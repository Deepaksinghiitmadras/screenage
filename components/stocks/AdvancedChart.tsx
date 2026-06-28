"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { init, dispose, type Chart } from "klinecharts";
import {
    Maximize2,
    Minimize2,
    TrendingUp,
    Minus,
    MoveVertical,
    Slash,
    GitBranchPlus,
    Ruler,
    Eraser,
    Equal,
    Spline,
    RotateCcw,
} from "lucide-react";
import { getHistory } from "@/lib/actions/market.actions";

type CandleType = "candle_solid" | "candle_stroke" | "ohlc" | "area";

const RANGES: { label: string; value: string }[] = [
    { label: "1M", value: "1mo" },
    { label: "3M", value: "3mo" },
    { label: "6M", value: "6mo" },
    { label: "1Y", value: "1y" },
    { label: "5Y", value: "5y" },
];

const CHART_TYPES: { label: string; value: CandleType }[] = [
    { label: "Candles", value: "candle_solid" },
    { label: "Hollow", value: "candle_stroke" },
    { label: "Bars", value: "ohlc" },
    { label: "Area", value: "area" },
];

const MAIN_INDICATORS = ["MA", "EMA", "BOLL", "SAR", "BBI"];
const SUB_INDICATORS = ["VOL", "MACD", "RSI", "KDJ", "DMI", "CCI", "WR", "OBV"];

const DRAW_TOOLS: { label: string; name: string; Icon: typeof TrendingUp }[] = [
    { label: "Trend line", name: "segment", Icon: TrendingUp },
    { label: "Ray", name: "rayLine", Icon: Slash },
    { label: "Horizontal line", name: "horizontalStraightLine", Icon: Minus },
    { label: "Vertical line", name: "verticalStraightLine", Icon: MoveVertical },
    { label: "Parallel channel", name: "parallelStraightLine", Icon: Equal },
    { label: "Price channel", name: "priceChannelLine", Icon: Spline },
    { label: "Fibonacci", name: "fibonacciLine", Icon: GitBranchPlus },
    { label: "Price line", name: "priceLine", Icon: Ruler },
];

const GREEN = "#22c55e";
const RED = "#ef4444";

const chartStyles = (type: CandleType, isLight: boolean, logScale: boolean) => {
    const grid = isLight ? "rgba(0,0,0,0.06)" : "rgba(55,65,81,0.35)";
    const axis = isLight ? "rgba(0,0,0,0.18)" : "rgba(55,65,81,0.6)";
    const tick = isLight ? "#4b5563" : "#9ca3af";
    const tooltipText = isLight ? "#374151" : "#d1d5db";
    const crossLine = isLight ? "#9ca3af" : "#6b7280";
    const crossBg = isLight ? "#4b5563" : "#374151";
    return {
        grid: {
            horizontal: { color: grid },
            vertical: { color: grid },
        },
        candle: {
            type,
            bar: {
                upColor: GREEN,
                downColor: RED,
                noChangeColor: "#9ca3af",
                upBorderColor: GREEN,
                downBorderColor: RED,
                upWickColor: GREEN,
                downWickColor: RED,
            },
            priceMark: {
                high: { color: tick },
                low: { color: tick },
                last: {
                    upColor: GREEN,
                    downColor: RED,
                    noChangeColor: "#9ca3af",
                    text: { color: "#ffffff" },
                },
            },
            tooltip: { text: { color: tooltipText } },
        },
        indicator: {
            tooltip: { text: { color: tooltipText } },
        },
        xAxis: {
            axisLine: { color: axis },
            tickText: { color: tick },
            tickLine: { color: axis },
        },
        yAxis: {
            type: logScale ? "logarithmic" : "normal",
            axisLine: { color: axis },
            tickText: { color: tick },
            tickLine: { color: axis },
        },
        crosshair: {
            horizontal: { line: { color: crossLine }, text: { backgroundColor: crossBg } },
            vertical: { line: { color: crossLine }, text: { backgroundColor: crossBg } },
        },
    };
};

