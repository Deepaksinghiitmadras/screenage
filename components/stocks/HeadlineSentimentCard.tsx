import { getHeadlineSentiment } from '@/lib/actions/sentiment.actions';
import { Newspaper, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';

const LABEL_STYLE: Record<string, { text: string; bg: string; ring: string }> = {
    Bullish: { text: 'text-green-400', bg: 'bg-green-500/10', ring: 'ring-green-500/20' },
    Bearish: { text: 'text-red-400', bg: 'bg-red-500/10', ring: 'ring-red-500/20' },
    Neutral: { text: 'text-amber-300', bg: 'bg-amber-400/10', ring: 'ring-amber-400/20' },
};

function ToneIcon({ tone }: { tone: 'bullish' | 'bearish' | 'neutral' }) {
    if (tone === 'bullish') return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
    if (tone === 'bearish') return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
    return <Minus className="h-3.5 w-3.5 text-gray-500" />;
}

export default async function HeadlineSentimentCard({ symbol }: { symbol: string }) {
    const data = await getHeadlineSentiment(symbol);
    if (!data) return null;

    const style = LABEL_STYLE[data.label] ?? LABEL_STYLE.Neutral;
    const bullPct = data.total ? Math.round((data.bullish / data.total) * 100) : 0;
    const bearPct = data.total ? Math.round((data.bearish / data.total) * 100) : 0;
    const neutPct = Math.max(0, 100 - bullPct - bearPct);

    return (
        <section className="rounded-2xl border border-gray-700 bg-gray-800 p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-400/10 text-teal-400 ring-1 ring-teal-400/20">
                        <Newspaper className="h-4 w-4" />
                    </span>
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Headline Sentiment</p>
                        <h3 className="text-sm font-semibold text-gray-100">{data.total} recent headlines</h3>
                    </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${style.text} ${style.bg} ${style.ring}`}>
                    {data.label} · {data.netScore}/100
                </span>
            </div>

            {/* Distribution bar */}
            <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-gray-700">
                {bullPct > 0 && <div className="bg-green-500" style={{ width: `${bullPct}%` }} title={`Bullish ${bullPct}%`} />}
                {neutPct > 0 && <div className="bg-gray-500" style={{ width: `${neutPct}%` }} title={`Neutral ${neutPct}%`} />}
                {bearPct > 0 && <div className="bg-red-500" style={{ width: `${bearPct}%` }} title={`Bearish ${bearPct}%`} />}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-gray-500">
                <span className="text-green-400">{data.bullish} bullish</span>
                <span>{data.neutral} neutral</span>
                <span className="text-red-400">{data.bearish} bearish</span>
            </div>

            {/* LLM why summary */}
            {data.why && (
                <div className="mt-4 rounded-xl border border-gray-700 bg-gray-900/40 p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-teal-400">
                        <Sparkles className="h-3.5 w-3.5" /> Why this read
                    </p>
                    <p className="text-sm leading-relaxed text-gray-300">{data.why}</p>
                </div>
            )}

            {/* Headline list */}
            <ul className="mt-4 space-y-2">
                {data.headlines.slice(0, 6).map((h, i) => (
                    <li key={`${h.url}-${i}`}>
                        <a
                            href={h.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-teal-400/5"
                        >
                            <span className="mt-0.5"><ToneIcon tone={h.tone} /></span>
                            <span className="flex-1 text-xs leading-snug text-gray-300 line-clamp-2">{h.headline}</span>
                        </a>
                    </li>
                ))}
            </ul>

            <p className="mt-3 text-[10px] text-gray-600">
                Sentiment is keyword-derived from recent headlines and an AI summary — for research/education only, not investment advice.
            </p>
        </section>
    );
}
