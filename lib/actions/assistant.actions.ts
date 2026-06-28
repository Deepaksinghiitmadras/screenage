'use server';

/**
 * Research Assistant — a conversational agent with persistent memory that ties
 * together the analysis tools (fundamentals, technicals, peers, screener,
 * options). It plans which tools to call, grounds the answer in real data, and
 * stores the conversation. Research/education only, not investment advice.
 */

import { connectToDatabase } from '@/database/mongoose';
import { ConversationModel, type ConversationMessage } from '@/database/models/conversation.model';
import { callAIProviderWithFallback } from '@/lib/ai-provider';
import { getFundamentals } from './market.actions';
import { getTechnicalSignals } from './technical.actions';
import { getPeerComparison } from './screener.actions';
import { runAIScreener } from './screener.actions';
import { getOptionChain } from './options.actions';

const MAX_CONTEXT_MESSAGES = 8;

type SerializedConversation = {
    _id: string;
    title: string;
    messages: { role: 'user' | 'assistant'; content: string; createdAt: string }[];
    updatedAt: string;
};

function serialize(doc: unknown): SerializedConversation {
    return JSON.parse(JSON.stringify(doc));
}

const n = (v: number | null | undefined, d = 2) =>
    v === null || v === undefined || Number.isNaN(v) ? 'n/a' : v.toFixed(d);

// --- Conversation CRUD -------------------------------------------------------

export async function listConversations(userId: string): Promise<SerializedConversation[]> {
    await connectToDatabase();
    const docs = await ConversationModel.find({ userId }, { messages: { $slice: -1 } })
        .sort({ updatedAt: -1 })
        .limit(30)
        .lean();
    return serialize(docs);
}

export async function getConversation(id: string, userId: string): Promise<SerializedConversation | null> {
    await connectToDatabase();
    const doc = await ConversationModel.findOne({ _id: id, userId }).lean();
    return doc ? serialize(doc) : null;
}

export async function deleteConversation(id: string, userId: string): Promise<{ success: boolean }> {
    await connectToDatabase();
    await ConversationModel.deleteOne({ _id: id, userId });
    return { success: true };
}

export async function renameConversation(
    id: string,
    userId: string,
    title: string,
): Promise<{ success: boolean }> {
    await connectToDatabase();
    const clean = title.trim().slice(0, 80);
    if (!clean) return { success: false };
    await ConversationModel.updateOne({ _id: id, userId }, { $set: { title: clean } });
    return { success: true };
}

// --- Planner -----------------------------------------------------------------

type Plan = {
    intent: 'stock_analysis' | 'compare' | 'screener' | 'options' | 'general';
    symbols: string[];
    screenerQuery?: string;
    optionsSymbol?: string;
};

function buildPlannerPrompt(message: string): string {
    return `You route an Indian stock-market question to data tools. Map company names to NSE tickers (e.g. "Reliance"->RELIANCE, "Tata Motors"->TMPV, "HDFC Bank"->HDFCBANK, "Nifty"->NIFTY).

Return ONLY minified JSON: {"intent":"stock_analysis|compare|screener|options|general","symbols":["TICKER"],"screenerQuery":"...","optionsSymbol":"..."}

Guidance:
- stock_analysis: a question about one stock (analysis, fundamentals, technicals, outlook). Put its ticker in symbols.
- compare: comparing 2+ stocks or asking about peers. Put all tickers in symbols (max 4).
- screener: finding/filtering stocks by criteria. Set screenerQuery to a concise screen description.
- options: option chain, PCR, max pain, IV, open interest. Set optionsSymbol (NIFTY/BANKNIFTY/FINNIFTY or a stock ticker).
- general: greetings, definitions, or anything not needing live data. symbols = [].

Question: "${message}"`;
}

