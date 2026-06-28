import EconomicMapWidget from "@/components/EconomicMapWidget";
import IndicesTicker from "@/components/market/IndicesTicker";
import MoversTable from "@/components/market/MoversTable";
import NewsFeed from "@/components/market/NewsFeed";
import MarketOverviewNative from "@/components/market/MarketOverviewNative";
import MarketHeatmap from "@/components/market/MarketHeatmap";
import EconomicCalendar from "@/components/market/EconomicCalendar";
import { getMovers, getHeatmap } from "@/lib/actions/market.actions";

const Home = async () => {
    const [movers, heatmap] = await Promise.all([getMovers(), getHeatmap()]);

    return (
        <div className="min-h-screen home-wrapper">
            {/* Indices ticker strip */}
            <IndicesTicker />

            {/* Three-column layout: Market Overview (left) · movers + heatmap (center) · Latest News (right) */}
            <div className="mt-6 grid w-full gap-6 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_340px]">
                {/* Left sidebar: Market Overview (native) */}
                <aside className="order-2 flex flex-col gap-6 lg:order-1">
                    <MarketOverviewNative />

                    {/* Economic calendar (native) */}
                    <EconomicCalendar title="Economic Calendar" height={520} />
                </aside>

                {/* Center column: movers tables + heatmap */}
                <main className="order-1 flex flex-col gap-8 lg:order-2">
                    {/* Top gainers / losers / most active */}
                    <section className="grid w-full gap-6 md:grid-cols-2 xl:grid-cols-3">
                        <MoversTable title="Top Gainers" rows={movers.gainers} />
                        <MoversTable title="Top Losers" rows={movers.losers} />
                        <MoversTable title="Most Active" rows={movers.mostActive} />
                    </section>

                    {/* Stock heatmap */}
                    <section className="w-full">
                        <MarketHeatmap cells={heatmap} height={600} />
                    </section>

                    {/* Global economic map (TradingView) */}
                    <section className="w-full">
                        <EconomicMapWidget title="Economic Map" height={520} />
                    </section>
                </main>

                {/* Right sidebar: Latest News */}
                <aside className="order-3 lg:col-span-2 xl:col-span-1">
                    <NewsFeed />
                </aside>
            </div>
        </div>
    )
}

export default Home;