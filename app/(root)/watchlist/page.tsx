import React, { Suspense } from 'react';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUserWatchlist } from '@/lib/actions/watchlist.actions';
import { getUserAlerts } from '@/lib/actions/alert.actions';
import { getNews } from '@/lib/actions/finnhub.actions';
import WatchlistManager from '@/components/watchlist/WatchlistManager';
import AlertsPanel from '@/components/watchlist/AlertsPanel';
import NewsGrid from '@/components/watchlist/NewsGrid';
import SearchCommand from '@/components/SearchCommand';
import { Loader2, Eye } from 'lucide-react';

export default async function WatchlistPage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        redirect('/sign-in');
    }

    const userId = session.user.id;

    // Parallel data fetching
    const [watchlistItems, alerts, news] = await Promise.all([
        getUserWatchlist(userId),
        getUserAlerts(userId),
        getNews() // Initial news fetch
    ]);

    const watchlistSymbols = watchlistItems.map((item: any) => item.symbol);

    // Fallback news if watchlist has items
    const relevantNews = watchlistSymbols.length > 0 ? await getNews(watchlistSymbols) : news;

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 p-5 md:p-8">
            {/* Header */}
            <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900 p-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                    <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-400/10 text-teal-400 ring-1 ring-teal-400/20">
                        <Eye className="h-5 w-5" />
                    </span>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-100 md:text-3xl">Watchlist</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Track your stocks, set price alerts and follow the news that moves them.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="hidden rounded-full border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-400 sm:inline-flex">
                        {watchlistSymbols.length} tracked · {alerts.length} alerts
                    </span>
                    <SearchCommand renderAs="button" label="Add Stock" initialStocks={[]} />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 xl:grid-cols-4">
                {/* Main Content - Watchlist Table */}
                <div className="space-y-6 lg:col-span-2 xl:col-span-3">
                    <WatchlistManager initialItems={watchlistItems} userId={userId} />
                </div>

                {/* Sidebar - Alerts + News */}
                <div className="space-y-6 lg:col-span-1">
                    <AlertsPanel alerts={alerts} />

                    {/* News Section */}
                    <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="animate-spin text-gray-500" /></div>}>
                        <NewsGrid news={relevantNews || []} compact />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
