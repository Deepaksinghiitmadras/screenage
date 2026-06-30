'use server';

/**
 * Multi-factor stock "investability" scorecard — blends our technical signals
 * with fundamental ratios into six normalized 0-100 axes (Trend, Momentum,
 * Value, Quality, Growth, Low-Risk) for a radar/scorecard view. Each axis has a
 * transparent rationale. Research/education only — not investment advice.
 */

import { getTechnicalSignals } from './technical.actions';
import { getFundamentals } from './market.actions';

/** Map a value to a 0-100 score using ascending [threshold, score] bands. */
function bandScore(value: number | null | undefined, bands: [number, number][], lowerIsBetter = false): number | null {
    if (value == null || Number.isNaN(value)) return null;
    const ordered = lowerIsBetter ? bands : [...bands].reverse();
    for (const [threshold, score] of ordered) {
        if (lowerIsBetter ? value <= threshold : value >= threshold) return score;
    }
    return lowerIsBetter ? 5 : 5;
}

/** Average the non-null scores. */
function avg(scores: (number | null)[]): number | null {
    const valid = scores.filter((s): s is number => s != null);
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

const fmtNum = (v: number | null | undefined, suffix = '', d = 1): string =>
    v == null || Number.isNaN(v) ? '—' : `${v.toFixed(d)}${suffix}`;

/** Score a technical category by its bull/bear indicator balance. */
function categoryScore(indicators: TechnicalIndicator[], category: TechnicalCategory): number | null {
    const items = indicators.filter((i) => (i.category ?? 'Trend') === category);
    if (items.length === 0) return null;
    let net = 0;
    for (const i of items) net += i.signal === 'bull' ? 1 : i.signal === 'bear' ? -1 : 0;
    return Math.round(Math.max(0, Math.min(100, 50 + (net / items.length) * 50)));
}

function gradeFor(score: number): string {
    if (score >= 85) return 'A+';
    if (score >= 75) return 'A';
    if (score >= 65) return 'B+';
    if (score >= 55) return 'B';
    if (score >= 45) return 'C+';
    if (score >= 35) return 'C';
    return 'D';
}

export async function getStockScorecard(symbol: string): Promise<StockScorecard> {
    const sym = symbol.trim().toUpperCase();
    const [tech, fund] = await Promise.all([getTechnicalSignals(sym), getFundamentals(sym)]);

    if (!tech.available && !fund) {
        return { symbol: sym, available: false, composite: 0, grade: 'D', axes: [], error: 'Not enough data to score this stock.' };
    }

    const m = fund?.metrics;
    const axes: ScorecardAxis[] = [];

    // --- Trend ---------------------------------------------------------------
    {
        const score = tech.available ? categoryScore(tech.indicators, 'Trend') : null;
        const mtfBull = (tech.multiTimeframe ?? []).filter((t) => t.signal === 'bull').length;
        axes.push({
            key: 'trend', label: 'Trend', score, weight: 0.2,
            summary: score == null ? 'No trend data' : score >= 60 ? 'Uptrend structure' : score <= 40 ? 'Downtrend structure' : 'Sideways',
            factors: [
                { label: 'Regime', value: tech.regime },
                { label: 'Timeframes bullish', value: `${mtfBull}/${(tech.multiTimeframe ?? []).length}` },
            ],
        });
    }

    // --- Momentum ------------------------------------------------------------
    {
        const score = tech.available ? categoryScore(tech.indicators, 'Momentum') : null;
        const dailyRsi = (tech.multiTimeframe ?? []).find((t) => t.timeframe === 'Daily')?.rsi ?? null;
        axes.push({
            key: 'momentum', label: 'Momentum', score, weight: 0.15,
            summary: score == null ? 'No momentum data' : score >= 60 ? 'Positive momentum' : score <= 40 ? 'Weak momentum' : 'Mixed',
            factors: [
                { label: 'RSI (daily)', value: fmtNum(dailyRsi) },
                { label: 'Composite bias', value: tech.bias },
            ],
        });
    }

    // --- Value ---------------------------------------------------------------
    {
        const pe = bandScore(m?.trailingPE, [[10, 100], [15, 85], [25, 65], [40, 45], [60, 25]], true);
        const pb = bandScore(m?.priceToBook, [[1, 100], [2, 80], [4, 60], [8, 40]], true);
        const peg = bandScore(m?.pegRatio, [[1, 100], [2, 70], [3, 45]], true);
        const score = avg([pe, pb, peg]);
        axes.push({
            key: 'value', label: 'Value', score, weight: 0.15,
            summary: score == null ? 'No valuation data' : score >= 60 ? 'Attractively valued' : score <= 40 ? 'Richly valued' : 'Fairly valued',
            factors: [
                { label: 'P/E', value: fmtNum(m?.trailingPE) },
                { label: 'P/B', value: fmtNum(m?.priceToBook) },
                { label: 'PEG', value: fmtNum(m?.pegRatio, '', 2) },
            ],
        });
    }

    // --- Quality -------------------------------------------------------------
    {
        const roe = bandScore(m?.roe, [[5, 25], [10, 50], [15, 65], [25, 85], [100, 100]]);
        const margin = bandScore(m?.profitMargin, [[0, 20], [5, 40], [10, 60], [20, 80], [100, 100]]);
        const de = bandScore(m?.debtToEquity, [[30, 100], [60, 80], [100, 60], [150, 40], [250, 25]], true);
        const cr = bandScore(m?.currentRatio, [[1, 40], [1.5, 65], [2, 85], [5, 100]]);
        const score = avg([roe, margin, de, cr]);
        axes.push({
            key: 'quality', label: 'Quality', score, weight: 0.2,
            summary: score == null ? 'No quality data' : score >= 60 ? 'Strong fundamentals' : score <= 40 ? 'Weak fundamentals' : 'Average quality',
            factors: [
                { label: 'ROE', value: fmtNum(m?.roe, '%') },
                { label: 'Profit margin', value: fmtNum(m?.profitMargin, '%') },
                { label: 'Debt/Equity', value: fmtNum(m?.debtToEquity) },
            ],
        });
    }

    // --- Growth --------------------------------------------------------------
    {
        const rev = bandScore(m?.revenueGrowth, [[0, 15], [8, 45], [15, 65], [25, 85], [100, 100]]);
        const earn = bandScore(m?.earningsGrowth, [[0, 15], [8, 45], [15, 65], [25, 85], [200, 100]]);
        const score = avg([rev, earn]);
        axes.push({
            key: 'growth', label: 'Growth', score, weight: 0.15,
            summary: score == null ? 'No growth data' : score >= 60 ? 'Fast growing' : score <= 40 ? 'Slow/declining' : 'Moderate growth',
            factors: [
                { label: 'Revenue growth', value: fmtNum(m?.revenueGrowth, '%') },
                { label: 'Earnings growth', value: fmtNum(m?.earningsGrowth, '%') },
            ],
        });
    }

    // --- Low Risk ------------------------------------------------------------
    {
        const betaScore = bandScore(m?.beta, [[0.7, 100], [0.9, 85], [1.1, 65], [1.4, 45]], true);
        const volScore = tech.regime === 'High Volatility' ? 25 : tech.regime === 'Ranging' ? 75 : 60;
        const score = avg([betaScore, volScore]);
        axes.push({
            key: 'lowRisk', label: 'Low Risk', score, weight: 0.15,
            summary: score == null ? 'No risk data' : score >= 60 ? 'Lower risk profile' : score <= 40 ? 'Higher risk' : 'Moderate risk',
            factors: [
                { label: 'Beta', value: fmtNum(m?.beta, '', 2) },
                { label: 'Volatility regime', value: tech.regime },
            ],
        });
    }

    // Default equal-weight composite over available axes.
    const composite = avg(axes.map((a) => a.score)) ?? 0;

    return {
        symbol: sym,
        available: true,
        composite,
        grade: gradeFor(composite),
        axes,
    };
}
