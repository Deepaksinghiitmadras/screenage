"use client";

import { useState, useTransition } from "react";
import { Sparkles, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Eye, RefreshCw, Loader2 } from "lucide-react";
import { getStockAIAnalysis } from "@/lib/actions/ai-analysis.actions";

const STANCE_STYLES: Record<string, string> = {
    Bullish: "bg-green-500/15 text-green-400 border-green-500/30",
    Bearish: "bg-red-500/15 text-red-400 border-red-500/30",
    Neutral: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

function StanceIcon({ stance }: { stance?: string }) {
    if (stance === "Bullish") return <TrendingUp className="h-4 w-4" />;
    if (stance === "Bearish") return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
}

export default function AIAnalysisCard({ symbol }: { symbol: string }) {
    const [analysis, setAnalysis] = useState<StockAIAnalysis | null>(null);
    const [isPending, startTransition] = useTransition();

    const generate = () => {
        startTransition(async () => {
            const data = await getStockAIAnalysis(symbol);
            setAnalysis(data);
        });
    };

    return (
        <div className="rounded-lg border border-gray-700/60 bg-gradient-to-b from-gray-800/60 to-gray-900/40 p-4">
            <div className="flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-base font-semibold text-gray-100">
                    <Sparkles className="h-4 w-4 text-teal-400" />
                    AI Analysis
                </h3>
                <button
                    type="button"
                    onClick={generate}
                    disabled={isPending}
                    className="flex items-center gap-1.5 rounded-md bg-teal-500/20 px-3 py-1.5 text-xs font-medium text-teal-300 transition-colors hover:bg-teal-500/30 disabled:opacity-60"
                >
                    {isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : analysis ? (
                        <RefreshCw className="h-3.5 w-3.5" />
                    ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {analysis ? "Regenerate" : "Generate"}
                </button>
            </div>

            {!analysis && !isPending && (
                <p className="mt-3 text-sm text-gray-400">
                    Generate an AI-grounded summary of {symbol.toUpperCase()} — stance, strengths, risks,
                    valuation and technicals, based on its fundamentals and price history.
                </p>
            )}

            {isPending && (
                <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Analysing fundamentals and price action…
                </div>
            )}

            {analysis && !isPending && !analysis.available && (
                <p className="mt-3 text-sm text-amber-300">{analysis.error ?? "Analysis unavailable."}</p>
            )}

            {analysis && !isPending && analysis.available && (
                <div className="mt-4 flex flex-col gap-4">
                    {/* Stance + thesis */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${STANCE_STYLES[analysis.stance ?? "Neutral"]}`}>
                            <StanceIcon stance={analysis.stance} />
                            {analysis.stance}
                        </span>
                        <span className="rounded-full bg-gray-700/60 px-2.5 py-1 text-xs text-gray-300">
                            Confidence: {analysis.confidence}
                        </span>
                    </div>
                    {analysis.thesis && <p className="text-sm text-gray-200">{analysis.thesis}</p>}

                    {/* Strengths + risks */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {analysis.strengths && analysis.strengths.length > 0 && (
                            <div className="rounded-lg border border-gray-700/60 bg-black/20 p-3">
                                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-green-400">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Strengths
                                </h4>
                                <ul className="space-y-1.5">
                                    {analysis.strengths.map((s, i) => (
                                        <li key={i} className="text-xs text-gray-300">• {s}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {analysis.risks && analysis.risks.length > 0 && (
                            <div className="rounded-lg border border-gray-700/60 bg-black/20 p-3">
                                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-400">
                                    <AlertTriangle className="h-3.5 w-3.5" /> Risks
                                </h4>
                                <ul className="space-y-1.5">
                                    {analysis.risks.map((s, i) => (
                                        <li key={i} className="text-xs text-gray-300">• {s}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Valuation + technical */}
                    {(analysis.valuation || analysis.technical) && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {analysis.valuation && (
                                <div>
                                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Valuation</h4>
                                    <p className="text-xs text-gray-300">{analysis.valuation}</p>
                                </div>
                            )}
                            {analysis.technical && (
                                <div>
                                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Technicals</h4>
                                    <p className="text-xs text-gray-300">{analysis.technical}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* What to watch */}
                    {analysis.whatToWatch && analysis.whatToWatch.length > 0 && (
                        <div>
                            <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                <Eye className="h-3.5 w-3.5" /> What to watch
                            </h4>
                            <ul className="space-y-1.5">
                                {analysis.whatToWatch.map((s, i) => (
                                    <li key={i} className="text-xs text-gray-300">• {s}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <p className="border-t border-gray-700/60 pt-2 text-[11px] text-gray-600">
                        AI-generated from delayed data · research/education only, not investment advice
                        {analysis.generatedAt && ` · ${new Date(analysis.generatedAt).toLocaleString("en-IN")}`}
                    </p>
                </div>
            )}
        </div>
    );
}
