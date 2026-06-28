"use client";

import React from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink } from "lucide-react";

interface NewsGridProps {
    news: any[];
    compact?: boolean;
}

export default function NewsGrid({ news, compact = false }: NewsGridProps) {
    if (!news || news.length === 0) return null;

    return (
        <div className="mt-2">
            <div className="mb-4 flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-teal-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">Market News</h2>
            </div>
            <div
                className={
                    compact
                        ? "grid grid-cols-1 gap-4"
                        : "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
                }
            >
                {news.map((item, idx) => (
                    <a
                        key={idx}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block overflow-hidden rounded-xl border border-gray-700 bg-gray-800 transition-colors hover:border-teal-400/40"
                    >
                        <div className="flex h-full flex-col p-4">
                            <div className="mb-2 flex items-start justify-between">
                                <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${item.related ? "bg-blue-500/15 text-blue-400" : "bg-gray-700 text-gray-400"
                                    }`}>
                                    {item.related || "MARKET"}
                                </span>
                                <ExternalLink className="h-3 w-3 text-gray-600 group-hover:text-teal-400" />
                            </div>
                            <h3 className="mb-2 line-clamp-2 text-sm font-semibold text-gray-100 transition-colors group-hover:text-teal-400">
                                {item.headline}
                            </h3>
                            <p className="mb-4 line-clamp-3 flex-1 text-xs text-gray-500">
                                {item.summary}
                            </p>
                            <div className="mt-auto flex items-center justify-between text-[10px] text-gray-600">
                                <span>{item.source}</span>
                                <span>
                                    {item.datetime ? formatDistanceToNow(item.datetime * 1000, { addSuffix: true }) : ''}
                                </span>
                            </div>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}
