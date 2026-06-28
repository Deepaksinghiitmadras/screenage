"use client";

import { useEffect, useState, useTransition } from "react";
import { Layers, Loader2, Search, TrendingUp, Target, Scale } from "lucide-react";
import { getOptionChain } from "@/lib/actions/options.actions";
import { OIDistributionChart, IVSmileChart } from "@/components/options/OptionCharts";

const PRESETS = ["NIFTY", "BANKNIFTY", "FINNIFTY", "RELIANCE", "TCS", "HDFCBANK", "INFY", "TATASTEEL"];

const compact = (v: number): string => {
    if (v >= 1e7) return `${(v / 1e7).toFixed(2)} Cr`;
    if (v >= 1e5) return `${(v / 1e5).toFixed(2)} L`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)} K`;
    return v.toFixed(0);
};
const fmt = (v: number | null, d = 2): string =>
    v === null || v === undefined || Number.isNaN(v) ? "—" : v.toFixed(d);

function SummaryCard({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: string }) {
    return (
        <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">{icon}{label}</div>
            <div className={`mt-1 text-xl font-bold ${tone ?? "text-gray-100"}`}>{value}</div>
            {sub && <div className="text-xs text-gray-500">{sub}</div>}
        </div>
    );
}

export default function OptionsPage() {
    const [symbol, setSymbol] = useState("NIFTY");
    const [input, setInput] = useState("NIFTY");
    const [expiry, setExpiry] = useState<string | undefined>(undefined);
    const [data, setData] = useState<OptionChainData | null>(null);
    const [isPending, startTransition] = useTransition();

    const load = (sym: string, exp?: string) => {
        startTransition(async () => {
            const res = await getOptionChain(sym, exp);
            setData(res);
            if (res.available && !exp) setExpiry(res.expiry);
        });
    };

    useEffect(() => {
        load(symbol, expiry);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol, expiry]);

    const selectSymbol = (s: string) => {
        const next = s.trim().toUpperCase();
        if (!next) return;
        setExpiry(undefined);
        setSymbol(next);
        setInput(next);
    };

    const pcrTone = data?.pcr == null ? "text-gray-100" : data.pcr >= 1 ? "text-green-400" : "text-red-400";

    return (
        <div className="mx-auto min-h-screen w-full max-w-7xl p-4 md:p-6 lg:p-8">
            <div className="mb-5">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-100">
                    <Layers className="h-6 w-6 text-teal-400" />
                    Options Analytics
                </h1>
                <p className="mt-1 text-sm text-gray-400">
                    NSE option chain with Max Pain, PCR, OI distribution and the IV smile. Delayed snapshot — research only.
                </p>
            </div>

            {/* Symbol + expiry controls */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        selectSymbol(input);
                    }}
                    className="flex flex-1 items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/60 px-3"
                >
                    <Search className="h-4 w-4 shrink-0 text-gray-500" />
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Symbol (e.g. NIFTY, RELIANCE)"
                        className="w-full bg-transparent py-2.5 text-sm uppercase text-gray-100 placeholder:text-gray-500 focus:outline-none"
                    />
                </form>
                {data?.available && data.expiries.length > 0 && (
                    <select
                        value={expiry ?? data.expiry}
                        onChange={(e) => setExpiry(e.target.value)}
                        className="rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2.5 text-sm text-gray-100 focus:outline-none"
                    >
                        {data.expiries.map((e) => (
                            <option key={e} value={e}>{e}</option>
                        ))}
                    </select>
                )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                    <button
                        key={p}
                        type="button"
                        onClick={() => selectSymbol(p)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                            symbol === p ? "border-teal-500/50 bg-teal-500/15 text-teal-300" : "border-gray-700 bg-gray-800/40 text-gray-300 hover:text-teal-300"
                        }`}
                    >
                        {p}
                    </button>
                ))}
            </div>

            {isPending && (
                <div className="mt-8 flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading option chain…
                </div>
            )}

            {!isPending && data && !data.available && (
                <p className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
                    {data.error ?? "Option chain unavailable."}
                </p>
            )}

            {!isPending && data?.available && (
                <div className="mt-6 flex flex-col gap-6">
                    {/* Summary */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                        <SummaryCard icon={<TrendingUp className="h-3.5 w-3.5" />} label="Spot" value={data.underlying != null ? `₹${fmt(data.underlying)}` : "—"} sub={`ATM ${data.atmStrike ?? "—"}`} />
                        <SummaryCard icon={<Scale className="h-3.5 w-3.5" />} label="PCR (OI)" value={fmt(data.pcr)} sub={data.pcr == null ? undefined : data.pcr >= 1 ? "Put-heavy" : "Call-heavy"} tone={pcrTone} />
                        <SummaryCard icon={<Target className="h-3.5 w-3.5" />} label="Max Pain" value={data.maxPain != null ? `${data.maxPain}` : "—"} sub="expiry magnet" tone="text-amber-300" />
                        <SummaryCard icon={<Layers className="h-3.5 w-3.5" />} label="Total Call OI" value={compact(data.totalCeOi)} tone="text-red-300" />
                        <SummaryCard icon={<Layers className="h-3.5 w-3.5" />} label="Total Put OI" value={compact(data.totalPeOi)} tone="text-green-300" />
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                        <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
                            <h3 className="mb-2 text-sm font-semibold text-gray-200">Open Interest by Strike</h3>
                            <OIDistributionChart strikes={data.strikes} atmStrike={data.atmStrike} />
                        </div>
                        <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
                            <h3 className="mb-2 text-sm font-semibold text-gray-200">IV Smile</h3>
                            <IVSmileChart strikes={data.strikes} atmStrike={data.atmStrike} />
                        </div>
                    </div>

                    {/* Option chain table */}
                    <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
                        <h3 className="mb-3 text-sm font-semibold text-gray-200">Option Chain · {data.expiry}</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-gray-700 text-gray-500">
                                        <th colSpan={4} className="bg-red-500/5 py-1.5 text-center font-medium text-red-300">CALLS</th>
                                        <th className="py-1.5 text-center font-medium text-gray-400">STRIKE</th>
                                        <th colSpan={4} className="bg-green-500/5 py-1.5 text-center font-medium text-green-300">PUTS</th>
                                    </tr>
                                    <tr className="border-b border-gray-700 text-[11px] uppercase tracking-wide text-gray-500">
                                        <th className="px-2 py-1.5 text-right font-medium">OI</th>
                                        <th className="px-2 py-1.5 text-right font-medium">Chg OI</th>
                                        <th className="px-2 py-1.5 text-right font-medium">IV</th>
                                        <th className="px-2 py-1.5 text-right font-medium">LTP</th>
                                        <th className="px-2 py-1.5 text-center font-medium text-gray-300">Strike</th>
                                        <th className="px-2 py-1.5 text-right font-medium">LTP</th>
                                        <th className="px-2 py-1.5 text-right font-medium">IV</th>
                                        <th className="px-2 py-1.5 text-right font-medium">Chg OI</th>
                                        <th className="px-2 py-1.5 text-right font-medium">OI</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.strikes.map((s) => {
                                        const isAtm = s.strike === data.atmStrike;
                                        const itmCall = data.underlying != null && s.strike < data.underlying;
                                        const itmPut = data.underlying != null && s.strike > data.underlying;
                                        return (
                                            <tr key={s.strike} className={`border-b border-gray-800/70 ${isAtm ? "bg-teal-500/10" : "hover:bg-gray-800/40"}`}>
                                                <td className={`px-2 py-1.5 text-right tabular-nums ${itmCall ? "bg-red-500/5" : ""} text-gray-300`}>{compact(s.ce.oi)}</td>
                                                <td className={`px-2 py-1.5 text-right tabular-nums ${s.ce.changeOi >= 0 ? "text-green-400" : "text-red-400"}`}>{compact(s.ce.changeOi)}</td>
                                                <td className="px-2 py-1.5 text-right tabular-nums text-gray-400">{fmt(s.ce.iv, 1)}</td>
                                                <td className="px-2 py-1.5 text-right tabular-nums text-gray-300">{fmt(s.ce.ltp)}</td>
                                                <td className={`px-2 py-1.5 text-center font-semibold tabular-nums ${isAtm ? "text-teal-300" : "text-gray-200"}`}>{s.strike}</td>
                                                <td className="px-2 py-1.5 text-right tabular-nums text-gray-300">{fmt(s.pe.ltp)}</td>
                                                <td className="px-2 py-1.5 text-right tabular-nums text-gray-400">{fmt(s.pe.iv, 1)}</td>
                                                <td className={`px-2 py-1.5 text-right tabular-nums ${s.pe.changeOi >= 0 ? "text-green-400" : "text-red-400"}`}>{compact(s.pe.changeOi)}</td>
                                                <td className={`px-2 py-1.5 text-right tabular-nums ${itmPut ? "bg-green-500/5" : ""} text-gray-300`}>{compact(s.pe.oi)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-3 text-[11px] text-gray-600">
                            Source: NSE (delayed snapshot) · ATM row highlighted · research/education only, not investment advice
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
