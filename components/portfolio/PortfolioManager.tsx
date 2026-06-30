"use client";

/**
 * Portfolio manager — add/track holdings with live valuation, P&L, allocation
 * donut (by sector or stock), a diversification score and automatic red flags.
 * Delayed quotes; research/education only, not investment advice.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Briefcase, Plus, Trash2, Pencil, Loader2, TrendingUp, TrendingDown,
    AlertTriangle, X, PieChart,
} from "lucide-react";
import { addHolding, removeHolding } from "@/lib/actions/portfolio.actions";
import InfoTooltip from "@/components/InfoTooltip";

const DONUT_COLORS = ["#0FEDBE", "#60a5fa", "#f59e0b", "#a78bfa", "#f472b6", "#34d399", "#fb7185", "#facc15", "#22d3ee", "#c084fc", "#4ade80", "#fca5a5"];

const inr = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;
const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
const tone = (v: number) => (v > 0 ? "text-green-400" : v < 0 ? "text-red-400" : "text-gray-300");

function DonutChart({ slices }: { slices: PortfolioAllocationSlice[] }) {
    const total = slices.reduce((a, s) => a + s.value, 0) || 1;
    const R = 70;
    const C = 90;
    const stroke = 26;
    const circ = 2 * Math.PI * R;
    let offset = 0;
    return (
        <div className="flex items-center gap-4">
            <svg viewBox="0 0 180 180" className="h-44 w-44 shrink-0 -rotate-90">
                {slices.map((s, i) => {
                    const frac = s.value / total;
                    const dash = frac * circ;
                    const el = (
                        <circle
                            key={s.label}
                            cx={C} cy={C} r={R}
                            fill="none"
                            stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
                            strokeWidth={stroke}
                            strokeDasharray={`${dash} ${circ - dash}`}
                            strokeDashoffset={-offset}
                        />
                    );
                    offset += dash;
                    return el;
                })}
            </svg>
            <div className="flex flex-col gap-1 text-xs">
                {slices.slice(0, 8).map((s, i) => (
                    <div key={s.label} className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                        <span className="w-28 truncate text-gray-300">{s.label}</span>
                        <span className="tabular-nums text-gray-500">{s.pct}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StatCard({ label, value, sub, tone: t, info }: { label: string; value: string; sub?: string; tone?: string; info?: string }) {
    return (
        <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-3">
            <div className="flex items-center gap-1 text-xs text-gray-500">{label}{info && <InfoTooltip term={info} align="left" />}</div>
            <div className={`mt-1 text-xl font-bold ${t ?? "text-gray-100"}`}>{value}</div>
            {sub && <div className={`text-xs ${t ?? "text-gray-500"}`}>{sub}</div>}
        </div>
    );
}

const FLAG_TONE: Record<string, string> = {
    high: "border-red-500/30 bg-red-500/10 text-red-300",
    medium: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    low: "border-gray-600/40 bg-gray-700/20 text-gray-400",
};

type Editing = { symbol: string; company: string; quantity: number; avgPrice: number; buyDate: string } | null;

export default function PortfolioManager({ userId, data }: { userId: string; data: PortfolioResult }) {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Editing>(null);
    const [allocView, setAllocView] = useState<"sector" | "stock">("sector");
    const [sortKey, setSortKey] = useState<"value" | "pnl" | "weight">("value");
    const [isPending, startTransition] = useTransition();

    const s = data.summary;
    const slices = allocView === "sector" ? data.bySector : data.byStock;
    const holdings = [...data.holdings].sort((a, b) =>
        sortKey === "pnl" ? b.pnl - a.pnl : sortKey === "weight" ? b.weightPct - a.weightPct : b.currentValue - a.currentValue,
    );

    const openAdd = () => { setEditing(null); setShowForm(true); };
    const openEdit = (h: PortfolioHolding) => {
        setEditing({ symbol: h.symbol, company: h.company, quantity: h.quantity, avgPrice: h.avgPrice, buyDate: h.buyDate ?? "" });
        setShowForm(true);
    };

    const remove = (symbol: string) => {
        startTransition(async () => {
            await removeHolding(userId, symbol);
            router.refresh();
        });
    };

    return (
        <div className="mx-auto min-h-screen w-full max-w-7xl p-4 md:p-6 lg:p-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-100">
                        <Briefcase className="h-6 w-6 text-teal-400" /> Portfolio
                    </h1>
                    <p className="mt-1 text-sm text-gray-400">Track holdings, P&amp;L, allocation and risk. Delayed quotes — research only, not investment advice.</p>
                </div>
                <button onClick={openAdd} className="flex items-center gap-1.5 rounded-lg bg-teal-500/90 px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-teal-400">
                    <Plus className="h-4 w-4" /> Add holding
                </button>
            </div>

            {data.holdings.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-700 bg-gray-800/30 p-10 text-center">
                    <Briefcase className="mx-auto h-8 w-8 text-gray-600" />
                    <p className="mt-3 text-gray-400">No holdings yet. Add your first stock to start tracking.</p>
                    <button onClick={openAdd} className="mt-4 rounded-lg bg-teal-500/90 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-teal-400">Add holding</button>
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    {/* Summary */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        <StatCard label="Current Value" value={inr(s.currentValue)} />
                        <StatCard label="Invested" value={inr(s.invested)} />
                        <StatCard label="Total P&L" value={inr(s.totalPnl)} sub={pct(s.totalPnlPct)} tone={tone(s.totalPnl)} />
                        <StatCard label="Day's P&L" value={inr(s.dayPnl)} sub={pct(s.dayPnlPct)} tone={tone(s.dayPnl)} />
                        <StatCard label="Annualized (est.)" value={s.annualizedPct != null ? pct(s.annualizedPct) : "—"} tone={s.annualizedPct != null ? tone(s.annualizedPct) : undefined} sub={s.annualizedPct == null ? "add buy dates" : undefined} info="annualizedReturn" />
                        <StatCard label="Diversification" value={`${s.diversificationScore}/100`} sub={`${s.holdings} holdings`} tone={s.diversificationScore >= 60 ? "text-green-400" : s.diversificationScore <= 35 ? "text-red-400" : "text-amber-300"} info="diversification" />
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        {/* Allocation */}
                        <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4 lg:col-span-2">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-200"><PieChart className="h-4 w-4 text-teal-400" /> Allocation</h3>
                                <div className="flex rounded-lg border border-gray-700 bg-gray-900/60 p-0.5 text-xs">
                                    {(["sector", "stock"] as const).map((v) => (
                                        <button key={v} onClick={() => setAllocView(v)} className={`rounded-md px-3 py-1 capitalize transition-colors ${allocView === v ? "bg-teal-500/20 text-teal-300" : "text-gray-400 hover:text-gray-200"}`}>{v}</button>
                                    ))}
                                </div>
                            </div>
                            <DonutChart slices={slices} />
                        </div>

                        {/* Red flags */}
                        <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
                            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-200"><AlertTriangle className="h-4 w-4 text-amber-400" /> Risk &amp; Red Flags</h3>
                            {data.redFlags.length === 0 ? (
                                <p className="text-sm text-gray-500">No major red flags — looks balanced.</p>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {data.redFlags.map((f, i) => (
                                        <div key={i} className={`rounded-md border px-2.5 py-2 text-xs ${FLAG_TONE[f.severity]}`}>
                                            <div className="font-semibold">{f.label}</div>
                                            <div className="opacity-90">{f.detail}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Holdings table */}
                    <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-200">Holdings ({data.holdings.length})</h3>
                            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)} className="rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1 text-xs text-gray-300 focus:outline-none">
                                <option value="value">Sort: Value</option>
                                <option value="pnl">Sort: P&L</option>
                                <option value="weight">Sort: Weight</option>
                            </select>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[820px] border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-gray-700 text-[11px] uppercase tracking-wide text-gray-500">
                                        <th className="px-2 py-2 text-left font-medium">Stock</th>
                                        <th className="px-2 py-2 text-right font-medium">Qty</th>
                                        <th className="px-2 py-2 text-right font-medium">Avg ₹</th>
                                        <th className="px-2 py-2 text-right font-medium">LTP ₹</th>
                                        <th className="px-2 py-2 text-right font-medium">Day %</th>
                                        <th className="px-2 py-2 text-right font-medium">Value</th>
                                        <th className="px-2 py-2 text-right font-medium">P&L</th>
                                        <th className="px-2 py-2 text-right font-medium">Wt %</th>
                                        <th className="px-2 py-2 text-right font-medium"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {holdings.map((h) => (
                                        <tr key={h.symbol} className="border-b border-gray-800/70 hover:bg-gray-800/40">
                                            <td className="px-2 py-2">
                                                <Link href={`/stocks/${h.symbol}`} className="font-semibold text-gray-100 hover:text-teal-400">{h.symbol}</Link>
                                                <div className="text-[11px] text-gray-500">{h.sector}</div>
                                            </td>
                                            <td className="px-2 py-2 text-right tabular-nums text-gray-300">{h.quantity}</td>
                                            <td className="px-2 py-2 text-right tabular-nums text-gray-400">{h.avgPrice.toLocaleString("en-IN")}</td>
                                            <td className="px-2 py-2 text-right tabular-nums text-gray-300">{h.price != null ? h.price.toLocaleString("en-IN") : "—"}</td>
                                            <td className={`px-2 py-2 text-right tabular-nums ${h.changePercent != null ? tone(h.changePercent) : "text-gray-500"}`}>{h.changePercent != null ? pct(h.changePercent) : "—"}</td>
                                            <td className="px-2 py-2 text-right tabular-nums text-gray-200">{inr(h.currentValue)}</td>
                                            <td className={`px-2 py-2 text-right tabular-nums ${tone(h.pnl)}`}>
                                                <div className="inline-flex items-center justify-end gap-1">
                                                    {h.pnl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                    {inr(h.pnl)}
                                                </div>
                                                <div className="text-[10px] opacity-80">{pct(h.pnlPct)}</div>
                                            </td>
                                            <td className="px-2 py-2 text-right tabular-nums text-gray-400">{h.weightPct}%</td>
                                            <td className="px-2 py-2 text-right">
                                                <div className="inline-flex items-center gap-1">
                                                    <button onClick={() => openEdit(h)} title="Edit" className="rounded p-1 text-gray-500 hover:text-teal-300"><Pencil className="h-3.5 w-3.5" /></button>
                                                    <button onClick={() => remove(h.symbol)} disabled={isPending} title="Remove" className="rounded p-1 text-gray-500 hover:text-red-400 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {showForm && (
                <HoldingForm
                    userId={userId}
                    editing={editing}
                    onClose={() => setShowForm(false)}
                    onSaved={() => { setShowForm(false); router.refresh(); }}
                />
            )}
        </div>
    );
}

function HoldingForm({ userId, editing, onClose, onSaved }: { userId: string; editing: Editing; onClose: () => void; onSaved: () => void }) {
    const [symbol, setSymbol] = useState(editing?.symbol ?? "");
    const [company, setCompany] = useState(editing?.company ?? "");
    const [quantity, setQuantity] = useState(editing?.quantity ?? 0);
    const [avgPrice, setAvgPrice] = useState(editing?.avgPrice ?? 0);
    const [buyDate, setBuyDate] = useState(editing?.buyDate ?? "");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const submit = () => {
        const sym = symbol.trim().toUpperCase();
        if (!sym || quantity <= 0 || avgPrice <= 0) { setError("Enter a symbol, quantity and average price."); return; }
        startTransition(async () => {
            const res = await addHolding(userId, { symbol: sym, company: company || sym, quantity, avgPrice, buyDate: buyDate || null });
            if (res.success) onSaved();
            else setError(res.error ?? "Failed to save.");
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-5" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-100">{editing ? "Edit holding" : "Add holding"}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X className="h-4 w-4" /></button>
                </div>
                <div className="flex flex-col gap-3 text-sm">
                    <label className="flex flex-col gap-1 text-gray-400">Symbol (NSE)
                        <input value={symbol} disabled={!!editing} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="RELIANCE" className="rounded-md border border-gray-700 bg-gray-800/60 px-3 py-2 uppercase text-gray-100 focus:border-teal-500 focus:outline-none disabled:opacity-60" />
                    </label>
                    <label className="flex flex-col gap-1 text-gray-400">Company (optional)
                        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Reliance Industries" className="rounded-md border border-gray-700 bg-gray-800/60 px-3 py-2 text-gray-100 focus:border-teal-500 focus:outline-none" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1 text-gray-400">Quantity
                            <input type="number" min={0} step="any" value={quantity || ""} onChange={(e) => setQuantity(Number(e.target.value))} className="rounded-md border border-gray-700 bg-gray-800/60 px-3 py-2 text-gray-100 focus:border-teal-500 focus:outline-none" />
                        </label>
                        <label className="flex flex-col gap-1 text-gray-400">Avg buy price ₹
                            <input type="number" min={0} step="any" value={avgPrice || ""} onChange={(e) => setAvgPrice(Number(e.target.value))} className="rounded-md border border-gray-700 bg-gray-800/60 px-3 py-2 text-gray-100 focus:border-teal-500 focus:outline-none" />
                        </label>
                    </div>
                    <label className="flex flex-col gap-1 text-gray-400">Buy date (optional — enables annualized return)
                        <input type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)} className="rounded-md border border-gray-700 bg-gray-800/60 px-3 py-2 text-gray-100 focus:border-teal-500 focus:outline-none" />
                    </label>
                    {error && <p className="text-xs text-red-400">{error}</p>}
                    <button onClick={submit} disabled={isPending} className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-teal-500/90 px-4 py-2.5 font-medium text-gray-900 hover:bg-teal-400 disabled:opacity-50">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {editing ? "Save changes" : "Add holding"}
                    </button>
                </div>
            </div>
        </div>
    );
}
