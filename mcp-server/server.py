"""
Screenage Market MCP Server
===========================
Exposes the Screenage market-data microservice as Model Context Protocol (MCP)
tools so AI assistants (Claude Desktop, Cursor, Windsurf, etc.) can research
Indian (NSE) stocks in natural language.

It is a thin, read-only proxy over the FastAPI `market-service` — it adds no new
data source, just an LLM-friendly tool surface. Research/education only; the data
is delayed and nothing here is investment advice.

Configure the upstream service with the MARKET_SERVICE_URL env var
(defaults to http://127.0.0.1:8000 for local dev; set it to your Render URL).

Run:
    pip install -r requirements.txt
    MARKET_SERVICE_URL=https://your-service.onrender.com python server.py
"""

from __future__ import annotations

import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

MARKET_SERVICE_URL = os.environ.get("MARKET_SERVICE_URL", "http://127.0.0.1:8000").rstrip("/")
HTTP_TIMEOUT = float(os.environ.get("MCP_HTTP_TIMEOUT", "30"))

mcp = FastMCP("Screenage Market")
_client = httpx.Client(base_url=MARKET_SERVICE_URL, timeout=HTTP_TIMEOUT)


def _get(path: str, params: dict[str, Any] | None = None) -> Any:
    """GET a market-service endpoint and return parsed JSON (or an error dict)."""
    try:
        res = _client.get(path, params={k: v for k, v in (params or {}).items() if v is not None})
        res.raise_for_status()
        return res.json()
    except httpx.HTTPStatusError as exc:
        return {"error": f"{exc.response.status_code} from {path}", "detail": exc.response.text[:300]}
    except Exception as exc:  # noqa: BLE001
        return {"error": f"market-service unreachable at {MARKET_SERVICE_URL}", "detail": str(exc)}


# --- Market overview ---------------------------------------------------------

@mcp.tool()
def get_market_regime(vix_high: float = 16.0, lookback: int = 30) -> dict:
    """Overall Indian-market regime (Trending Up/Down, Ranging, High Volatility)
    from NIFTY trend, India VIX and market breadth. `vix_high` sets the volatility
    threshold and `lookback` the trend-slope window (days)."""
    return _get("/market-regime", {"vix_high": vix_high, "lookback": lookback})


@mcp.tool()
def get_indices() -> dict:
    """Live levels for the key Indian indices (NIFTY 50, SENSEX, BANK NIFTY, India VIX, etc.)."""
    return _get("/indices")


@mcp.tool()
def get_movers(limit: int = 5) -> dict:
    """Top gainers, losers and most-active NSE stocks for the day."""
    return _get("/movers", {"limit": limit})


@mcp.tool()
def get_heatmap() -> dict:
    """All ~93 basket stocks with today's % change, sector and index weight.
    Useful to find the constituents of a sector (e.g. IT, Financials) before scanning."""
    return _get("/heatmap")


# --- Single stock ------------------------------------------------------------

@mcp.tool()
def get_quote(symbols: str) -> dict:
    """Latest price, day stats, 52-week range and a sparkline for one or more NSE
    symbols (comma-separated, e.g. 'RELIANCE,TCS')."""
    return _get("/quotes", {"symbols": symbols})


@mcp.tool()
def get_fundamentals(symbol: str) -> dict:
    """Company profile + fundamental ratios (P/E, P/B, ROE, margins, debt/equity,
    growth, beta, dividend yield, analyst targets) for an NSE stock."""
    return _get(f"/fundamentals/{symbol.upper().strip()}")


@mcp.tool()
def get_price_history(symbol: str, range: str = "6mo") -> dict:
    """Daily/weekly OHLC candles. `range` is one of 1mo, 3mo, 6mo, 1y, 2y, 5y."""
    return _get(f"/history/{symbol.upper().strip()}", {"range": range})


# --- Screening / technicals --------------------------------------------------

@mcp.tool()
def scan_technicals(symbols: str) -> dict:
    """Run the technical scanner over a comma-separated list of NSE symbols.
    Each row returns a 0-100 score, bias (Bullish/Bearish/Neutral), regime, RSI
    and whether price is above its SMA50 — rank/filter these to screen the market."""
    return _get("/technical-scan", {"symbols": symbols})


@mcp.tool()
def get_forecast(symbol: str, horizon: int = 30, ci: int = 80, drift_mode: str = "balanced") -> dict:
    """Monte Carlo (GBM) price forecast: median path, `ci`% confidence band,
    probability of profit and bull/base/bear scenarios over `horizon` trading days.
    `drift_mode` is balanced | neutral | momentum. A probabilistic model, not a prediction."""
    return _get("/forecast", {"symbol": symbol, "horizon": horizon, "ci": ci, "drift_mode": drift_mode})


@mcp.tool()
def run_backtest(
    symbol: str,
    strategy: str = "sma_cross",
    range: str = "2y",
    fast: int = 20,
    slow: int = 50,
    rsi_low: float = 30,
    rsi_high: float = 70,
    breakout: int = 20,
    stop_loss_pct: float = 0,
    take_profit_pct: float = 0,
    trailing_pct: float = 0,
    cost_pct: float = 0.05,
    capital: float = 100000,
) -> dict:
    """Backtest a rule on daily candles and return performance metrics + trade log.
    `strategy` is sma_cross | rsi | breakout. Optional risk controls: stop_loss_pct,
    take_profit_pct, trailing_pct (0 = off) and cost_pct per side. Education only."""
    return _get("/backtest", {
        "symbol": symbol, "strategy": strategy, "range": range,
        "fast": fast, "slow": slow, "rsi_low": rsi_low, "rsi_high": rsi_high, "breakout": breakout,
        "stop_loss_pct": stop_loss_pct, "take_profit_pct": take_profit_pct,
        "trailing_pct": trailing_pct, "cost_pct": cost_pct, "capital": capital,
    })


# --- Options -----------------------------------------------------------------

@mcp.tool()
def get_option_chain(symbol: str = "NIFTY", expiry: str | None = None, strikes_each_side: int = 10) -> dict:
    """NSE option chain with PCR, Max Pain, OI walls (support/resistance), ATM
    straddle, IV and Black-Scholes Greeks per strike. `symbol` can be an index
    (NIFTY, BANKNIFTY) or a stock; `strikes_each_side` is 5-50 around ATM."""
    return _get("/option-chain", {"symbol": symbol, "expiry": expiry, "strikes_each_side": strikes_each_side})


# --- Context: news / calendar ------------------------------------------------

@mcp.tool()
def get_market_news(limit: int = 10) -> dict:
    """Latest Indian-market news headlines (deduped, with source and timestamp)."""
    return _get("/news", {"limit": limit})


@mcp.tool()
def get_economic_calendar(days: int = 7) -> dict:
    """Upcoming economic events (US/IN/GB/EU/CN/JP) for the next `days` days,
    with importance, forecast/previous and the indicator description."""
    return _get("/calendar", {"days": days})


if __name__ == "__main__":
    mcp.run()
