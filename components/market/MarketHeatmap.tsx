'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type Tile<T> = { item: T; x: number; y: number; w: number; h: number };

/** Squarified treemap layout (Bruls et al.) over a [0..100] x [0..100] box. */
function squarify<T extends { value: number }>(
    items: T[],
    x0: number,
    y0: number,
    x1: number,
    y1: number,
): Tile<T>[] {
    const tiles: Tile<T>[] = [];
    const totalValue = items.reduce((s, i) => s + i.value, 0);
    if (totalValue <= 0) return tiles;

    const totalArea = (x1 - x0) * (y1 - y0);
    const queue = items
        .filter((i) => i.value > 0)
        .map((i) => ({ item: i, area: (i.value / totalValue) * totalArea }))
        .sort((a, b) => b.area - a.area);

    let rx = x0,
        ry = y0,
        rw = x1 - x0,
        rh = y1 - y0;

    type Q = (typeof queue)[number];

    const worst = (row: Q[], side: number): number => {
        if (row.length === 0) return Infinity;
        const sum = row.reduce((s, r) => s + r.area, 0);
        const max = Math.max(...row.map((r) => r.area));
        const min = Math.min(...row.map((r) => r.area));
        const side2 = side * side;
        const sum2 = sum * sum;
        return Math.max((side2 * max) / sum2, sum2 / (side2 * min));
    };

    const layoutRow = (row: Q[]) => {
        const sum = row.reduce((s, r) => s + r.area, 0);
        if (rw >= rh) {
            const colW = sum / rh;
            let yy = ry;
            for (const r of row) {
                const itemH = r.area / colW;
                tiles.push({ item: r.item, x: rx, y: yy, w: colW, h: itemH });
                yy += itemH;
            }
            rx += colW;
            rw -= colW;
        } else {
            const rowH = sum / rw;
            let xx = rx;
            for (const r of row) {
                const itemW = r.area / rowH;
                tiles.push({ item: r.item, x: xx, y: ry, w: itemW, h: rowH });
                xx += itemW;
            }
            ry += rowH;
            rh -= rowH;
        }
    };

    let row: Q[] = [];
    let i = 0;
    while (i < queue.length) {
        const side = Math.min(rw, rh);
        const withNext = [...row, queue[i]];
        if (row.length === 0 || worst(withNext, side) <= worst(row, side)) {
            row = withNext;
            i++;
        } else {
            layoutRow(row);
            row = [];
        }
    }
    if (row.length) layoutRow(row);
    return tiles;
}

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

/** Colour a cell from its % change: red (down) → neutral → green (up). `range` sets sensitivity. */
function cellColor(pct: number, range = 3): string {
    const t = Math.max(-range, Math.min(range, pct)) / range; // -1..1
    const neutral = [38, 41, 48]; // slate
    if (t >= 0) {
        const g = [22, 163, 74];
        return `rgb(${lerp(neutral[0], g[0], t)},${lerp(neutral[1], g[1], t)},${lerp(neutral[2], g[2], t)})`;
    }
    const r = [220, 38, 38];
    const k = -t;
    return `rgb(${lerp(neutral[0], r[0], k)},${lerp(neutral[1], r[1], k)},${lerp(neutral[2], r[2], k)})`;
}

const SENSITIVITIES = [2, 3, 5] as const;

