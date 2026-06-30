"use client";

/**
 * Stock Evaluation Scorecard — a multi-factor radar (Trend, Momentum, Value,
 * Quality, Growth, Low-Risk) with a weighted composite grade. Axis weights are
 * user-configurable and recompute the composite live. Research/education only.
 */

import { useEffect, useMemo, useState } from "react";
import { Gauge, Loader2, Settings } from "lucide-react";
import { getStockScorecard } from "@/lib/actions/scorecard.actions";

const SIZE = 280;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 95;

function pointAt(idx: number, total: number, radius: number): [number, number] {
    const angle = (-90 + (idx * 360) / total) * (Math.PI / 180);
    return [CX + radius * Math.cos(angle), CY + radius * Math.sin(angle)];
}

function RadarChart({ axes }: { axes: ScorecardAxis[] }) {
    const n = axes.length;
    const rings = [25, 50, 75, 100];
    const dataPts = axes.map((a, i) => pointAt(i, n, (R * (a.score ?? 0)) / 100));
    const polygon = dataPts.map((p) => p.join(",")).join(" ");

    return (
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[300px]">
            {rings.map((ring) => {
                const pts = axes.map((_, i) => pointAt(i, n, (R * ring) / 100).join(",")).join(" ");
                return <polygon key={ring} points={pts} fill="none" stroke="#374151" strokeWidth={0.5} />;
            })}
            {axes.map((a, i) => {
                const [x, y] = pointAt(i, n, R);
                const [lx, ly] = pointAt(i, n, R + 16);
                return (
                    <g key={a.key}>
                        <line x1={CX} y1={CY} x2={x} y2={y} stroke="#374151" strokeWidth={0.5} />
                        <text x={lx} y={ly} fill="#9ca3af" fontSize={9} textAnchor="middle" dominantBaseline="middle">
                            {a.label}
                        </text>
                        <text x={lx} y={ly + 9} fill="#6b7280" fontSize={8} textAnchor="middle" dominantBaseline="middle">
                            {a.score ?? "—"}
                        </text>
                    </g>
                );
            })}
            <polygon points={polygon} fill="#0FEDBE" fillOpacity={0.18} stroke="#0FEDBE" strokeWidth={1.5} />
            {dataPts.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill="#0FEDBE" />
            ))}
        </svg>
    );
}

function scoreTone(score: number | null) {
    if (score == null) return "text-gray-500";
    return score >= 60 ? "text-green-400" : score <= 40 ? "text-red-400" : "text-amber-300";
}

function gradeTone(grade: string) {
    if (grade.startsWith("A")) return "text-green-400";
    if (grade.startsWith("B")) return "text-teal-300";
    if (grade.startsWith("C")) return "text-amber-300";
    return "text-red-400";
}

export default function StockScorecard({ symbol }: { symbol: string }) {
    const [data, setData] = useState<StockScorecard | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [weights, setWeights] = useState<Record<string, number>>({});

    useEffect(() => {
        let active = true;
        setLoading(true);
        getStockScorecard(symbol).then((res) => {
            if (active) {
                setData(res);
                setWeights(Object.fromEntries(res.axes.map((a) => [a.key, Math.round(a.weight * 100)])));
                setLoading(false);
            }
        });
        return () => {
            active = false;
        };
    }, [symbol]);

    // Weighted composite over axes that have a score.
    const composite = useMemo(() => {
        if (!data) return 0;
        let wSum = 0;
        let acc = 0;
        for (const a of data.axes) {
            if (a.score == null) continue;
            const w = weights[a.key] ?? Math.round(a.weight * 100);
            wSum += w;
            acc += w * a.score;
        }
        return wSum > 0 ? Math.round(acc / wSum) : 0;
    }, [data, weights]);

    const grade = useMemo(() => {
        if (composite >= 85) return "A+";
        if (composite >= 75) return "A";
        if (composite >= 65) return "B+";
        if (composite >= 55) return "B";
        if (composite >= 45) return "C+";
        if (composite >= 35) return "C";
        return "D";
    }, [composite]);

    return (
        <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-teal-400" />
                    <h3 className="text-base font-semibold text-gray-100">Evaluation Scorecard</h3>
                </div>
                <button
                    type="button"
                    onClick={() => setShowSettings((v) => !v)}
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${showSettings ? "border-teal-500/50 bg-teal-500/15 text-teal-300" : "border-gray-700 bg-gray-800/60 text-gray-400 hover:text-teal-300"}`}
                >
                    <Settings className="h-3.5 w-3.5" /> Weights
                </button>
            </div>

            {loading && (
                <div className="flex items-center gap-2 py-6 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Scoring…
                </div>
            )}

            {!loading && data && !data.available && (
                <p className="py-4 text-sm text-gray-400">{data.error ?? "Scorecard unavailable."}</p>
            )}

            {!loading && data?.available && (
                <div className="flex flex-col gap-4">
                    {showSettings && (
                        <div className="rounded-lg border border-gray-700/60 bg-black/20 p-3">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {data.axes.map((a) => (
                                    <label key={a.key} className="flex items-center gap-2 text-xs text-gray-400">
                                        <span className="w-20 shrink-0">{a.label}</span>
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            value={weights[a.key] ?? Math.round(a.weight * 100)}
                                            onChange={(e) => setWeights({ ...weights, [a.key]: Number(e.target.value) })}
                                            className="flex-1 accent-teal-400"
                                        />
                                        <span className="w-7 text-right tabular-nums text-gray-300">{weights[a.key] ?? Math.round(a.weight * 100)}</span>
                                    </label>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => setWeights(Object.fromEntries(data.axes.map((a) => [a.key, Math.round(a.weight * 100)])))}
                                className="mt-2 rounded-md border border-gray-700 px-3 py-1 text-xs text-gray-400 hover:text-gray-200"
                            >
                                Reset weights
                            </button>
                        </div>
                    )}

                    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                        <RadarChart axes={data.axes} />
                        <div className="flex flex-col items-center">
                            <div className={`text-5xl font-bold ${gradeTone(grade)}`}>{grade}</div>
                            <div className="mt-1 text-sm text-gray-400">Composite <span className="font-semibold text-gray-200">{composite}/100</span></div>
                            <div className="mt-2 h-2 w-32 overflow-hidden rounded-full bg-gray-700">
                                <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-green-500" style={{ width: `${composite}%` }} />
                            </div>
                            <div className="mt-1 text-[11px] text-gray-500">weighted across {data.axes.filter((a) => a.score != null).length} factors</div>
                        </div>
                    </div>

                    {/* Axis breakdown */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {data.axes.map((a) => (
                            <div key={a.key} className="rounded-md bg-black/20 p-2.5">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-xs font-semibold text-gray-200">{a.label}</span>
                                    <span className={`text-sm font-bold tabular-nums ${scoreTone(a.score)}`}>{a.score ?? "—"}</span>
                                </div>
                                <p className="text-[11px] text-gray-500">{a.summary}</p>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
                                    {a.factors.map((f) => (
                                        <span key={f.label}>
                                            {f.label}: <span className="text-gray-300">{f.value}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <p className="text-[11px] text-gray-600">
                        Factor scores blend our technical signals with fundamental ratios, normalized 0–100. Adjust the weights to match your
                        style. A research summary, not a rating or recommendation — not investment advice.
                    </p>
                </div>
            )}
        </div>
    );
}
