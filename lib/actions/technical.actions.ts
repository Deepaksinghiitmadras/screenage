'use server';

/**
 * Technical signal scanner + statistical price forecast (Phase: technicals).
 * Everything is computed in TypeScript from the daily candles we already fetch
 * (no extra infra). Research/education only — not investment advice.
 */

import { getHistory } from './market.actions';
import { SECTOR_GROUPS, SCREENER_UNIVERSE } from '@/lib/sector-peers';

const MARKET_SERVICE_URL = process.env.MARKET_SERVICE_URL ?? 'http://127.0.0.1:8000';

// --- Indicator math ----------------------------------------------------------

function sma(values: number[], period: number): number | null {
    if (values.length < period) return null;
    const slice = values.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

function emaSeries(values: number[], period: number): number[] {
    if (values.length === 0) return [];
    const k = 2 / (period + 1);
    const out: number[] = [values[0]];
    for (let i = 1; i < values.length; i++) {
        out.push(values[i] * k + out[i - 1] * (1 - k));
    }
    return out;
}

function rsi(values: number[], period = 14): number | null {
    if (values.length < period + 1) return null;
    let gain = 0;
    let loss = 0;
    for (let i = values.length - period; i < values.length; i++) {
        const diff = values[i] - values[i - 1];
        if (diff >= 0) gain += diff;
        else loss -= diff;
    }
    const avgGain = gain / period;
    const avgLoss = loss / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
}

function macd(values: number[]): { hist: number; macd: number; signal: number } | null {
    if (values.length < 35) return null;
    const ema12 = emaSeries(values, 12);
    const ema26 = emaSeries(values, 26);
    const macdLine = ema12.map((v, i) => v - ema26[i]);
    const signalLine = emaSeries(macdLine.slice(-30), 9);
    const m = macdLine[macdLine.length - 1];
    const s = signalLine[signalLine.length - 1];
    return { macd: m, signal: s, hist: m - s };
}

function stdev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
}

/** Slope of a least-squares line through the series, normalized by mean price. */
function normalizedSlope(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;
    const xs = Array.from({ length: n }, (_, i) => i);
    const meanX = (n - 1) / 2;
    const meanY = values.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
        num += (xs[i] - meanX) * (values[i] - meanY);
        den += (xs[i] - meanX) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    return meanY === 0 ? 0 : (slope / meanY) * 100; // % per day
}

const fmt = (v: number | null, d = 2): string =>
    v === null || v === undefined || Number.isNaN(v) ? '—' : v.toFixed(d);

// --- Forecast (geometric Brownian projection with confidence band) -----------

function buildForecast(closes: number[]): PriceForecast | undefined {
    if (closes.length < 40) return undefined;
    const window = closes.slice(-120);
    const logRet: number[] = [];
    for (let i = 1; i < window.length; i++) logRet.push(Math.log(window[i] / window[i - 1]));

    let mu = logRet.reduce((a, b) => a + b, 0) / logRet.length; // daily drift
    const sigma = stdev(logRet); // daily vol
    // Dampen drift toward 0 (conservative) and cap the 30-day expected move.
    mu *= 0.5;
    const horizon = 30;
    const cap = Math.log(1.25) / horizon; // ±25% over horizon
    mu = Math.max(-cap, Math.min(cap, mu));

    const last = closes[closes.length - 1];
    const z = 1.2816; // 80% interval
    const median: number[] = [];
    const upper: number[] = [];
    const lower: number[] = [];
    for (let t = 1; t <= horizon; t++) {
        const drift = mu * t;
        const band = z * sigma * Math.sqrt(t);
        median.push(+(last * Math.exp(drift)).toFixed(2));
        upper.push(+(last * Math.exp(drift + band)).toFixed(2));
        lower.push(+(last * Math.exp(drift - band)).toFixed(2));
    }

    const annualizedVolPct = +(sigma * Math.sqrt(252) * 100).toFixed(1);
    const expectedReturnPct = +(((median[horizon - 1] - last) / last) * 100).toFixed(2);
    const confidence: PriceForecast['confidence'] =
        annualizedVolPct < 25 ? 'High' : annualizedVolPct < 45 ? 'Medium' : 'Low';

    return {
        horizonDays: horizon,
        lastClose: +last.toFixed(2),
        history: closes.slice(-60).map((c) => +c.toFixed(2)),
        median,
        upper,
        lower,
        expectedReturnPct,
        annualizedVolPct,
        confidence,
    };
}

// --- Main action -------------------------------------------------------------

