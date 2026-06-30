import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { getUserWatchlist } from "@/lib/actions/watchlist.actions";
import CorporateCalendar from "@/components/market/CorporateCalendar";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    let watchlistSymbols: string[] = [];
    if (session?.user) {
        const items = await getUserWatchlist(session.user.id);
        watchlistSymbols = (items || []).map((i: { symbol: string }) => i.symbol);
    }
    return <CorporateCalendar watchlistSymbols={watchlistSymbols} />;
}
