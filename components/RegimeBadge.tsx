"use client";

/**
 * Shared regime badge — a consistent visual label for a market/stock regime,
 * used across the dashboard, stock pages and the screener.
 */

import { TrendingUp, TrendingDown, MoveHorizontal, Zap, HelpCircle } from "lucide-react";

type RegimeMeta = { cls: string; Icon: typeof TrendingUp };

const REGIME_META: Record<string, RegimeMeta> = {
    "Trending Up": { cls: "bg-green-500/15 text-green-400 border-green-500/30", Icon: TrendingUp },
    "Trending Down": { cls: "bg-red-500/15 text-red-400 border-red-500/30", Icon: TrendingDown },
    Ranging: { cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: MoveHorizontal },
    "High Volatility": { cls: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30", Icon: Zap },
    Unknown: { cls: "bg-gray-600/20 text-gray-400 border-gray-600/40", Icon: HelpCircle },
};

export default function RegimeBadge({
    regime,
    size = "sm",
    showIcon = true,
    title,
}: {
    regime: string;
    size?: "xs" | "sm" | "md";
    showIcon?: boolean;
    title?: string;
}) {
    const meta = REGIME_META[regime] ?? REGIME_META.Unknown;
    const Icon = meta.Icon;
    const sizing =
        size === "md"
            ? "px-2.5 py-1 text-sm gap-1.5"
            : size === "xs"
            ? "px-1.5 py-0.5 text-[10px] gap-1"
            : "px-2 py-0.5 text-xs gap-1";
    const iconSize = size === "md" ? "h-4 w-4" : size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";

    return (
        <span title={title ?? regime} className={`inline-flex w-fit items-center rounded-full border font-medium ${meta.cls} ${sizing}`}>
            {showIcon && <Icon className={iconSize} />}
            {regime}
        </span>
    );
}
