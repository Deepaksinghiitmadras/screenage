"use client";

/**
 * Themed Collections — browse curated, filter-based baskets computed live from
 * the universe's fundamentals. Each collection is dynamic; the detail view is
 * configurable (sort + minimum market cap). Research/education only.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Layers, ArrowUpDown } from "lucide-react";
import { COLLECTIONS, COLLECTION_TERM, COLLECTION_LABEL, type CollectionMetricKey } from "@/lib/collections";
import InfoTooltip from "@/components/InfoTooltip";

const PCT_COLS = new Set<CollectionMetricKey>(["dividendYield", "roe", "profitMargin", "revenueGrowth", "earningsGrowth", "changePercent"]);

const inrCr = (v: number | null) => (v == null ? "—" : `₹${Math.round(v / 1e7).toLocaleString("en-IN")} Cr`);

function fmtMetric(key: CollectionMetricKey, v: number | null): string {
    if (v == null || Number.isNaN(v)) return "—";
    if (key === "marketCap") return inrCr(v);
    if (PCT_COLS.has(key)) return `${v.toFixed(1)}%`;
    return v.toFixed(2);
}

export default function CollectionsWorkspace({ universe }: { universe: ScreenerStock[] }) {
    const [selectedId, setSelectedId] = useState(COLLECTIONS[0].id);
    const selected = COLLECTIONS.find((c) => c.id === selectedId)!;
    const [sortBy, setSortBy] = useState<CollectionMetricKey>(selected.sortBy);
    const [sortDir, setSortDir] = useState<"asc" | "desc">(selected.sortDir);
    const [minCapCr, setMinCapCr] = useState(0);

    // Counts per collection (computed once from the universe).
    const counts = useMemo(() => {
        const map: Record<string, number> = {};
        for (const c of COLLECTIONS) map[c.id] = universe.filter(c.filter).length;
        return map;
    }, [universe]);

    const selectCollection = (id: string) => {
        const c = COLLECTIONS.find((x) => x.id === id)!;
        setSelectedId(id);
        setSortBy(c.sortBy);
        setSortDir(c.sortDir);
    };

    const rows = useMemo(() => {
        const list = universe
            .filter(selected.filter)
            .filter((s) => (s.marketCap ?? 0) >= minCapCr * 1e7);
        const dir = sortDir === "asc" ? 1 : -1;
        return list.sort((a, b) => {
            const av = a[sortBy] ?? (sortDir === "asc" ? Infinity : -Infinity);
            const bv = b[sortBy] ?? (sortDir === "asc" ? Infinity : -Infinity);
            return (av - bv) * dir;
        });
    }, [universe, selected, sortBy, sortDir, minCapCr]);

    const columns = selected.columns;

    return (
        <div className="mx-auto min-h-screen w-full max-w-7xl p-4 md:p-6 lg:p-8">
            <div className="mb-5">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-100">
                    <Layers className="h-6 w-6 text-teal-400" /> Collections
                </h1>
                <p className="mt-1 text-sm text-gray-400">Curated, live-computed baskets of stocks by theme. Filters re-evaluate on current fundamentals. Research/education only, not investment advice.</p>
            </div>

            {/* Collection cards */}
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {COLLECTIONS.map((c) => (
                    <button
                        key={c.id}
                        onClick={() => selectCollection(c.id)}
                        className={`rounded-lg border p-3 text-left transition-colors ${selectedId === c.id ? "border-teal-500/50 bg-teal-500/10" : "border-gray-700 bg-gray-800/40 hover:border-gray-600"}`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xl">{c.emoji}</span>
                            <span className="rounded-full bg-gray-700/60 px-2 py-0.5 text-[11px] text-gray-300">{counts[c.id] ?? 0}</span>
                        </div>
                        <div className={`mt-1.5 flex items-center gap-1 text-sm font-semibold ${selectedId === c.id ? "text-teal-300" : "text-gray-200"}`}>
                            {c.name}<InfoTooltip text={c.tooltip} align="left" />
                        </div>
                        <p className="mt-0.5 text-[11px] text-gray-500">{c.description}</p>
                    </button>
                ))}
            </div>

            {/* Detail table */}
            <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-200">
                        <span>{selected.emoji}</span> {selected.name}
                        <span className="text-xs font-normal text-gray-500">· {rows.length} stocks</span>
                        <InfoTooltip text={selected.tooltip} />
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <label className="flex items-center gap-1 text-gray-400">
                            Min cap ₹Cr
                            <input type="number" min={0} step={1000} value={minCapCr} onChange={(e) => setMinCapCr(Math.max(0, Number(e.target.value) || 0))} className="w-20 rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1 text-gray-100 focus:border-teal-500 focus:outline-none" />
                        </label>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as CollectionMetricKey)} className="rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1 text-gray-300 focus:outline-none">
                            {columns.map((col) => <option key={col} value={col}>Sort: {COLLECTION_LABEL[col]}</option>)}
                            <option value="marketCap">Sort: Mkt Cap</option>
                        </select>
                        <button onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} className="flex items-center gap-1 rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1 text-gray-300 hover:text-teal-300">
                            <ArrowUpDown className="h-3.5 w-3.5" /> {sortDir === "asc" ? "Asc" : "Desc"}
                        </button>
                    </div>
                </div>

                {rows.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">No stocks currently match this theme (data may be loading or rate-limited).</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-gray-700 text-[11px] uppercase tracking-wide text-gray-500">
                                    <th className="px-2 py-2 text-left font-medium">Company</th>
                                    <th className="px-2 py-2 text-right font-medium">Price ₹</th>
                                    {columns.map((col) => (
                                        <th key={col} className="px-2 py-2 text-right font-medium">
                                            <span className="inline-flex items-center gap-1">{COLLECTION_LABEL[col]}{COLLECTION_TERM[col] && <InfoTooltip term={COLLECTION_TERM[col]} align="right" />}</span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((s) => (
                                    <tr key={s.symbol} className="border-b border-gray-800/70 hover:bg-gray-800/40">
                                        <td className="px-2 py-2">
                                            <Link href={`/stocks/${s.symbol}`} className="font-semibold text-gray-100 hover:text-teal-400">{s.symbol}</Link>
                                            <div className="max-w-[160px] truncate text-[11px] text-gray-500">{s.name}</div>
                                        </td>
                                        <td className="px-2 py-2 text-right tabular-nums text-gray-300">{s.price != null ? s.price.toLocaleString("en-IN") : "—"}</td>
                                        {columns.map((col) => (
                                            <td key={col} className="px-2 py-2 text-right tabular-nums text-gray-300">{fmtMetric(col, s[col])}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <p className="mt-3 text-[11px] text-gray-600">Filters run on delayed fundamentals over our curated universe · a starting point for research, not a recommendation.</p>
            </div>
        </div>
    );
}
