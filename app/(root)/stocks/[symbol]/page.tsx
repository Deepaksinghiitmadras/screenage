import TradingViewWidget from "@/components/TradingViewWidget";
import WatchlistButton from "@/components/WatchlistButton";
import { Suspense } from "react";
import StockSentimentCard from "@/components/stocks/StockSentimentCard";
import HeadlineSentimentCard from "@/components/stocks/HeadlineSentimentCard";
import FundamentalsPanel from "@/components/stocks/FundamentalsPanel";
import AIAnalysisCard from "@/components/stocks/AIAnalysisCard";
import PeerComparison from "@/components/stocks/PeerComparison";
import TechnicalSignalCard from "@/components/stocks/TechnicalSignalCard";
import AdvancedChart from "@/components/stocks/AdvancedChart";
import {
    TECHNICAL_ANALYSIS_WIDGET_CONFIG,
} from "@/lib/constants";

import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { isStockInWatchlist } from '@/lib/actions/watchlist.actions';
import { getStockSentimentInsights } from '@/lib/actions/adanos.actions';
import { getHistory, getFundamentals } from '@/lib/actions/market.actions';
import { formatSymbolForTradingView } from '@/lib/utils';

const inr = (value: number | null | undefined): string => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

export default async function StockDetails({ params }: StockDetailsPageProps) {
    const { symbol } = await params;
    // India-first: bare symbols (no exchange suffix) are treated as NSE so the
    // TradingView widgets resolve correctly (e.g. ONGC -> NSE:ONGC, M&M -> NSE:M_M).
    const hasExchange = symbol.includes('.') || symbol.includes(':');
    const tvSymbol = formatSymbolForTradingView(hasExchange ? symbol : `${symbol}.NS`);
    const scriptUrl = `https://s3.tradingview.com/external-embedding/embed-widget-`;

    const session = await auth.api.getSession({
        headers: await headers()
    });
    const userId = session?.user?.id;
    const [isInWatchlist, sentimentInsights, history, fundamentals] = await Promise.all([
        userId ? isStockInWatchlist(userId, symbol) : Promise.resolve(false),
        getStockSentimentInsights(symbol),
        getHistory(symbol, '6mo'),
        getFundamentals(symbol),
    ]);

    const name = fundamentals?.name ?? symbol.toUpperCase();
    const subtitle = [fundamentals?.exchange, fundamentals?.sector].filter(Boolean).join(' • ') || symbol.toUpperCase();
    const price = fundamentals?.price ?? null;
    const change = fundamentals?.change ?? null;
    const changePct = fundamentals?.changePercent ?? null;
    const up = (changePct ?? 0) >= 0;

    return (
        <div className="mx-auto min-h-screen w-full max-w-7xl p-4 md:p-6 lg:p-8">
            {/* Moneycontrol-style header */}
            <div className="mb-6 flex flex-col gap-4 border-b border-gray-800 pb-5 md:flex-row md:items-start md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-100">{name}</h1>
                    <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
                </div>
                <div className="flex items-center gap-6">
                    {price !== null && (
                        <div className="text-right">
                            <div className="text-3xl font-bold text-gray-100">₹{inr(price)}</div>
                            <div className={`text-sm font-medium ${up ? 'text-green-500' : 'text-red-500'}`}>
                                {change !== null && <span>{up ? '+' : ''}{inr(change)} </span>}
                                {changePct !== null && <span>({up ? '+' : ''}{changePct.toFixed(2)}%)</span>}
                            </div>
                            {(fundamentals?.fiftyTwoWeekLow != null || fundamentals?.fiftyTwoWeekHigh != null) && (
                                <div className="mt-1 text-xs text-gray-500">
                                    52W: ₹{inr(fundamentals?.fiftyTwoWeekLow)} – ₹{inr(fundamentals?.fiftyTwoWeekHigh)}
                                </div>
                            )}
                        </div>
                    )}
                    <WatchlistButton
                        symbol={symbol.toUpperCase()}
                        company={name}
                        isInWatchlist={isInWatchlist}
                        userId={userId}
                    />
                </div>
            </div>

            {/* Full-width advanced chart */}
            <AdvancedChart
                symbol={symbol}
                initialCandles={history.candles}
                initialRange={history.range}
            />

            {/* Lower grid: fundamentals + sidebar */}
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="flex flex-col gap-6 lg:col-span-2">
                    <AIAnalysisCard symbol={symbol} />
                    <FundamentalsPanel symbol={symbol} showHeader={false} />
                    <PeerComparison symbol={symbol} />
                </div>
                <div className="flex flex-col gap-6">
                    <TechnicalSignalCard symbol={symbol} />
                    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl border border-gray-700 bg-gray-800" />}>
                        <HeadlineSentimentCard symbol={symbol} />
                    </Suspense>
                    <StockSentimentCard insight={sentimentInsights} />
                    <TradingViewWidget
                        scriptUrl={`${scriptUrl}technical-analysis.js`}
                        config={TECHNICAL_ANALYSIS_WIDGET_CONFIG(tvSymbol)}
                        height={400}
                    />
                </div>
            </div>
        </div>
    );
}
