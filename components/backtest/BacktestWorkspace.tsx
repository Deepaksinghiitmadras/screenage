"use client";

/**
 * Strategy backtester workspace — pick a symbol + rule, simulate on daily
 * candles, and view the equity curve, metrics and trade log. Education only.
 */

import { useState, useTransition } from "react";
import { Activity, Loader2, Play, Search, TrendingUp, TrendingDown } from "lucide-react";
import { runBacktest } from "@/lib/actions/backtest.actions";
import InfoTooltip from "@/components/InfoTooltip";

const PRESETS = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "TATASTEEL", "SBIN", "ITC"];
const RANGES = ["1y", "2y", "3y", "5y"];
const STRATEGIES: { id: BacktestStrategy; label: string; desc: string }[] = [
    { id: "sma_cross", label: "SMA Crossover", desc: "Long while fast SMA > slow SMA" },
    { id: "rsi", label: "RSI Reversion", desc: "Buy oversold, exit overbought" },
    { id: "breakout", label: "Breakout Channel", desc: "Buy N-day high, exit N-day low" },
];

const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
const toneFor = (v: number) => (v > 0 ? "text-green-400" : v < 0 ? "text-red-400" : "text-gray-300");

const EXIT_META: Record<string, { label: string; cls: string }> = {
    signal: { label: "Signal", cls: "bg-gray-700/40 text-gray-300" },
    stop_loss: { label: "Stop", cls: "bg-red-500/15 text-red-300" },
    trailing_stop: { label: "Trail", cls: "bg-amber-500/15 text-amber-300" },
    take_profit: { label: "Target", cls: "bg-green-500/15 text-green-300" },
    open: { label: "Open", cls: "bg-teal-500/15 text-teal-300" },
};

