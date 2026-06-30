"use client";

/**
 * Market Regime banner — the overall Indian-market regime (from NIFTY trend,
 * India VIX and breadth) with configurable volatility threshold & trend window.
 */

import { useEffect, useState } from "react";
import { Loader2, Settings, Activity } from "lucide-react";
import { getMarketRegime } from "@/lib/actions/market.actions";
import RegimeBadge from "@/components/RegimeBadge";
import InfoTooltip from "@/components/InfoTooltip";

const DEFAULT_CONFIG: MarketRegimeConfig = { vixHigh: 16, lookback: 30 };

const RISK_META: Record<string, { label: string; cls: string }> = {
    "risk-on": { label: "Risk-On", cls: "text-green-400" },
    "risk-off": { label: "Risk-Off", cls: "text-red-400" },
    neutral: { label: "Neutral", cls: "text-amber-300" },
};

const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

export default function MarketRegimeBanner() {
    const [data, setData] = useState<MarketRegime | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [draft, setDraft] = useState<MarketRegimeConfig>(DEFAULT_CONFIG);
    const [config, setConfig] = useState<MarketRegimeConfig>(DEFAULT_CONFIG);

    useEffect(() => {
        let active = true;
        setLoading(true);
        getMarketRegime(config).then((res) => {
            if (active) {
                setData(res);
                setLoading(false);
            }
        });
        return () => {
            active = false;
        };
    }, [config]);

    const dirty = draft.vixHigh !== config.vixHigh || draft.lookback !== config.lookback;
    const risk = data ? RISK_META[data.risk] ?? RISK_META.neutral : RISK_META.neutral;

    return (
        <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Activity className="h-5 w-5 text-teal-400" />
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 text-sm font-semibold text-gray-100">Market Regime<InfoTooltip term="regime" align="left" /></span>
                            {data?.available && <RegimeBadge regime={data.regime} size="md" />}
                        </div>
                        {data?.available && (
                            <p className="mt-0.5 max-w-xl text-xs text-gray-500">{data.note}</p>
                        )}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setShowSettings((v) => !v)}
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${showSettings ? "border-teal-500/50 bg-teal-500/15 text-teal-300" : "border-gray-700 bg-gray-800/60 text-gray-400 hover:text-teal-300"}`}
                >
                    <Settings className="h-3.5 w-3.5" /> Tune
                </button>
            </div>

            {showSettings && (
                <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-gray-700/60 bg-black/20 p-3 text-xs text-gray-400">
                    <label className="flex items-center gap-2">
                        VIX “high” threshold
                        <input type="number" min={8} max={40} step={0.5} value={draft.vixHigh}
                            onChange={(e) => setDraft({ ...draft, vixHigh: Number(e.target.value) || 16 })}
                            className="w-16 rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1 text-gray-100 focus:border-teal-500 focus:outline-none" />
                    </label>
                    <label className="flex items-center gap-2">
                        Trend window (days)
                        <input type="number" min={10} max={120} value={draft.lookback}
                            onChange={(e) => setDraft({ ...draft, lookback: Number(e.target.value) || 30 })}
                            className="w-16 rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1 text-gray-100 focus:border-teal-500 focus:outline-none" />
                    </label>
                    <button type="button" onClick={() => setConfig(draft)} disabled={!dirty || loading}
                        className="rounded-md bg-teal-500/90 px-3 py-1 font-medium text-gray-900 hover:bg-teal-400 disabled:opacity-40">
                        Apply
                    </button>
                </div>
            )}

            {loading && (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Reading the market…
                </div>
            )}

            {!loading && data?.available && (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Stat label="NIFTY 50" value={data.nifty.price.toLocaleString("en-IN")} sub={pct(data.nifty.changePercent)} subTone={data.nifty.changePercent >= 0 ? "text-green-400" : "text-red-400"} />
                    <Stat label="Bias" value={risk.label} valueTone={risk.cls} sub={`slope ${data.nifty.slopePctPerDay}%/d`} />
                    <Stat label="India VIX" value={data.vix != null ? String(data.vix) : "—"} sub={`vol ${data.annualizedVolPct}%`} subTone={data.vix != null && data.vix >= data.vixHigh ? "text-fuchsia-300" : "text-gray-500"} />
                    <div className="rounded-md bg-black/20 p-2.5">
                        <div className="text-[11px] text-gray-500">Breadth</div>
                        <div className="mt-0.5 text-sm font-bold text-gray-100">{data.breadthPct}% up</div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-red-500/30">
                            <div className="h-full rounded-full bg-green-500" style={{ width: `${data.breadthPct}%` }} />
                        </div>
                        <div className="mt-0.5 text-[10px] text-gray-500">{data.advancers}↑ / {data.decliners}↓ of {data.universe}</div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Stat({ label, value, sub, valueTone, subTone }: { label: string; value: string; sub?: string; valueTone?: string; subTone?: string }) {
    return (
        <div className="rounded-md bg-black/20 p-2.5">
            <div className="text-[11px] text-gray-500">{label}</div>
            <div className={`mt-0.5 text-sm font-bold ${valueTone ?? "text-gray-100"}`}>{value}</div>
            {sub && <div className={`text-[11px] ${subTone ?? "text-gray-500"}`}>{sub}</div>}
        </div>
    );
}
