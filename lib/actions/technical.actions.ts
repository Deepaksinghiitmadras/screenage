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

// --- Advanced indicator math (OHLC) ------------------------------------------

/** Wilder's smoothing of a series over `period`. */
function wilderSmooth(values: number[], period: number): number[] {
    if (values.length < period) return [];
    const out: number[] = [];
    let prev = values.slice(0, period).reduce((a, b) => a + b, 0); // first = sum
    out.push(prev);
    for (let i = period; i < values.length; i++) {
        prev = prev - prev / period + values[i];
        out.push(prev);
    }
    return out;
}

function trueRanges(high: number[], low: number[], close: number[]): number[] {
    const tr: number[] = [];
    for (let i = 1; i < high.length; i++) {
        tr.push(Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1])));
    }
    return tr;
}

/** Average True Range (Wilder). */
function atr(high: number[], low: number[], close: number[], period = 14): number | null {
    const tr = trueRanges(high, low, close);
    if (tr.length < period) return null;
    let a = tr.slice(0, period).reduce((x, y) => x + y, 0) / period;
    for (let i = period; i < tr.length; i++) a = (a * (period - 1) + tr[i]) / period;
    return a;
}

/** ADX with +DI / -DI (Wilder). */
function adx(high: number[], low: number[], close: number[], period = 14): { adx: number; plusDI: number; minusDI: number } | null {
    const n = high.length;
    if (n < period * 2 + 1) return null;
    const tr: number[] = [];
    const plusDM: number[] = [];
    const minusDM: number[] = [];
    for (let i = 1; i < n; i++) {
        const up = high[i] - high[i - 1];
        const down = low[i - 1] - low[i];
        plusDM.push(up > down && up > 0 ? up : 0);
        minusDM.push(down > up && down > 0 ? down : 0);
        tr.push(Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1])));
    }
    const trS = wilderSmooth(tr, period);
    const plusS = wilderSmooth(plusDM, period);
    const minusS = wilderSmooth(minusDM, period);
    const dx: number[] = [];
    for (let i = 0; i < trS.length; i++) {
        const pdi = trS[i] === 0 ? 0 : (100 * plusS[i]) / trS[i];
        const mdi = trS[i] === 0 ? 0 : (100 * minusS[i]) / trS[i];
        const denom = pdi + mdi;
        dx.push(denom === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / denom);
    }
    if (dx.length < period) return null;
    let adxVal = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < dx.length; i++) adxVal = (adxVal * (period - 1) + dx[i]) / period;
    const lastIdx = trS.length - 1;
    const plusDI = trS[lastIdx] === 0 ? 0 : (100 * plusS[lastIdx]) / trS[lastIdx];
    const minusDI = trS[lastIdx] === 0 ? 0 : (100 * minusS[lastIdx]) / trS[lastIdx];
    return { adx: adxVal, plusDI, minusDI };
}

/** Bollinger Bands → bands + %B + bandwidth. */
function bollinger(closes: number[], period = 20, mult = 2): { upper: number; mid: number; lower: number; percentB: number; widthPct: number } | null {
    if (closes.length < period) return null;
    const slice = closes.slice(-period);
    const mid = slice.reduce((a, b) => a + b, 0) / period;
    const sd = stdev(slice);
    const upper = mid + mult * sd;
    const lower = mid - mult * sd;
    const price = closes[closes.length - 1];
    const percentB = upper === lower ? 50 : ((price - lower) / (upper - lower)) * 100;
    const widthPct = mid === 0 ? 0 : ((upper - lower) / mid) * 100;
    return { upper, mid, lower, percentB, widthPct };
}

/** Stochastic %K over `period`. */
function stochasticK(high: number[], low: number[], close: number[], period = 14): number | null {
    if (close.length < period) return null;
    const hi = Math.max(...high.slice(-period));
    const lo = Math.min(...low.slice(-period));
    return hi === lo ? 50 : ((close[close.length - 1] - lo) / (hi - lo)) * 100;
}

/** Commodity Channel Index. */
function cci(high: number[], low: number[], close: number[], period = 20): number | null {
    const n = close.length;
    if (n < period) return null;
    const tp: number[] = [];
    for (let i = n - period; i < n; i++) tp.push((high[i] + low[i] + close[i]) / 3);
    const mean = tp.reduce((a, b) => a + b, 0) / period;
    const meanDev = tp.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
    return meanDev === 0 ? 0 : (tp[tp.length - 1] - mean) / (0.015 * meanDev);
}

