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