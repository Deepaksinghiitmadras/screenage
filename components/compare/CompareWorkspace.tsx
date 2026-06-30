"use client";

/**
 * Stock comparison — overlay the multi-factor radar of 2–4 stocks and compare
 * their key fundamentals side-by-side (best value per row highlighted). Reuses
 * the scorecard engine. Research/education only, not investment advice.
 */

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { GitCompareArrows, Loader2, Plus, Search, X } from "lucide-react";
import { getComparison } from "@/lib/actions/compare.actions";
import InfoTooltip from "@/components/InfoTooltip";

const COLORS = ["#0FEDBE", "#60a5fa", "#f59e0b", "#a78bfa"];
const PRESETS = ["TCS", "INFY", "WIPRO", "HCLTECH", "RELIANCE", "HDFCBANK", "ITC", "MARUTI"];
const MAX = 4;

const SIZE = 300;
const C = SIZE / 2;
const R = 105;

function pointAt(idx: number, total: number, radius: number): [number, number] {
    const angle = (-90 + (idx * 360) / total) * (Math.PI / 180);
    return [C + radius * Math.cos(angle), C + radius * Math.sin(angle)];
}

function MultiRadar({ stocks }: { stocks: ComparisonStock[] }) {
    const axes = stocks.find((s) => s.axes.length)?.axes ?? [];
    const n = axes.length;
    if (n === 0) return null;
    const rings = [25, 50, 75, 100];

    return (
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[340px]">
            {rings.map((ring) => (
                <polygon key={ring} points={axes.map((_, i) => pointAt(i, n, (R * ring) / 100).join(",")).join(" ")} fill="none" stroke="#374151" strokeWidth={0.5} />
            ))}
            {axes.map((a, i) => {
                const [x, y] = pointAt(i, n, R);
                const [lx, ly] = pointAt(i, n, R + 18);
                return (
                    <g key={a.key}>
                        <line x1={C} y1={C} x2={x} y2={y} stroke="#374151" strokeWidth={0.5} />
                        <text x={lx} y={ly} fill="#9ca3af" fontSize={9} textAnchor="middle" dominantBaseline="middle">{a.label}</text>
                    </g>
                );
            })}
            {stocks.map((s, si) => {
                if (!s.available) return null;
                const pts = s.axes.map((a, i) => pointAt(i, n, (R * (a.score ?? 0)) / 100));
                return (
                    <polygon key={s.symbol} points={pts.map((p) => p.join(",")).join(" ")} fill={COLORS[si % COLORS.length]} fillOpacity={0.1} stroke={COLORS[si % COLORS.length]} strokeWidth={1.75} />
                );
            })}
        </svg>
    );
}

const cr = (v: number | null) => (v == null ? "—" : v >= 1e7 ? `₹${(v / 1e7).toFixed(0)} Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(0)} L` : `₹${v.toFixed(0)}`);
const num = (v: number | null, d = 2) => (v == null ? "—" : v.toFixed(d));
const pctv = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
const price = (v: number | null) => (v == null ? "—" : `₹${v.toLocaleString("en-IN")}`);

type Better = "high" | "low" | "none";
const METRICS: { key: keyof ComparisonMetrics; label: string; term?: string; better: Better; fmt: (v: number | null) => string }[] = [
    { key: "price", label: "Price", better: "none", fmt: price },
    { key: "marketCap", label: "Market Cap", better: "high", fmt: cr },
    { key: "trailingPE", label: "P/E", term: "pe", better: "low", fmt: (v) => num(v) },
    { key: "priceToBook", label: "P/B", term: "pb", better: "low", fmt: (v) => num(v) },
    { key: "roe", label: "ROE", term: "roe", better: "high", fmt: pctv },
    { key: "profitMargin", label: "Profit Margin", term: "profitMargin", better: "high", fmt: pctv },
    { key: "debtToEquity", label: "Debt / Equity", term: "debtToEquity", better: "low", fmt: (v) => num(v) },
    { key: "revenueGrowth", label: "Revenue Growth", term: "revenueGrowth", better: "high", fmt: pctv },
    { key: "beta", label: "Beta", term: "beta", better: "low", fmt: (v) => num(v) },
    { key: "dividendYield", label: "Dividend Yield", term: "dividendYield", better: "high", fmt: pctv },
];

function bestIndex(stocks: ComparisonStock[], key: keyof ComparisonMetrics, better: Better): number {
    if (better === "none") return -1;
    let best = -1;
    let bestVal = better === "high" ? -Infinity : Infinity;
    stocks.forEach((s, i) => {
        const v = s.metrics[key];
        if (v == null) return;
        if ((better === "high" && v > bestVal) || (better === "low" && v < bestVal)) { bestVal = v; best = i; }
    });
    return best;
}

const gradeTone = (g: string) => (g.startsWith("A") ? "text-green-400" : g.startsWith("B") ? "text-teal-300" : g.startsWith("C") ? "text-amber-300" : "text-red-400");