function parsePlan(raw: string): Plan {
    try {
        let t = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
        const a = t.indexOf('{');
        const b = t.lastIndexOf('}');
        if (a !== -1 && b !== -1) t = t.slice(a, b + 1);
        const p = JSON.parse(t) as Partial<Plan>;
        const intent = (['stock_analysis', 'compare', 'screener', 'options', 'general'] as const).includes(p.intent as Plan['intent'])
            ? (p.intent as Plan['intent'])
            : 'general';
        const symbols = Array.isArray(p.symbols)
            ? p.symbols.map((s) => String(s).toUpperCase().trim()).filter(Boolean).slice(0, 4)
            : [];
        return { intent, symbols, screenerQuery: p.screenerQuery, optionsSymbol: p.optionsSymbol };
    } catch {
        return { intent: 'general', symbols: [] };
    }
}

// --- Tool execution -> compact context ---------------------------------------

async function gatherContext(plan: Plan): Promise<string> {
    const parts: string[] = [];

    if (plan.intent === 'screener') {
        const res = await runAIScreener(plan.screenerQuery || '');
        if (res.available) {
            parts.push(`SCREENER (${res.interpreted ?? 'results'}) — top matches:`);
            for (const r of res.rows.slice(0, 12)) {
                parts.push(`- ${r.symbol} ${r.name}: P/E ${n(r.trailingPE)}, ROE ${n(r.roe)}%, margin ${n(r.profitMargin)}%, D/E ${n(r.debtToEquity)}, divYld ${n(r.dividendYield)}%, mcap ${n((r.marketCap ?? 0) / 1e7, 0)}cr`);
            }
        } else {
            parts.push(`SCREENER: ${res.error ?? 'no results'}`);
        }
        return parts.join('\n');
    }

    if (plan.intent === 'options') {
        const sym = (plan.optionsSymbol || plan.symbols[0] || 'NIFTY').toUpperCase();
        const oc = await getOptionChain(sym);
        if (oc.available) {
            parts.push(`OPTION CHAIN ${oc.symbol} (expiry ${oc.expiry}): spot ${n(oc.underlying)}, ATM ${oc.atmStrike}, PCR ${n(oc.pcr)}, Max Pain ${oc.maxPain}, total Call OI ${n(oc.totalCeOi, 0)}, total Put OI ${n(oc.totalPeOi, 0)}.`);
        } else {
            parts.push(`OPTION CHAIN ${sym}: ${oc.error ?? 'unavailable'}`);
        }
        return parts.join('\n');
    }

    // stock_analysis / compare: fundamentals + technicals per symbol; peers for first.
    const syms = plan.symbols.slice(0, plan.intent === 'compare' ? 4 : 2);
    for (const sym of syms) {
        const [f, tech] = await Promise.all([getFundamentals(sym), getTechnicalSignals(sym)]);
        if (f) {
            const m = f.metrics;
            parts.push(
                `FUNDAMENTALS ${sym} (${f.name}): price ₹${n(f.price)} (${n(f.changePercent)}%), P/E ${n(m.trailingPE)}, P/B ${n(m.priceToBook)}, ROE ${n(m.roe)}%, margin ${n(m.profitMargin)}%, rev growth ${n(m.revenueGrowth)}%, D/E ${n(m.debtToEquity)}, divYld ${n(m.dividendYield)}%, 52w ₹${n(f.fiftyTwoWeekLow)}-₹${n(f.fiftyTwoWeekHigh)}, sector ${f.sector ?? 'n/a'}.`,
            );
        } else {
            parts.push(`FUNDAMENTALS ${sym}: not available.`);
        }
        if (tech.available) {
            parts.push(
                `TECHNICALS ${sym}: score ${tech.score}/100 (${tech.bias}), regime ${tech.regime}${tech.forecast ? `, 30d projection ${tech.forecast.expectedReturnPct >= 0 ? '+' : ''}${tech.forecast.expectedReturnPct}% (vol ${tech.forecast.annualizedVolPct}%)` : ''}.`,
            );
        }
    }

    if (plan.intent === 'compare' && syms.length >= 1) {
        const peers = await getPeerComparison(syms[0]);
        if (peers.available) {
            parts.push(`PEERS (${peers.sector}):`);
            for (const r of peers.rows.slice(0, 8)) {
                parts.push(`- ${r.symbol}: P/E ${n(r.trailingPE)}, ROE ${n(r.roe)}%, margin ${n(r.profitMargin)}%, D/E ${n(r.debtToEquity)}`);
            }
        }
    }

    return parts.join('\n');
}

