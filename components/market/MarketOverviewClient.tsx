'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export type OverviewTab = { label: string; symbols: { s: string; d: string }[] };

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
    if (!data || data.length < 2) {
        return <div className="h-7 w-20" />;
    }
    const w = 80;
    const h = 28;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const step = w / (data.length - 1);
    const points = data
        .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`)
        .join(' ');
    const stroke = up ? '#22c55e' : '#ef4444';
    return (
        <svg width={w} height={h} className="shrink-0" viewBox={`0 0 ${w} ${h}`}>
            <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.5} />
        </svg>
    );
}

export default function MarketOverviewClient({
    tabs,
    quotes,
}: {
    tabs: OverviewTab[];
    quotes: Record<string, WatchlistQuote>;
}) {
    const [active, setActive] = useState(0);
    const [featuredKey, setFeaturedKey] = useState<string | null>(null);
    const tab = tabs[active] ?? tabs[0];

    const rows = useMemo(
        () =>
            (tab?.symbols ?? []).map(({ s, d }) => ({
                key: s,
                name: d,
                quote: quotes[s.toUpperCase()],
            })),
        [tab, quotes],
    );

    // Featured = hovered row (if it has a sparkline) else first row with data.
    const featured =
        rows.find((r) => r.key === featuredKey && r.quote?.sparkline && r.quote.sparkline.length > 2) ??
        rows.find((r) => r.quote?.sparkline && r.quote.sparkline.length > 2);

    return (
        <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-100">Market Overview</h2>
                <span className="rounded bg-teal-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-teal-300">
                    Native
                </span>
            </div>

            {/* Tabs */}
            <div className="mb-3 flex flex-wrap gap-1">
                {tabs.map((t, i) => (
                    <button
                        key={t.label}
                        type="button"
                        onClick={() => {
                            setActive(i);
                            setFeaturedKey(null);
                        }}
                        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                            i === active
                                ? 'bg-teal-500/20 text-teal-300'
                                : 'text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Featured chart */}
            {featured?.quote?.sparkline && (
                <Link
                    href={`/stocks/${encodeURIComponent(featured.key)}`}
                    className="mb-3 block rounded-md border border-gray-700/50 bg-gray-900/40 p-3 transition-colors hover:border-teal-400/40"
                >
                    <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-sm font-semibold text-gray-100">{featured.name}</span>
                        <span
                            className={`text-xs font-medium ${
                                (featured.quote.changePercent ?? 0) >= 0
                                    ? 'text-green-400'
                                    : 'text-red-400'
                            }`}
                        >
                            ₹{featured.quote.price?.toLocaleString('en-IN')} ·{' '}
                            {(featured.quote.changePercent ?? 0) >= 0 ? '+' : ''}
                            {featured.quote.changePercent}%
                        </span>
                    </div>
                    <FeaturedChart
                        data={featured.quote.sparkline}
                        up={(featured.quote.changePercent ?? 0) >= 0}
                    />
                </Link>
            )}

            {/* List */}
            <ul className="divide-y divide-gray-700/40">
                {rows.map((r) => {
                    const q = r.quote;
                    const pct = q?.changePercent ?? 0;
                    const up = pct >= 0;
                    return (
                        <li key={r.key}>
                            <Link
                                href={`/stocks/${encodeURIComponent(r.key)}`}
                                onMouseEnter={() => setFeaturedKey(r.key)}
                                className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-teal-400/5"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-gray-200">{r.name}</p>
                                    <p className="text-xs text-gray-500">{r.key}</p>
                                </div>
                                {q?.sparkline ? (
                                    <Sparkline data={q.sparkline} up={up} />
                                ) : (
                                    <div className="h-7 w-20" />
                                )}
                                <div className="w-28 text-right">
                                    <p className="text-sm font-medium text-gray-200">
                                        {q?.price != null ? `₹${q.price.toLocaleString('en-IN')}` : '—'}
                                    </p>
                                    <p className={`text-xs font-medium ${up ? 'text-green-400' : 'text-red-400'}`}>
                                        {q
                                            ? `${up ? '+' : ''}${q.change ?? 0} (${up ? '+' : ''}${pct}%)`
                                            : ''}
                                    </p>
                                </div>
                            </Link>
                        </li>
                    );
                })}
            </ul>
            <p className="mt-3 text-[11px] text-gray-600">
                Tap a stock to open its chart · delayed data, research use only.
            </p>
        </div>
    );
}

function FeaturedChart({ data, up }: { data: number[]; up: boolean }) {
    const w = 100;
    const h = 60;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const step = w / (data.length - 1);
    const pts = data.map(
        (v, i) => [i * step, h - ((v - min) / span) * h] as const,
    );
    const line = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    const area = `0,${h} ${line} ${w},${h}`;
    const stroke = up ? '#22c55e' : '#ef4444';
    const fill = up ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
    return (
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-16 w-full">
            <polygon points={area} fill={fill} />
            <polyline points={line} fill="none" stroke={stroke} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </svg>
    );
}
