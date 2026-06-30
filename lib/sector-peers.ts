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
    { name: 'Information Technology', symbols: ['TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM', 'LTIM', 'MPHASIS', 'PERSISTENT', 'COFORGE', 'OFSS', 'TATAELXSI', 'BSOFT', 'KPITTECH', 'CYIENT', 'ZENSARTECH'] },
    { name: 'Private Banks', symbols: ['HDFCBANK', 'ICICIBANK', 'KOTAKBANK', 'AXISBANK', 'INDUSINDBK', 'IDFCFIRSTB', 'FEDERALBNK', 'BANDHANBNK', 'RBLBANK', 'AUBANK', 'YESBANK'] },
    { name: 'Public Sector Banks', symbols: ['SBIN', 'BANKBARODA', 'PNB', 'CANBK', 'UNIONBANK', 'INDIANB', 'BANKINDIA', 'MAHABANK', 'IOB', 'UCOBANK', 'CENTRALBK'] },
    { name: 'Automobiles', symbols: ['MARUTI', 'M&M', 'TATAMOTORS', 'BAJAJ-AUTO', 'HEROMOTOCO', 'EICHERMOT', 'TVSMOTOR', 'ASHOKLEY'] },
    { name: 'Auto Ancillaries', symbols: ['BOSCHLTD', 'MOTHERSON', 'BALKRISIND', 'MRF', 'APOLLOTYRE', 'EXIDEIND', 'BHARATFORG', 'SONACOMS', 'UNOMINDA', 'SCHAEFFLER', 'TIINDIA', 'ENDURANCE'] },
    { name: 'FMCG', symbols: ['HINDUNILVR', 'ITC', 'NESTLEIND', 'BRITANNIA', 'DABUR', 'MARICO', 'GODREJCP', 'COLPAL', 'TATACONSUM', 'VBL', 'UBL', 'RADICO', 'EMAMILTD', 'JYOTHYLAB', 'BALRAMCHIN'] },
    { name: 'Pharmaceuticals', symbols: ['SUNPHARMA', 'DRREDDY', 'CIPLA', 'DIVISLAB', 'AUROPHARMA', 'LUPIN', 'BIOCON', 'TORNTPHARM', 'ALKEM', 'ZYDUSLIFE', 'MANKIND', 'GLENMARK', 'IPCALAB', 'LAURUSLABS', 'ABBOTINDIA', 'GLAND', 'AJANTPHARM'] },
    { name: 'Healthcare Services', symbols: ['APOLLOHOSP', 'MAXHEALTH', 'FORTIS', 'NH', 'METROPOLIS', 'LALPATHLAB', 'SYNGENE', 'KIMS', 'MEDPLUS'] },
    { name: 'Oil & Gas / Energy', symbols: ['RELIANCE', 'ONGC', 'IOC', 'BPCL', 'GAIL', 'HINDPETRO', 'OIL', 'PETRONET', 'IGL', 'MGL', 'GUJGASLTD', 'ATGL', 'AEGISLOG'] },
    { name: 'Metals & Mining', symbols: ['TATASTEEL', 'JSWSTEEL', 'HINDALCO', 'VEDL', 'JINDALSTEL', 'SAIL', 'NMDC', 'NATIONALUM', 'JSL', 'APLAPOLLO', 'HINDZINC', 'RATNAMANI', 'WELCORP'] },
    { name: 'Power & Utilities', symbols: ['NTPC', 'POWERGRID', 'TATAPOWER', 'ADANIPOWER', 'JSWENERGY', 'NHPC', 'SJVN', 'NLCINDIA', 'TORNTPOWER', 'CESC', 'ADANIENSOL'] },
    { name: 'Cement', symbols: ['ULTRACEMCO', 'SHREECEM', 'AMBUJACEM', 'ACC', 'DALBHARAT', 'JKCEMENT', 'RAMCOCEM', 'NUVOCO', 'JKLAKSHMI', 'BIRLACORPN'] },
    { name: 'NBFC & Financial Services', symbols: ['BAJFINANCE', 'BAJAJFINSV', 'CHOLAFIN', 'SHRIRAMFIN', 'MUTHOOTFIN', 'SBICARD', 'PFC', 'RECLTD', 'LICHSGFIN', 'MANAPPURAM', 'M&MFIN', 'IIFL', 'POONAWALLA', 'ABCAPITAL', 'JIOFIN'] },
    { name: 'Insurance', symbols: ['HDFCLIFE', 'SBILIFE', 'ICICIPRULI', 'ICICIGI', 'LICI', 'MFSL', 'STARHEALTH', 'NIACL', 'GICRE'] },
    { name: 'Telecom', symbols: ['BHARTIARTL', 'IDEA', 'INDUSTOWER', 'TATACOMM', 'HFCL', 'TEJASNET'] },
    { name: 'Capital Goods & Infra', symbols: ['LT', 'SIEMENS', 'ABB', 'BHEL', 'BEL', 'HAL', 'CUMMINSIND', 'THERMAX', 'KEI', 'POLYCAB', 'ASTRAL', 'SUPREMEIND', 'NBCC', 'IRCON', 'RVNL', 'KEC', 'GMRAIRPORT'] },
    { name: 'Chemicals & Fertilizers', symbols: ['SRF', 'PIIND', 'DEEPAKNTR', 'AARTIIND', 'ATUL', 'NAVINFLUOR', 'TATACHEM', 'COROMANDEL', 'UPL', 'GNFC', 'VINATIORGA', 'FLUOROCHEM', 'LINDEINDIA'] },
    { name: 'Paints', symbols: ['ASIANPAINT', 'BERGEPAINT', 'KANSAINER', 'AKZOINDIA', 'INDIGOPNTS'] },
    { name: 'Consumer Durables', symbols: ['HAVELLS', 'VOLTAS', 'CROMPTON', 'WHIRLPOOL', 'DIXON', 'BLUESTARCO', 'AMBER', 'KAYNES', 'VGUARD', 'ORIENTELEC'] },
    { name: 'Consumer & Retail', symbols: ['TITAN', 'DMART', 'TRENT', 'JUBLFOOD', 'PAGEIND', 'ABFRL', 'DEVYANI', 'METROBRAND', 'BATAINDIA', 'RELAXO', 'KALYANKJIL'] },
    { name: 'Realty', symbols: ['DLF', 'GODREJPROP', 'OBEROIRLTY', 'PRESTIGE', 'PHOENIXLTD', 'BRIGADE', 'LODHA', 'SOBHA'] },
    { name: 'Internet & New-age', symbols: ['PAYTM', 'NYKAA', 'POLICYBZR', 'DELHIVERY', 'INFOEDGE', 'IRCTC', 'CARTRADE'] },
    { name: 'Media & Entertainment', symbols: ['ZEEL', 'SUNTV', 'PVRINOX', 'NAZARA', 'SAREGAMA', 'NETWORK18'] },
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
