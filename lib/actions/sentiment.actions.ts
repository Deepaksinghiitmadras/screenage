'use server';

import { getNews } from '@/lib/actions/finnhub.actions';
import { callAIProviderWithFallback } from '@/lib/ai-provider';

export type HeadlineTone = 'bullish' | 'bearish' | 'neutral';

export interface ScoredHeadline {
    headline: string;
    tone: HeadlineTone;
    source: string;
    url: string;
    datetime: number;
}

export interface HeadlineSentiment {
    symbol: string;
    total: number;
    bullish: number;
    bearish: number;
    neutral: number;
    /** 0-100, 50 = neutral */
    netScore: number;
    label: 'Bullish' | 'Bearish' | 'Neutral';
    why: string | null;
    headlines: ScoredHeadline[];
}

const BULLISH_TERMS = [
    'surge', 'surges', 'soar', 'soars', 'jump', 'jumps', 'rally', 'rallies', 'gain', 'gains',
    'rise', 'rises', 'rose', 'beat', 'beats', 'record', 'high', 'profit', 'profits', 'upgrade',
    'upgraded', 'outperform', 'buy', 'bullish', 'growth', 'strong', 'boost', 'boosts', 'wins',
    'win', 'expand', 'expansion', 'approval', 'approved', 'dividend', 'top', 'tops', 'climb',
    'climbs', 'rebound', 'optimistic', 'positive', 'breakout',
];

const BEARISH_TERMS = [
    'fall', 'falls', 'fell', 'drop', 'drops', 'plunge', 'plunges', 'slump', 'slumps', 'sink',
    'sinks', 'crash', 'crashes', 'loss', 'losses', 'miss', 'misses', 'downgrade', 'downgraded',
    'underperform', 'sell', 'bearish', 'weak', 'weakness', 'cut', 'cuts', 'decline', 'declines',
    'slide', 'slides', 'tumble', 'tumbles', 'warn', 'warns', 'warning', 'probe', 'fraud', 'lawsuit',
    'fine', 'fined', 'penalty', 'layoff', 'layoffs', 'default', 'low', 'lows', 'concern', 'concerns',
    'risk', 'negative', 'selloff', 'sell-off',
];

function scoreHeadline(text: string): HeadlineTone {
    const lower = ` ${text.toLowerCase()} `;
    let score = 0;
    for (const term of BULLISH_TERMS) {
        if (lower.includes(` ${term} `) || lower.includes(`${term},`) || lower.includes(`${term}.`)) score += 1;
    }
    for (const term of BEARISH_TERMS) {
        if (lower.includes(` ${term} `) || lower.includes(`${term},`) || lower.includes(`${term}.`)) score -= 1;
    }
    if (score > 0) return 'bullish';
    if (score < 0) return 'bearish';
    return 'neutral';
}

async function summariseWhy(symbol: string, headlines: ScoredHeadline[], label: string): Promise<string | null> {
    if (headlines.length === 0) return null;
    const list = headlines
        .slice(0, 12)
        .map((h) => `- [${h.tone}] ${h.headline}`)
        .join('\n');
    const prompt = `You are a markets analyst. Based ONLY on these recent news headlines for ${symbol}, write a concise 2-sentence explanation of why the aggregate headline sentiment is currently "${label}". Be specific and reference the themes in the headlines. Do not give investment advice or price targets. Plain text only, no markdown.\n\nHeadlines:\n${list}`;
    try {
        const reply = await callAIProviderWithFallback(prompt);
        return reply.trim().slice(0, 600) || null;
    } catch (err) {
        console.error('summariseWhy failed', err);
        return null;
    }
}

export async function getHeadlineSentiment(symbol: string): Promise<HeadlineSentiment | null> {
    let articles: MarketNewsArticle[] = [];
    try {
        articles = await getNews([symbol]);
    } catch (err) {
        console.error('getHeadlineSentiment: news fetch failed', err);
        return null;
    }

    const seen = new Set<string>();
    const scored: ScoredHeadline[] = [];
    for (const a of articles) {
        if (!a.headline) continue;
        const key = a.headline.toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);
        scored.push({
            headline: a.headline,
            tone: scoreHeadline(`${a.headline} ${a.summary ?? ''}`),
            source: a.source,
            url: a.url,
            datetime: a.datetime,
        });
        if (scored.length >= 20) break;
    }

    if (scored.length === 0) return null;

    const bullish = scored.filter((h) => h.tone === 'bullish').length;
    const bearish = scored.filter((h) => h.tone === 'bearish').length;
    const neutral = scored.length - bullish - bearish;
    const directional = bullish + bearish;
    const netScore = directional === 0 ? 50 : Math.round((bullish / directional) * 100);

    let label: HeadlineSentiment['label'] = 'Neutral';
    if (netScore >= 60) label = 'Bullish';
    else if (netScore <= 40) label = 'Bearish';

    const why = await summariseWhy(symbol, scored, label);

    return {
        symbol: symbol.toUpperCase(),
        total: scored.length,
        bullish,
        bearish,
        neutral,
        netScore,
        label,
        why,
        headlines: scored,
    };
}
