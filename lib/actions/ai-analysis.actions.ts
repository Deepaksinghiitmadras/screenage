'use server';

/**
 * AI stock analysis (Phase A) — generates a structured, research-only verdict
 * for a single stock by grounding an LLM in our own fundamentals + price
 * history. Output is cached per-symbol to keep token usage low.
 *
 * NOT investment advice. For research/education only.
 */

import { callAIProviderWithFallback } from '@/lib/ai-provider';
import { getFundamentals, getHistory } from './market.actions';

const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const analysisCache = new Map<string, { at: number; data: StockAIAnalysis }>();

const num = (v: number | null | undefined, digits = 2): string =>
    v === null || v === undefined || Number.isNaN(v) ? 'n/a' : v.toFixed(digits);

function sma(closes: number[], period: number): number | null {
    if (closes.length < period) return null;
    const slice = closes.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

function buildPrompt(f: StockFundamentals, derived: Record<string, string>): string {
    const m = f.metrics;
    const a = f.analyst;
    return `You are an equity research assistant for the Indian stock market. Analyse the stock below using ONLY the provided data. Be objective and balanced. This is for research and education, NOT investment advice.

Return ONLY a valid minified JSON object (no markdown, no code fences) with EXACTLY these keys:
{"stance":"Bullish|Bearish|Neutral","confidence":"Low|Medium|High","thesis":"one sentence","strengths":["..."],"risks":["..."],"technical":"2-3 sentences on trend and key levels","valuation":"1-2 sentences on whether valuation looks cheap/fair/expensive","whatToWatch":["..."]}

Rules:
- strengths, risks and whatToWatch: 2-4 short bullet strings each, grounded in the numbers.
- Reference concrete figures (P/E, ROE, growth, debt, 52W position) where relevant.
- Do not invent data not provided. If something is "n/a", do not claim it.
- Keep it concise.

COMPANY: ${f.name} (${f.symbol}) — ${[f.sector, f.industry].filter(Boolean).join(' / ') || 'n/a'}
PRICE: ₹${num(f.price)} (${num(f.changePercent)}% today)
52-WEEK RANGE: ₹${num(f.fiftyTwoWeekLow)} – ₹${num(f.fiftyTwoWeekHigh)} | current position: ${derived.range52Pos}
VALUATION: P/E ${num(m.trailingPE)}, Forward P/E ${num(m.forwardPE)}, P/B ${num(m.priceToBook)}, PEG ${num(m.pegRatio)}, EPS ₹${num(m.eps)}, Dividend Yield ${num(m.dividendYield)}%
PROFITABILITY: ROE ${num(m.roe)}%, ROA ${num(m.roa)}%, Profit Margin ${num(m.profitMargin)}%, Operating Margin ${num(m.operatingMargin)}%
GROWTH: Revenue Growth ${num(m.revenueGrowth)}%, Earnings Growth ${num(m.earningsGrowth)}%
BALANCE SHEET: Debt/Equity ${num(m.debtToEquity)}, Current Ratio ${num(m.currentRatio)}, Beta ${num(m.beta)}
ANALYSTS: consensus ${a.recommendation ?? 'n/a'}, target mean ₹${num(a.targetMean)} (range ₹${num(a.targetLow)}–₹${num(a.targetHigh)}), covered by ${num(a.numberOfAnalysts, 0)}
TECHNICALS (6mo): last ₹${derived.last}, SMA20 ₹${derived.sma20}, SMA50 ₹${derived.sma50}, trend ${derived.trend}, 1mo change ${derived.change1mo}%`;
}

function parseAnalysis(raw: string, f: StockFundamentals): StockAIAnalysis {
    let text = raw.trim();
    // Strip code fences if the model added them.
    text = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    // Extract the first {...} block.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) text = text.slice(start, end + 1);

    const parsed = JSON.parse(text) as Partial<StockAIAnalysis>;
    const stance: AIAnalysisStance =
        parsed.stance === 'Bullish' || parsed.stance === 'Bearish' ? parsed.stance : 'Neutral';
    const confidence: AIAnalysisConfidence =
        parsed.confidence === 'High' || parsed.confidence === 'Low' ? parsed.confidence : 'Medium';
    const arr = (v: unknown): string[] =>
        Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean).slice(0, 5) : [];

    return {
        available: true,
        symbol: f.symbol,
        name: f.name,
        stance,
        confidence,
        thesis: typeof parsed.thesis === 'string' ? parsed.thesis : '',
        strengths: arr(parsed.strengths),
        risks: arr(parsed.risks),
        technical: typeof parsed.technical === 'string' ? parsed.technical : '',
        valuation: typeof parsed.valuation === 'string' ? parsed.valuation : '',
        whatToWatch: arr(parsed.whatToWatch),
        generatedAt: new Date().toISOString(),
    };
}

export async function getStockAIAnalysis(symbol: string): Promise<StockAIAnalysis> {
    const key = symbol.trim().toUpperCase();

    const cached = analysisCache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        return cached.data;
    }

    const [fundamentals, history] = await Promise.all([
        getFundamentals(symbol),
        getHistory(symbol, '6mo'),
    ]);

    if (!fundamentals) {
        return { available: false, symbol: key, error: 'No fundamental data available for this symbol.' };
    }

    const closes = history.candles.map((c) => c.close);
    const last = closes.length ? closes[closes.length - 1] : fundamentals.price ?? 0;
    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);
    const monthAgo = closes.length > 21 ? closes[closes.length - 22] : closes[0];
    const change1mo = monthAgo ? ((last - monthAgo) / monthAgo) * 100 : 0;
    const low = fundamentals.fiftyTwoWeekLow;
    const high = fundamentals.fiftyTwoWeekHigh;
    const range52Pos =
        low != null && high != null && high > low
            ? `${(((last - low) / (high - low)) * 100).toFixed(0)}% of range`
            : 'n/a';
    const trend =
        sma20 != null && sma50 != null
            ? sma20 > sma50
                ? 'short-term above medium-term (uptrend)'
                : 'short-term below medium-term (downtrend)'
            : 'n/a';

    const derived: Record<string, string> = {
        last: num(last),
        sma20: num(sma20),
        sma50: num(sma50),
        trend,
        change1mo: num(change1mo),
        range52Pos,
    };

    try {
        const raw = await callAIProviderWithFallback(buildPrompt(fundamentals, derived));
        const data = parseAnalysis(raw, fundamentals);
        analysisCache.set(key, { at: Date.now(), data });
        return data;
    } catch (err) {
        console.error('AI analysis failed for', key, err);
        return {
            available: false,
            symbol: key,
            name: fundamentals.name,
            error: 'The AI analysis could not be generated right now. Please try again.',
        };
    }
}
