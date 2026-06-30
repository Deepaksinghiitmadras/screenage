'use server';

/**
 * Monte Carlo price-forecast action — backed by the Python market-service
 * `/forecast` (GBM simulation). Probabilistic estimate on delayed data, not advice.
 */

const MARKET_SERVICE_URL = process.env.MARKET_SERVICE_URL ?? 'http://127.0.0.1:8000';

export async function getForecast(symbol: string, config?: Partial<ForecastConfig>): Promise<ForecastResult> {
    const params = new URLSearchParams({ symbol: symbol.trim().toUpperCase() });
    if (config?.horizon) params.set('horizon', String(config.horizon));
    if (config?.lookback) params.set('lookback', String(config.lookback));
    if (config?.paths) params.set('paths', String(config.paths));
    if (config?.ci) params.set('ci', String(config.ci));
    if (config?.driftMode) params.set('drift_mode', config.driftMode);

    const fallback: ForecastResult = {
        symbol: symbol.toUpperCase(),
        lastClose: 0,
        horizonDays: config?.horizon ?? 30,
        ci: config?.ci ?? 80,
        lookback: config?.lookback ?? 252,
        paths: config?.paths ?? 1000,
        driftMode: config?.driftMode ?? 'balanced',
        history: [],
        median: [],
        upper: [],
        lower: [],
        samplePaths: [],
        probProfitPct: 0,
        expectedReturnPct: 0,
        downside5Pct: 0,
        annualizedVolPct: 0,
        scenarios: { bull: { price: 0, returnPct: 0 }, base: { price: 0, returnPct: 0 }, bear: { price: 0, returnPct: 0 } },
        available: false,
        error: 'Forecast is temporarily unavailable. The data source may be rate-limiting; try again shortly.',
    };

    try {
        const res = await fetch(`${MARKET_SERVICE_URL}/forecast?${params.toString()}`, {
            next: { revalidate: 600 },
        });
        if (!res.ok) {
            console.error('market-service /forecast failed:', res.status);
            return { ...fallback, error: res.status === 404 ? 'Not enough price history for this symbol.' : fallback.error };
        }
        const data = (await res.json()) as ForecastResult;
        return { ...data, available: true };
    } catch (err) {
        console.error('market-service /forecast unreachable:', err);
        return fallback;
    }
}
