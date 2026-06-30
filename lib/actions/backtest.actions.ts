'use server';

/**
 * Strategy backtester actions — backed by the Python market-service `/backtest`.
 * Long-only, full-capital simulation on delayed daily candles. Education only.
 */

const MARKET_SERVICE_URL = process.env.MARKET_SERVICE_URL ?? 'http://127.0.0.1:8000';

export type BacktestRequest = {
    symbol: string;
    strategy: BacktestStrategy;
    range: string;
    fast?: number;
    slow?: number;
    rsiPeriod?: number;
    rsiLow?: number;
    rsiHigh?: number;
    breakout?: number;
    capital?: number;
    costPct?: number;
    stopLossPct?: number;
    takeProfitPct?: number;
    trailingPct?: number;
};

export async function runBacktest(req: BacktestRequest): Promise<BacktestResult> {
    const params = new URLSearchParams({
        symbol: req.symbol.trim().toUpperCase(),
        strategy: req.strategy,
        range: req.range,
    });
    if (req.fast) params.set('fast', String(req.fast));
    if (req.slow) params.set('slow', String(req.slow));
    if (req.rsiPeriod) params.set('rsi_period', String(req.rsiPeriod));
    if (req.rsiLow != null) params.set('rsi_low', String(req.rsiLow));
    if (req.rsiHigh != null) params.set('rsi_high', String(req.rsiHigh));
    if (req.breakout) params.set('breakout', String(req.breakout));
    if (req.capital) params.set('capital', String(req.capital));
    if (req.costPct != null) params.set('cost_pct', String(req.costPct));
    if (req.stopLossPct != null) params.set('stop_loss_pct', String(req.stopLossPct));
    if (req.takeProfitPct != null) params.set('take_profit_pct', String(req.takeProfitPct));
    if (req.trailingPct != null) params.set('trailing_pct', String(req.trailingPct));

    const fallback: BacktestResult = {
        symbol: req.symbol.toUpperCase(),
        strategy: req.strategy,
        range: req.range,
        params: {},
        bars: 0,
        startDate: '',
        endDate: '',
        metrics: {
            totalReturnPct: 0, buyHoldReturnPct: 0, cagrPct: 0, maxDrawdownPct: 0,
            sharpe: 0, sortino: 0, calmar: 0, profitFactor: 0, winRatePct: 0, trades: 0,
            avgWinPct: 0, avgLossPct: 0, bestTradePct: 0, worstTradePct: 0, avgHoldBars: 0,
            maxConsecLosses: 0, exposurePct: 0, startCapital: 0, finalCapital: 0, pnl: 0,
        },
        equityCurve: [],
        trades: [],
        available: false,
        error: 'Backtest is temporarily unavailable. The data source may be rate-limiting; try again shortly.',
    };

    try {
        const res = await fetch(`${MARKET_SERVICE_URL}/backtest?${params.toString()}`, {
            next: { revalidate: 600 },
            signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
            console.error('market-service /backtest failed:', res.status);
            return { ...fallback, error: res.status === 404 ? 'Not enough price history for this symbol.' : fallback.error };
        }
        const data = (await res.json()) as BacktestResult;
        return { ...data, available: true };
    } catch (err) {
        console.error('market-service /backtest unreachable:', err);
        return fallback;
    }
}
