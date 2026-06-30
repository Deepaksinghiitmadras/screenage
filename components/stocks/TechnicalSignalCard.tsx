"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2, TrendingUp, TrendingDown, Minus, Settings } from "lucide-react";
import { getTechnicalSignals } from "@/lib/actions/technical.actions";
import RegimeBadge from "@/components/RegimeBadge";

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
    const [showSettings, setShowSettings] = useState(false);
    const [draft, setDraft] = useState<TechnicalConfig>(DEFAULT_TECH_CONFIG);
    const [config, setConfig] = useState<TechnicalConfig>(DEFAULT_TECH_CONFIG);

    useEffect(() => {
        let active = true;
        setLoading(true);
        getTechnicalSignals(symbol, config).then((res) => {
            if (active) {
                setData(res);
                setLoading(false);
            }
        });
        return () => {
            active = false;
        };
    }, [symbol, config]);

    const dirty = JSON.stringify(draft) !== JSON.stringify(config);
    const categories: TechnicalCategory[] = ["Trend", "Momentum", "Volatility", "Volume"];

    return (
        <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-teal-400" />
                    <h3 className="text-base font-semibold text-gray-100">Technical Signals</h3>
                </div>
                <button
                    type="button"
                    onClick={() => setShowSettings((v) => !v)}
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${showSettings ? "border-teal-500/50 bg-teal-500/15 text-teal-300" : "border-gray-700 bg-gray-800/60 text-gray-400 hover:text-teal-300"}`}
                >
                    <Settings className="h-3.5 w-3.5" /> Indicators
                </button>
            </div>

            {showSettings && (
                <div className="mb-4 rounded-lg border border-gray-700/60 bg-black/20 p-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                        <TechNum label="RSI period" value={draft.rsiPeriod} onChange={(v) => setDraft({ ...draft, rsiPeriod: v })} min={2} max={50} />
                        <TechNum label="SMA fast" value={draft.smaFast} onChange={(v) => setDraft({ ...draft, smaFast: v })} min={3} max={100} />
                        <TechNum label="SMA mid" value={draft.smaMid} onChange={(v) => setDraft({ ...draft, smaMid: v })} min={5} max={200} />
                        <TechNum label="SMA long" value={draft.smaLong} onChange={(v) => setDraft({ ...draft, smaLong: v })} min={20} max={300} />
                        <TechNum label="Bollinger period" value={draft.bbPeriod} onChange={(v) => setDraft({ ...draft, bbPeriod: v })} min={5} max={100} />
                        <TechNum label="Bollinger σ" value={draft.bbStd} onChange={(v) => setDraft({ ...draft, bbStd: v })} min={1} max={4} step={0.5} />
                        <TechNum label="ADX period" value={draft.adxPeriod} onChange={(v) => setDraft({ ...draft, adxPeriod: v })} min={5} max={50} />
                        <TechNum label="ATR period" value={draft.atrPeriod} onChange={(v) => setDraft({ ...draft, atrPeriod: v })} min={5} max={50} />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setConfig(draft)}
                            disabled={!dirty || loading}
                            className="rounded-md bg-teal-500/90 px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-teal-400 disabled:opacity-40"
                        >
                            Apply
                        </button>
                        <button
                            type="button"
                            onClick={() => { setDraft(DEFAULT_TECH_CONFIG); setConfig(DEFAULT_TECH_CONFIG); }}
                            className="rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200"
                        >
                            Reset
                        </button>
                        {dirty && <span className="text-[11px] text-amber-300">Unapplied changes</span>}
                    </div>
                </div>
            )}

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
                            <span className="flex items-center gap-1.5 text-xs text-gray-400">
                                Regime: <RegimeBadge regime={data.regime} size="xs" />
                            </span>
                            <span className="max-w-md text-xs text-gray-500">{data.regimeNote}</span>
                        </div>
                    </div>

                    {/* Multi-timeframe RSI */}
                    {data.multiTimeframe && data.multiTimeframe.length > 0 && (
                        <div className="rounded-lg border border-gray-700/60 bg-black/20 p-3">
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Multi-Timeframe RSI</h4>
                            <div className="grid grid-cols-3 gap-2">
                                {data.multiTimeframe.map((t) => (
                                    <div key={t.timeframe} className="rounded-md bg-gray-800/50 p-2 text-center">
                                        <div className="text-[11px] text-gray-500">{t.timeframe}</div>
                                        <div className={`text-lg font-bold ${t.signal === "bull" ? "text-green-400" : t.signal === "bear" ? "text-red-400" : "text-gray-300"}`}>
                                            {t.rsi ?? "—"}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Bollinger band position */}
                    {data.bands && <BandBar bands={data.bands} />}

                    {/* Indicators grouped by category */}
                    {categories.map((cat) => {
                        const items = data.indicators.filter((i) => (i.category ?? "Trend") === cat);
                        if (items.length === 0) return null;
                        return (
                            <div key={cat}>
                                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{cat}</h4>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {items.map((ind) => (
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
                            </div>
                        );
                    })}

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

const DEFAULT_TECH_CONFIG: TechnicalConfig = {
    rsiPeriod: 14, smaFast: 20, smaMid: 50, smaLong: 200,
    bbPeriod: 20, bbStd: 2, adxPeriod: 14, atrPeriod: 14,
};

function TechNum({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
    return (
        <label className="flex flex-col gap-1 text-[11px] text-gray-400">
            {label}
            <input
                type="number"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
                className="rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1 text-sm text-gray-100 focus:border-teal-500 focus:outline-none"
            />
        </label>
    );
}

function BandBar({ bands }: { bands: TechnicalBands }) {
    const pct = Math.max(0, Math.min(100, bands.percentB));
    return (
        <div className="rounded-lg border border-gray-700/60 bg-black/20 p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
                <h4 className="font-semibold uppercase tracking-wide text-gray-400">Bollinger Position</h4>
                <span className="text-gray-500">width {bands.widthPct}%</span>
            </div>
            <div className="relative h-2 rounded-full bg-gradient-to-r from-green-500/40 via-gray-600/40 to-red-500/40">
                <div
                    className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gray-900 bg-teal-400"
                    style={{ left: `${pct}%` }}
                    title={`%B ${bands.percentB}`}
                />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-gray-500 tabular-nums">
                <span>Lower ₹{bands.lower}</span>
                <span>Mid ₹{bands.mid}</span>
                <span>Upper ₹{bands.upper}</span>
            </div>
        </div>
    );
}