export default function MarketHeatmap({
    cells,
    height = 600,
    title = 'Stock Heatmap',
}: {
    cells: HeatmapCell[];
    height?: number;
    title?: string;
}) {
    const [hover, setHover] = useState<HeatmapCell | null>(null);
    const [sensitivity, setSensitivity] = useState<number>(3);
    const [sizeMode, setSizeMode] = useState<'weight' | 'equal'>('weight');
    const [sectorFilter, setSectorFilter] = useState<string>('All');

    // All sector names (for the filter dropdown).
    const sectorNames = useMemo(() => {
        const set = new Set(cells.map((c) => c.sector));
        return Array.from(set).sort();
    }, [cells]);

    // Apply the sector filter before layout.
    const visibleCells = useMemo(
        () => (sectorFilter === 'All' ? cells : cells.filter((c) => c.sector === sectorFilter)),
        [cells, sectorFilter],
    );

    const layout = useMemo(() => {
        if (visibleCells.length === 0) return [];
        const sizeOf = (c: HeatmapCell) => (sizeMode === 'equal' ? 1 : Math.max(c.weight, 0.01));
        // 1. Group by sector and lay sectors out across the whole box.
        const sectors = new Map<string, HeatmapCell[]>();
        for (const c of visibleCells) {
            const list = sectors.get(c.sector) ?? [];
            list.push(c);
            sectors.set(c.sector, list);
        }
        const sectorItems = Array.from(sectors.entries()).map(([name, list]) => ({
            name,
            list,
            value: list.reduce((s, c) => s + sizeOf(c), 0),
        }));
        const sectorTiles = squarify(sectorItems, 0, 0, 100, 100);

        // 2. Lay each sector's stocks within its tile.
        const all: {
            cell: HeatmapCell;
            x: number;
            y: number;
            w: number;
            h: number;
        }[] = [];
        const labels: {
            name: string;
            x: number;
            y: number;
            w: number;
            h: number;
            avg: number;
            count: number;
        }[] = [];
        for (const st of sectorTiles) {
            const list = st.item.list;
            const avg =
                list.reduce((s, c) => s + c.changePercent, 0) / Math.max(list.length, 1);
            labels.push({
                name: st.item.name,
                x: st.x,
                y: st.y,
                w: st.w,
                h: st.h,
                avg,
                count: list.length,
            });
            const inner = squarify(
                st.item.list.map((c) => ({ ...c, value: sizeOf(c) })),
                st.x,
                st.y,
                st.x + st.w,
                st.y + st.h,
            );
            for (const t of inner) {
                all.push({ cell: t.item, x: t.x, y: t.y, w: t.w, h: t.h });
            }
        }
        return [{ labels, all }] as const;
    }, [visibleCells, sizeMode]);

    const data = layout[0];
    const legend = [-sensitivity, -sensitivity / 2, 0, sensitivity / 2, sensitivity];

    const controlBtn = (active: boolean) =>
        `rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
            active
                ? 'bg-teal-500/20 text-teal-300'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
        }`;

    return (
        <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-semibold text-gray-100">{title}</h2>
                <span className="rounded bg-teal-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-teal-300">
                    Native · Nifty 50
                </span>
            </div>

            {/* Controls */}
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-400">
                <div className="flex items-center gap-1.5">
                    <span className="text-gray-500">Sensitivity</span>
                    {SENSITIVITIES.map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setSensitivity(s)}
                            className={controlBtn(sensitivity === s)}
                        >
                            ±{s}%
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-1.5">
                    <span className="text-gray-500">Size</span>
                    <button
                        type="button"
                        onClick={() => setSizeMode('weight')}
                        className={controlBtn(sizeMode === 'weight')}
                    >
                        Weight
                    </button>
                    <button
                        type="button"
                        onClick={() => setSizeMode('equal')}
                        className={controlBtn(sizeMode === 'equal')}
                    >
                        Equal
                    </button>
                </div>

                <div className="flex items-center gap-1.5">
                    <span className="text-gray-500">Sector</span>
                    <select
                        value={sectorFilter}
                        onChange={(e) => setSectorFilter(e.target.value)}
                        className="rounded border border-gray-700 bg-gray-800 px-2 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    >
                        <option value="All">All sectors</option>
                        {sectorNames.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {!data || visibleCells.length === 0 ? (
                <div
                    className="flex items-center justify-center rounded-lg border border-gray-700/60 text-sm text-gray-500"
                    style={{ height }}
                >
                    Heatmap data unavailable.
                </div>
            ) : (
                <>
                    {/* Breadcrumb / zoom state */}
                    <div className="mb-2 flex items-center gap-1 text-xs text-gray-400">
                        <button
                            type="button"
                            onClick={() => setSectorFilter('All')}
                            className={`rounded px-1.5 py-0.5 ${
                                sectorFilter === 'All'
                                    ? 'text-gray-200'
                                    : 'text-teal-400 hover:bg-gray-800'
                            }`}
                        >
                            All sectors
                        </button>
                        {sectorFilter !== 'All' && (
                            <>
                                <span className="text-gray-600">/</span>
                                <span className="font-medium text-gray-200">{sectorFilter}</span>
                                <span className="ml-1 text-gray-500">
                                    ({visibleCells.length} stocks · click a header to zoom out)
                                </span>
                            </>
                        )}
                    </div>

                    <div
                        className="relative w-full overflow-hidden rounded-lg border border-gray-700/60 bg-gray-900"
                        style={{ height }}
                        onMouseLeave={() => setHover(null)}
                    >
                        {/* Sector headers (clickable → drill in / out, TradingView-style) */}
                        {data.labels.map((l) => {
                            const drilled = sectorFilter !== 'All';
                            return (
                                <button
                                    key={`label-${l.name}`}
                                    type="button"
                                    onClick={() =>
                                        setSectorFilter(drilled ? 'All' : l.name)
                                    }
                                    className="group absolute z-20 m-0.5 flex items-center gap-1 rounded bg-black/50 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-200 hover:bg-black/80 hover:text-white"
                                    style={{
                                        left: `${l.x}%`,
                                        top: `${l.y}%`,
                                        maxWidth: `${l.w}%`,
                                    }}
                                    title={
                                        drilled
                                            ? 'Back to all sectors'
                                            : `Zoom into ${l.name} (${l.count} stocks)`
                                    }
                                >
                                    {drilled && <span aria-hidden>←</span>}
                                    <span className="truncate">{l.name}</span>
                                    <span
                                        className={
                                            l.avg >= 0 ? 'text-green-400' : 'text-red-400'
                                        }
                                    >
                                        {l.avg >= 0 ? '+' : ''}
                                        {l.avg.toFixed(1)}%
                                    </span>
                                    {!drilled && <span aria-hidden>›</span>}
                                </button>
                            );
                        })}

                        {/* Stock cells */}
                        {data.all.map(({ cell, x, y, w, h }) => {
                            const big = w > 7 && h > 6;
                            return (
                                <Link
                                    key={cell.symbol}
                                    href={`/stocks/${encodeURIComponent(cell.symbol)}`}
                                    className="absolute flex cursor-pointer flex-col items-center justify-center overflow-hidden border border-gray-900/70 text-center transition-[filter] hover:z-10 hover:brightness-125 hover:ring-1 hover:ring-white/40"
                                    style={{
                                        left: `${x}%`,
                                        top: `${y}%`,
                                        width: `${w}%`,
                                        height: `${h}%`,
                                        backgroundColor: cellColor(cell.changePercent, sensitivity),
                                    }}
                                    onMouseEnter={() => setHover(cell)}
                                    title={`${cell.symbol}  ₹${cell.price.toLocaleString('en-IN')}  ${
                                        cell.changePercent >= 0 ? '+' : ''
                                    }${cell.changePercent}%`}
                                >
                                    {big && (
                                        <>
                                            <span className="px-0.5 text-[11px] font-bold leading-tight text-white drop-shadow">
                                                {cell.symbol}
                                            </span>
                                            <span className="text-[10px] font-medium text-white/90">
                                                {cell.changePercent >= 0 ? '+' : ''}
                                                {cell.changePercent}%
                                            </span>
                                        </>
                                    )}
                                </Link>
                            );
                        })}

                        {/* Hover detail chip */}
                        {hover && (
                            <div className="pointer-events-none absolute bottom-2 left-2 rounded-md border border-gray-700 bg-gray-800/95 px-3 py-1.5 text-xs shadow-lg">
                                <span className="font-semibold text-gray-100">{hover.symbol}</span>
                                <span className="ml-2 text-gray-400">
                                    ₹{hover.price.toLocaleString('en-IN')}
                                </span>
                                <span
                                    className={`ml-2 font-medium ${
                                        hover.changePercent >= 0 ? 'text-green-400' : 'text-red-400'
                                    }`}
                                >
                                    {hover.changePercent >= 0 ? '+' : ''}
                                    {hover.changePercent}%
                                </span>
                                <span className="ml-2 text-gray-500">{hover.sector}</span>
                                <span className="ml-2 text-teal-400">Open →</span>
                            </div>
                        )}
                    </div>

                    {/* Legend */}
                    <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-gray-500">
                        {legend.map((v) => (
                            <span key={v} className="flex items-center gap-1">
                                <span
                                    className="inline-block h-3 w-6 rounded-sm"
                                    style={{ backgroundColor: cellColor(v, sensitivity) }}
                                />
                                {v > 0 ? `+${v}` : v}%
                            </span>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
