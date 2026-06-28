"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Loader2 } from "lucide-react";
import { getPeerComparison } from "@/lib/actions/screener.actions";

const fmtCr = (v: number | null): string => {
    if (v === null || v === undefined || Number.isNaN(v)) return "—";
    if (v >= 1e7) return `${(v / 1e7).toFixed(2)} Cr`;
    if (v >= 1e5) return `${(v / 1e5).toFixed(2)} L`;
    return v.toFixed(0);
};
const fmtNum = (v: number | null, d = 2): string =>
    v === null || v === undefined || Number.isNaN(v) ? "—" : v.toFixed(d);
const fmtPct = (v: number | null): string =>
    v === null || v === undefined || Number.isNaN(v) ? "—" : `${v.toFixed(2)}%`;

type Col = {
    key: keyof ScreenerStock;
    label: string;
    render: (v: number | null) => string;
    /** "high" = bigger is better, "low" = smaller is better. */
    best: "high" | "low" | null;
};

const COLS: Col[] = [
    { key: "price", label: "Price ₹", render: fmtNum, best: null },
    { key: "marketCap", label: "Mkt Cap", render: fmtCr, best: "high" },
    { key: "trailingPE", label: "P/E", render: fmtNum, best: "low" },
    { key: "priceToBook", label: "P/B", render: fmtNum, best: "low" },
    { key: "roe", label: "ROE", render: fmtPct, best: "high" },
    { key: "profitMargin", label: "Net Margin", render: fmtPct, best: "high" },
    { key: "revenueGrowth", label: "Rev Growth", render: fmtPct, best: "high" },
    { key: "debtToEquity", label: "D/E", render: fmtNum, best: "low" },
    { key: "dividendYield", label: "Div Yield", render: fmtPct, best: "high" },
];

export default function PeerComparison({ symbol }: { symbol: string }) {
    const [data, setData] = useState<PeerComparison | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        setLoading(true);
        getPeerComparison(symbol).then((res) => {
            if (active) {
                setData(res);
                setLoading(false);
            }
        });
        return () => {
            active = false;
        };
    }, [symbol]);

    // Best value per column (for highlighting).
    const bestByCol: Partial<Record<keyof ScreenerStock, number>> = {};
    if (data?.available) {
        for (const col of COLS) {
            if (!col.best) continue;
            const vals = data.rows
                .map((r) => r[col.key])
                .filter((v): v is number => typeof v === "number" && !Number.isNaN(v) && v > 0);
            if (vals.length) bestByCol[col.key] = col.best === "high" ? Math.max(...vals) : Math.min(...vals);
        }
    }

    const base = symbol.trim().toUpperCase();

    return (
        <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
            <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-400" />
                <h3 className="text-base font-semibold text-gray-100">Peer Comparison</h3>
                {data?.sector && <span className="text-xs text-gray-500">· {data.sector}</span>}
            </div>

            {loading && (
                <div className="flex items-center gap-2 py-6 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading peers…
                </div>
            )}

            {!loading && data && !data.available && (
                <p className="py-4 text-sm text-gray-400">{data.error ?? "Peer comparison unavailable."}</p>
            )}

            {!loading && data?.available && (
                <div className="-mx-4 overflow-x-auto px-4">
                    <table className="w-full min-w-[760px] border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-gray-700 text-xs uppercase tracking-wide text-gray-500">
                                <th className="py-2 pr-3 text-left font-medium">Company</th>
                                {COLS.map((c) => (
                                    <th key={c.key} className="px-3 py-2 text-right font-medium">{c.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.rows.map((row) => {
                                const isBase = row.symbol.toUpperCase() === base;
                                return (
                                    <tr
                                        key={row.symbol}
                                        className={`border-b border-gray-800 ${isBase ? "bg-teal-500/10" : "hover:bg-gray-800/50"}`}
                                    >
                                        <td className="py-2.5 pr-3">
                                            <Link href={`/stocks/${row.symbol}`} className="flex flex-col">
                                                <span className={`font-medium ${isBase ? "text-teal-300" : "text-gray-200"}`}>
                                                    {row.symbol}
                                                </span>
                                                <span className="line-clamp-1 text-xs text-gray-500">{row.name}</span>
                                            </Link>
                                        </td>
                                        {COLS.map((c) => {
                                            const v = row[c.key] as number | null;
                                            const isBest =
                                                c.best != null &&
                                                typeof v === "number" &&
                                                bestByCol[c.key] !== undefined &&
                                                v === bestByCol[c.key];
                                            return (
                                                <td
                                                    key={c.key}
                                                    className={`px-3 py-2.5 text-right tabular-nums ${
                                                        isBest ? "font-semibold text-green-400" : "text-gray-300"
                                                    }`}
                                                >
                                                    {c.render(v)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <p className="mt-3 text-[11px] text-gray-600">
                        Green = best in column among peers · delayed data, research only
                    </p>
                </div>
            )}
        </div>
    );
}
