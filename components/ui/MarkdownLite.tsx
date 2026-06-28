"use client";

import React from "react";

/**
 * A tiny, dependency-free Markdown renderer for assistant replies.
 * Supports: ## / ### headings, - and * bullet lists, 1. numbered lists,
 * **bold**, *italic*, `inline code`, and paragraphs. Intentionally minimal.
 */

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
    // Tokenise on **bold**, *italic*, `code`
    const tokenRe = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
    const parts = text.split(tokenRe).filter((p) => p !== "");
    return parts.map((part, i) => {
        const key = `${keyPrefix}-${i}`;
        if (part.startsWith("**") && part.endsWith("**")) {
            return (
                <strong key={key} className="font-semibold text-gray-100">
                    {part.slice(2, -2)}
                </strong>
            );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
            return (
                <code key={key} className="rounded bg-gray-800 px-1 py-0.5 font-mono text-[0.85em] text-teal-300">
                    {part.slice(1, -1)}
                </code>
            );
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
            return (
                <em key={key} className="italic text-gray-300">
                    {part.slice(1, -1)}
                </em>
            );
        }
        return <React.Fragment key={key}>{part}</React.Fragment>;
    });
}

export default function MarkdownLite({ content }: { content: string }) {
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    const blocks: React.ReactNode[] = [];
    let list: { ordered: boolean; items: string[] } | null = null;
    let key = 0;

    const flushList = () => {
        if (!list) return;
        const items = list.items.map((it, i) => (
            <li key={i} className="ml-1">
                {renderInline(it, `li-${key}-${i}`)}
            </li>
        ));
        blocks.push(
            list.ordered ? (
                <ol key={`ol-${key++}`} className="my-1.5 list-decimal space-y-1 pl-5">
                    {items}
                </ol>
            ) : (
                <ul key={`ul-${key++}`} className="my-1.5 list-disc space-y-1 pl-5">
                    {items}
                </ul>
            ),
        );
        list = null;
    };

    for (const raw of lines) {
        const line = raw.trimEnd();
        if (!line.trim()) {
            flushList();
            continue;
        }

        const h3 = /^###\s+(.*)/.exec(line);
        const h2 = /^##\s+(.*)/.exec(line);
        const bullet = /^[-*]\s+(.*)/.exec(line);
        const ordered = /^\d+\.\s+(.*)/.exec(line);

        if (h3) {
            flushList();
            blocks.push(
                <h4 key={`h-${key++}`} className="mt-2 mb-1 text-sm font-semibold text-gray-100">
                    {renderInline(h3[1], `h-${key}`)}
                </h4>,
            );
        } else if (h2) {
            flushList();
            blocks.push(
                <h3 key={`h-${key++}`} className="mt-2 mb-1 text-base font-semibold text-gray-100">
                    {renderInline(h2[1], `h-${key}`)}
                </h3>,
            );
        } else if (bullet) {
            if (!list || list.ordered) {
                flushList();
                list = { ordered: false, items: [] };
            }
            list.items.push(bullet[1]);
        } else if (ordered) {
            if (!list || !list.ordered) {
                flushList();
                list = { ordered: true, items: [] };
            }
            list.items.push(ordered[1]);
        } else {
            flushList();
            blocks.push(
                <p key={`p-${key++}`} className="my-1 leading-relaxed">
                    {renderInline(line, `p-${key}`)}
                </p>,
            );
        }
    }
    flushList();

    return <div className="text-sm">{blocks}</div>;
}
