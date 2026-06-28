"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getTechnicalSignals } from "@/lib/actions/technical.actions";

const SIGNAL_DOT: Record<TechnicalSignalState, string> = {
    bull: "bg-green-500",
    bear: "bg-red-500",
    neutral: "bg-gray-500",
};

const BIAS_STYLE: Record<string, string> = {
    Bullish: "bg-green-500/15 text-green-400 border-green-500/30",
    Bearish: "bg-red-500/15 text-red-400 border-red-500/30",
    Neutral: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

function BiasIcon({ bias }: { bias: string }) {
    if (bias === "Bullish") return <TrendingUp className="h-4 w-4" />;
    if (bias === "Bearish") return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
}

function ScoreGauge({ score, bias }: { score: number; bias: string }) {
    const color = bias === "Bullish" ? "#22c55e" : bias === "Bearish" ? "#ef4444" : "#f59e0b";
    const r = 34;
    const c = Math.PI * r; // semicircle length
    const pct = score / 100;
    return (
        <div className="relative flex flex-col items-center">
            <svg width={92} height={56} viewBox="0 0 92 56">
                <path d="M 12 50 A 34 34 0 0 1 80 50" fill="none" className="stroke-gray-700" strokeWidth={8} strokeLinecap="round" />
                <path
                    d="M 12 50 A 34 34 0 0 1 80 50"
                    fill="none"
                    stroke={color}
                    strokeWidth={8}
                    strokeLinecap="round"
                    strokeDasharray={`${c * pct} ${c}`}
                />
                <text x={46} y={46} textAnchor="middle" fontSize={20} fontWeight={700} className="fill-gray-100">{score}</text>
            </svg>
            <span className="text-[10px] uppercase tracking-wide text-gray-500">/ 100</span>
        </div>
    );
}

const inr = (v: number): string => {
    if (v >= 1000) return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
    return `₹${v.toFixed(1)}`;
};

function ForecastChart({ f }: { f: PriceForecast }) {
    const W = 560;
    const H = 200;
    const padX = 10;
    const padY = 16;
    const gutter = 56; // right space for price labels
    const histLen = f.history.length;
    const total = histLen + f.horizonDays;

    const all = [...f.history, ...f.upper, ...f.lower, ...f.median];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const plotW = W - 2 * padX - gutter;
    const x = (i: number) => padX + (i / (total - 1)) * plotW;
    const y = (v: number) => padY + (1 - (v - min) / (max - min || 1)) * (H - 2 * padY);

    const histPath = f.history.map((v, i) => `${x(i)},${y(v)}`).join(" ");
    const medPath = f.median.map((v, i) => `${x(histLen + i)},${y(v)}`).join(" ");
    const bandTop = f.upper.map((v, i) => `${x(histLen + i)},${y(v)}`).join(" ");
    const bandBottom = f.lower.map((v, i) => `${x(histLen + i)},${y(v)}`).reverse().join(" ");
    const joinX = x(histLen - 1);
    const lastClose = f.history[histLen - 1];
    const joinY = y(lastClose);

    const endMed = f.median[f.median.length - 1];
    const endUpper = f.upper[f.upper.length - 1];
    const endLower = f.lower[f.lower.length - 1];
    const endX = x(total - 1);

    // Gridlines: max, mid, min
    const mid = (min + max) / 2;
    const grid = [max, mid, min];

    return (
        <div className="overflow-x-auto">
            <svg width={W} height={H} className="block">
                {/* gridlines + price labels */}
                {grid.map((v, i) => (
                    <g key={i}>
                        <line x1={padX} x2={padX + plotW} y1={y(v)} y2={y(v)} className="stroke-gray-700/60" strokeWidth={1} strokeDasharray="2 4" />
                        <text x={padX + plotW + 6} y={y(v) + 3} fontSize={10} className="fill-gray-500">{inr(v)}</text>
                    </g>
                ))}

                {/* confidence band */}
                <polygon points={`${bandTop} ${bandBottom}`} className="fill-teal-400" opacity={0.18} />

                {/* historical line */}
                <polyline points={histPath} fill="none" className="stroke-gray-400" strokeWidth={1.5} />

                {/* divider + Today label */}
                <line x1={joinX} x2={joinX} y1={padY} y2={H - padY} className="stroke-gray-500" strokeDasharray="3 3" strokeWidth={1} />
                <text x={joinX - 4} y={padY + 2} textAnchor="end" fontSize={9} className="fill-gray-500">Today</text>

                {/* median projection */}
                <polyline points={`${joinX},${joinY} ${medPath}`} fill="none" className="stroke-teal-400" strokeWidth={2} strokeDasharray="5 3" />

                {/* last close marker */}
                <circle cx={joinX} cy={joinY} r={3.5} className="fill-gray-100" />

                {/* projection end markers + labels */}
                <circle cx={endX} cy={y(endMed)} r={3.5} className="fill-teal-400" />
                <text x={endX} y={y(endUpper) - 5} textAnchor="end" fontSize={9.5} className="fill-teal-300">{inr(endUpper)}</text>
                <text x={endX} y={y(endMed) - 6} textAnchor="end" fontSize={10} fontWeight={600} className="fill-teal-200">{inr(endMed)}</text>
                <text x={endX} y={y(endLower) + 12} textAnchor="end" fontSize={9.5} className="fill-teal-300">{inr(endLower)}</text>
            </svg>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
                <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-3 bg-gray-400" /> Past 60 days</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-3 border-t-2 border-dashed border-teal-400" /> Expected path</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-sm bg-teal-400/30" /> 80% range</span>
            </div>
        </div>
    );
}

export default function TechnicalSignalCard({ symbol }: { symbol: string }) {
    const [data, setData] = useState<TechnicalSignals | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        setLoading(true);
        getTechnicalSignals(symbol).then((res) => {
            if (active) {
                setData(res);
                setLoading(false);
            }
        });
        return () => {
            active = false;
        };
    }, [symbol]);

    return (
        <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
            <div className="mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-teal-400" />
                <h3 className="text-base font-semibold text-gray-100">Technical Signals</h3>
            </div>

            {loading && (
                <div className="flex items-center gap-2 py-6 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Scanning indicators…
                </div>
            )}

            {!loading && data && !data.available && (
                <p className="py-4 text-sm text-gray-400">{data.error ?? "Signals unavailable."}</p>
            )}

            {!loading && data?.available && (
                <div className="flex flex-col gap-4">
                    {/* Score + bias + regime */}
                    <div className="flex flex-wrap items-center gap-4">
                        <ScoreGauge score={data.score} bias={data.bias} />
                        <div className="flex flex-col gap-1.5">
                            <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${BIAS_STYLE[data.bias]}`}>
                                <BiasIcon bias={data.bias} /> {data.bias}
                            </span>
                            <span className="text-xs text-gray-400">
                                Regime: <span className="font-medium text-gray-200">{data.regime}</span>
                            </span>
                            <span className="max-w-md text-xs text-gray-500">{data.regimeNote}</span>
                        </div>
                    </div>

                    {/* Indicators */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {data.indicators.map((ind) => (
                            <div key={ind.label} className="flex items-start gap-2 rounded-md bg-black/20 p-2.5">
                                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${SIGNAL_DOT[ind.signal]}`} />
                                <div className="min-w-0">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="text-xs font-medium text-gray-300">{ind.label}</span>
                                        <span className="text-xs tabular-nums text-gray-400">{ind.value}</span>
                                    </div>
                                    <p className="text-[11px] text-gray-500">{ind.note}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Forecast */}
                    {data.forecast && (
                        <div className="rounded-lg border border-gray-700/60 bg-black/20 p-3">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                    {data.forecast.horizonDays}-Day Projection
                                </h4>
                                <div className="flex items-center gap-3 text-xs">
                                    <span className={data.forecast.expectedReturnPct >= 0 ? "text-green-400" : "text-red-400"}>
                                        Expected {data.forecast.expectedReturnPct >= 0 ? "+" : ""}{data.forecast.expectedReturnPct}%
                                    </span>
                                    <span className="text-gray-500">Vol {data.forecast.annualizedVolPct}%</span>
                                    <span className="text-gray-500">Confidence: {data.forecast.confidence}</span>
                                </div>
                            </div>
                            <ForecastChart f={data.forecast} />
                            <p className="mt-2 text-[11px] text-gray-600">
                                Statistical projection (drift + 80% volatility band) from delayed data. A model estimate, not a
                                prediction — not investment advice.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