function buildAnswerPrompt(history: ConversationMessage[], dataContext: string, message: string, language = 'English'): string {
    const convo = history
        .slice(-MAX_CONTEXT_MESSAGES)
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

    const langLine =
        language && language !== 'English'
            ? `Respond entirely in ${language} (including the follow-up questions). Keep stock tickers, numbers and currency symbols (₹) as-is.\n\n`
            : '';

    return `You are "Screenage Assistant", a research assistant for the Indian stock market (NSE/BSE). You help users analyse and research stocks. Be concise, objective and balanced. Use ₹ for prices. Always ground claims in the DATA provided. If data is missing, say so. End material answers with a brief reminder that this is research/education, not investment advice. Never give direct buy/sell financial advice; frame as observations and considerations.

${langLine}Format your answer in clean Markdown: use **bold** for key figures, short bullet lists where helpful, and short paragraphs. Do NOT use level-1 headings.

After the answer and the disclaimer, output exactly one final line that starts with "FOLLOWUPS:" followed by 2-3 short, specific follow-up questions the user might ask next, separated by " | ". Keep each question under 8 words. Example:
FOLLOWUPS: How does it compare to peers? | What are the key risks? | Show the option chain

${dataContext ? `DATA (delayed, fetched for this question):\n${dataContext}\n` : 'No live data was fetched for this question.\n'}
${convo ? `CONVERSATION SO FAR:\n${convo}\n` : ''}
User: ${message}
Assistant:`;
}

/**
 * Split a raw model reply into the visible answer and any FOLLOWUPS line.
 */
function extractFollowups(raw: string): { reply: string; followups: string[] } {
    const lines = raw.split('\n');
    const idx = lines.findIndex((l) => /^\s*FOLLOWUPS\s*:/i.test(l));
    if (idx === -1) return { reply: raw.trim(), followups: [] };
    const followLine = lines[idx].replace(/^\s*FOLLOWUPS\s*:/i, '').trim();
    const followups = followLine
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3);
    const reply = lines.slice(0, idx).join('\n').trim();
    return { reply, followups };
}

// --- Send a message (the agent loop) -----------------------------------------

export async function sendAssistantMessage(
    conversationId: string | null,
    userId: string,
    message: string,
    language = 'English',
): Promise<{ conversationId: string; reply: string; followups: string[] }> {
    const text = message.trim();
    if (!text) throw new Error('Empty message');

    await connectToDatabase();

    let conversation =
        conversationId != null
            ? await ConversationModel.findOne({ _id: conversationId, userId })
            : null;
    if (!conversation) {
        conversation = await ConversationModel.create({
            userId,
            title: text.slice(0, 48),
            messages: [],
        });
    }

    const history = [...conversation.messages];
    conversation.messages.push({ role: 'user', content: text, createdAt: new Date() });

    let reply: string;
    let followups: string[] = [];
    try {
        const plan = parsePlan(await callAIProviderWithFallback(buildPlannerPrompt(text)));
        const dataContext = plan.intent === 'general' ? '' : await gatherContext(plan);
        const raw = (await callAIProviderWithFallback(buildAnswerPrompt(history, dataContext, text, language))).trim();
        const parsed = extractFollowups(raw);
        reply = parsed.reply;
        followups = parsed.followups;
    } catch (err) {
        console.error('Assistant failed:', err);
        reply = 'Sorry — I had trouble answering that just now. Please try again.';
    }

    conversation.messages.push({ role: 'assistant', content: reply, createdAt: new Date() });
    await conversation.save();

    return { conversationId: String(conversation._id), reply, followups };
}
