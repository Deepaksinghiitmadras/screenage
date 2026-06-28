import { getFundamentals } from '@/lib/actions/market.actions';

const inr = (value: number | null, fractionDigits = 2): string => {
    if (value === null || Number.isNaN(value)) return '—';
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(value);
};

/** Format large absolute amounts the Indian way (Cr / Lakh Cr). */
const inrCompact = (value: number | null): string => {
    if (value === null || Number.isNaN(value) || value === 0) return '—';
    const crore = value / 1e7; // 1 crore = 10,000,000
    if (crore >= 1e5) return `₹${(crore / 1e5).toFixed(2)} Lakh Cr`;
    if (crore >= 1) return `₹${inr(crore, 2)} Cr`;
    return `₹${inr(value, 0)}`;
};

const pct = (value: number | null): string =>
    value === null || Number.isNaN(value) ? '—' : `${value.toFixed(2)}%`;

const ratio = (value: number | null): string =>
    value === null || Number.isNaN(value) ? '—' : value.toFixed(2);

const colorForPct = (value: number | null): string => {
    if (value === null) return 'text-gray-200';
    return value >= 0 ? 'text-green-500' : 'text-red-500';
};

const Metric = ({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) => (
    <div className="flex items-center justify-between border-b border-gray-700/60 py-2">
        <span className="text-sm text-gray-400">{label}</span>
        <span className={`text-sm font-medium ${valueClass ?? 'text-gray-100'}`}>{value}</span>
    </div>
);

export default async function FundamentalsPanel({ symbol, showHeader = true }: { symbol: string; showHeader?: boolean }) {
    const data = await getFundamentals(symbol);

    if (!data) {
        return (
            <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
                <h3 className="text-base font-semibold text-gray-100">Fundamentals</h3>
                <p className="mt-2 text-sm text-gray-400">
                    Fundamental data is unavailable for this symbol right now.
                </p>
            </div>
        );
    }

    const { metrics: m, analyst: a } = data;

    return (
        <div className="flex flex-col gap-4">
            {/* Header / price */}
            {showHeader && (
            <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-100">{data.name}</h2>
                        <p className="text-xs text-gray-400">
                            {[data.sector, data.industry].filter(Boolean).join(' • ') || data.symbol}
                        </p>
                    </div>
                    {data.price !== null && (
                        <div className="text-right">
                            <div className="text-xl font-semibold text-gray-100">₹{inr(data.price)}</div>
                            <div className={`text-sm ${colorForPct(data.changePercent)}`}>
                                {data.change !== null ? `${data.change >= 0 ? '+' : ''}${inr(data.change)}` : ''}{' '}
                                {data.changePercent !== null && (
                                    <span>({data.changePercent >= 0 ? '+' : ''}{data.changePercent.toFixed(2)}%)</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                {(data.fiftyTwoWeekLow !== null || data.fiftyTwoWeekHigh !== null) && (
                    <p className="mt-3 text-xs text-gray-400">
                        52W range: <span className="text-gray-200">₹{inr(data.fiftyTwoWeekLow)} – ₹{inr(data.fiftyTwoWeekHigh)}</span>
                    </p>
                )}
            </div>
            )}

            {/* Valuation */}
            <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
                <h3 className="mb-1 text-base font-semibold text-gray-100">Valuation</h3>
                <Metric label="Market Cap" value={inrCompact(m.marketCap)} />
                <Metric label="Enterprise Value" value={inrCompact(m.enterpriseValue)} />
                <Metric label="P/E (TTM)" value={ratio(m.trailingPE)} />
                <Metric label="Forward P/E" value={ratio(m.forwardPE)} />
                <Metric label="P/B" value={ratio(m.priceToBook)} />
                <Metric label="PEG Ratio" value={ratio(m.pegRatio)} />
                <Metric label="EPS (TTM)" value={m.eps !== null ? `₹${inr(m.eps)}` : '—'} />
                <Metric label="Book Value" value={m.bookValue !== null ? `₹${inr(m.bookValue)}` : '—'} />
                <Metric label="Dividend Yield" value={pct(m.dividendYield)} />
                <Metric label="Beta" value={ratio(m.beta)} />
            </div>

            {/* Profitability & financials */}
            <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
                <h3 className="mb-1 text-base font-semibold text-gray-100">Profitability & Financials</h3>
                <Metric label="Revenue (TTM)" value={inrCompact(m.revenue)} />
                <Metric label="Gross Profit" value={inrCompact(m.grossProfit)} />
                <Metric label="EBITDA" value={inrCompact(m.ebitda)} />
                <Metric label="Profit Margin" value={pct(m.profitMargin)} valueClass={colorForPct(m.profitMargin)} />
                <Metric label="Operating Margin" value={pct(m.operatingMargin)} valueClass={colorForPct(m.operatingMargin)} />
                <Metric label="ROE" value={pct(m.roe)} valueClass={colorForPct(m.roe)} />
                <Metric label="ROA" value={pct(m.roa)} valueClass={colorForPct(m.roa)} />
                <Metric label="Revenue Growth" value={pct(m.revenueGrowth)} valueClass={colorForPct(m.revenueGrowth)} />
                <Metric label="Earnings Growth" value={pct(m.earningsGrowth)} valueClass={colorForPct(m.earningsGrowth)} />
                <Metric label="Debt / Equity" value={ratio(m.debtToEquity)} />
                <Metric label="Current Ratio" value={ratio(m.currentRatio)} />
            </div>

            {/* Analyst view */}
            {(a.recommendation || a.targetMean !== null) && (
                <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
                    <h3 className="mb-1 text-base font-semibold text-gray-100">Analyst View</h3>
                    {a.recommendation && (
                        <Metric
                            label="Consensus"
                            value={a.recommendation.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                            valueClass="text-yellow-500"
                        />
                    )}
                    <Metric label="Target (Mean)" value={a.targetMean !== null ? `₹${inr(a.targetMean)}` : '—'} />
                    <Metric label="Target Range" value={a.targetLow !== null && a.targetHigh !== null ? `₹${inr(a.targetLow)} – ₹${inr(a.targetHigh)}` : '—'} />
                    <Metric label="Analysts Covering" value={a.numberOfAnalysts !== null ? String(Math.round(a.numberOfAnalysts)) : '—'} />
                </div>
            )}

            {data.summary && (
                <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
                    <h3 className="mb-1 text-base font-semibold text-gray-100">About</h3>
                    <p className="text-sm leading-relaxed text-gray-400 line-clamp-6">{data.summary}</p>
                    {data.website && (
                        <a
                            href={data.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-block text-xs text-teal-400 hover:underline"
                        >
                            Visit website ↗
                        </a>
                    )}
                </div>
            )}

            <p className="text-xs text-gray-500">
                Source: company filings via Yahoo Finance · delayed data, research use only.
            </p>
        </div>
    );
}
