'use server';

/**
 * Stock comparison action — fetches the multi-factor scorecard (radar axes +
 * grade) and key fundamental metrics for up to 4 stocks in parallel, so the UI
 * can overlay their radars and compare metrics side-by-side. Research only.
 */

import { getStockScorecard } from '@/lib/actions/scorecard.actions';
import { getFundamentals } from '@/lib/actions/market.actions';

export async function getComparison(symbols: string[]): Promise<ComparisonStock[]> {
    const uniq = Array.from(
        new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
    ).slice(0, 4);

    const results = await Promise.all(
        uniq.map(async (sym): Promise<ComparisonStock> => {
            const [card, fund] = await Promise.all([getStockScorecard(sym), getFundamentals(sym)]);
            const m = fund?.metrics;
            return {
                symbol: sym,
                name: fund?.name ?? sym,
                available: card.available,
                grade: card.grade,
                composite: card.composite,
                axes: card.axes.map((a) => ({ key: a.key, label: a.label, score: a.score })),
                metrics: {
                    price: fund?.price ?? null,
                    marketCap: m?.marketCap ?? null,
                    trailingPE: m?.trailingPE ?? null,
                    priceToBook: m?.priceToBook ?? null,
                    roe: m?.roe ?? null,
                    profitMargin: m?.profitMargin ?? null,
                    debtToEquity: m?.debtToEquity ?? null,
                    revenueGrowth: m?.revenueGrowth ?? null,
                    beta: m?.beta ?? null,
                    dividendYield: m?.dividendYield ?? null,
                },
            };
        }),
    );

    return results;
}