function ExitBadge({ reason }: { reason: string }) {
    const meta = EXIT_META[reason] ?? EXIT_META.signal;
    return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${meta.cls}`}>{meta.label}</span>;
}

function EquityChart({ points }: { points: BacktestEquityPoint[] }) {
    if (points.length < 2) return <p className="py-8 text-sm text-gray-500">No equity data.</p>;

    const H = 280;
    const padTop = 12;
    const padBottom = 28;
    const padLeft = 44;
    const plotH = H - padTop - padBottom;
    const W = 900;
    const plotW = W - padLeft - 8;

    const vals = points.flatMap((p) => [p.strategy, p.buyHold]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;

    const x = (i: number) => padLeft + (i / (points.length - 1)) * plotW;
    const y = (v: number) => padTop + plotH - ((v - min) / span) * plotH;

    const line = (key: "strategy" | "buyHold") => points.map((p, i) => `${x(i)},${y(p[key])}`).join(" ");

    // 100 baseline (starting capital).
    const baseY = y(100);
    const last = points[points.length - 1];

    return (
        <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ minWidth: 640 }}>
                {[0, 0.25, 0.5, 0.75, 1].map((g) => {
                    const val = min + g * span;
                    const yy = padTop + plotH - g * plotH;
                    return (
                        <g key={g}>
                            <line x1={padLeft} x2={W - 8} y1={yy} y2={yy} stroke="#374151" strokeWidth={0.5} />
                            <text x={4} y={yy + 3} fill="#6b7280" fontSize={10}>{val.toFixed(0)}</text>
                        </g>
                    );
                })}
                {min <= 100 && max >= 100 && (
                    <line x1={padLeft} x2={W - 8} y1={baseY} y2={baseY} stroke="#6b7280" strokeDasharray="4 4" strokeWidth={1} />
                )}
                <polyline points={line("buyHold")} fill="none" stroke="#9ca3af" strokeWidth={1.5} opacity={0.8} />
                <polyline points={line("strategy")} fill="none" stroke="#0FEDBE" strokeWidth={2} />
            </svg>
            <div className="mt-1 flex items-center gap-4 px-1 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm" style={{ background: "#0FEDBE" }} /> Strategy ({fmtPct(last.strategy - 100)})</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm" style={{ background: "#9ca3af" }} /> Buy &amp; Hold ({fmtPct(last.buyHold - 100)})</span>
                <span className="text-gray-600">Indexed to 100 at start</span>
            </div>
        </div>
    );
}

function Metric({ label, value, tone, sub, info }: { label: string; value: string; tone?: string; sub?: string; info?: string }) {
    return (
        <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-3">
            <div className="flex items-center gap-1 text-xs text-gray-500">{label}{info && <InfoTooltip term={info} align="left" />}</div>
            <div className={`mt-1 text-lg font-bold ${tone ?? "text-gray-100"}`}>{value}</div>
            {sub && <div className="text-[11px] text-gray-500">{sub}</div>}
        </div>
    );
}

export default function BacktestWorkspace() {
    const [input, setInput] = useState("RELIANCE");
    const [symbol, setSymbol] = useState("RELIANCE");
    const [strategy, setStrategy] = useState<BacktestStrategy>("sma_cross");
    const [range, setRange] = useState("2y");
    const [fast, setFast] = useState(20);
    const [slow, setSlow] = useState(50);
    const [rsiLow, setRsiLow] = useState(30);
    const [rsiHigh, setRsiHigh] = useState(70);
    const [breakout, setBreakout] = useState(20);
    const [capital, setCapital] = useState(100000);
    const [costPct, setCostPct] = useState(0.05);
    const [stopLossPct, setStopLossPct] = useState(0);
    const [takeProfitPct, setTakeProfitPct] = useState(0);
    const [trailingPct, setTrailingPct] = useState(0);
    const [result, setResult] = useState<BacktestResult | null>(null);
    const [isPending, startTransition] = useTransition();

    const run = (sym = symbol) => {
        startTransition(async () => {
            const res = await runBacktest({
                symbol: sym, strategy, range,
                fast, slow, rsiLow, rsiHigh, breakout,
                capital, costPct, stopLossPct, takeProfitPct, trailingPct,
            });
            setResult(res);
        });
    };

    const selectSymbol = (s: string) => {
        const next = s.trim().toUpperCase();
        if (!next) return;
        setSymbol(next);
        setInput(next);
        run(next);
    };

    const m = result?.metrics;
    const beatsHold = m ? m.totalReturnPct > m.buyHoldReturnPct : false;

    return (
        <div className="mx-auto min-h-screen w-full max-w-7xl p-4 md:p-6 lg:p-8">
            <div className="mb-5">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-100">
                    <Activity className="h-6 w-6 text-teal-400" />
                    Strategy Backtester
                </h1>
                <p className="mt-1 text-sm text-gray-400">
                    Test a simple rule on historical daily candles — equity curve, win-rate and drawdown vs buy &amp; hold. Research/education only, not investment advice.
                </p>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <form
                        onSubmit={(e) => { e.preventDefault(); selectSymbol(input); }}
                        className="flex flex-1 items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/60 px-3"
                    >
                        <Search className="h-4 w-4 shrink-0 text-gray-500" />
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Symbol (e.g. RELIANCE, TCS)"
                            className="w-full bg-transparent py-2.5 text-sm uppercase text-gray-100 placeholder:text-gray-500 focus:outline-none"
                        />
                    </form>
                    <select value={range} onChange={(e) => setRange(e.target.value)} className="rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2.5 text-sm text-gray-100 focus:outline-none">
                        {RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button
                        type="button"
                        onClick={() => run()}
                        disabled={isPending}
                        className="flex items-center justify-center gap-1.5 rounded-lg bg-teal-500/90 px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-teal-400 disabled:opacity-50"
                    >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        Run
                    </button>
                </div>

                {/* Strategy picker */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {STRATEGIES.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => setStrategy(s.id)}
                            className={`rounded-lg border p-3 text-left transition-colors ${strategy === s.id ? "border-teal-500/50 bg-teal-500/10" : "border-gray-700 bg-gray-800/40 hover:border-gray-600"}`}
                        >
                            <div className={`text-sm font-semibold ${strategy === s.id ? "text-teal-300" : "text-gray-200"}`}>{s.label}</div>
                            <div className="text-xs text-gray-500">{s.desc}</div>
                        </button>
                    ))}
                </div>

                {/* Strategy params */}
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-700/60 bg-gray-800/30 p-3 text-sm">
                    {strategy === "sma_cross" && (
                        <>
                            <NumField label="Fast SMA" value={fast} onChange={setFast} min={2} max={100} />
                            <NumField label="Slow SMA" value={slow} onChange={setSlow} min={3} max={250} />
                        </>
                    )}
                    {strategy === "rsi" && (
                        <>
                            <NumField label="Buy below RSI" value={rsiLow} onChange={setRsiLow} min={5} max={50} />
                            <NumField label="Exit above RSI" value={rsiHigh} onChange={setRsiHigh} min={50} max={95} />
                        </>
                    )}
                    {strategy === "breakout" && (
                        <NumField label="Channel (days)" value={breakout} onChange={setBreakout} min={5} max={120} />
                    )}
                    <span className="text-xs text-gray-500">Adjust, then press Run.</span>
                </div>

                {/* Risk & costs */}
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-700/60 bg-gray-800/30 p-3 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Risk &amp; costs</span>
                    <NumField label="Capital ₹" value={capital} onChange={setCapital} min={1000} max={100000000} step={1000} width="w-28" />
                    <NumField label="Cost % / side" value={costPct} onChange={setCostPct} min={0} max={2} step={0.01} />
                    <NumField label="Stop-loss %" value={stopLossPct} onChange={setStopLossPct} min={0} max={90} step={0.5} />
                    <NumField label="Take-profit %" value={takeProfitPct} onChange={setTakeProfitPct} min={0} max={500} step={1} />
                    <NumField label="Trailing %" value={trailingPct} onChange={setTrailingPct} min={0} max={90} step={0.5} />
                    <span className="text-xs text-gray-500">0 = off</span>
                </div>
            </div>

            {/* Loading / error */}
            {isPending && (
                <div className="mt-8 flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Running backtest…
                </div>
            )}
            {!isPending && result && !result.available && (
                <p className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">{result.error}</p>
            )}

            {/* Results */}
            {!isPending && result?.available && m && (
                <div className="mt-6 flex flex-col gap-6">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                        <Metric label="Strategy Return" value={fmtPct(m.totalReturnPct)} tone={toneFor(m.totalReturnPct)} sub={`vs ${fmtPct(m.buyHoldReturnPct)} hold`} />
                        <Metric label="Net P&L" value={`₹${m.pnl.toLocaleString("en-IN")}`} tone={toneFor(m.pnl)} sub={`₹${m.finalCapital.toLocaleString("en-IN")} final`} />
                        <Metric label="CAGR" value={fmtPct(m.cagrPct)} tone={toneFor(m.cagrPct)} info="cagr" />
                        <Metric label="Max Drawdown" value={fmtPct(m.maxDrawdownPct)} tone="text-red-400" info="maxDrawdown" />
                        <Metric label="Sharpe" value={m.sharpe.toFixed(2)} tone={toneFor(m.sharpe)} info="sharpe" />
                        <Metric label="Sortino" value={m.sortino.toFixed(2)} tone={toneFor(m.sortino)} info="sortino" />
                        <Metric label="Calmar" value={m.calmar.toFixed(2)} tone={toneFor(m.calmar)} info="calmar" />
                        <Metric label="Profit Factor" value={m.profitFactor.toFixed(2)} tone={toneFor(m.profitFactor - 1)} info="profitFactor" />
                        <Metric label="Win Rate" value={`${m.winRatePct}%`} sub={`${m.trades} trades`} />
                        <Metric label="Avg Win / Loss" value={`${fmtPct(m.avgWinPct)} / ${fmtPct(m.avgLossPct)}`} />
                        <Metric label="Best / Worst" value={`${fmtPct(m.bestTradePct)} / ${fmtPct(m.worstTradePct)}`} />
                        <Metric label="Max Consec. Losses" value={`${m.maxConsecLosses}`} sub={`avg hold ${m.avgHoldBars}d`} />
                        <Metric label="Time in Market" value={`${m.exposurePct}%`} />
                        <Metric
                            label="vs Buy & Hold"
                            value={beatsHold ? "Outperforms" : "Underperforms"}
                            tone={beatsHold ? "text-green-400" : "text-red-400"}
                            sub={fmtPct(m.totalReturnPct - m.buyHoldReturnPct)}
                        />
                    </div>

                    <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
                        <div className="mb-2 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-200">Equity Curve · {result.symbol}</h3>
                            <span className="text-xs text-gray-500">{result.startDate} → {result.endDate} · {result.bars} bars</span>
                        </div>
                        <EquityChart points={result.equityCurve} />
                    </div>

                    {result.trades.length > 0 && (
                        <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
                            <h3 className="mb-3 text-sm font-semibold text-gray-200">Trade Log ({result.trades.length})</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[560px] border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-gray-700 text-[11px] uppercase tracking-wide text-gray-500">
                                            <th className="px-2 py-1.5 text-left font-medium">Entry</th>
                                            <th className="px-2 py-1.5 text-left font-medium">Exit</th>
                                            <th className="px-2 py-1.5 text-left font-medium">Reason</th>
                                            <th className="px-2 py-1.5 text-right font-medium">Entry ₹</th>
                                            <th className="px-2 py-1.5 text-right font-medium">Exit ₹</th>
                                            <th className="px-2 py-1.5 text-right font-medium">Bars</th>
                                            <th className="px-2 py-1.5 text-right font-medium">P&L ₹</th>
                                            <th className="px-2 py-1.5 text-right font-medium">Return</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.trades.map((t, i) => (
                                            <tr key={`${t.entryDate}-${i}`} className="border-b border-gray-800/70 hover:bg-gray-800/40">
                                                <td className="px-2 py-1.5 text-gray-300">{t.entryDate}</td>
                                                <td className="px-2 py-1.5 text-gray-300">{t.exitDate}</td>
                                                <td className="px-2 py-1.5"><ExitBadge reason={t.exit} /></td>
                                                <td className="px-2 py-1.5 text-right tabular-nums text-gray-400">{t.entryPrice.toFixed(2)}</td>
                                                <td className="px-2 py-1.5 text-right tabular-nums text-gray-400">{t.exitPrice.toFixed(2)}</td>
                                                <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{t.bars}</td>
                                                <td className={`px-2 py-1.5 text-right tabular-nums ${toneFor(t.pnl)}`}>{t.pnl >= 0 ? "+" : ""}{t.pnl.toLocaleString("en-IN")}</td>
                                                <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${toneFor(t.returnPct)}`}>
                                                    <span className="inline-flex items-center justify-end gap-1">
                                                        {t.returnPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                        {fmtPct(t.returnPct)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <p className="text-[11px] text-gray-600">
                        Long-only, full-capital · costs &amp; intrabar stop-loss/target/trailing modelled when set · signals act on the same close (no look-ahead via rising-edge entries) · past performance is not indicative of future results · research/education only, not investment advice.
                    </p>
                </div>
            )}

            {/* Symbol presets */}
            {!result && !isPending && (
                <div className="mt-6">
                    <div className="mb-2 text-xs text-gray-500">Try a symbol:</div>
                    <div className="flex flex-wrap gap-2">
                        {PRESETS.map((p) => (
                            <button key={p} type="button" onClick={() => selectSymbol(p)} className="rounded-full border border-gray-700 bg-gray-800/40 px-3 py-1.5 text-xs text-gray-300 hover:text-teal-300">
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function NumField({ label, value, onChange, min, max, step = 1, width = "w-20" }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; width?: string }) {
    return (
        <label className="flex items-center gap-2 text-gray-400">
            {label}
            <input
                type="number"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
                className={`${width} rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1 text-sm text-gray-100 focus:border-teal-500 focus:outline-none`}
            />
        </label>
    );
}
