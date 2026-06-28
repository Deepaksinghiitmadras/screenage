import { getIndices } from "@/lib/actions/market.actions";

const formatNumber = (n: number) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const IndicesTicker = async () => {
    const indices = await getIndices();

    if (!indices.length) return null;

    // Duplicate the list so the marquee loops seamlessly.
    const items = [...indices, ...indices];

    return (
        <div className="indices-ticker">
            <div className="indices-ticker-track">
                {items.map((idx, i) => {
                    const up = idx.change >= 0;
                    return (
                        <div key={`${idx.symbol}-${i}`} className="indices-ticker-item">
                            <span className="font-semibold text-gray-100">{idx.name}</span>
                            <span className="text-gray-300">{formatNumber(idx.price)}</span>
                            <span className={up ? "text-green-400" : "text-red-400"}>
                                {up ? "+" : ""}{formatNumber(idx.change)} ({up ? "+" : ""}
                                {idx.changePercent.toFixed(2)}%)
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default IndicesTicker;
