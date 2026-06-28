'use client';

import React, { useState, useMemo } from 'react';
import WatchlistTable from './WatchlistTable';
import { Button } from '@/components/ui/button';
import { ArrowDownAZ, ArrowUpZA, ArrowUpDown } from 'lucide-react';
import { WatchlistItem } from '@/database/models/watchlist.model';

interface WatchlistManagerProps {
    initialItems: WatchlistItem[]; // Using the DB model type directly or a simplified version
    userId: string;
}

export default function WatchlistManager({ initialItems, userId }: WatchlistManagerProps) {
    // Sort state: 'asc' (A-Z), 'desc' (Z-A), or null (added order/default)
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);

    const toggleSort = () => {
        if (sortOrder === null) setSortOrder('asc');
        else if (sortOrder === 'asc') setSortOrder('desc');
        else setSortOrder(null);
    };

    const sortedItems = useMemo(() => {
        if (!sortOrder) return initialItems;

        return [...initialItems].sort((a, b) => {
            if (sortOrder === 'asc') {
                return a.symbol.localeCompare(b.symbol);
            } else {
                return b.symbol.localeCompare(a.symbol);
            }
        });
    }, [initialItems, sortOrder]);

    const watchlistSymbols = sortedItems.map((item) => item.symbol);
    const tableItems = useMemo(
        () => sortedItems.map((item) => ({ symbol: item.symbol, company: item.company })),
        [sortedItems],
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                    <span className="mr-2">My Watchlist</span>
                    <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-500">
                        {watchlistSymbols.length}
                    </span>
                </h3>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSort}
                    className="h-8 px-2 text-gray-400 hover:bg-white/10 hover:text-gray-100"
                    title={
                        sortOrder === 'asc'
                            ? 'Sorted A-Z'
                            : sortOrder === 'desc'
                                ? 'Sorted Z-A'
                                : 'Default Order'
                    }
                >
                    {sortOrder === 'asc' && <ArrowDownAZ className="mr-2 h-4 w-4" />}
                    {sortOrder === 'desc' && <ArrowUpZA className="mr-2 h-4 w-4" />}
                    {sortOrder === null && <ArrowUpDown className="mr-2 h-4 w-4" />}
                    <span className="text-xs">
                        {sortOrder === 'asc' ? 'A-Z' : sortOrder === 'desc' ? 'Z-A' : 'Sort'}
                    </span>
                </Button>
            </div>

            <WatchlistTable items={tableItems} userId={userId} />
        </div>
    );
}
