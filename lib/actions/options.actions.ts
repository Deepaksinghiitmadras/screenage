'use server';

/**
 * Options analytics actions — NSE option chain + derived metrics (PCR, Max Pain,
 * OI distribution, IV smile) via the market-service. Delayed data, research only.
 */

const MARKET_SERVICE_URL = process.env.MARKET_SERVICE_URL ?? 'http://127.0.0.1:8000';

export async function getOptionChain(symbol: string, expiry?: string, strikesEachSide?: number): Promise<OptionChainData> {
    const params = new URLSearchParams({ symbol: symbol.trim().toUpperCase() });
    if (expiry) params.set('expiry', expiry);
    if (strikesEachSide) params.set('strikes_each_side', String(strikesEachSide));

    const fallback: OptionChainData = {
        symbol: symbol.toUpperCase(),
        type: 'Indices',
        underlying: null,
        expiry: '',
        expiries: [],
        atmStrike: null,
        pcr: null,
        maxPain: null,
        totalCeOi: 0,
        totalPeOi: 0,
        strikes: [],
        available: false,
        error: 'Option chain is temporarily unavailable. NSE may be rate-limiting; try again shortly.',
    };

    try {
        const res = await fetch(`${MARKET_SERVICE_URL}/option-chain?${params.toString()}`, {
            next: { revalidate: 120 },
            signal: AbortSignal.timeout(25000),
        });
        if (!res.ok) {
            console.error('market-service /option-chain failed:', res.status);
            return fallback;
        }
        const data = (await res.json()) as OptionChainData;
        return { ...data, available: true };
    } catch (err) {
        console.error('market-service /option-chain unreachable:', err);
        return fallback;
    }
}
