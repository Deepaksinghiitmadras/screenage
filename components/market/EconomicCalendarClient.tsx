'use client';

import { useMemo, useState } from 'react';

/** ISO-2 country code → flag emoji (EU handled via regional indicators E+U). */
function flag(code: string): string {
    if (!code || code.length !== 2) return '🏳️';
    const cc = code.toUpperCase();
    return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65)));
}

function fmtTime(epoch: number): string {
    if (!epoch) return '--:--';
    return new Date(epoch * 1000).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata',
    });
}

function dayLabel(epoch: number): string {
    const d = new Date(epoch * 1000);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const same = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
    if (same(d, today)) return 'Today';
    if (same(d, tomorrow)) return 'Tomorrow';
    return d.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'Asia/Kolkata',
    });
}

function fmtVal(v: number | string | null, unit: string): string {
    if (v === null || v === undefined || v === '') return '—';
    return `${v}${unit ?? ''}`;
}

function Importance({ level }: { level: number }) {
    return (
        <span className="inline-flex items-center gap-0.5" title={`Importance ${level}/3`}>
            {[1, 2, 3].map((i) => (
                <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${
                        i <= level
                            ? level >= 3
                                ? 'bg-red-400'
                                : level === 2
                                  ? 'bg-amber-400'
                                  : 'bg-gray-400'
                            : 'bg-gray-700'
                    }`}
                />
            ))}
        </span>
    );
}

const COUNTRY_NAMES: Record<string, string> = {
    US: 'United States',
    IN: 'India',
    GB: 'United Kingdom',
    EU: 'Euro Area',
    CN: 'China',
    JP: 'Japan',
};

const num = (v: number | string | null): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.+-]/g, ''));
    return Number.isFinite(n) ? n : null;
};

export default function EconomicCalendarClient({
    events,
    height = 520,
    title = 'Economic Calendar',
}: {
    events: MarketCalendarEvent[];
    height?: number;
    title?: string;
}) {
    // Filters
    const [minImportance, setMinImportance] = useState(1); // 1=all, 2=med+, 3=high only
    const [activeCountries, setActiveCountries] = useState<Set<string>>(new Set());
    const [query, setQuery] = useState('');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const countries = useMemo(() => {
        const set = new Set(events.map((e) => e.country).filter(Boolean));
        return Array.from(set).sort();
    }, [events]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return events.filter((e) => {
            if (e.importance < minImportance) return false;
            if (activeCountries.size > 0 && !activeCountries.has(e.country)) return false;
            if (q && !e.title.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [events, minImportance, activeCountries, query]);

    const groups = useMemo(() => {
        const out: { label: string; items: MarketCalendarEvent[] }[] = [];
        for (const ev of filtered) {
            const label = dayLabel(ev.datetime);
            const last = out[out.length - 1];
            if (last && last.label === label) last.items.push(ev);
            else out.push({ label, items: [ev] });
        }
        return out;
    }, [filtered]);

    const toggleCountry = (c: string) => {
        setActiveCountries((prev) => {
            const next = new Set(prev);
            if (next.has(c)) next.delete(c);
            else next.add(c);
            return next;
        });
    };

    const toggleExpand = (id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const IMPORTANCE_OPTS = [
        { v: 1, label: 'All' },
        { v: 2, label: 'Med+' },
        { v: 3, label: 'High' },
    ];

    return (
        <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
                <span className="rounded bg-teal-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-teal-300">
                    Native · IST
                </span>
            </div>

            {/* Filters */}
            <div className="mb-3 space-y-2">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search events…"
                    className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />

                <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-gray-500">Impact</span>
                    {IMPORTANCE_OPTS.map((o) => (
                        <button
                            key={o.v}
                            type="button"
                            onClick={() => setMinImportance(o.v)}
                            className={`rounded px-2 py-0.5 font-medium transition-colors ${
                                minImportance === o.v
                                    ? 'bg-teal-500/20 text-teal-300'
                                    : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                            }`}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                    {countries.map((c) => {
                        const on = activeCountries.size === 0 || activeCountries.has(c);
                        return (
                            <button
                                key={c}
                                type="button"
                                onClick={() => toggleCountry(c)}
                                title={COUNTRY_NAMES[c] ?? c}
                                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                                    activeCountries.has(c)
                                        ? 'bg-teal-500/20 text-teal-200'
                                        : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                                } ${activeCountries.size > 0 && !activeCountries.has(c) ? 'opacity-50' : ''}`}
                            >
                                <span aria-hidden>{flag(c)}</span>
                                {c}
                            </button>
                        );
                    })}
                    {activeCountries.size > 0 && (
                        <button
                            type="button"
                            onClick={() => setActiveCountries(new Set())}
                            className="rounded px-1.5 py-0.5 text-[11px] text-teal-400 hover:bg-gray-800"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">No events match these filters.</p>
            ) : (
                <div className="overflow-y-auto pr-1" style={{ maxHeight: height }}>
                    {groups.map((g) => (
                        <div key={g.label} className="mb-3">
                            <div className="sticky top-0 z-10 bg-gray-800/95 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                {g.label}
                            </div>
                            <ul className="divide-y divide-gray-700/50">
                                {g.items.map((ev) => {
                                    const isOpen = expanded.has(ev.id);
                                    const a = num(ev.actual);
                                    const f = num(ev.forecast);
                                    const beat = a !== null && f !== null ? a - f : null;
                                    return (
                                        <li key={ev.id}>
                                            <button
                                                type="button"
                                                onClick={() => toggleExpand(ev.id)}
                                                className="flex w-full items-start gap-2 py-2 text-left hover:bg-gray-700/20"
                                            >
                                                <span className="w-10 flex-shrink-0 pt-0.5 text-xs tabular-nums text-gray-500">
                                                    {fmtTime(ev.datetime)}
                                                </span>
                                                <span className="pt-0.5 text-base leading-none" aria-hidden>
                                                    {flag(ev.country)}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="truncate text-sm text-gray-100">
                                                            {ev.title}
                                                        </p>
                                                        <Importance level={ev.importance} />
                                                    </div>
                                                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                                                        <span>
                                                            A:{' '}
                                                            <span className="text-gray-200">
                                                                {fmtVal(ev.actual, ev.unit)}
                                                            </span>
                                                        </span>
                                                        <span>
                                                            F:{' '}
                                                            <span className="text-gray-300">
                                                                {fmtVal(ev.forecast, ev.unit)}
                                                            </span>
                                                        </span>
                                                        <span>
                                                            P:{' '}
                                                            <span className="text-gray-400">
                                                                {fmtVal(ev.previous, ev.unit)}
                                                            </span>
                                                        </span>
                                                    </div>
                                                </div>
                                                <span
                                                    className={`pt-1 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                                    aria-hidden
                                                >
                                                    ⌄
                                                </span>
                                            </button>

                                            {isOpen && (
                                                <div className="mb-2 ml-12 rounded-md border border-gray-700/60 bg-gray-900/60 p-3 text-xs">
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                                        <Detail label="Country">
                                                            {flag(ev.country)} {COUNTRY_NAMES[ev.country] ?? ev.country}
                                                        </Detail>
                                                        <Detail label="Currency">
                                                            {ev.currency || '—'}
                                                        </Detail>
                                                        <Detail label="Period">
                                                            {ev.period || '—'}
                                                        </Detail>
                                                        <Detail label="Impact">
                                                            {ev.importance >= 3
                                                                ? 'High'
                                                                : ev.importance === 2
                                                                  ? 'Medium'
                                                                  : 'Low'}
                                                        </Detail>
                                                        <Detail label="Actual">
                                                            {fmtVal(ev.actual, ev.unit)}
                                                        </Detail>
                                                        <Detail label="Forecast">
                                                            {fmtVal(ev.forecast, ev.unit)}
                                                        </Detail>
                                                        <Detail label="Previous">
                                                            {fmtVal(ev.previous, ev.unit)}
                                                        </Detail>
                                                        <Detail label="vs Forecast">
                                                            {beat === null ? (
                                                                '—'
                                                            ) : (
                                                                <span
                                                                    className={
                                                                        beat >= 0
                                                                            ? 'text-green-400'
                                                                            : 'text-red-400'
                                                                    }
                                                                >
                                                                    {beat >= 0 ? '▲ +' : '▼ '}
                                                                    {beat.toFixed(2)}
                                                                    {ev.unit}
                                                                </span>
                                                            )}
                                                        </Detail>
                                                    </div>

                                                    {ev.comment && (
                                                        <p className="mt-2 border-t border-gray-700/50 pt-2 leading-relaxed text-gray-400">
                                                            {ev.comment.length > 320
                                                                ? `${ev.comment.slice(0, 320).trim()}…`
                                                                : ev.comment}
                                                        </p>
                                                    )}

                                                    {(ev.source || ev.category) && (
                                                        <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
                                                            {ev.category && (
                                                                <span className="rounded bg-gray-800 px-1.5 py-0.5">
                                                                    {ev.category}
                                                                </span>
                                                            )}
                                                            {ev.source &&
                                                                (ev.sourceUrl ? (
                                                                    <a
                                                                        href={ev.sourceUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-teal-400 hover:underline"
                                                                    >
                                                                        Source: {ev.source} ↗
                                                                    </a>
                                                                ) : (
                                                                    <span>Source: {ev.source}</span>
                                                                ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <span className="text-gray-500">{label}: </span>
            <span className="text-gray-200">{children}</span>
        </div>
    );
}
