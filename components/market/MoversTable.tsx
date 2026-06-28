import Link from "next/link";

const formatNumber = (n: number) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MoversTable = ({ title, rows }: { title: string; rows: MarketMover[] }) => {
    return (
        <div className="movers-table">
            <h3 className="movers-table-title">{title}</h3>
            {rows.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-500">Data unavailable.</p>
            ) : (
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-800">
                            <th className="px-4 py-2 font-medium">Stock</th>
                            <th className="px-4 py-2 font-medium text-right">Price</th>
                            <th className="px-4 py-2 font-medium text-right">Change</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const up = row.change >= 0;
                            return (
                                <tr key={row.symbol} className="border-b border-gray-800/60 hover:bg-gray-800/40 transition-colors">
                                    <td className="px-4 py-2">
                                        <Link href={`/stocks/${row.symbol}`} className="text-gray-100 hover:text-teal-400 font-medium">
                                            {row.name}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-2 text-right text-gray-300">{formatNumber(row.price)}</td>
                                    <td className={`px-4 py-2 text-right ${up ? "text-green-400" : "text-red-400"}`}>
                                        {up ? "+" : ""}{row.changePercent.toFixed(2)}%
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default MoversTable;
