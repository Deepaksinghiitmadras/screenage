import { getQuotes } from '@/lib/actions/market.actions';
import MarketOverviewClient, { type OverviewTab } from './MarketOverviewClient';

const TABS: OverviewTab[] = [
    {
        label: 'Financials',
        symbols: [
            { s: 'HDFCBANK', d: 'HDFC Bank' },
            { s: 'ICICIBANK', d: 'ICICI Bank' },
            { s: 'SBIN', d: 'State Bank of India' },
            { s: 'KOTAKBANK', d: 'Kotak Mahindra Bank' },
            { s: 'AXISBANK', d: 'Axis Bank' },
        ],
    },
    {
        label: 'IT',
        symbols: [
            { s: 'TCS', d: 'Tata Consultancy' },
            { s: 'INFY', d: 'Infosys' },
            { s: 'HCLTECH', d: 'HCL Technologies' },
            { s: 'WIPRO', d: 'Wipro' },
            { s: 'TECHM', d: 'Tech Mahindra' },
        ],
    },
    {
        label: 'Energy',
        symbols: [
            { s: 'RELIANCE', d: 'Reliance Industries' },
            { s: 'ONGC', d: 'Oil & Natural Gas' },
            { s: 'NTPC', d: 'NTPC' },
            { s: 'POWERGRID', d: 'Power Grid Corp' },
            { s: 'COALINDIA', d: 'Coal India' },
        ],
    },
    {
        label: 'Auto',
        symbols: [
            { s: 'MARUTI', d: 'Maruti Suzuki' },
            { s: 'M&M', d: 'Mahindra & Mahindra' },
            { s: 'TMPV', d: 'Tata Motors' },
            { s: 'EICHERMOT', d: 'Eicher Motors' },
            { s: 'BAJAJ-AUTO', d: 'Bajaj Auto' },
        ],
    },
    {
        label: 'FMCG',
        symbols: [
            { s: 'HINDUNILVR', d: 'Hindustan Unilever' },
            { s: 'ITC', d: 'ITC' },
            { s: 'NESTLEIND', d: 'Nestlé India' },
            { s: 'BRITANNIA', d: 'Britannia' },
            { s: 'TATACONSUM', d: 'Tata Consumer' },
        ],
    },
    {
        label: 'Pharma',
        symbols: [
            { s: 'SUNPHARMA', d: 'Sun Pharma' },
            { s: 'DRREDDY', d: "Dr Reddy's Labs" },
            { s: 'CIPLA', d: 'Cipla' },
            { s: 'DIVISLAB', d: "Divi's Labs" },
            { s: 'APOLLOHOSP', d: 'Apollo Hospitals' },
        ],
    },
    {
        label: 'Metals',
        symbols: [
            { s: 'TATASTEEL', d: 'Tata Steel' },
            { s: 'JSWSTEEL', d: 'JSW Steel' },
            { s: 'HINDALCO', d: 'Hindalco' },
            { s: 'ADANIENT', d: 'Adani Enterprises' },
            { s: 'JINDALSTEL', d: 'Jindal Steel' },
        ],
    },
    {
        label: 'Infra',
        symbols: [
            { s: 'LT', d: 'Larsen & Toubro' },
            { s: 'ADANIPORTS', d: 'Adani Ports' },
            { s: 'ULTRACEMCO', d: 'UltraTech Cement' },
            { s: 'GRASIM', d: 'Grasim Industries' },
            { s: 'SIEMENS', d: 'Siemens' },
        ],
    },
    {
        label: 'Consumer',
        symbols: [
            { s: 'TITAN', d: 'Titan Company' },
            { s: 'ASIANPAINT', d: 'Asian Paints' },
            { s: 'DMART', d: 'Avenue Supermarts' },
            { s: 'TRENT', d: 'Trent' },
            { s: 'NYKAA', d: 'FSN E-Commerce (Nykaa)' },
        ],
    },
];

export default async function MarketOverviewNative() {
    const allSymbols = TABS.flatMap((t) => t.symbols.map((s) => s.s));
    const quotes = await getQuotes(allSymbols);
    const map: Record<string, WatchlistQuote> = {};
    for (const q of quotes) {
        if (q.requested) map[q.requested.toUpperCase()] = q;
    }
    return <MarketOverviewClient tabs={TABS} quotes={map} />;
}
