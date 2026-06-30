# Terminal 1 — data service
cd market-service
source .venv/bin/activate
uvicorn main:app --port 8000

# Terminal 2 — the app (as before)
npm run dev

or 

# terminal 1: Python service
source market-service/.venv/bin/activate && uvicorn --app-dir market-service main:app --port 8000
# terminal 2: Next app
npm run dev


When happy: git add -A && git commit -m "..." && git push



The 30-day forecast is a statistical Geometric Brownian Motion projection (drift from mean log-returns, dampened ×0.5 and capped ±25%, with an 80% volatility band) computed in TypeScript. The technical score is a rules-based composite (SMA/RSI/MACD/range/volume).

Accurate labels: "statistical price projection (GBM)", "probabilistic forecast", or "quantitative projection". I'd avoid "statistical trading" since it implies a tradeable signal.







#1 — What the Technical Scanner does & how it's calculated

It's a rules-based composite score (0–100), not ML. For each stock it pulls 1y of daily candles and computes:

Trend: price vs SMA20 / SMA50 / SMA200 (±points each)
Momentum: RSI(14) — penalizes overbought >70, rewards oversold <30 / mild trend zones
Range position: where price sits in its 20-day high–low band
Volume confirmation: today's volume vs 20-day average, signed by direction
Score starts at 50 and adds/subtracts. Bias = Bullish ≥60 / Bearish ≤40 / Neutral. Regime comes from annualized volatility (>45% → "High Volatility") and 30-day slope (Trending Up/Down vs Ranging). In your screenshot: PAGEIND 92 Bullish/Trending Up, JUBLFOOD 24 Bearish/Trending Down. Logic lives in technical.actions.ts (per-stock) and the batch Python version in main.py





Updated todo list

Let me check exactly how big the "universe" is and where it's defined, to answer #1 accurately:      

Searched for regex `SCREENER_UNIVERSE|export const SECTOR_GROUPS`, 6 results

Read [](file:///Users/deepaksingh/Documents/vscode/stock_market/OpenStock/lib/sector-peers.ts#12-12), lines 12 to 49

The "universe" is a **curated list of ~115 large/mid-cap NSE stocks** across 17 sectors, defined in sector-peers.ts — not all of NSE. Let me research feature ideas for #2, then answer both:   



Fetched 2 resources

## 1 — Yes, the screener only covers ~115 curated stocks

The "universe" is a **hand-picked list of ~115 large/mid-cap NSE stocks** across 17 sectors in sector-peers.ts — **not** the full ~2,000 NSE listings. It only limits the **screener, technical scan, and heatmap** (the features that batch-process many stocks). **Individual stock pages still work for *any* symbol** via search — you can open a stock that isn't in the universe.

To widen discovery you'd expand `SECTOR_GROUPS` (e.g., to NIFTY 500). Trade-off: more stocks = more `get_info()` calls = more yfinance throttling on Render. So expansion pairs naturally with the data-source upgrade.

## 2 — Ideas to attract users (researched: Tickertape, Screener.in, Groww)

I grouped these by **effort vs. impact**, prioritizing things that **reuse the engine we already built** (forecast, scorecard, technical, regime, alerts, AI, email).

### Tier A — high impact, mostly reuses what we have
1. **Portfolio tracker** (Tickertape's #1 hook) — let users add holdings → live P&L, **XIRR**, allocation/**diversification score**, and an AI **"red flags"** panel. We can score each holding with the existing **scorecard** and roll it into a portfolio health grade. This is the single biggest retention driver.
2. **Market Mood / Fear-&-Greed gauge** (Tickertape's MMI) — a 0–100 dial from **VIX + breadth + momentum**, which we *already compute* in `/market-regime`. Cheap to add, very shareable/sticky.
3. **Stock comparison** — overlay 2–4 stocks' **scorecard radars** + key metrics side-by-side. Reuses the radar we built; great for decision-making.
4. **Smarter alerts + daily AI digest** — you already have an alerts model + `AlertsPanel` + Inngest + Nodemailer. Extend alerts to **technical/regime/price triggers**, and send a **personalized "good-morning" email**: watchlist moves, market regime, relevant news, AI summary.

### Tier B — medium effort, broadens appeal
5. **Expand universe to NIFTY 500** (answers #1) so screening/scan/heatmap cover far more stocks.
6. **Themed collections** — curated, shareable baskets ("Debt-free compounders", "High-dividend PSUs") built from your screener presets.
7. **Earnings & dividend calendar** for the user's watchlist (corporate-actions feed).
8. **PWA / installable app** + light-mode polish — feels like a real product, boosts repeat visits.

### Tier C — bigger bets (more infra/cost)
9. **Mutual funds / ETFs** coverage (Groww/Tickertape parity) — large surface.
10. **Telegram/WhatsApp alerts** (OpenAlgo does this) — meet users where they are.
11. **Reliable data source** — a fundamentals/quotes provider that allows cloud IPs, which also fixes the screener/heatmap throttling. This unblocks everything else at scale.

### My recommendation
Start with **#2 (Fear-Greed gauge)** — tiny effort, instantly engaging, data already there — then **#1 (Portfolio tracker)** and **#3 (Comparison)** as the flagship retention features, and **#4 (digest emails)** to bring users back daily. Those four turn Screenage from a "research tool you visit" into a "habit you return to."

Want me to build the **Fear-&-Greed gauge** first (quick win), or start the **Portfolio tracker**?

Created 2 todos