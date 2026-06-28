/**
 * Curated NSE sector peer groups (India-first). Used for peer comparison and
 * as the default universe for the AI screener. Symbols are bare NSE tickers
 * (the market-service appends `.NS`).
 */

export type SectorGroup = {
    name: string;
    symbols: string[];
};

export const SECTOR_GROUPS: SectorGroup[] = [
    { name: 'Information Technology', symbols: ['TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM', 'MPHASIS', 'PERSISTENT', 'COFORGE'] },
    { name: 'Private Banks', symbols: ['HDFCBANK', 'ICICIBANK', 'KOTAKBANK', 'AXISBANK', 'INDUSINDBK', 'IDFCFIRSTB', 'FEDERALBNK'] },
    { name: 'Public Sector Banks', symbols: ['SBIN', 'BANKBARODA', 'PNB', 'CANBK', 'UNIONBANK'] },
    { name: 'Automobiles', symbols: ['MARUTI', 'M&M', 'TMPV', 'BAJAJ-AUTO', 'HEROMOTOCO', 'EICHERMOT', 'TVSMOTOR', 'ASHOKLEY'] },
    { name: 'FMCG', symbols: ['HINDUNILVR', 'ITC', 'NESTLEIND', 'BRITANNIA', 'DABUR', 'MARICO', 'GODREJCP', 'COLPAL', 'TATACONSUM'] },
    { name: 'Pharmaceuticals', symbols: ['SUNPHARMA', 'DRREDDY', 'CIPLA', 'DIVISLAB', 'AUROPHARMA', 'LUPIN', 'BIOCON', 'TORNTPHARM', 'ALKEM'] },
    { name: 'Oil & Gas / Energy', symbols: ['RELIANCE', 'ONGC', 'IOC', 'BPCL', 'GAIL', 'HINDPETRO', 'OIL'] },
    { name: 'Metals & Mining', symbols: ['TATASTEEL', 'JSWSTEEL', 'HINDALCO', 'VEDL', 'JINDALSTEL', 'SAIL', 'NMDC', 'NATIONALUM'] },
    { name: 'Power & Utilities', symbols: ['NTPC', 'POWERGRID', 'TATAPOWER', 'ADANIPOWER', 'JSWENERGY', 'NHPC'] },
    { name: 'Cement', symbols: ['ULTRACEMCO', 'SHREECEM', 'AMBUJACEM', 'ACC', 'DALBHARAT', 'JKCEMENT'] },
    { name: 'NBFC & Financial Services', symbols: ['BAJFINANCE', 'BAJAJFINSV', 'CHOLAFIN', 'SHRIRAMFIN', 'MUTHOOTFIN', 'SBICARD'] },
    { name: 'Insurance', symbols: ['HDFCLIFE', 'SBILIFE', 'ICICIPRULI', 'ICICIGI', 'LICI'] },
    { name: 'Telecom', symbols: ['BHARTIARTL', 'IDEA', 'INDUSTOWER'] },
    { name: 'Capital Goods & Infra', symbols: ['LT', 'SIEMENS', 'ABB', 'BHEL', 'BEL', 'HAL'] },
    { name: 'Paints', symbols: ['ASIANPAINT', 'BERGEPAINT', 'KANSAINER'] },
    { name: 'Consumer & Retail', symbols: ['TITAN', 'DMART', 'TRENT', 'JUBLFOOD', 'PAGEIND'] },
    { name: 'Adani Group', symbols: ['ADANIENT', 'ADANIPORTS', 'ADANIGREEN', 'ADANIPOWER'] },
];

/** Reverse lookup: bare symbol -> its sector group. */
const SYMBOL_TO_GROUP = new Map<string, SectorGroup>();
for (const group of SECTOR_GROUPS) {
    for (const symbol of group.symbols) {
        SYMBOL_TO_GROUP.set(symbol.toUpperCase(), group);
    }
}

/** Returns the peer group for a symbol, or null if it isn't in our curated map. */
export function getPeerGroup(symbol: string): SectorGroup | null {
    return SYMBOL_TO_GROUP.get(symbol.trim().toUpperCase()) ?? null;
}

/** Flat, de-duplicated universe of all curated symbols (for the screener). */
export const SCREENER_UNIVERSE: string[] = Array.from(
    new Set(SECTOR_GROUPS.flatMap((g) => g.symbols)),
);
