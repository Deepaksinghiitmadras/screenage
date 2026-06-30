"use client";

/**
 * AI Price Forecast — Monte Carlo (Geometric Brownian Motion) simulation card.
 * Shows a fan chart (history + median + confidence band + sample paths),
 * probability of profit and bull/base/bear scenarios. Configurable horizon,
 * confidence, drift assumption and path count. Research/education only.
 */

import { useEffect, useState } from "react";
import { Sparkles, Loader2, Settings } from "lucide-react";
import { getForecast } from "@/lib/actions/forecast.actions";
import InfoTooltip from "@/components/InfoTooltip";

const DEFAULT_CONFIG: ForecastConfig = { horizon: 30, lookback: 252, paths: 1000, ci: 80, driftMode: "balanced" };

const DRIFT_LABELS: Record<ForecastDriftMode, string> = {
    balanced: "Balanced",
    neutral: "Random walk",
    momentum: "Momentum",
};

const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
const toneFor = (v: number) => (v > 0 ? "text-green-400" : v < 0 ? "text-red-400" : "text-gray-300");

function FanChart({ f }: { f: ForecastResult }) {
    const H = 260;
    const padTop = 12;
    const padBottom = 24;
    const padLeft = 46;
    const plotH = H - padTop - padBottom;
    const W = 860;
    const plotW = W - padLeft - 8;

    const hist = f.history;
    const last = f.lastClose;
    // Prepend last close so forecast series visually continue from history.
    const median = [last, ...f.median];
    const upper = [last, ...f.upper];
    const lower = [last, ...f.lower];
    const samples = f.samplePaths.map((s) => [last, ...s]);

    const total = hist.length + median.length - 1; // shared join point
    const allY = [...hist, ...upper, ...lower];
    const min = Math.min(...allY);
    const max = Math.max(...allY);
    const span = max - min || 1;

    const x = (i: number) => padLeft + (i / (total - 1)) * plotW;
    const y = (v: number) => padTop + plotH - ((v - min) / span) * plotH;
    const joinIdx = hist.length - 1;

    const histLine = hist.map((v, i) => `${x(i)},${y(v)}`).join(" ");
    const fLine = (arr: number[]) => arr.map((v, i) => `${x(joinIdx + i)},${y(v)}`).join(" ");
    const bandPath = `M ${upper.map((v, i) => `${x(joinIdx + i)},${y(v)}`).join(" L ")} L ${lower
        .map((v, i) => `${x(joinIdx + i)},${y(v)}`)
        .reverse()
        .join(" L ")} Z`;

    return (
        <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ minWidth: 600 }}>
                {[0, 0.25, 0.5, 0.75, 1].map((g) => {
                    const val = min + g * span;
                    const yy = padTop + plotH - g * plotH;
                    return (
                        <g key={g}>
                            <line x1={padLeft} x2={W - 8} y1={yy} y2={yy} stroke="#374151" strokeWidth={0.5} />
                            <text x={4} y={yy + 3} fill="#6b7280" fontSize={10}>₹{val.toFixed(0)}</text>
                        </g>
                    );
                })}
                {/* now divider */}
                <line x1={x(joinIdx)} x2={x(joinIdx)} y1={padTop} y2={padTop + plotH} stroke="#4b5563" strokeDasharray="3 3" strokeWidth={1} />
                <text x={x(joinIdx) + 4} y={padTop + 10} fill="#9ca3af" fontSize={9}>now</text>
                {/* confidence band */}
                <path d={bandPath} fill="#0FEDBE" opacity={0.12} />
                {/* sample paths */}
                {samples.map((s, i) => (
                    <polyline key={i} points={fLine(s)} fill="none" stroke="#5eead4" strokeWidth={0.5} opacity={0.25} />
                ))}
                {/* history + median */}
                <polyline points={histLine} fill="none" stroke="#9ca3af" strokeWidth={1.5} />
                <polyline points={fLine(median)} fill="none" stroke="#0FEDBE" strokeWidth={2} strokeDasharray="5 3" />
            </svg>
            <div className="mt-1 flex flex-wrap items-center gap-4 px-1 text-[11px] text-gray-400">
                <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 bg-gray-400" /> History (60d)</span>
                <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 border-t-2 border-dashed border-teal-400" /> Median path</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-teal-400/20" /> {f.ci}% band</span>
                <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 bg-teal-300/40" /> Sample paths</span>
            </div>
        </div>
    );
}

function ProbGauge({ pct }: { pct: number }) {
    const tone = pct >= 55 ? "#22c55e" : pct <= 45 ? "#ef4444" : "#f59e0b";
    return (
        <div className="flex flex-col items-center">
            <div className="text-2xl font-bold" style={{ color: tone }}>{pct}%</div>
            <div className="mt-1 h-2 w-24 overflow-hidden rounded-full bg-gray-700">
                <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: tone }} />
            </div>
            <div className="mt-1 text-[11px] text-gray-500">prob. of profit</div>
        </div>
    );
}

function ScenarioCard({ label, s, tone }: { label: string; s: ForecastScenario; tone: string }) {
    return (
        <div className="rounded-lg border border-gray-700/60 bg-black/20 p-3 text-center">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
            <div className={`mt-1 text-base font-bold ${tone}`}>₹{s.price.toLocaleString("en-IN")}</div>
            <div className={`text-xs ${toneFor(s.returnPct)}`}>{fmtPct(s.returnPct)}</div>
        </div>
    );
}

