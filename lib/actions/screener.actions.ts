'use server';

/**
 * AI screener + peer comparison (Phase B). Backed by the market-service
 * `/screener` batch endpoint (concurrent yfinance fundamentals). Research only.
 */

import { callAIProviderWithFallback } from '@/lib/ai-provider';
import { getPeerGroup, SCREENER_UNIVERSE } from '@/lib/sector-peers';
import { connectToDatabase } from '@/database/mongoose';
import { ScreenerHistoryModel } from '@/database/models/screenerHistory.model';

const MARKET_SERVICE_URL = process.env.MARKET_SERVICE_URL ?? 'http://127.0.0.1:8000';

const ALLOWED_METRICS = [
    'price', 'changePercent', 'marketCap', 'trailingPE', 'forwardPE',
    'priceToBook', 'pegRatio', 'roe', 'roa', 'profitMargin', 'operatingMargin',
    'revenueGrowth', 'earningsGrowth', 'debtToEquity', 'dividendYield', 'beta',
] as const;

async function fetchScreenerStocks(symbols: string[]): Promise<ScreenerStock[]> {
    if (symbols.length === 0) return [];
    const query = encodeURIComponent(symbols.join(','));
    try {
        const res = await fetch(`${MARKET_SERVICE_URL}/screener?symbols=${query}`, {
            next: { revalidate: 600 },
            signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
            console.error('market-service /screener failed:', res.status);
            return [];
        }
        const data = (await res.json()) as { stocks: ScreenerStock[] };
        return data.stocks ?? [];
    } catch (err) {
        console.error('market-service /screener unreachable:', err);
        return [];
    }
}

/** Fundamentals for the whole curated universe (used by themed collections). */
export async function getScreenerUniverse(): Promise<ScreenerStock[]> {
    return fetchScreenerStocks(SCREENER_UNIVERSE);
}

// --- Peer comparison ---------------------------------------------------------

export async function getPeerComparison(symbol: string): Promise<PeerComparison> {
    const base = symbol.trim().toUpperCase();
    const group = getPeerGroup(base);

    if (!group) {
        return { available: false, sector: null, base, rows: [], error: 'No curated peer group for this stock yet.' };
    }

    const rows = await fetchScreenerStocks(group.symbols);
    if (rows.length === 0) {
        return { available: false, sector: group.name, base, rows: [], error: 'Peer data is temporarily unavailable.' };
    }

    // Sort by market cap (largest first), keeping the base stock discoverable.
    rows.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
    return { available: true, sector: group.name, base, rows };
}

// --- AI screener -------------------------------------------------------------

function buildScreenerPrompt(query: string): string {
    return `You convert a natural-language Indian-stock screening request into a strict JSON filter spec.

Allowed metric keys (use EXACTLY these): ${ALLOWED_METRICS.join(', ')}.
Units: percentages are plain numbers (ROE 15% -> 15, dividendYield 3% -> 3). marketCap is in absolute INR. price is in INR. ratios (trailingPE, priceToBook, pegRatio, debtToEquity, beta) are plain numbers.

Return ONLY minified JSON (no markdown) with this shape:
{"filters":[{"metric":"<key>","operator":"<|<=|>|>=","value":<number>}],"sortBy":"<key>","sortDir":"asc|desc","interpreted":"<one short sentence describing the screen>"}

Rules:
- Map vague terms to numeric thresholds (e.g. "cheap"/"undervalued" -> trailingPE < 20; "high ROE" -> roe > 18; "low debt" -> debtToEquity < 50; "high dividend" -> dividendYield > 3; "large cap" -> marketCap > 500000000000; "profitable" -> profitMargin > 10; "growing" -> revenueGrowth > 10).
- Use 1-4 filters. Pick a sensible sortBy + sortDir (default: a primary metric from the request, descending for "high/best", ascending for "cheap/low").
- Do not invent metrics outside the allowed list.

Request: "${query}"`;
}

function parseCriteria(raw: string): ScreenerCriteria & { interpreted?: string } {
    let text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) text = text.slice(start, end + 1);

    const parsed = JSON.parse(text) as Partial<ScreenerCriteria> & { interpreted?: string };
    const allowed = new Set<string>(ALLOWED_METRICS);
    const ops = new Set(['<', '<=', '>', '>=']);

    const filters: ScreenerFilter[] = Array.isArray(parsed.filters)
        ? parsed.filters
              .filter(
                  (f): f is ScreenerFilter =>
                      !!f &&
                      allowed.has(String(f.metric)) &&
                      ops.has(String(f.operator)) &&
                      typeof f.value === 'number' &&
                      !Number.isNaN(f.value),
              )
              .slice(0, 4)
        : [];

    const sortBy = parsed.sortBy && allowed.has(String(parsed.sortBy)) ? String(parsed.sortBy) : undefined;
    const sortDir = parsed.sortDir === 'asc' || parsed.sortDir === 'desc' ? parsed.sortDir : 'desc';

    return { filters, sortBy, sortDir, interpreted: parsed.interpreted };
}

