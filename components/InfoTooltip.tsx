"use client";

/**
 * InfoTooltip — a small "i" icon that reveals a plain-English description on
 * hover/focus/tap. Pass `term` to pull a definition from the glossary, or `text`
 * for a custom one. Reusable on any metric label across the app.
 */

import { useState } from "react";
import { Info } from "lucide-react";
import { getTermDescription } from "@/lib/glossary";

type Align = "center" | "left" | "right";

export default function InfoTooltip({
    term,
    text,
    align = "center",
    size = 12,
}: {
    term?: string;
    text?: string;
    align?: Align;
    size?: number;
}) {
    const [open, setOpen] = useState(false);
    const body = text ?? (term ? getTermDescription(term) : null);
    if (!body) return null;

    const pos =
        align === "left"
            ? "left-0"
            : align === "right"
            ? "right-0"
            : "left-1/2 -translate-x-1/2";

    return (
        <span className="relative inline-flex align-middle">
            <span
                role="button"
                tabIndex={0}
                aria-label="More info"
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
                className="inline-flex cursor-help text-gray-500 transition-colors hover:text-teal-300"
            >
                <Info style={{ width: size, height: size }} />
            </span>
            {open && (
                <span
                    role="tooltip"
                    className={`absolute bottom-full z-50 mb-1.5 w-60 rounded-md border border-gray-700 bg-gray-900 px-2.5 py-1.5 text-[11px] font-normal leading-snug text-gray-300 shadow-xl ${pos}`}
                >
                    {body}
                </span>
            )}
        </span>
    );
}
