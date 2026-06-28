"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, Loader2, RefreshCw, Trash2 } from "lucide-react";
import CreateAlertModal from "./CreateAlertModal";
import { getQuotes } from "@/lib/actions/market.actions";
import { removeFromWatchlist } from "@/lib/actions/watchlist.actions";

export interface WatchlistRow {
    symbol: string;
    company: string;
}

interface WatchlistTableProps {
    items: WatchlistRow[];
    userId: string;
}

const GREEN = "#22c55e";
const RED = "#ef4444";

const inr = (n: number) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const compactVol = (n: number) => {
    if (n >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
    if (n >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)} K`;
    return `${n}`;
};

function Sparkline({ points, up }: { points: number[]; up: boolean }) {
    if (!points || points.length < 2) {
        return <div className="h-8 w-24 rounded bg-gray-800/50" />;
    }
    const w = 96;
    const h = 32;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const step = w / (points.length - 1);
    const d = points
        .map((p, i) => {
            const x = i * step;
            const y = h - ((p - min) / span) * h;
            return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
    return (
        <svg width={w} height={h} className="overflow-visible">
            <path d={d} fill="none" stroke={up ? GREEN : RED} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}

function FiftyTwoWeekBar({ low, high, price }: { low: number; high: number; price: number }) {
    const span = high - low || 1;
    const pct = Math.min(100, Math.max(0, ((price - low) / span) * 100));
    return (
        <div className="w-36">
            <div className="relative h-1.5 rounded-full bg-gradient-to-r from-red-500/60 via-yellow-500/50 to-green-500/60">
                <div
                    className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-full bg-gray-100 ring-1 ring-gray-900/40"
                    style={{ left: `${pct}%` }}
                />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-gray-500">
                <span>{low.toLocaleString("en-IN")}</span>
                <span>{high.toLocaleString("en-IN")}</span>
            </div>
        </div>
    );
}

export default function WatchlistTable({ items, userId }: WatchlistTableProps) {
    const [rows, setRows] = useState<WatchlistRow[]>(items);
    const [quotes, setQuotes] = useState<Record<string, WatchlistQuote>>({});
    const [loading, setLoading] = useState(true);
    const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
    const [isRemoving, startRemove] = useTransition();

    useEffect(() => {
        setRows(items);
    }, [items]);

    const symbols = useMemo(() => rows.map((r) => r.symbol), [rows]);

    const load = useMemo(
        () => async () => {
            if (symbols.length === 0) {
                setQuotes({});
                setLoading(false);
                return;
            }
            const data = await getQuotes(symbols);
            const map: Record<string, WatchlistQuote> = {};
            for (const q of data) map[q.requested.toUpperCase()] = q;
            setQuotes(map);
            setRefreshedAt(new Date());
            setLoading(false);
        },
        [symbols],
    );

    useEffect(() => {
        setLoading(true);
        load();
        const id = setInterval(load, 60_000);
        return () => clearInterval(id);
    }, [load]);

    const handleRemove = (symbol: string) => {
        setRows((prev) => prev.filter((r) => r.symbol !== symbol));
        startRemove(async () => {
            await removeFromWatchlist(userId, symbol);
        });
    };

    if (rows.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-800 py-12 text-center">
                <h3 className="mb-2 text-xl font-medium text-gray-200">Your watchlist is empty</h3>
                <p className="text-gray-500">Search for a stock to track its performance and set alerts.</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-gray-700 bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2.5">
                <h3 className="text-sm font-semibold text-gray-100">
                    Holdings <span className="text-gray-500">({rows.length})</span>
                </h3>
                <button
                    type="button"
                    onClick={() => load()}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-teal-400"
                    title="Refresh quotes"
                >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    {refreshedAt
                        ? refreshedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                        : "Refresh"}
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                    <thead>
                        <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wide text-gray-500">
                            <th className="px-4 py-2 font-medium">Company</th>
                            <th className="px-4 py-2 font-medium">Trend</th>
                            <th className="px-4 py-2 text-right font-medium">Mkt Price</th>
                            <th className="px-4 py-2 text-right font-medium">1D Change</th>
                            <th className="px-4 py-2 text-right font-medium">1D Vol</th>
                            <th className="px-4 py-2 font-medium">52W Range</th>
                            <th className="px-4 py-2 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const q = quotes[row.symbol.toUpperCase()];
                            const available = !!q?.available && q.price != null;
                            const up = (q?.change ?? 0) >= 0;
                            const initials = (row.company || row.symbol).slice(0, 2).toUpperCase();
                            return (
                                <tr key={row.symbol} className="border-b border-gray-700/50 transition-colors hover:bg-teal-400/5">
                                    {/* Company */}
                                    <td className="px-4 py-3">
                                        <Link href={`/stocks/${encodeURIComponent(row.symbol)}`} className="flex items-center gap-3">
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-700 text-[11px] font-semibold text-gray-200">
                                                {initials}
                                            </span>
                                            <span className="flex flex-col">
                                                <span className="font-medium text-gray-100">{row.company || row.symbol}</span>
                                                <span className="text-xs text-gray-500">{row.symbol}</span>
                                            </span>
                                        </Link>
                                    </td>
                                    {/* Trend */}
                                    <td className="px-4 py-3">
                                        {available ? <Sparkline points={q!.sparkline ?? []} up={up} /> : <span className="text-xs text-gray-600">—</span>}
                                    </td>
                                    {/* Price */}
                                    <td className="px-4 py-3 text-right font-medium text-gray-100">
                                        {available ? `₹${inr(q!.price!)}` : loading ? <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-gray-600" /> : "—"}
                                    </td>
                                    {/* Change */}
                                    <td className="px-4 py-3 text-right" style={{ color: available ? (up ? GREEN : RED) : undefined }}>
                                        {available ? (
                                            <span className="flex flex-col items-end">
                                                <span>{up ? "+" : ""}{inr(q!.change!)}</span>
                                                <span className="text-xs">{up ? "+" : ""}{q!.changePercent!.toFixed(2)}%</span>
                                            </span>
                                        ) : (
                                            <span className="text-gray-600">—</span>
                                        )}
                                    </td>
                                    {/* Volume */}
                                    <td className="px-4 py-3 text-right text-gray-300">
                                        {available && q!.volume != null ? compactVol(q!.volume) : "—"}
                                    </td>
                                    {/* 52W */}
                                    <td className="px-4 py-3">
                                        {available && q!.week52Low != null && q!.week52High != null ? (
                                            <FiftyTwoWeekBar low={q!.week52Low} high={q!.week52High} price={q!.price!} />
                                        ) : (
                                            <span className="text-xs text-gray-600">—</span>
                                        )}
                                    </td>
                                    {/* Actions */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            <CreateAlertModal
                                                userId={userId}
                                                symbol={row.symbol}
                                                currentPrice={q?.price ?? 0}
                                            >
                                                <button
                                                    type="button"
                                                    title="Create alert"
                                                    className="rounded p-1.5 text-gray-500 transition-colors hover:bg-yellow-500/10 hover:text-yellow-400"
                                                >
                                                    <Bell className="h-4 w-4" />
                                                </button>
                                            </CreateAlertModal>
                                            <button
                                                type="button"
                                                onClick={() => handleRemove(row.symbol)}
                                                disabled={isRemoving}
                                                title="Remove from watchlist"
                                                className="rounded p-1.5 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <p className="border-t border-gray-700/60 px-4 py-2 text-[11px] text-gray-600">
                Delayed quotes (~15 min) from Yahoo Finance · auto-refreshes every minute · research use only.
            </p>
        </div>
    );
}
