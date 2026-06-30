"use client";

/**
 * Earnings & Dividend calendar — upcoming corporate-action dates for your
 * watchlist or any sector. Configurable source + event-type filter. Dates are
 * from the data provider and may shift; research/education only.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Loader2, Megaphone, Coins, Search, Plus, X } from "lucide-react";
import { getCorporateActions } from "@/lib/actions/market.actions";
import { SECTOR_GROUPS } from "@/lib/sector-peers";
import InfoTooltip from "@/components/InfoTooltip";

type TypeFilter = "all" | "earnings" | "ex_dividend";

const fmtDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

function daysAway(iso: string): number {
    const d = new Date(iso + "T00:00:00").getTime();
    return Math.round((d - new Date(new Date().toDateString()).getTime()) / 86400000);
}

export default function CorporateCalendar({ watchlistSymbols }: { watchlistSymbols: string[] }) {
    const hasWatchlist = watchlistSymbols.length > 0;
    const [source, setSource] = useState<string>(hasWatchlist ? "watchlist" : "custom");
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
    const [customSymbols, setCustomSymbols] = useState<string[]>([]);
    const [input, setInput] = useState("");
    const [events, setEvents] = useState<CorporateEvent[]>([]);
    const [loading, setLoading] = useState(true);

    const symbols = useMemo(() => {
        if (source === "watchlist") return watchlistSymbols;
        if (source === "custom") return customSymbols;
        return SECTOR_GROUPS.find((g) => g.name === source)?.symbols ?? [];
    }, [source, watchlistSymbols, customSymbols]);

    const addSymbol = (raw: string) => {
        const sym = raw.trim().toUpperCase();
        if (!sym || customSymbols.includes(sym) || customSymbols.length >= 25) return;
        setCustomSymbols([...customSymbols, sym]);
        setInput("");
    };

    useEffect(() => {
        let active = true;
        setLoading(true);
        getCorporateActions(symbols).then((res) => {
            if (active) {
                setEvents(res.events);
                setLoading(false);
            }
        });
        return () => { active = false; };
    }, [symbols]);

    const filtered = events.filter((e) => typeFilter === "all" || e.type === typeFilter);
    const byDate = useMemo(() => {
        const map = new Map<string, CorporateEvent[]>();
        for (const e of filtered) {
            if (!map.has(e.date)) map.set(e.date, []);
            map.get(e.date)!.push(e);
        }
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [filtered]);

    return (
        <div className="mx-auto min-h-screen w-full max-w-4xl p-4 md:p-6 lg:p-8">
            <div className="mb-5">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-100">
                    <CalendarDays className="h-6 w-6 text-teal-400" /> Earnings &amp; Dividends
                </h1>
                <p className="mt-1 text-sm text-gray-400">Upcoming results and ex-dividend dates for your watchlist or a sector. Dates can shift — confirm with the company. Research/education only.</p>
            </div>

            {/* Controls */}
            <div className="mb-5 flex flex-wrap items-center gap-3">
                <select value={source} onChange={(e) => setSource(e.target.value)} className="rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-sm text-gray-100 focus:outline-none">
                    {hasWatchlist && <option value="watchlist">My Watchlist ({watchlistSymbols.length})</option>}
                    <option value="custom">Search / Custom</option>
                    {SECTOR_GROUPS.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
                </select>
                <div className="flex rounded-lg border border-gray-700 bg-gray-900/60 p-0.5 text-xs">
                    {([["all", "All"], ["earnings", "Earnings"], ["ex_dividend", "Dividends"]] as [TypeFilter, string][]).map(([val, label]) => (
                        <button key={val} onClick={() => setTypeFilter(val)} className={`rounded-md px-3 py-1 transition-colors ${typeFilter === val ? "bg-teal-500/20 text-teal-300" : "text-gray-400 hover:text-gray-200"}`}>
                            {label}
                            {val === "earnings" && <InfoTooltip term="earnings" />}
                            {val === "ex_dividend" && <InfoTooltip term="exDividend" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Custom symbol search */}
            {source === "custom" && (
                <div className="mb-5 flex flex-wrap items-center gap-2">
                    {customSymbols.map((s) => (
                        <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-800/60 px-3 py-1 text-xs text-gray-200">
                            {s}<button onClick={() => setCustomSymbols(customSymbols.filter((x) => x !== s))} className="opacity-70 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
                        </span>
                    ))}
                    {customSymbols.length < 25 && (
                        <form onSubmit={(e) => { e.preventDefault(); addSymbol(input); }} className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-800/60 px-3 py-1">
                            <Search className="h-3.5 w-3.5 text-gray-500" />
                            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Add symbol e.g. RELIANCE" className="w-40 bg-transparent text-sm uppercase text-gray-100 placeholder:text-gray-500 focus:outline-none" />
                            <button type="submit" className="text-teal-400 hover:text-teal-300"><Plus className="h-4 w-4" /></button>
                        </form>
                    )}
                </div>
            )}

            {loading && (
                <div className="flex items-center gap-2 py-8 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading calendar…</div>
            )}

            {!loading && byDate.length === 0 && (
                <p className="rounded-lg border border-dashed border-gray-700 bg-gray-800/30 p-8 text-center text-sm text-gray-500">
                    No upcoming earnings or ex-dividend dates found for this selection in the next few months.
                </p>
            )}

            {!loading && byDate.length > 0 && (
                <div className="flex flex-col gap-4">
                    {byDate.map(([date, items]) => {
                        const away = daysAway(date);
                        return (
                            <div key={date} className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
                                <div className="mb-2 flex items-baseline justify-between">
                                    <h3 className="text-sm font-semibold text-gray-200">{fmtDate(date)}</h3>
                                    <span className="text-[11px] text-gray-500">{away <= 0 ? "today" : away === 1 ? "tomorrow" : `in ${away} days`}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {items.map((e, i) => (
                                        <Link
                                            key={`${e.symbol}-${e.type}-${i}`}
                                            href={`/stocks/${e.symbol}`}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-900/50 px-3 py-1 text-xs text-gray-200 hover:border-teal-500/40 hover:text-teal-300"
                                        >
                                            {e.type === "earnings"
                                                ? <Megaphone className="h-3.5 w-3.5 text-teal-400" />
                                                : <Coins className="h-3.5 w-3.5 text-amber-400" />}
                                            <span className="font-semibold">{e.symbol}</span>
                                            <span className={`text-[10px] uppercase ${e.type === "earnings" ? "text-teal-400" : "text-amber-300"}`}>
                                                {e.type === "earnings" ? "Earnings" : "Ex-Div"}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