/** Williams %R over `period`. */
function williamsR(high: number[], low: number[], close: number[], period = 14): number | null {
    if (close.length < period) return null;
    const hi = Math.max(...high.slice(-period));
    const lo = Math.min(...low.slice(-period));
    return hi === lo ? -50 : (-100 * (hi - close[close.length - 1])) / (hi - lo);
}

/** Resample daily closes into period-end closes by ISO week or calendar month. */
function resampleCloses(candles: { time: string; close: number }[], unit: 'W' | 'M'): number[] {
    const buckets = new Map<string, number>();
    for (const c of candles) {
        const d = new Date(c.time);
        let key: string;
        if (unit === 'M') {
            key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
        } else {
            const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getUTCDay() + 1) / 7);
            key = `${d.getUTCFullYear()}-W${week}`;
        }
        buckets.set(key, c.close); // last close in the bucket wins (insertion order = chronological)
    }
    return Array.from(buckets.values());
}

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

export async function getTechnicalSignals(symbol: string, config?: Partial<TechnicalConfig>): Promise<TechnicalSignals> {
    const sym = symbol.trim().toUpperCase();
    const clamp = (v: number | undefined, d: number, lo: number, hi: number) =>
        Math.max(lo, Math.min(hi, Math.round(v ?? d)));
    const cfg: TechnicalConfig = {
        rsiPeriod: clamp(config?.rsiPeriod, 14, 2, 50),
        smaFast: clamp(config?.smaFast, 20, 3, 100),
        smaMid: clamp(config?.smaMid, 50, 5, 200),
        smaLong: clamp(config?.smaLong, 200, 20, 300),
        bbPeriod: clamp(config?.bbPeriod, 20, 5, 100),
        bbStd: Math.max(1, Math.min(4, config?.bbStd ?? 2)),
        adxPeriod: clamp(config?.adxPeriod, 14, 5, 50),
        atrPeriod: clamp(config?.atrPeriod, 14, 5, 50),
    };

    // 2y of candles so weekly/monthly RSI has enough samples.
    const history = await getHistory(sym, '2y');
    const candles = history.candles;
    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const volumes = candles.map((c) => c.volume);

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
            config: cfg,
            error: 'Insufficient history.',
        };
    }

    const price = closes[closes.length - 1];
    const smaFast = sma(closes, cfg.smaFast);
    const smaMid = sma(closes, cfg.smaMid);
    const smaLong = sma(closes, cfg.smaLong);
    const rsiVal = rsi(closes, cfg.rsiPeriod);
    const macdVal = macd(closes);
    const high20 = Math.max(...closes.slice(-20));
    const low20 = Math.min(...closes.slice(-20));
    const volAvg20 = sma(volumes, 20);
    const lastVol = volumes[volumes.length - 1];

    const indicators: TechnicalIndicator[] = [];
    let score = 50;

    // --- Trend ---------------------------------------------------------------
    if (smaMid != null) {
        const above = price > smaMid;
        score += above ? 10 : -10;
        indicators.push({
            label: `Price vs SMA${cfg.smaMid}`, category: 'Trend',
            value: `₹${fmt(price)} vs ₹${fmt(smaMid)}`,
            signal: above ? 'bull' : 'bear',
            note: above ? `Trading above the ${cfg.smaMid}-day average` : `Trading below the ${cfg.smaMid}-day average`,
        });
    }
    if (smaFast != null && smaMid != null) {
        const golden = smaFast > smaMid;
        score += golden ? 8 : -8;
        indicators.push({
            label: `SMA${cfg.smaFast} vs SMA${cfg.smaMid}`, category: 'Trend',
            value: `${fmt(smaFast)} / ${fmt(smaMid)}`,
            signal: golden ? 'bull' : 'bear',
            note: golden ? 'Short-term momentum above medium-term' : 'Short-term momentum below medium-term',
        });
    }
    if (smaLong != null) {
        const above = price > smaLong;
        score += above ? 8 : -8;
        indicators.push({
            label: `Price vs SMA${cfg.smaLong}`, category: 'Trend',
            value: `₹${fmt(price)} vs ₹${fmt(smaLong)}`,
            signal: above ? 'bull' : 'bear',
            note: above ? 'In a long-term uptrend' : 'In a long-term downtrend',
        });
    }

    // ADX / DI — trend strength + direction.
    const adxVal = adx(highs, lows, closes, cfg.adxPeriod);
    if (adxVal) {
        const bullDir = adxVal.plusDI > adxVal.minusDI;
        const strong = adxVal.adx >= 25;
        let sig: TechnicalSignalState = 'neutral';
        if (strong) { sig = bullDir ? 'bull' : 'bear'; score += bullDir ? 8 : -8; }
        indicators.push({
            label: `ADX (${cfg.adxPeriod})`, category: 'Trend',
            value: `${fmt(adxVal.adx, 1)} · +DI ${fmt(adxVal.plusDI, 0)} / -DI ${fmt(adxVal.minusDI, 0)}`,
            signal: sig,
            note: !strong ? 'No clear trend (ADX < 25)' : bullDir ? 'Strong uptrend' : 'Strong downtrend',
        });
    }

    // --- Momentum ------------------------------------------------------------
    if (rsiVal != null) {
        let sig: TechnicalSignalState = 'neutral';
        let note = 'Momentum is neutral';
        if (rsiVal >= 70) { sig = 'bear'; note = 'Overbought — pullback risk'; score -= 4; }
        else if (rsiVal >= 55) { sig = 'bull'; note = 'Bullish momentum'; score += 8; }
        else if (rsiVal <= 30) { sig = 'bull'; note = 'Oversold — possible bounce'; score += 4; }
        else if (rsiVal <= 45) { sig = 'bear'; note = 'Weak momentum'; score -= 8; }
        indicators.push({ label: `RSI (${cfg.rsiPeriod})`, category: 'Momentum', value: fmt(rsiVal, 1), signal: sig, note });
    }

    if (macdVal) {
        const bull = macdVal.hist > 0;
        score += bull ? 8 : -8;
        indicators.push({
            label: 'MACD (12,26,9)', category: 'Momentum',
            value: `hist ${fmt(macdVal.hist)}`,
            signal: bull ? 'bull' : 'bear',
            note: bull ? 'MACD above signal line' : 'MACD below signal line',
        });
    }

    const stoch = stochasticK(highs, lows, closes, 14);
    if (stoch != null) {
        let sig: TechnicalSignalState = 'neutral';
        if (stoch >= 80) sig = 'bear';
        else if (stoch <= 20) sig = 'bull';
        indicators.push({
            label: 'Stochastic %K (14)', category: 'Momentum',
            value: `${fmt(stoch, 0)}%`,
            signal: sig,
            note: stoch >= 80 ? 'Overbought zone' : stoch <= 20 ? 'Oversold zone' : 'Mid zone',
        });
    }

    const cciVal = cci(highs, lows, closes, 20);
    if (cciVal != null) {
        let sig: TechnicalSignalState = 'neutral';
        if (cciVal > 100) { sig = 'bull'; score += 3; }
        else if (cciVal < -100) { sig = 'bear'; score -= 3; }
        indicators.push({
            label: 'CCI (20)', category: 'Momentum',
            value: fmt(cciVal, 0),
            signal: sig,
            note: cciVal > 100 ? 'Strong upside momentum' : cciVal < -100 ? 'Strong downside momentum' : 'Neutral momentum',
        });
    }

    const wr = williamsR(highs, lows, closes, 14);
    if (wr != null) {
        let sig: TechnicalSignalState = 'neutral';
        if (wr >= -20) sig = 'bear';
        else if (wr <= -80) sig = 'bull';
        indicators.push({
            label: 'Williams %R (14)', category: 'Momentum',
            value: fmt(wr, 0),
            signal: sig,
            note: wr >= -20 ? 'Overbought' : wr <= -80 ? 'Oversold' : 'Neutral',
        });
    }

    // --- Volatility ----------------------------------------------------------
    const bb = bollinger(closes, cfg.bbPeriod, cfg.bbStd);
    if (bb) {
        let sig: TechnicalSignalState = 'neutral';
        if (bb.percentB >= 100) sig = 'bear';
        else if (bb.percentB <= 0) sig = 'bull';
        indicators.push({
            label: `Bollinger %B (${cfg.bbPeriod},${cfg.bbStd})`, category: 'Volatility',
            value: `${fmt(bb.percentB, 0)}% · width ${fmt(bb.widthPct, 1)}%`,
            signal: sig,
            note: bb.percentB >= 100 ? 'Above upper band — stretched' : bb.percentB <= 0 ? 'Below lower band — stretched' : 'Inside bands',
        });
    }

    const atrVal = atr(highs, lows, closes, cfg.atrPeriod);
    if (atrVal != null) {
        const atrPct = (atrVal / price) * 100;
        indicators.push({
            label: `ATR (${cfg.atrPeriod})`, category: 'Volatility',
            value: `₹${fmt(atrVal)} · ${fmt(atrPct, 1)}%`,
            signal: 'neutral',
            note: atrPct > 4 ? 'High daily volatility' : atrPct < 1.5 ? 'Low daily volatility' : 'Moderate volatility',
        });
    }

    // 20-day range position.
    const range = high20 - low20;
    const pos = range > 0 ? ((price - low20) / range) * 100 : 50;
    let bsig: TechnicalSignalState = 'neutral';
    if (pos >= 80) { bsig = 'bull'; score += 5; }
    else if (pos <= 20) { bsig = 'bear'; score -= 5; }
    indicators.push({
        label: '20-day range', category: 'Volatility',
        value: `${pos.toFixed(0)}% of range`,
        signal: bsig,
        note: pos >= 80 ? 'Near 20-day high' : pos <= 20 ? 'Near 20-day low' : 'Mid-range',
    });

    // --- Volume --------------------------------------------------------------
    if (volAvg20 != null && volAvg20 > 0) {
        const ratio = lastVol / volAvg20;
        const heavy = ratio > 1.3;
        indicators.push({
            label: 'Volume', category: 'Volume',
            value: `${ratio.toFixed(2)}× avg`,
            signal: 'neutral',
            note: heavy ? 'Above-average activity' : 'Normal activity',
        });
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    const bias: TechnicalSignals['bias'] = score >= 60 ? 'Bullish' : score <= 40 ? 'Bearish' : 'Neutral';

    // Multi-timeframe RSI (Daily / Weekly / Monthly).
    const rsiSignal = (r: number | null): TechnicalSignalState =>
        r == null ? 'neutral' : r >= 55 ? 'bull' : r <= 45 ? 'bear' : 'neutral';
    const weeklyCloses = resampleCloses(candles, 'W');
    const monthlyCloses = resampleCloses(candles, 'M');
    const multiTimeframe: TechnicalTimeframeRSI[] = [
        { timeframe: 'Daily', rsi: round1(rsi(closes, cfg.rsiPeriod)), signal: rsiSignal(rsi(closes, cfg.rsiPeriod)) },
        { timeframe: 'Weekly', rsi: round1(rsi(weeklyCloses, cfg.rsiPeriod)), signal: rsiSignal(rsi(weeklyCloses, cfg.rsiPeriod)) },
        { timeframe: 'Monthly', rsi: round1(rsi(monthlyCloses, cfg.rsiPeriod)), signal: rsiSignal(rsi(monthlyCloses, cfg.rsiPeriod)) },
    ];

    // Regime detection.
    const logRet: number[] = [];
    const tail = closes.slice(-60);
    for (let i = 1; i < tail.length; i++) logRet.push(Math.log(tail[i] / tail[i - 1]));
    const annVol = stdev(logRet) * Math.sqrt(252) * 100;
    const slope = normalizedSlope(closes.slice(-30));

    let regime: string;
    let regimeNote: string;
    if (annVol > 45) {
        regime = 'High Volatility';
        regimeNote = `Elevated volatility (~${annVol.toFixed(0)}% annualized) — signals are less reliable.`;
    } else if (adxVal && adxVal.adx >= 25 && slope > 0) {
        regime = 'Trending Up';
        regimeNote = `Strong uptrend (ADX ${adxVal.adx.toFixed(0)}).`;
    } else if (adxVal && adxVal.adx >= 25 && slope < 0) {
        regime = 'Trending Down';
        regimeNote = `Strong downtrend (ADX ${adxVal.adx.toFixed(0)}).`;
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
        multiTimeframe,
        bands: bb ? {
            price: +price.toFixed(2),
            upper: +bb.upper.toFixed(2),
            mid: +bb.mid.toFixed(2),
            lower: +bb.lower.toFixed(2),
            percentB: +bb.percentB.toFixed(1),
            widthPct: +bb.widthPct.toFixed(1),
        } : undefined,
        config: cfg,
        forecast: buildForecast(closes),
    };
}

function round1(v: number | null): number | null {
    return v == null ? null : +v.toFixed(1);
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