export async function getTechnicalSignals(symbol: string): Promise<TechnicalSignals> {
    const sym = symbol.trim().toUpperCase();
    const history = await getHistory(sym, '1y');
    const closes = history.candles.map((c) => c.close);
    const volumes = history.candles.map((c) => c.volume);

    if (closes.length < 50) {
        return {
            available: false,
            symbol: sym,
            price: closes[closes.length - 1] ?? 0,
            score: 50,
            bias: 'Neutral',
            regime: 'Unknown',
            regimeNote: 'Not enough price history to compute technical signals.',
            indicators: [],
            error: 'Insufficient history.',
        };
    }

    const price = closes[closes.length - 1];
    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);
    const sma200 = sma(closes, 200);
    const rsi14 = rsi(closes, 14);
    const macdVal = macd(closes);
    const high20 = Math.max(...closes.slice(-20));
    const low20 = Math.min(...closes.slice(-20));
    const volAvg20 = sma(volumes, 20);
    const lastVol = volumes[volumes.length - 1];

    const indicators: TechnicalIndicator[] = [];
    let score = 50;

    // Trend vs SMA50
    if (sma50 != null) {
        const above = price > sma50;
        score += above ? 10 : -10;
        indicators.push({
            label: 'Price vs SMA50',
            value: `₹${fmt(price)} vs ₹${fmt(sma50)}`,
            signal: above ? 'bull' : 'bear',
            note: above ? 'Trading above the 50-day average' : 'Trading below the 50-day average',
        });
    }

    // Short vs medium trend
    if (sma20 != null && sma50 != null) {
        const golden = sma20 > sma50;
        score += golden ? 8 : -8;
        indicators.push({
            label: 'SMA20 vs SMA50',
            value: `${fmt(sma20)} / ${fmt(sma50)}`,
            signal: golden ? 'bull' : 'bear',
            note: golden ? 'Short-term momentum above medium-term' : 'Short-term momentum below medium-term',
        });
    }

    // Long-term trend
    if (sma200 != null) {
        const above = price > sma200;
        score += above ? 8 : -8;
        indicators.push({
            label: 'Price vs SMA200',
            value: `₹${fmt(price)} vs ₹${fmt(sma200)}`,
            signal: above ? 'bull' : 'bear',
            note: above ? 'In a long-term uptrend' : 'In a long-term downtrend',
        });
    }

    // RSI
    if (rsi14 != null) {
        let sig: TechnicalSignalState = 'neutral';
        let note = 'Momentum is neutral';
        if (rsi14 >= 70) { sig = 'bear'; note = 'Overbought — pullback risk'; score -= 4; }
        else if (rsi14 >= 55) { sig = 'bull'; note = 'Bullish momentum'; score += 8; }
        else if (rsi14 <= 30) { sig = 'bull'; note = 'Oversold — possible bounce'; score += 4; }
        else if (rsi14 <= 45) { sig = 'bear'; note = 'Weak momentum'; score -= 8; }
        indicators.push({ label: 'RSI (14)', value: fmt(rsi14, 1), signal: sig, note });
    }

    // MACD
    if (macdVal) {
        const bull = macdVal.hist > 0;
        score += bull ? 8 : -8;
        indicators.push({
            label: 'MACD',
            value: `hist ${fmt(macdVal.hist)}`,
            signal: bull ? 'bull' : 'bear',
            note: bull ? 'MACD above signal line' : 'MACD below signal line',
        });
    }

    // 20-day breakout position
    const range = high20 - low20;
    const pos = range > 0 ? ((price - low20) / range) * 100 : 50;
    let bsig: TechnicalSignalState = 'neutral';
    if (pos >= 80) { bsig = 'bull'; score += 5; }
    else if (pos <= 20) { bsig = 'bear'; score -= 5; }
    indicators.push({
        label: '20-day range',
        value: `${pos.toFixed(0)}% of range`,
        signal: bsig,
        note: pos >= 80 ? 'Near 20-day high' : pos <= 20 ? 'Near 20-day low' : 'Mid-range',
    });

    // Volume
    if (volAvg20 != null && volAvg20 > 0) {
        const ratio = lastVol / volAvg20;
        const heavy = ratio > 1.3;
        indicators.push({
            label: 'Volume',
            value: `${ratio.toFixed(2)}× avg`,
            signal: 'neutral',
            note: heavy ? 'Above-average activity' : 'Normal activity',
        });
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    const bias: TechnicalSignals['bias'] = score >= 60 ? 'Bullish' : score <= 40 ? 'Bearish' : 'Neutral';

    // Regime detection
    const logRet: number[] = [];
    const tail = closes.slice(-60);
    for (let i = 1; i < tail.length; i++) logRet.push(Math.log(tail[i] / tail[i - 1]));
    const annVol = stdev(logRet) * Math.sqrt(252) * 100;
    const slope = normalizedSlope(closes.slice(-30)); // % per day

    let regime: string;
    let regimeNote: string;
    if (annVol > 45) {
        regime = 'High Volatility';
        regimeNote = `Elevated volatility (~${annVol.toFixed(0)}% annualized) — signals are less reliable.`;
    } else if (slope > 0.15) {
        regime = 'Trending Up';
        regimeNote = 'Price is in a sustained uptrend.';
    } else if (slope < -0.15) {
        regime = 'Trending Down';
        regimeNote = 'Price is in a sustained downtrend.';
    } else {
        regime = 'Ranging';
        regimeNote = 'Price is consolidating sideways — mean-reversion is more likely than breakout.';
    }

    return {
        available: true,
        symbol: sym,
        price: +price.toFixed(2),
        score,
        bias,
        regime,
        regimeNote,
        indicators,
        forecast: buildForecast(closes),
    };
}

// --- Market-wide technical scan ----------------------------------------------

/** Sector names available for the market scan (plus "All"). */
export async function getScanSectors(): Promise<string[]> {
    return ['All', ...SECTOR_GROUPS.map((g) => g.name)];
}

/**
 * Run the lightweight technical scanner across the whole universe (or one
 * sector) via the market-service batch endpoint. Returns rows ranked by score.
 */
export async function getMarketScan(sector = 'All'): Promise<MarketScanResult> {
    const group = SECTOR_GROUPS.find((g) => g.name === sector);
    const symbols = sector === 'All' || !group ? SCREENER_UNIVERSE : group.symbols;

    try {
        const query = encodeURIComponent(symbols.join(','));
        const res = await fetch(`${MARKET_SERVICE_URL}/technical-scan?symbols=${query}`, {
            next: { revalidate: 600 },
        });
        if (!res.ok) {
            return { available: false, sector, rows: [], error: 'Scan service is temporarily unavailable.' };
        }
        const data = (await res.json()) as { rows: MarketScanRow[] };
        const rows = (data.rows ?? []).slice().sort((a, b) => b.score - a.score);
        return { available: true, sector, rows };
    } catch (err) {
        console.error('market scan unreachable:', err);
        return { available: false, sector, rows: [], error: 'Scan service is temporarily unavailable.' };
    }
}
