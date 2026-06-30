"use client";

/**
 * Fear & Greed gauge — a composite 0-100 market-sentiment dial (CNN Fear & Greed
 * / Tickertape MMI style) built from NIFTY momentum, India VIX, breadth, 52-week
 * strength and PCR. Component weights are user-configurable and move the needle
 * live. Research/education only, not investment advice.
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2, Settings, Gauge } from "lucide-react";
import { getFearGreed } from "@/lib/actions/market.actions";
import InfoTooltip from "@/components/InfoTooltip";

const CX = 120;
const CY = 120;
const R = 96;

// Score (0-100) → angle (-90 left … +90 right), 0=top.
const angleFor = (s: number) => -90 + (s / 100) * 180;

function polar(r: number, angleDeg: number) {
    const a = (angleDeg * Math.PI) / 180;
    return { x: CX + r * Math.sin(a), y: CY - r * Math.cos(a) };
}

function arcPath(from: number, to: number, r: number) {
    const start = polar(r, angleFor(from));
    const end = polar(r, angleFor(to));
    const largeArc = to - from > 50 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

const ZONES: { from: number; to: number; color: string }[] = [
    { from: 0, to: 25, color: "#ef4444" },
    { from: 25, to: 45, color: "#f59e0b" },
    { from: 45, to: 55, color: "#eab308" },
    { from: 55, to: 75, color: "#84cc16" },
    { from: 75, to: 100, color: "#22c55e" },
];

function labelFor(v: number) {
    if (v < 25) return "Extreme Fear";
    if (v < 45) return "Fear";
    if (v < 55) return "Neutral";
    if (v < 75) return "Greed";
    return "Extreme Greed";
}

function toneFor(v: number) {
    if (v < 25) return "#ef4444";
    if (v < 45) return "#f59e0b";
    if (v < 55) return "#eab308";
    if (v < 75) return "#84cc16";
    return "#22c55e";
}

export default function FearGreedGauge() {
    const [data, setData] = useState<FearGreedResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [weights, setWeights] = useState<Record<string, number>>({});

    useEffect(() => {
        let active = true;
        setLoading(true);
        getFearGreed().then((res) => {
            if (active) {
                setData(res);
                setWeights(Object.fromEntries(res.components.map((c) => [c.key, Math.round(c.weight * 100)])));
                setLoading(false);
            }
        });
        return () => { active = false; };
    }, []);

    // Re-weight the composite client-side.
    const composite = useMemo(() => {
        if (!data || data.components.length === 0) return 50;
        let wSum = 0;
        let acc = 0;
        for (const c of data.components) {
            const w = weights[c.key] ?? Math.round(c.weight * 100);
            wSum += w;
            acc += w * c.score;
        }
        return wSum > 0 ? Math.round((acc / wSum) * 10) / 10 : 50;
    }, [data, weights]);

    const needle = polar(R - 12, angleFor(composite));
    const dirty = data ? data.components.some((c) => (weights[c.key] ?? Math.round(c.weight * 100)) !== Math.round(c.weight * 100)) : false;

    return (
        <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-100"><Gauge className="h-4 w-4 text-teal-400" /> Fear &amp; Greed</h3>
                <button
                    type="button"
                    onClick={() => setShowSettings((v) => !v)}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition-colors ${showSettings ? "border-teal-500/50 bg-teal-500/15 text-teal-300" : "border-gray-700 bg-gray-800/60 text-gray-400 hover:text-teal-300"}`}
                >
                    <Settings className="h-3.5 w-3.5" /> Weights
                </button>
            </div>

            {loading && (
                <div className="flex items-center gap-2 py-8 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Reading sentiment…
                </div>
            )}

            {!loading && data && !data.available && (
                <p className="py-4 text-sm text-gray-400">Sentiment data is temporarily unavailable.</p>
            )}

            {!loading && data?.available && (
                <div className="flex flex-col items-center gap-3">
                    <svg viewBox="0 0 240 140" className="w-full max-w-[260px]">
                        {ZONES.map((z) => (
                            <path key={z.from} d={arcPath(z.from, z.to, R)} fill="none" stroke={z.color} strokeWidth={16} strokeLinecap="butt" opacity={0.85} />
                        ))}
                        {/* needle */}
                        <line x1={CX} y1={CY} x2={needle.x} y2={needle.y} stroke={toneFor(composite)} strokeWidth={3} strokeLinecap="round" />
                        <circle cx={CX} cy={CY} r={6} fill={toneFor(composite)} />
                        <text x={CX} y={CY - 30} textAnchor="middle" fontSize={30} fontWeight={700} fill={toneFor(composite)}>{Math.round(composite)}</text>
                        <text x={20} y={134} fontSize={9} fill="#6b7280">Fear</text>
                        <text x={220} y={134} fontSize={9} fill="#6b7280" textAnchor="end">Greed</text>
                    </svg>
                    <div className="-mt-2 text-lg font-bold" style={{ color: toneFor(composite) }}>{labelFor(composite)}</div>

                    {showSettings && (
                        <div className="w-full rounded-lg border border-gray-700/60 bg-black/20 p-3">
                            {data.components.map((c) => (
                                <label key={c.key} className="mb-1.5 flex items-center gap-2 text-[11px] text-gray-400">
                                    <span className="flex w-28 shrink-0 items-center gap-1">{c.label}<InfoTooltip term={c.key} align="left" /></span>
                                    <input type="range" min={0} max={100} value={weights[c.key] ?? Math.round(c.weight * 100)} onChange={(e) => setWeights({ ...weights, [c.key]: Number(e.target.value) })} className="flex-1 accent-teal-400" />
                                    <span className="w-7 text-right tabular-nums text-gray-300">{weights[c.key] ?? Math.round(c.weight * 100)}</span>
                                </label>
                            ))}
                            {dirty && (
                                <button onClick={() => setWeights(Object.fromEntries(data.components.map((c) => [c.key, Math.round(c.weight * 100)])))} className="mt-1 rounded-md border border-gray-700 px-2 py-1 text-[11px] text-gray-400 hover:text-gray-200">Reset</button>
                            )}
                        </div>
                    )}

                    {/* Component breakdown */}
                    <div className="w-full space-y-1.5">
                        {data.components.map((c) => (
                            <div key={c.key} className="flex items-center gap-2 text-[11px]">
                                <span className="flex w-28 shrink-0 items-center gap-1 text-gray-400">{c.label}<InfoTooltip term={c.key} align="left" /></span>
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-700">
                                    <div className="h-full rounded-full" style={{ width: `${c.score}%`, background: toneFor(c.score) }} />
                                </div>
                                <span className="w-24 text-right text-gray-500">{c.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
