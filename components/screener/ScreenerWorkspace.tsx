"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
    Sparkles,
    Search,
    Loader2,
    SlidersHorizontal,
    History,
    Trash2,
    Radar,
    MessageSquare,
} from "lucide-react";
import {
    runAndSaveScreener,
    listScreenerHistory,
    deleteScreenerHistory,
    type ScreenerHistoryItem,
} from "@/lib/actions/screener.actions";
import { getMarketScan } from "@/lib/actions/technical.actions";
import AssistantChat from "@/components/assistant/AssistantChat";

type ConvoSummary = { _id: string; title: string; updatedAt: string };
type Tab = "screen" | "scan" | "assistant";

const PRESETS = [
    "Undervalued large caps with high ROE",
    "High dividend yield stocks above 3%",
    "Low debt companies with strong profit margins",
    "Cheap stocks with P/E under 15 and growing revenue",
    "High growth stocks with revenue growth over 15%",
];

const fmtCr = (v: number | null): string => {
    if (v === null || v === undefined || Number.isNaN(v)) return "—";
    if (v >= 1e7) return `${(v / 1e7).toFixed(0)} Cr`;
    if (v >= 1e5) return `${(v / 1e5).toFixed(0)} L`;
    return v.toFixed(0);
};
const fmtNum = (v: number | null, d = 2): string =>
    v === null || v === undefined || Number.isNaN(v) ? "—" : v.toFixed(d);
const fmtPct = (v: number | null): string =>
    v === null || v === undefined || Number.isNaN(v) ? "—" : `${v.toFixed(2)}%`;

const COLS: { key: keyof ScreenerStock; label: string; render: (v: number | null) => string }[] = [
    { key: "price", label: "Price ₹", render: fmtNum },
    { key: "marketCap", label: "Mkt Cap", render: fmtCr },
    { key: "trailingPE", label: "P/E", render: fmtNum },
    { key: "roe", label: "ROE", render: fmtPct },
    { key: "profitMargin", label: "Net Margin", render: fmtPct },
    { key: "revenueGrowth", label: "Rev Growth", render: fmtPct },
    { key: "debtToEquity", label: "D/E", render: fmtNum },
    { key: "dividendYield", label: "Div Yield", render: fmtPct },
];

const biasColor = (bias: string) =>
    bias === "Bullish" ? "text-green-400" : bias === "Bearish" ? "text-red-400" : "text-amber-300";