function applyFilters(stocks: ScreenerStock[], criteria: ScreenerCriteria): ScreenerStock[] {
    const matched = stocks.filter((s) =>
        criteria.filters.every((f) => {
            const v = s[f.metric as keyof ScreenerStock];
            if (typeof v !== 'number' || Number.isNaN(v)) return false;
            switch (f.operator) {
                case '<': return v < f.value;
                case '<=': return v <= f.value;
                case '>': return v > f.value;
                case '>=': return v >= f.value;
                default: return false;
            }
        }),
    );

    if (criteria.sortBy) {
        const key = criteria.sortBy as keyof ScreenerStock;
        const dir = criteria.sortDir === 'asc' ? 1 : -1;
        matched.sort((a, b) => {
            const av = a[key];
            const bv = b[key];
            const an = typeof av === 'number' ? av : dir === 1 ? Infinity : -Infinity;
            const bn = typeof bv === 'number' ? bv : dir === 1 ? Infinity : -Infinity;
            return (an - bn) * dir;
        });
    }

    return matched.slice(0, 25);
}

export async function runAIScreener(query: string): Promise<ScreenerResult> {
    const clean = query.trim();
    if (!clean) {
        return { available: false, query: '', rows: [], error: 'Please enter what you want to screen for.' };
    }

    let criteria: ScreenerCriteria & { interpreted?: string };
    try {
        const raw = await callAIProviderWithFallback(buildScreenerPrompt(clean));
        criteria = parseCriteria(raw);
    } catch (err) {
        console.error('AI screener parse failed:', err);
        return { available: false, query: clean, rows: [], error: 'Could not interpret that screen. Try rephrasing.' };
    }

    if (criteria.filters.length === 0) {
        return { available: false, query: clean, rows: [], error: 'No valid filters could be derived. Try being more specific.' };
    }

    const universe = await fetchScreenerStocks(SCREENER_UNIVERSE);
    const rows = applyFilters(universe, criteria);

    return {
        available: true,
        query: clean,
        interpreted: criteria.interpreted,
        criteria,
        rows,
    };
}

// --- Saved screener history --------------------------------------------------

export type ScreenerHistoryItem = {
    _id: string;
    query: string;
    interpreted?: string;
    matches: number;
    result: ScreenerResult;
    updatedAt: string;
};

/**
 * Run the screener and persist the result for the user. If the same query was
 * run recently (within 12h), the cached result is reused to save LLM cost.
 */
export async function runAndSaveScreener(
    userId: string,
    query: string,
): Promise<{ result: ScreenerResult; historyId: string | null; cached: boolean }> {
    const clean = query.trim();
    if (!clean) {
        return {
            result: { available: false, query: '', rows: [], error: 'Please enter what you want to screen for.' },
            historyId: null,
            cached: false,
        };
    }

    await connectToDatabase();

    // Reuse a recent identical run to avoid a redundant LLM call.
    const recent = await ScreenerHistoryModel.findOne({
        userId,
        query: clean,
        updatedAt: { $gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
    })
        .sort({ updatedAt: -1 })
        .lean();

    if (recent) {
        return {
            result: (recent as { result: ScreenerResult }).result,
            historyId: String((recent as { _id: unknown })._id),
            cached: true,
        };
    }

    const result = await runAIScreener(clean);

    let historyId: string | null = null;
    if (result.available) {
        const doc = await ScreenerHistoryModel.create({
            userId,
            query: clean,
            interpreted: result.interpreted,
            result,
            matches: result.rows.length,
        });
        historyId = String(doc._id);
    }

    return { result, historyId, cached: false };
}

export async function listScreenerHistory(userId: string): Promise<ScreenerHistoryItem[]> {
    await connectToDatabase();
    const docs = await ScreenerHistoryModel.find(
        { userId },
        { query: 1, interpreted: 1, matches: 1, result: 1, updatedAt: 1 },
    )
        .sort({ updatedAt: -1 })
        .limit(30)
        .lean();
    return JSON.parse(JSON.stringify(docs)) as ScreenerHistoryItem[];
}

export async function deleteScreenerHistory(id: string, userId: string): Promise<{ success: boolean }> {
    await connectToDatabase();
    await ScreenerHistoryModel.deleteOne({ _id: id, userId });
    return { success: true };
}