export default function AIForecastCard({ symbol }: { symbol: string }) {
    const [data, setData] = useState<ForecastResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [draft, setDraft] = useState<ForecastConfig>(DEFAULT_CONFIG);
    const [config, setConfig] = useState<ForecastConfig>(DEFAULT_CONFIG);

    useEffect(() => {
        let active = true;
        setLoading(true);
        getForecast(symbol, config).then((res) => {
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

    return (
        <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-teal-400" />
                    <h3 className="text-base font-semibold text-gray-100">AI Price Forecast</h3>
                    <span className="rounded bg-gray-700/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-400">Monte Carlo</span>
                    <InfoTooltip term="monteCarlo" />
                </div>
                <button
                    type="button"
                    onClick={() => setShowSettings((v) => !v)}
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${showSettings ? "border-teal-500/50 bg-teal-500/15 text-teal-300" : "border-gray-700 bg-gray-800/60 text-gray-400 hover:text-teal-300"}`}
                >
                    <Settings className="h-3.5 w-3.5" /> Model
                </button>
            </div>

            {showSettings && (
                <div className="mb-4 rounded-lg border border-gray-700/60 bg-black/20 p-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                        <Field label="Horizon (days)">
                            <Select value={draft.horizon} onChange={(v) => setDraft({ ...draft, horizon: v })} options={[10, 20, 30, 60, 90, 120]} />
                        </Field>
                        <Field label="Confidence">
                            <Select value={draft.ci} onChange={(v) => setDraft({ ...draft, ci: v })} options={[50, 68, 80, 90, 95]} suffix="%" />
                        </Field>
                        <Field label="Drift assumption">
                            <select
                                value={draft.driftMode}
                                onChange={(e) => setDraft({ ...draft, driftMode: e.target.value as ForecastDriftMode })}
                                className="w-full rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1 text-sm text-gray-100 focus:border-teal-500 focus:outline-none"
                            >
                                <option value="balanced">Balanced (½ historical drift)</option>
                                <option value="neutral">Random walk (no drift)</option>
                                <option value="momentum">Momentum (full drift)</option>
                            </select>
                        </Field>
                        <Field label="Lookback (days)">
                            <Select value={draft.lookback} onChange={(v) => setDraft({ ...draft, lookback: v })} options={[120, 252, 504]} />
                        </Field>
                        <Field label="Simulations">
                            <Select value={draft.paths} onChange={(v) => setDraft({ ...draft, paths: v })} options={[500, 1000, 2000, 5000]} />
                        </Field>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        <button type="button" onClick={() => setConfig(draft)} disabled={!dirty || loading} className="rounded-md bg-teal-500/90 px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-teal-400 disabled:opacity-40">
                            Run simulation
                        </button>
                        <button type="button" onClick={() => { setDraft(DEFAULT_CONFIG); setConfig(DEFAULT_CONFIG); }} className="rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200">
                            Reset
                        </button>
                        {dirty && <span className="text-[11px] text-amber-300">Unapplied changes</span>}
                    </div>
                </div>
            )}

            {loading && (
                <div className="flex items-center gap-2 py-6 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Running {config.paths.toLocaleString("en-IN")} simulations…
                </div>
            )}

            {!loading && data && !data.available && (
                <p className="py-4 text-sm text-gray-400">{data.error ?? "Forecast unavailable."}</p>
            )}

            {!loading && data?.available && (
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-5">
                        <ProbGauge pct={data.probProfitPct} />
                        <div className="flex flex-col gap-1 text-sm">
                            <span className="text-gray-400">
                                Expected ({data.horizonDays}d):{" "}
                                <span className={`font-semibold ${toneFor(data.expectedReturnPct)}`}>{fmtPct(data.expectedReturnPct)}</span>
                            </span>
                            <span className="text-gray-400">
                                Worst-case 5%: <span className="font-semibold text-red-400">{fmtPct(data.downside5Pct)}</span>
                            </span>
                            <span className="text-gray-500 text-xs">
                                Annualized vol {data.annualizedVolPct}% · {DRIFT_LABELS[data.driftMode]} drift · {data.paths.toLocaleString("en-IN")} paths
                            </span>
                        </div>
                    </div>

                    <FanChart f={data} />

                    <div className="grid grid-cols-3 gap-3">
                        <ScenarioCard label={`Bull (P${100 - (100 - data.ci) / 2})`} s={data.scenarios.bull} tone="text-green-400" />
                        <ScenarioCard label="Base (median)" s={data.scenarios.base} tone="text-gray-200" />
                        <ScenarioCard label={`Bear (P${(100 - data.ci) / 2})`} s={data.scenarios.bear} tone="text-red-400" />
                    </div>

                    <p className="text-[11px] text-gray-600">
                        Monte Carlo simulation assuming log-normal returns (GBM) from {data.lookback}-day drift &amp; volatility. A probabilistic
                        range of outcomes, not a prediction — markets can move outside the band. Research/education only, not investment advice.
                    </p>
                </div>
            )}
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1 text-[11px] text-gray-400">
            {label}
            {children}
        </label>
    );
}

function Select({ value, onChange, options, suffix = "" }: { value: number; onChange: (v: number) => void; options: number[]; suffix?: string }) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1 text-sm text-gray-100 focus:border-teal-500 focus:outline-none"
        >
            {options.map((o) => (
                <option key={o} value={o}>{o}{suffix}</option>
            ))}
        </select>
    );
}
