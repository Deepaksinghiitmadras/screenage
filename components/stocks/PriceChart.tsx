"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
    createChart,
    ColorType,
    CandlestickSeries,
    LineSeries,
    AreaSeries,
    BarSeries,
    BaselineSeries,
    HistogramSeries,
    LineStyle,
    type IChartApi,
    type Time,
} from "lightweight-charts";
import { getHistory } from "@/lib/actions/market.actions";

type ChartType = "candles" | "line" | "area" | "bars" | "baseline";

const RANGES: { label: string; value: string }[] = [
    { label: "1M", value: "1mo" },
    { label: "3M", value: "3mo" },
    { label: "6M", value: "6mo" },
    { label: "1Y", value: "1y" },
    { label: "5Y", value: "5y" },
];

const CHART_TYPES: { label: string; value: ChartType }[] = [
    { label: "Candles", value: "candles" },
    { label: "Line", value: "line" },
    { label: "Area", value: "area" },
    { label: "Bars", value: "bars" },
    { label: "Baseline", value: "baseline" },
];

const GREEN = "#22c55e";
const RED = "#ef4444";
const TEAL = "#2dd4bf";

const sma = (candles: StockCandle[], period: number) => {
    const out: { time: Time; value: number }[] = [];
    for (let i = period - 1; i < candles.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) sum += candles[i - j].close;
        out.push({ time: candles[i].time as Time, value: +(sum / period).toFixed(2) });
    }
    return out;
};

export default function PriceChart({
    symbol,
    initialCandles,
    initialRange = "6mo",
}: {
    symbol: string;
    initialCandles: StockCandle[];
    initialRange?: string;
}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<IChartApi | null>(null);

    const [range, setRange] = useState(initialRange);
    const [candles, setCandles] = useState<StockCandle[]>(initialCandles);
    const [chartType, setChartType] = useState<ChartType>("candles");
    const [showVolume, setShowVolume] = useState(true);
    const [showSMA20, setShowSMA20] = useState(false);
    const [showSMA50, setShowSMA50] = useState(false);
    const [logScale, setLogScale] = useState(false);
    const [isPending, startTransition] = useTransition();

    const hasData = candles.length > 0;
    const lastClose = hasData ? candles[candles.length - 1].close : 0;

    const mainData = useMemo(() => {
        if (chartType === "candles" || chartType === "bars") {
            return candles.map((c) => ({
                time: c.time as Time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
            }));
        }
        return candles.map((c) => ({ time: c.time as Time, value: c.close }));
    }, [candles, chartType]);

    // (Re)build the chart whenever visual options or data change.
    useEffect(() => {
        if (!containerRef.current || !hasData) return;

        const chart = createChart(containerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: "transparent" },
                textColor: "#9ca3af",
                attributionLogo: false,
            },
            grid: {
                vertLines: { color: "rgba(55,65,81,0.35)" },
                horzLines: { color: "rgba(55,65,81,0.35)" },
            },
            rightPriceScale: {
                borderColor: "rgba(55,65,81,0.6)",
                mode: logScale ? 1 : 0, // 1 = logarithmic
            },
            timeScale: { borderColor: "rgba(55,65,81,0.6)", timeVisible: false },
            crosshair: { mode: 1 },
            autoSize: true,
        });
        chartRef.current = chart;

        // Main price series
        if (chartType === "candles") {
            const s = chart.addSeries(CandlestickSeries, {
                upColor: GREEN, downColor: RED,
                borderUpColor: GREEN, borderDownColor: RED,
                wickUpColor: GREEN, wickDownColor: RED,
            });
            s.setData(mainData as never);
        } else if (chartType === "bars") {
            const s = chart.addSeries(BarSeries, { upColor: GREEN, downColor: RED });
            s.setData(mainData as never);
        } else if (chartType === "line") {
            const s = chart.addSeries(LineSeries, { color: TEAL, lineWidth: 2 });
            s.setData(mainData as never);
        } else if (chartType === "area") {
            const s = chart.addSeries(AreaSeries, {
                lineColor: TEAL, topColor: "rgba(45,212,191,0.4)", bottomColor: "rgba(45,212,191,0.02)", lineWidth: 2,
            });
            s.setData(mainData as never);
        } else {
            const s = chart.addSeries(BaselineSeries, {
                baseValue: { type: "price", price: candles[0].close },
                topLineColor: GREEN, topFillColor1: "rgba(34,197,94,0.3)", topFillColor2: "rgba(34,197,94,0.02)",
                bottomLineColor: RED, bottomFillColor1: "rgba(239,68,68,0.02)", bottomFillColor2: "rgba(239,68,68,0.3)",
            });
            s.setData(mainData as never);
        }

        // Moving averages
        if (showSMA20 && candles.length >= 20) {
            const s = chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: LineStyle.Solid });
            s.setData(sma(candles, 20) as never);
        }
        if (showSMA50 && candles.length >= 50) {
            const s = chart.addSeries(LineSeries, { color: "#a855f7", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
            s.setData(sma(candles, 50) as never);
        }

        // Volume
        if (showVolume) {
            const v = chart.addSeries(HistogramSeries, {
                priceFormat: { type: "volume" },
                priceScaleId: "volume",
                lastValueVisible: false,
            });
            chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
            v.setData(
                candles.map((c) => ({
                    time: c.time as Time,
                    value: c.volume,
                    color: c.close >= c.open ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)",
                })) as never,
            );
        }

        chart.timeScale().fitContent();

        return () => {
            chart.remove();
            chartRef.current = null;
        };
    }, [mainData, chartType, showVolume, showSMA20, showSMA50, logScale, candles, hasData]);

    const handleRange = (value: string) => {
        if (value === range) return;
        setRange(value);
        startTransition(async () => {
            const data = await getHistory(symbol, value);
            setCandles(data.candles);
        });
    };

    const pill = (active: boolean) =>
        `rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            active ? "bg-teal-500/20 text-teal-300" : "text-gray-400 hover:bg-gray-700/60 hover:text-gray-200"
        }`;

    return (
        <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
            {/* Top row: title + range */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-gray-100">
                    Price Chart
                    {hasData && <span className="ml-2 text-sm font-normal text-gray-400">₹{lastClose.toLocaleString("en-IN")}</span>}
                    {isPending && <span className="ml-2 text-xs text-gray-500">loading…</span>}
                </h3>
                <div className="flex gap-1">
                    {RANGES.map((r) => (
                        <button key={r.value} type="button" onClick={() => handleRange(r.value)} className={pill(range === r.value)}>
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Controls row: chart type + indicators */}
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex gap-1">
                    {CHART_TYPES.map((t) => (
                        <button key={t.value} type="button" onClick={() => setChartType(t.value)} className={pill(chartType === t.value)}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="flex gap-1">
                    <button type="button" onClick={() => setShowSMA20((v) => !v)} className={pill(showSMA20)}>
                        <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: "#f59e0b" }} />SMA 20
                    </button>
                    <button type="button" onClick={() => setShowSMA50((v) => !v)} className={pill(showSMA50)}>
                        <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: "#a855f7" }} />SMA 50
                    </button>
                    <button type="button" onClick={() => setShowVolume((v) => !v)} className={pill(showVolume)}>Volume</button>
                    <button type="button" onClick={() => setLogScale((v) => !v)} className={pill(logScale)}>Log</button>
                </div>
            </div>

            {hasData ? (
                <div ref={containerRef} className="h-[440px] w-full" />
            ) : (
                <div className="flex h-[440px] items-center justify-center text-sm text-gray-500">
                    Chart data unavailable for this symbol.
                </div>
            )}
        </div>
    );
}
