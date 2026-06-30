import Link from "next/link";
import { Megaphone, ArrowRight } from "lucide-react";
import { getCorporateActions } from "@/lib/actions/market.actions";
import InfoTooltip from "@/components/InfoTooltip";

// A curated large-cap basket for the dashboard earnings peek.
const BASKET = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "BHARTIARTL", "SBIN", "LT",
    "ITC", "HINDUNILVR", "BAJFINANCE", "KOTAKBANK", "AXISBANK", "MARUTI", "SUNPHARMA",
    "TITAN", "ULTRACEMCO", "NTPC", "TATAMOTORS", "M&M",
];

const fmtDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default async function UpcomingEarnings() {
    const { events } = await getCorporateActions(BASKET);
    const earnings = events.filter((e) => e.type === "earnings").slice(0, 6);

    return (
        <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-200">
                    <Megaphone className="h-4 w-4 text-teal-400" /> Upcoming Earnings
                    <InfoTooltip term="earnings" />
                </h3>
                <Link href="/events" className="flex items-center gap-0.5 text-[11px] text-gray-400 hover:text-teal-300">
                    All <ArrowRight className="h-3 w-3" />
                </Link>
            </div>
            {earnings.length === 0 ? (
                <p className="text-xs text-gray-500">No large-cap earnings in the next few months (or data is loading).</p>
            ) : (
                <ul className="divide-y divide-gray-700/60">
                    {earnings.map((e, i) => (
                        <li key={`${e.symbol}-${i}`}>
                            <Link href={`/stocks/${e.symbol}`} className="flex items-center justify-between py-2 text-xs hover:text-teal-300">
                                <span className="font-semibold text-gray-200">{e.symbol}</span>
                                <span className="text-gray-500">{fmtDate(e.date)}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            <Link href="/events" className="mt-2 block text-[11px] text-gray-500 hover:text-teal-300">See your watchlist &amp; sector calendar →</Link>
        </div>
    );
}