export default function AdvancedChart({
    symbol,
    initialCandles,
    initialRange = "6mo",
}: {
    symbol: string;
    initialCandles: StockCandle[];
    initialRange?: string;
}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<Chart | null>(null);
    // Track indicators already on the chart so we can update in place.
    const mainOnChartRef = useRef<string | null>(null);
    const subPanesRef = useRef<Map<string, string>>(new Map());
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const isLight = mounted && resolvedTheme === "light";

    const [range, setRange] = useState(initialRange);
    const [candles, setCandles] = useState<StockCandle[]>(initialCandles);
    const [candleType, setCandleType] = useState<CandleType>("candle_solid");
    const [mainIndicator, setMainIndicator] = useState<string>("MA");
    const [subIndicators, setSubIndicators] = useState<string[]>(["VOL"]);
    const [maInput, setMaInput] = useState("5,10,30");
    const [logScale, setLogScale] = useState(false);
    const [isFull, setIsFull] = useState(false);
    const [activeTool, setActiveTool] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    useEffect(() => setMounted(true), []);

    const maParams = useMemo(
        () =>
            maInput
                .split(",")
                .map((s) => parseInt(s.trim(), 10))
                .filter((n) => Number.isFinite(n) && n > 0 && n <= 400)
                .slice(0, 4),
        [maInput],
    );
    const supportsParams = mainIndicator === "MA" || mainIndicator === "EMA";

    const hasData = candles.length > 0;
    const lastClose = hasData ? candles[candles.length - 1].close : 0;
    const firstClose = hasData ? candles[0].close : 0;
    const pctChange = firstClose ? ((lastClose - firstClose) / firstClose) * 100 : 0;

    const klineData = useMemo(
        () =>
            candles.map((c) => ({
                timestamp: new Date(c.time).getTime(),
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume,
            })),
        [candles],
    );

    // 1. Create the chart ONCE on mount. Drawings/indicators added later persist.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const chart = init(el);
        if (!chart) return;
        chartRef.current = chart;
        return () => {
            dispose(el);
            chartRef.current = null;
            mainOnChartRef.current = null;
            subPanesRef.current.clear();
        };
    }, []);

    // 2. Theme / candle type / scale → restyle in place (keeps overlays).
    useEffect(() => {
        chartRef.current?.setStyles(chartStyles(candleType, isLight, logScale));
    }, [candleType, isLight, logScale]);

    // 3. New data → swap data in place (keeps drawings & indicators).
    useEffect(() => {
        if (klineData.length === 0) return;
        chartRef.current?.applyNewData(klineData);
    }, [klineData]);

    // 4. Main (overlay) indicator → replace only when it changes.
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;
        if (mainOnChartRef.current) {
            chart.removeIndicator("candle_pane", mainOnChartRef.current);
            mainOnChartRef.current = null;
        }
        if (mainIndicator !== "NONE") {
            const useParams =
                (mainIndicator === "MA" || mainIndicator === "EMA") && maParams.length > 0;
            chart.createIndicator(
                useParams ? { name: mainIndicator, calcParams: maParams } : mainIndicator,
                true,
                { id: "candle_pane" },
            );
            mainOnChartRef.current = mainIndicator;
        }
    }, [mainIndicator, maParams]);

    // 5. Sub (study) indicators → add/remove panes incrementally.
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;
        const panes = subPanesRef.current;
        const desired = new Set(subIndicators);
        for (const [name, paneId] of Array.from(panes.entries())) {
            if (!desired.has(name)) {
                chart.removeIndicator(paneId, name);
                panes.delete(name);
            }
        }
        for (const name of subIndicators) {
            if (!panes.has(name)) {
                const paneId = chart.createIndicator(name, false);
                if (paneId) panes.set(name, paneId);
            }
        }
    }, [subIndicators]);

    // Fullscreen handling.
    useEffect(() => {
        const onChange = () => {
            setIsFull(!!document.fullscreenElement);
            window.setTimeout(() => chartRef.current?.resize(), 120);
        };
        document.addEventListener("fullscreenchange", onChange);
        return () => document.removeEventListener("fullscreenchange", onChange);
    }, []);

    const toggleFullscreen = () => {
        const el = wrapRef.current;
        if (!el) return;
        if (!document.fullscreenElement) el.requestFullscreen?.();
        else document.exitFullscreen?.();
    };

    const handleRange = (value: string) => {
        if (value === range) return;
        setRange(value);
        startTransition(async () => {
            const data = await getHistory(symbol, value);
            setCandles(data.candles);
        });
    };

    const toggleSub = (name: string) =>
        setSubIndicators((prev) =>
            prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
        );

    const startDrawing = (name: string) => {
        const chart = chartRef.current;
        if (!chart) return;
        setActiveTool(name);
        chart.createOverlay({
            name,
            onDrawEnd: () => {
                setActiveTool(null);
                return true;
            },
        });
    };

    const clearDrawings = () => {
        setActiveTool(null);
        chartRef.current?.removeOverlay();
    };

    const resetView = () => chartRef.current?.scrollToRealTime();

    const pill = (active: boolean) =>
        `rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            active
                ? "bg-teal-500/20 text-teal-300"
                : "text-gray-400 hover:bg-gray-700/60 hover:text-gray-200"
        }`;

    return (
        <div
            ref={wrapRef}
            className={`rounded-lg border border-gray-700/60 p-4 ${
                isFull ? "flex h-screen flex-col bg-gray-900" : "bg-gray-800/40"
            }`}
        >
            {/* Title + range */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-gray-100">
                    Price Chart
                    {hasData && (
                        <span className="ml-2 text-sm font-normal text-gray-400">
                            ₹{lastClose.toLocaleString("en-IN")}
                        </span>
                    )}
                    {hasData && (
                        <span
                            className={`ml-2 text-xs font-medium ${
                                pctChange >= 0 ? "text-green-500" : "text-red-500"
                            }`}
                        >
                            {pctChange >= 0 ? "+" : ""}
                            {pctChange.toFixed(2)}%
                        </span>
                    )}
                    {isPending && <span className="ml-2 text-xs text-gray-500">loading…</span>}
                </h3>
                <div className="flex items-center gap-1">
                    {RANGES.map((r) => (
                        <button
                            key={r.value}
                            type="button"
                            onClick={() => handleRange(r.value)}
                            className={pill(range === r.value)}
                        >
                            {r.label}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => setLogScale((v) => !v)}
                        title="Toggle logarithmic price scale"
                        className={pill(logScale)}
                    >
                        Log
                    </button>
                    <button
                        type="button"
                        onClick={resetView}
                        title="Reset view to latest"
                        className="ml-1 rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-700/60 hover:text-gray-200"
                    >
                        <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={toggleFullscreen}
                        title={isFull ? "Exit full screen" : "Full screen"}
                        className="ml-1 rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-700/60 hover:text-gray-200"
                    >
                        {isFull ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            {/* Chart type */}
            <div className="mb-2 flex flex-wrap items-center gap-1">
                {CHART_TYPES.map((t) => (
                    <button
                        key={t.value}
                        type="button"
                        onClick={() => setCandleType(t.value)}
                        className={pill(candleType === t.value)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Indicators */}
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-1">
                    <span className="mr-1 text-xs text-gray-500">Overlay:</span>
                    {[...MAIN_INDICATORS, "NONE"].map((m) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => setMainIndicator(m)}
                            className={pill(mainIndicator === m)}
                        >
                            {m === "NONE" ? "Off" : m}
                        </button>
                    ))}
                    {supportsParams && (
                        <label className="ml-1 flex items-center gap-1 text-xs text-gray-500">
                            <span>periods</span>
                            <input
                                value={maInput}
                                onChange={(e) => setMaInput(e.target.value)}
                                placeholder="5,10,30"
                                className="w-24 rounded border border-gray-700 bg-gray-900/60 px-2 py-1 text-xs text-gray-200 outline-none focus:border-teal-500"
                            />
                        </label>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <span className="mr-1 text-xs text-gray-500">Studies:</span>
                    {SUB_INDICATORS.map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => toggleSub(s)}
                            className={pill(subIndicators.includes(s))}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Drawing tools */}
            <div className="mb-3 flex flex-wrap items-center gap-1 border-t border-gray-700/60 pt-3">
                <span className="mr-1 text-xs text-gray-500">Draw:</span>
                {DRAW_TOOLS.map((t) => (
                    <button
                        key={t.name}
                        type="button"
                        onClick={() => startDrawing(t.name)}
                        title={t.label}
                        className={`flex items-center gap-1 ${pill(activeTool === t.name)}`}
                    >
                        <t.Icon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{t.label}</span>
                    </button>
                ))}
                <button
                    type="button"
                    onClick={clearDrawings}
                    title="Clear all drawings"
                    className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                    <Eraser className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Clear</span>
                </button>
            </div>

            <div className={`relative ${isFull ? "flex flex-1 flex-col" : ""}`}>
                <div ref={containerRef} className={isFull ? "w-full flex-1" : "h-[480px] w-full"} />
                {!hasData && (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
                        Chart data unavailable for this symbol.
                    </div>
                )}
            </div>
            <p className="mt-2 text-xs text-gray-600">
                Drag to pan · scroll to zoom · hover for OHLC. Drawings stay put as you change
                range, indicators or theme. Delayed data, research use only.
            </p>
        </div>
    );
}
