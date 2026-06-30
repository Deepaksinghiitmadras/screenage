/**
 * Themed stock collections — curated, *filter-based* baskets (Tickertape /
 * smallcase style) computed live from the screener universe's fundamentals.
 * Each collection is dynamic: it re-evaluates against current data. Plain module
 * (filter functions) so it can be imported by the client workspace.
 */

export type CollectionMetricKey =
    | 'dividendYield' | 'roe' | 'trailingPE' | 'priceToBook' | 'pegRatio'
    | 'profitMargin' | 'revenueGrowth' | 'earningsGrowth' | 'debtToEquity'
    | 'beta' | 'marketCap' | 'changePercent';

export type StockCollection = {
    id: string;
    name: string;
    emoji: string;
    description: string;
    tooltip: string;
    /** Columns to surface in the table (besides name/price). */
    columns: CollectionMetricKey[];
    /** Default sort. */
    sortBy: CollectionMetricKey;
    sortDir: 'asc' | 'desc';
    filter: (s: ScreenerStock) => boolean;
};

const LARGE_CAP = 2e11; // ₹20,000 Cr

export const COLLECTIONS: StockCollection[] = [
    {
        id: 'high-dividend',
        name: 'High Dividend Payers',
        emoji: '💰',
        description: 'Stocks paying a generous, steady dividend yield.',
        tooltip: 'Companies with a dividend yield of 4% or more — useful for income-focused investors.',
        columns: ['dividendYield', 'roe', 'marketCap'],
        sortBy: 'dividendYield', sortDir: 'desc',
        filter: (s) => (s.dividendYield ?? 0) >= 4,
    },
    {
        id: 'debt-free-compounders',
        name: 'Debt-Free Compounders',
        emoji: '🏆',
        description: 'Low-debt businesses compounding at high returns on equity.',
        tooltip: 'Very low debt (Debt/Equity under 0.2×) plus a Return on Equity of 15%+ — financially sturdy compounders.',
        columns: ['roe', 'debtToEquity', 'profitMargin'],
        sortBy: 'roe', sortDir: 'desc',
        filter: (s) => s.debtToEquity != null && s.debtToEquity < 20 && (s.roe ?? 0) >= 15,
    },
    {
        id: 'value-large-caps',
        name: 'Value Large-Caps',
        emoji: '🏦',
        description: 'Big, established companies trading at a modest P/E.',
        tooltip: 'Market cap above ₹20,000 Cr and a P/E of 18 or less — large-caps that look reasonably valued.',
        columns: ['trailingPE', 'priceToBook', 'marketCap'],
        sortBy: 'trailingPE', sortDir: 'asc',
        filter: (s) => (s.marketCap ?? 0) >= LARGE_CAP && (s.trailingPE ?? 0) > 0 && (s.trailingPE ?? 999) <= 18,
    },
    {
        id: 'high-growth',
        name: 'High Growth',
        emoji: '🚀',
        description: 'Fast-growing revenue and earnings.',
        tooltip: 'Both revenue growth and earnings growth of 15%+ year-on-year.',
        columns: ['revenueGrowth', 'earningsGrowth', 'roe'],
        sortBy: 'earningsGrowth', sortDir: 'desc',
        filter: (s) => (s.revenueGrowth ?? -999) >= 15 && (s.earningsGrowth ?? -999) >= 15,
    },
    {
        id: 'quality-roe',
        name: 'Quality (High ROE)',
        emoji: '⭐',
        description: 'Highly profitable, efficient businesses.',
        tooltip: 'Return on Equity of 20%+ and a profit margin of 10%+ — high-quality operators.',
        columns: ['roe', 'profitMargin', 'debtToEquity'],
        sortBy: 'roe', sortDir: 'desc',
        filter: (s) => (s.roe ?? 0) >= 20 && (s.profitMargin ?? 0) >= 10,
    },
    {
        id: 'low-vol-defensives',
        name: 'Low-Volatility Defensives',
        emoji: '🛡️',
        description: 'Steadier stocks that move less than the market.',
        tooltip: 'Beta of 0.8 or below — historically less volatile than the broader market.',
        columns: ['beta', 'dividendYield', 'marketCap'],
        sortBy: 'beta', sortDir: 'asc',
        filter: (s) => s.beta != null && s.beta > 0 && s.beta <= 0.8,
    },
    {
        id: 'below-book',
        name: 'Below 1.5× Book',
        emoji: '📉',
        description: 'Trading close to or below book value.',
        tooltip: 'Price-to-Book of 1.5 or less — can signal value (verify quality before acting).',
        columns: ['priceToBook', 'trailingPE', 'roe'],
        sortBy: 'priceToBook', sortDir: 'asc',
        filter: (s) => (s.priceToBook ?? 0) > 0 && (s.priceToBook ?? 999) <= 1.5,
    },
    {
        id: 'cash-cows',
        name: 'Profitable Cash Cows',
        emoji: '🐄',
        description: 'Fat margins with a dividend on top.',
        tooltip: 'Profit margin of 20%+ and a dividend yield of 1.5%+ — cash-generative payers.',
        columns: ['profitMargin', 'dividendYield', 'roe'],
        sortBy: 'profitMargin', sortDir: 'desc',
        filter: (s) => (s.profitMargin ?? 0) >= 20 && (s.dividendYield ?? 0) >= 1.5,
    },
];

/** glossary term for a collection metric column (for InfoTooltip). */
export const COLLECTION_TERM: Record<CollectionMetricKey, string | undefined> = {
    dividendYield: 'dividendYield', roe: 'roe', trailingPE: 'pe', priceToBook: 'pb',
    pegRatio: 'peg', profitMargin: 'profitMargin', revenueGrowth: 'revenueGrowth',
    earningsGrowth: 'earningsGrowth', debtToEquity: 'debtToEquity', beta: 'beta',
    marketCap: undefined, changePercent: undefined,
};

export const COLLECTION_LABEL: Record<CollectionMetricKey, string> = {
    dividendYield: 'Div Yield', roe: 'ROE', trailingPE: 'P/E', priceToBook: 'P/B',
    pegRatio: 'PEG', profitMargin: 'Margin', revenueGrowth: 'Rev Growth',
    earningsGrowth: 'EPS Growth', debtToEquity: 'D/E', beta: 'Beta',
    marketCap: 'Mkt Cap', changePercent: 'Day %',
};