export default function ScreenerWorkspace({
    userId,
    sectors,
    initialHistory,
    initialConversations,
}: {
    userId: string;
    sectors: string[];
    initialHistory: ScreenerHistoryItem[];
    initialConversations: ConvoSummary[];
}) {
    const [tab, setTab] = useState<Tab>("screen");

    // --- Screen tab state ---
    const [query, setQuery] = useState("");
    const [result, setResult] = useState<ScreenerResult | null>(null);
    const [history, setHistory] = useState<ScreenerHistoryItem[]>(initialHistory);
    const [cached, setCached] = useState(false);
    const [isPending, startTransition] = useTransition();

    // --- Scan tab state ---
    const [sector, setSector] = useState("All");
    const [scan, setScan] = useState<MarketScanResult | null>(null);
    const [scanPending, startScan] = useTransition();

    const run = (q: string) => {
        const text = q.trim();
        if (!text) return;
        setQuery(text);
        startTransition(async () => {
            const res = await runAndSaveScreener(userId, text);
            setResult(res.result);
            setCached(res.cached);
            if (!res.cached) {
                const list = await listScreenerHistory(userId);
                setHistory(list);
            }
        });
    };

    const openHistory = (item: ScreenerHistoryItem) => {
        setQuery(item.query);
        setResult(item.result);
        setCached(true);
    };

    const removeHistory = (id: string) => {
        startTransition(async () => {
            await deleteScreenerHistory(id, userId);
            setHistory((prev) => prev.filter((h) => h._id !== id));
        });
    };

    const runScan = (s: string) => {
        setSector(s);
        startScan(async () => {
            const res = await getMarketScan(s);
            setScan(res);
        });
    };

    return (
        <div className="mx-auto min-h-screen w-full max-w-6xl p-4 md:p-6 lg:p-8">
            <div className="mb-5">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-100">
                    <Sparkles className="h-6 w-6 text-teal-400" />
                    AI Stock Screener
                </h1>
                <p className="mt-1 text-sm text-gray-400">
                    Screen the market in plain English, run a market-wide technical scan, or ask the research assistant.
                </p>
            </div>

            {/* Tabs */}
            <div className="mb-5 flex gap-1 border-b border-gray-700/60">
                {([
                    { id: "screen", label: "Screen", icon: SlidersHorizontal },
                    { id: "scan", label: "Technical Scan", icon: Radar },
                    { id: "assistant", label: "Assistant", icon: MessageSquare },
                ] as const).map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setTab(id)}
                        className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                            tab === id
                                ? "border-teal-400 text-teal-300"
                                : "border-transparent text-gray-400 hover:text-gray-200"
                        }`}
                    >
                        <Icon className="h-4 w-4" /> {label}
                    </button>
                ))}
            </div>

            {/* --- SCREEN TAB --- */}
            {tab === "screen" && (
                <>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            run(query);
                        }}
                        className="flex flex-col gap-3 sm:flex-row"
                    >
                        <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/60 px-3">
                            <Search className="h-4 w-4 shrink-0 text-gray-500" />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="e.g. undervalued IT stocks with high ROE and low debt"
                                className="w-full bg-transparent py-3 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isPending || !query.trim()}
                            className="flex items-center justify-center gap-2 rounded-lg bg-teal-500/20 px-5 py-3 text-sm font-medium text-teal-300 transition-colors hover:bg-teal-500/30 disabled:opacity-60"
                        >
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            Screen
                        </button>
                    </form>

                    <div className="mt-3 flex flex-wrap gap-2">
                        {PRESETS.map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => run(p)}
                                disabled={isPending}
                                className="rounded-full border border-gray-700 bg-gray-800/40 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-teal-500/40 hover:text-teal-300 disabled:opacity-60"
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    {/* Saved history */}
                    {history.length > 0 && (
                        <div className="mt-5">
                            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                                <History className="h-3.5 w-3.5" /> Recent screens (saved · no re-run cost)
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {history.map((h) => (
                                    <span
                                        key={h._id}
                                        className="group flex items-center gap-1.5 rounded-md border border-gray-700 bg-gray-800/40 py-1.5 pl-3 pr-2 text-xs text-gray-300"
                                    >
                                        <button onClick={() => openHistory(h)} className="hover:text-teal-300">
                                            {h.query} <span className="text-gray-500">· {h.matches}</span>
                                        </button>
                                        <button
                                            onClick={() => removeHistory(h._id)}
                                            className="text-gray-600 hover:text-red-400"
                                            title="Delete"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {isPending && (
                        <div className="mt-8 flex items-center gap-2 text-sm text-gray-400">
                            <Loader2 className="h-4 w-4 animate-spin" /> Interpreting and screening the universe…
                        </div>
                    )}

                    {!isPending && result && (
                        <div className="mt-6">
                            {!result.available ? (
                                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
                                    {result.error ?? "No results."}
                                </p>
                            ) : (
                                <>
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 text-sm text-gray-300">
                                            <SlidersHorizontal className="h-4 w-4 text-teal-400" />
                                            {result.interpreted ?? "Screen results"}
                                            {cached && (
                                                <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500">
                                                    from history
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs text-gray-500">{result.rows.length} matches</span>
                                    </div>

                                    {result.criteria && result.criteria.filters.length > 0 && (
                                        <div className="mb-3 flex flex-wrap gap-2">
                                            {result.criteria.filters.map((f, i) => (
                                                <span key={i} className="rounded-md bg-gray-800/60 px-2.5 py-1 text-xs text-gray-400">
                                                    {f.metric} {f.operator} {f.value}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {result.rows.length === 0 ? (
                                        <p className="rounded-lg border border-gray-700 bg-gray-800/40 p-4 text-sm text-gray-400">
                                            No stocks in the universe matched these filters. Try loosening the criteria.
                                        </p>
                                    ) : (
                                        <div className="overflow-x-auto rounded-lg border border-gray-700/60">
                                            <table className="w-full min-w-[820px] border-collapse text-sm">
                                                <thead>
                                                    <tr className="border-b border-gray-700 bg-gray-800/60 text-xs uppercase tracking-wide text-gray-500">
                                                        <th className="px-4 py-2.5 text-left font-medium">Company</th>
                                                        {COLS.map((c) => (
                                                            <th key={c.key} className="px-3 py-2.5 text-right font-medium">{c.label}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {result.rows.map((row) => (
                                                        <tr key={row.symbol} className="border-b border-gray-800 hover:bg-gray-800/50">
                                                            <td className="px-4 py-2.5">
                                                                <Link href={`/stocks/${row.symbol}`} className="flex flex-col">
                                                                    <span className="font-medium text-gray-200">{row.symbol}</span>
                                                                    <span className="line-clamp-1 text-xs text-gray-500">{row.name}</span>
                                                                </Link>
                                                            </td>
                                                            {COLS.map((c) => (
                                                                <td key={c.key} className="px-3 py-2.5 text-right tabular-nums text-gray-300">
                                                                    {c.render(row[c.key] as number | null)}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    <p className="mt-3 text-[11px] text-gray-600">
                                        AI-mapped filters over a curated NSE universe · delayed data · research/education only,
                                        not investment advice
                                    </p>
                                </>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* --- SCAN TAB --- */}
            {tab === "scan" && (
                <>
                    <p className="mb-3 text-sm text-gray-400">
                        Run the technical scanner across the universe or a sector. Each stock is scored 0–100 from
                        moving averages, RSI, range position and volume.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={sector}
                            onChange={(e) => setSector(e.target.value)}
                            className="rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-teal-500/40"
                        >
                            {sectors.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => runScan(sector)}
                            disabled={scanPending}
                            className="flex items-center gap-2 rounded-lg bg-teal-500/20 px-5 py-2.5 text-sm font-medium text-teal-300 hover:bg-teal-500/30 disabled:opacity-60"
                        >
                            {scanPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
                            Run Scan
                        </button>
                    </div>

                    {scanPending && (
                        <div className="mt-8 flex items-center gap-2 text-sm text-gray-400">
                            <Loader2 className="h-4 w-4 animate-spin" /> Scanning {sector === "All" ? "the universe" : sector}…
                        </div>
                    )}

                    {!scanPending && scan && (
                        <div className="mt-5">
                            {!scan.available ? (
                                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
                                    {scan.error ?? "No results."}
                                </p>
                            ) : (
                                <>
                                    <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
                                        <span>{scan.sector} · ranked by technical score</span>
                                        <span>{scan.rows.length} stocks</span>
                                    </div>
                                    <div className="overflow-x-auto rounded-lg border border-gray-700/60">
                                        <table className="w-full min-w-[720px] border-collapse text-sm">
                                            <thead>
                                                <tr className="border-b border-gray-700 bg-gray-800/60 text-xs uppercase tracking-wide text-gray-500">
                                                    <th className="px-4 py-2.5 text-left font-medium">Symbol</th>
                                                    <th className="px-3 py-2.5 text-right font-medium">Price ₹</th>
                                                    <th className="px-3 py-2.5 text-right font-medium">Chg %</th>
                                                    <th className="px-3 py-2.5 text-right font-medium">Score</th>
                                                    <th className="px-3 py-2.5 text-left font-medium">Bias</th>
                                                    <th className="px-3 py-2.5 text-left font-medium">Regime</th>
                                                    <th className="px-3 py-2.5 text-right font-medium">RSI</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {scan.rows.map((r) => (
                                                    <tr key={r.symbol} className="border-b border-gray-800 hover:bg-gray-800/50">
                                                        <td className="px-4 py-2.5">
                                                            <Link href={`/stocks/${r.symbol}`} className="font-medium text-gray-200 hover:text-teal-300">
                                                                {r.symbol}
                                                            </Link>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-300">{fmtNum(r.price)}</td>
                                                        <td className={`px-3 py-2.5 text-right tabular-nums ${r.changePercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                                                            {r.changePercent >= 0 ? "+" : ""}{r.changePercent.toFixed(2)}%
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right">
                                                            <span className={`font-semibold tabular-nums ${biasColor(r.bias)}`}>{r.score}</span>
                                                        </td>
                                                        <td className={`px-3 py-2.5 font-medium ${biasColor(r.bias)}`}>{r.bias}</td>
                                                        <td className="px-3 py-2.5 text-gray-400">{r.regime}</td>
                                                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-300">{r.rsi != null ? r.rsi.toFixed(0) : "—"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="mt-3 text-[11px] text-gray-600">
                                        Statistical technical scoring over delayed daily candles · research/education only,
                                        not investment advice
                                    </p>
                                </>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* --- ASSISTANT TAB --- */}
            {tab === "assistant" && (
                <AssistantChat userId={userId} initialConversations={initialConversations} embedded />
            )}
        </div>
    );
}
