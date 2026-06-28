'use server';

/**
 * Market data actions backed by the Python `market-service` (yfinance + nselib).
 * Data is for research/analysis only (delayed quotes), not live trading.
 */

const MARKET_SERVICE_URL = process.env.MARKET_SERVICE_URL ?? 'http://127.0.0.1:8000';

async function fetchMarket<T>(path: string, revalidateSeconds: number, fallback: T): Promise<T> {
    try {
        const res = await fetch(`${MARKET_SERVICE_URL}${path}`, {
            next: { revalidate: revalidateSeconds },
        });
        if (!res.ok) {
            console.error(`market-service ${path} failed: ${res.status}`);
            return fallback;
        }
        return (await res.json()) as T;
    } catch (err) {
        console.error(`market-service ${path} unreachable:`, err);
        return fallback;
    }
}

export async function getIndices(): Promise<MarketIndex[]> {
    const data = await fetchMarket<{ indices: MarketIndex[] }>(
        '/indices',
        60,
        { indices: [] },
    );
    return data.indices;
}

export async function getMovers(): Promise<MarketMovers> {
    return fetchMarket<MarketMovers>(
        '/movers',
        120,
        { gainers: [], losers: [], mostActive: [] },
    );
}

export async function getHeatmap(): Promise<HeatmapCell[]> {
    const data = await fetchMarket<{ cells: HeatmapCell[] }>(
        '/heatmap',
        120,
        { cells: [] },
    );
    return data.cells;
}

export async function getMarketNews(limit = 12): Promise<MarketNewsItem[]> {
    const data = await fetchMarket<{ articles: MarketNewsItem[] }>(
        `/news?limit=${limit}`,
        300,
        { articles: [] },
    );
    return data.articles;
}

export async function getEconomicCalendar(days = 7): Promise<MarketCalendarEvent[]> {
    const data = await fetchMarket<{ events: MarketCalendarEvent[] }>(
        `/calendar?days=${days}`,
        900,
        { events: [] },
    );
    return data.events;
}

export async function getFundamentals(symbol: string): Promise<StockFundamentals | null> {
    const clean = encodeURIComponent(symbol.trim().toUpperCase());
    return fetchMarket<StockFundamentals | null>(
        `/fundamentals/${clean}`,
        900,
        null,
    );
}

export async function getHistory(symbol: string, range = '6mo'): Promise<StockHistory> {
    const clean = encodeURIComponent(symbol.trim().toUpperCase());
    return fetchMarket<StockHistory>(
        `/history/${clean}?range=${encodeURIComponent(range)}`,
        300,
        { symbol: symbol.toUpperCase(), range, candles: [] },
    );
}

export async function getQuotes(symbols: string[]): Promise<WatchlistQuote[]> {
    const list = symbols.map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (list.length === 0) return [];
    const param = encodeURIComponent(list.join(','));
    const data = await fetchMarket<{ quotes: WatchlistQuote[] }>(
        `/quotes?symbols=${param}`,
        60,
        { quotes: [] },
    );
    return data.quotes;
}