export default function CompareWorkspace() {
    const [symbols, setSymbols] = useState<string[]>(["TCS", "INFY"]);
    const [input, setInput] = useState("");
    const [data, setData] = useState<ComparisonStock[]>([]);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (symbols.length === 0) { setData([]); return; }
        startTransition(async () => setData(await getComparison(symbols)));
    }, [symbols]);

    const add = (raw: string) => {
        const sym = raw.trim().toUpperCase();
        if (!sym || symbols.includes(sym) || symbols.length >= MAX) return;
        setSymbols([...symbols, sym]);
        setInput("");
    };
    const remove = (sym: string) => setSymbols(symbols.filter((s) => s !== sym));

    return (
        <div className="mx-auto min-h-screen w-full max-w-7xl p-4 md:p-6 lg:p-8">
            <div className="mb-5">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-100">
                    <GitCompareArrows className="h-6 w-6 text-teal-400" /> Compare Stocks
                </h1>
                <p className="mt-1 text-sm text-gray-400">Overlay up to {MAX} stocks' factor radars and compare fundamentals side-by-side. Research/education only, not investment advice.</p>
            </div>

            {/* Selected chips + add */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                {symbols.map((s, i) => (
                    <span key={s} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm" style={{ borderColor: COLORS[i % COLORS.length], color: COLORS[i % COLORS.length] }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        {s}
                        <button onClick={() => remove(s)} className="opacity-70 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
                    </span>
                ))}
                {symbols.length < MAX && (
                    <form onSubmit={(e) => { e.preventDefault(); add(input); }} className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-800/60 px-3 py-1">
                        <Search className="h-3.5 w-3.5 text-gray-500" />
                        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Add symbol" className="w-28 bg-transparent text-sm uppercase text-gray-100 placeholder:text-gray-500 focus:outline-none" />
                        <button type="submit" className="text-teal-400 hover:text-teal-300"><Plus className="h-4 w-4" /></button>
                    </form>
                )}
            </div>

            {/* Presets */}
            {symbols.length < MAX && (
                <div className="mb-6 flex flex-wrap gap-2">
                    {PRESETS.filter((p) => !symbols.includes(p)).map((p) => (
                        <button key={p} onClick={() => add(p)} className="rounded-full border border-gray-700 bg-gray-800/40 px-3 py-1 text-xs text-gray-300 hover:text-teal-300">{p}</button>
                    ))}
                </div>
            )}

            {isPending && (
                <div className="flex items-center gap-2 py-8 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Comparing…</div>
            )}

            {!isPending && data.length > 0 && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Radar overlay */}
                    <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
                        <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold text-gray-200">Factor Radar<InfoTooltip text="Each axis is a 0–100 factor score (Trend, Momentum, Value, Quality, Growth, Low-Risk). A bigger, more balanced shape is generally stronger." /></h3>
                        <div className="flex flex-col items-center gap-3">
                            <MultiRadar stocks={data} />
                            <div className="flex flex-wrap justify-center gap-3 text-xs">
                                {data.map((s, i) => (
                                    <span key={s.symbol} className="flex items-center gap-1.5">
                                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                                        <span className="text-gray-300">{s.symbol}</span>
                                        <span className={`font-bold ${gradeTone(s.grade)}`}>{s.available ? s.grade : "—"}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Factor scores table */}
                    <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
                        <h3 className="mb-2 text-sm font-semibold text-gray-200">Factor Scores (0–100)</h3>
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-gray-700 text-gray-500">
                                    <th className="py-1.5 text-left font-medium">Factor</th>
                                    {data.map((s) => <th key={s.symbol} className="py-1.5 text-right font-medium text-gray-300">{s.symbol}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {(data.find((s) => s.axes.length)?.axes ?? []).map((axis, ai) => {
                                    const vals = data.map((s) => s.axes[ai]?.score ?? null);
                                    const best = Math.max(...vals.map((v) => v ?? -1));
                                    return (
                                        <tr key={axis.key} className="border-b border-gray-800/70">
                                            <td className="py-1.5 text-gray-400">{axis.label}</td>
                                            {vals.map((v, i) => (
                                                <td key={i} className={`py-1.5 text-right tabular-nums ${v != null && v === best && best > 0 ? "font-bold text-teal-300" : "text-gray-300"}`}>{v ?? "—"}</td>
                                            ))}
                                        </tr>
                                    );
                                })}
                                <tr>
                                    <td className="py-1.5 font-semibold text-gray-300">Composite</td>
                                    {data.map((s) => <td key={s.symbol} className={`py-1.5 text-right font-bold ${gradeTone(s.grade)}`}>{s.available ? `${s.composite}` : "—"}</td>)}
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Fundamentals table */}
                    <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4 lg:col-span-2">
                        <h3 className="mb-2 text-sm font-semibold text-gray-200">Key Fundamentals <span className="text-[11px] font-normal text-gray-500">· best value per row highlighted</span></h3>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[560px] text-xs">
                                <thead>
                                    <tr className="border-b border-gray-700 text-gray-500">
                                        <th className="py-2 text-left font-medium">Metric</th>
                                        {data.map((s) => (
                                            <th key={s.symbol} className="py-2 text-right font-medium">
                                                <Link href={`/stocks/${s.symbol}`} className="text-gray-200 hover:text-teal-400">{s.symbol}</Link>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {METRICS.map((m) => {
                                        const best = bestIndex(data, m.key, m.better);
                                        return (
                                            <tr key={m.key} className="border-b border-gray-800/70">
                                                <td className="py-2 text-gray-400">
                                                    <span className="inline-flex items-center gap-1">{m.label}{m.term && <InfoTooltip term={m.term} align="left" />}</span>
                                                </td>
                                                {data.map((s, i) => (
                                                    <td key={i} className={`py-2 text-right tabular-nums ${i === best ? "font-bold text-teal-300" : "text-gray-300"}`}>{m.fmt(s.metrics[m.key])}</td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {!isPending && symbols.length === 0 && (
                <p className="text-sm text-gray-500">Add at least one stock to compare.</p>
            )}
        </div>
    );
}
