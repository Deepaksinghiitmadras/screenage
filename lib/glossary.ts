/**
 * Plain-English definitions for financial terms shown across the app.
 * Used by <InfoTooltip term="..." /> so users can hover any "i" icon to learn
 * what a metric means. Keep descriptions short, jargon-free and India-relevant.
 */

export const GLOSSARY: Record<string, string> = {
    // --- Fear & Greed components ---
    momentum:
        "Compares NIFTY's level to its 125-day average. Trading above the average = strength (greed); below = weakness (fear).",
    volatility:
        "India VIX is the market's 'fear gauge' — it measures how much swing traders expect. Low VIX = calm (greed); high VIX = anxious (fear).",
    breadth:
        "The share of stocks rising vs falling. When most stocks advance, participation is broad (greed); when few do, it's narrow (fear).",
    strength:
        "Where NIFTY sits in its 52-week (1-year) high-to-low range. Near the high = greed; near the low = fear.",
    putcall:
        "Put/Call Ratio (PCR) compares bearish 'put' options to bullish 'call' options. Low PCR (more calls) = greed; high PCR (more puts) = fear.",

    // --- Market regime ---
    regime:
        "The market's current behaviour: Trending Up/Down (a clear direction), Ranging (sideways), or High Volatility (big, erratic swings).",
    niftyTrend:
        "Whether NIFTY is above or below its moving averages and the direction of its recent slope.",

    // --- Valuation ---
    pe: "Price-to-Earnings: share price ÷ earnings per share. Lower can mean cheaper, but compare within the same sector.",
    pb: "Price-to-Book: share price ÷ book value per share. Below 1 can signal undervaluation (or weak quality).",
    peg: "PEG: the P/E ratio divided by earnings growth. Below 1 suggests growth is cheaply priced.",
    dividendYield: "Annual dividend as a % of the share price — the cash income a share pays you each year.",

    // --- Quality / financials ---
    roe: "Return on Equity: profit generated per ₹ of shareholder money. Higher and steady is better.",
    profitMargin: "Net profit as a % of revenue — how much of each ₹ of sales becomes profit.",
    debtToEquity: "Debt ÷ shareholder equity — how leveraged the company is. Lower is generally safer.",
    currentRatio: "Current assets ÷ current liabilities — ability to cover short-term dues. Above 1 is healthier.",
    revenueGrowth: "Year-on-year change in sales. Positive and rising signals a growing business.",
    earningsGrowth: "Year-on-year change in profit. Negative growth is a caution sign.",
    beta: "How much a stock moves vs the market. Below 1 = steadier than the market; above 1 = more volatile.",

    // --- Technicals ---
    rsi: "Relative Strength Index (0-100): above 70 = overbought (pullback risk), below 30 = oversold (bounce chance).",
    macd: "MACD compares two moving averages of price. Above its signal line = bullish momentum; below = bearish.",
    adx: "Average Directional Index measures trend STRENGTH (not direction). Above 25 = a strong trend.",
    atr: "Average True Range — the typical daily price move in ₹. Higher ATR = more volatile.",
    bollinger: "Bollinger Bands wrap price in a volatility envelope. Touching the upper/lower band = stretched.",
    stochastic: "Stochastic %K (0-100): above 80 = overbought, below 20 = oversold.",
    cci: "Commodity Channel Index: above +100 = strong upside momentum, below -100 = strong downside.",
    williamsR: "Williams %R: -20 and above = overbought, -80 and below = oversold.",

    // --- Options ---
    maxPain: "The strike price where option buyers lose the most — price often gravitates here near expiry.",
    pcr: "Put/Call Ratio by open interest. Above 1 = put-heavy (often cautious); below 1 = call-heavy.",
    iv: "Implied Volatility — the market's expectation of future swings, baked into option prices.",
    delta: "How much an option's price moves for a ₹1 move in the stock (also ~ probability of expiring in-the-money).",
    gamma: "How fast Delta itself changes as the stock moves — highest near the strike.",
    theta: "Daily time-decay — how much value an option loses each day, all else equal.",
    vega: "Sensitivity to volatility — how much an option's price moves per 1% change in IV.",
    oiBuildup: "Reads change in Open Interest vs price: long/short buildup (new positions) or unwinding/covering (closing).",

    // --- Backtest / forecast / portfolio ---
    sharpe: "Sharpe ratio: return earned per unit of risk. Higher is better; above 1 is good.",
    sortino: "Like Sharpe but only penalises downside swings — a fairer risk-adjusted return.",
    calmar: "Annual return ÷ worst drawdown — reward vs the deepest loss endured.",
    maxDrawdown: "The largest peak-to-trough fall — the worst loss you'd have sat through.",
    profitFactor: "Gross profit ÷ gross loss across trades. Above 1 means winners outweigh losers.",
    cagr: "Compound Annual Growth Rate — the smoothed yearly return of an investment.",
    diversification: "How spread-out your money is across stocks and sectors. Higher = less single-stock risk.",
    annualizedReturn: "Your portfolio's return expressed as an equivalent per-year (CAGR) figure.",
    monteCarlo: "Runs thousands of simulated price paths to show a range of likely outcomes, not a single guess.",
    earnings: "The date a company reports its quarterly results. Prices can move sharply around earnings.",
    exDividend: "To receive the next dividend you must own the stock before this 'ex-dividend' date; buy on/after it and you miss that payout.",
};

export function getTermDescription(term: string): string | null {
    return GLOSSARY[term] ?? null;
}
