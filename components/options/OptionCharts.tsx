"use client";

/**
 * Lightweight SVG charts for the options suite — no extra chart dependency.
 * OIDistributionChart: grouped Call vs Put open-interest bars per strike.
 * IVSmileChart: implied-volatility curve (Call & Put) across strikes.
 */

const CE_COLOR = "#f87171"; // calls (resistance)
const PE_COLOR = "#34d399"; // puts (support)

function niceMax(v: number): number {
    if (v <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    return Math.ceil(v / mag) * mag;
}

export function OIDistributionChart({ strikes, atmStrike }: { strikes: OptionStrike[]; atmStrike: number | null }) {
    if (strikes.length === 0) return null;

    const H = 240;
    const padTop = 12;
    const padBottom = 36;
    const plotH = H - padTop - padBottom;
    const group = 30; // px per strike group
    const W = Math.max(640, strikes.length * group);
    const barW = group * 0.36;
    const maxOi = niceMax(Math.max(...strikes.flatMap((s) => [s.ce.oi, s.pe.oi]), 1));

    const y = (oi: number) => padTop + plotH - (oi / maxOi) * plotH;

    return (
        <div className="overflow-x-auto">
            <svg width={W} height={H} className="block">
                {/* gridlines */}
                {[0.25, 0.5, 0.75, 1].map((g) => (
                    <line key={g} x1={0} x2={W} y1={padTop + plotH - g * plotH} y2={padTop + plotH - g * plotH} stroke="#374151" strokeWidth={0.5} />
                ))}
                {strikes.map((s, i) => {
                    const cx = i * group + group / 2;
                    const isAtm = s.strike === atmStrike;
                    return (
                        <g key={s.strike}>
                            {isAtm && <rect x={cx - group / 2} y={padTop} width={group} height={plotH} fill="#14b8a6" opacity={0.08} />}
                            <rect x={cx - barW - 1} y={y(s.ce.oi)} width={barW} height={padTop + plotH - y(s.ce.oi)} fill={CE_COLOR} opacity={0.85} />
                            <rect x={cx + 1} y={y(s.pe.oi)} width={barW} height={padTop + plotH - y(s.pe.oi)} fill={PE_COLOR} opacity={0.85} />
                            {i % 2 === 0 && (
                                <text x={cx} y={H - 20} fill={isAtm ? "#5eead4" : "#9ca3af"} fontSize={9} textAnchor="middle">
                                    {s.strike}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
            <div className="mt-1 flex items-center gap-4 px-1 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm" style={{ background: CE_COLOR }} /> Call OI (resistance)</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm" style={{ background: PE_COLOR }} /> Put OI (support)</span>
            </div>
        </div>
    );
}

export function IVSmileChart({ strikes, atmStrike }: { strikes: OptionStrike[]; atmStrike: number | null }) {
    const pts = strikes.filter((s) => (s.ce.iv ?? 0) > 0 || (s.pe.iv ?? 0) > 0);
    if (pts.length < 2) {
        return <p className="py-6 text-sm text-gray-500">IV data not available for this expiry.</p>;
    }

    const H = 220;
    const padTop = 12;
    const padBottom = 36;
    const padLeft = 32;
    const plotH = H - padTop - padBottom;
    const step = 36;
    const W = Math.max(640, pts.length * step);
    const plotW = W - padLeft;

    const ivs = pts.flatMap((s) => [s.ce.iv ?? 0, s.pe.iv ?? 0]).filter((v) => v > 0);
    const maxIv = niceMax(Math.max(...ivs, 1));
    const minIv = Math.max(0, Math.floor(Math.min(...ivs) / 5) * 5);

    const x = (i: number) => padLeft + (i / (pts.length - 1)) * plotW;
    const y = (iv: number) => padTop + plotH - ((iv - minIv) / (maxIv - minIv || 1)) * plotH;

    const line = (key: "ce" | "pe") =>
        pts
            .map((s, i) => {
                const iv = s[key].iv ?? 0;
                return iv > 0 ? `${x(i)},${y(iv)}` : null;
            })
            .filter(Boolean)
            .join(" ");

    return (
        <div className="overflow-x-auto">
            <svg width={W} height={H} className="block">
                {[0, 0.5, 1].map((g) => {
                    const val = minIv + g * (maxIv - minIv);
                    const yy = padTop + plotH - g * plotH;
                    return (
                        <g key={g}>
                            <line x1={padLeft} x2={W} y1={yy} y2={yy} stroke="#374151" strokeWidth={0.5} />
                            <text x={4} y={yy + 3} fill="#6b7280" fontSize={9}>{val.toFixed(0)}</text>
                        </g>
                    );
                })}
                <polyline points={line("ce")} fill="none" stroke={CE_COLOR} strokeWidth={2} />
                <polyline points={line("pe")} fill="none" stroke={PE_COLOR} strokeWidth={2} />
                {pts.map((s, i) =>
                    s.strike === atmStrike ? (
                        <line key="atm" x1={x(i)} x2={x(i)} y1={padTop} y2={padTop + plotH} stroke="#14b8a6" strokeDasharray="3 3" strokeWidth={1} />
                    ) : null,
                )}
                {pts.map((s, i) =>
                    i % 2 === 0 ? (
                        <text key={s.strike} x={x(i)} y={H - 20} fill={s.strike === atmStrike ? "#5eead4" : "#9ca3af"} fontSize={9} textAnchor="middle">
                            {s.strike}
                        </text>
                    ) : null,
                )}
            </svg>
            <div className="mt-1 flex items-center gap-4 px-1 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm" style={{ background: CE_COLOR }} /> Call IV</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm" style={{ background: PE_COLOR }} /> Put IV</span>
            </div>
        </div>
    );
}
