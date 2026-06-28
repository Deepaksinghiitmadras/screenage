import Link from "next/link";
import { getMarketNews } from "@/lib/actions/market.actions";
import { getNews } from "@/lib/actions/finnhub.actions";

const timeAgo = (epochSeconds: number): string => {
    if (!epochSeconds) return "";
    const diffMs = Date.now() - epochSeconds * 1000;
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
};

// Stable-ish colour per source so the fallback tiles look intentional.
const SOURCE_COLORS = [
    "from-teal-500/30 to-teal-700/30",
    "from-sky-500/30 to-sky-700/30",
    "from-violet-500/30 to-violet-700/30",
    "from-amber-500/30 to-amber-700/30",
    "from-rose-500/30 to-rose-700/30",
    "from-emerald-500/30 to-emerald-700/30",
];
const colorFor = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return SOURCE_COLORS[h % SOURCE_COLORS.length];
};

function Thumb({
    image,
    source,
    size,
}: {
    image: string | null;
    source: string;
    size: "lead" | "row";
}) {
    const cls =
        size === "lead"
            ? "h-48 w-full rounded-lg object-cover"
            : "h-16 w-24 flex-shrink-0 rounded object-cover";
    if (image) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={image} alt={source} className={cls} loading="lazy" />;
    }
    const box =
        size === "lead"
            ? "flex h-48 w-full items-center justify-center rounded-lg px-3 text-center"
            : "flex h-16 w-24 flex-shrink-0 items-center justify-center rounded px-1 text-center";
    return (
        <div className={`${box} bg-gradient-to-br ${colorFor(source)}`}>
            <span
                className={`font-semibold text-gray-100 ${size === "lead" ? "text-lg" : "text-[10px]"}`}
            >
                {source}
            </span>
        </div>
    );
}

export default async function NewsFeed() {
    let articles: MarketNewsItem[] = await getMarketNews(12);

    // Fallback to Finnhub general news if the market service returned nothing.
    if (articles.length === 0) {
        try {
            const finnhub = await getNews();
            articles = (finnhub ?? []).map((a) => ({
                id: String(a.id),
                headline: a.headline,
                summary: a.summary,
                source: a.source,
                url: a.url,
                image: a.image ?? null,
                datetime: a.datetime,
            }));
        } catch {
            articles = [];
        }
    }

    // De-dupe by url/headline.
    const seen = new Set<string>();
    articles = articles.filter((a) => {
        const key = (a.url || a.headline || "").toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    if (articles.length === 0) {
        return (
            <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
                <h2 className="text-lg font-semibold text-gray-100">Latest News</h2>
                <p className="mt-2 text-sm text-gray-400">News is unavailable right now.</p>
            </div>
        );
    }

    const [lead, ...rest] = articles;
    const leadSource = lead.source || "News";

    return (
        <section className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
            <h2 className="mb-3 text-lg font-semibold text-gray-100">Latest News</h2>

            {/* Lead story */}
            <Link
                href={lead.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block overflow-hidden rounded-lg"
            >
                <div className="overflow-hidden rounded-lg">
                    <Thumb image={lead.image} source={leadSource} size="lead" />
                </div>
                <h3 className="mt-3 text-base font-semibold text-gray-100 group-hover:text-teal-400">
                    {lead.headline}
                </h3>
                {lead.summary && (
                    <p className="mt-1 line-clamp-2 text-sm text-gray-400">{lead.summary}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                    <span className="font-medium text-gray-400">{leadSource}</span> ·{" "}
                    {timeAgo(lead.datetime)}
                </p>
            </Link>

            {/* Rest */}
            <ul className="mt-4 divide-y divide-gray-700/60">
                {rest.map((a, i) => {
                    const src = a.source || "News";
                    return (
                        <li key={`${a.id}-${i}`}>
                            <Link
                                href={a.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex gap-3 py-3"
                            >
                                <Thumb image={a.image} source={src} size="row" />
                                <div className="min-w-0">
                                    <h4 className="line-clamp-2 text-sm font-medium text-gray-100 group-hover:text-teal-400">
                                        {a.headline}
                                    </h4>
                                    <p className="mt-1 text-xs text-gray-500">
                                        <span className="font-medium text-gray-400">{src}</span> ·{" "}
                                        {timeAgo(a.datetime)}
                                    </p>
                                </div>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
