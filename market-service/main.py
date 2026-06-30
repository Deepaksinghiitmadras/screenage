"""
Screenage Market Data Service
=============================
A small FastAPI microservice that exposes Indian (NSE/BSE) market data using
`yfinance` (Yahoo Finance) and `nselib` (NSE India).

The Next.js app consumes these endpoints server-side. This service is for
research / analysis only (delayed quotes) — it is NOT for live trading.

Run locally:
    cd market-service
    python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import math
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from statistics import NormalDist
from typing import Any
import numpy as np
import pandas as pd
import yfinance as yf
from cachetools import TTLCache
from curl_cffi import requests as curl_requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import providers

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("market-service")

# Browser-impersonating session so Yahoo Finance does not block requests.
# Routed through a proxy when MARKET_PROXY / MARKET_HTTP(S)_PROXY is set, which
# is the universal fix for datacenter-IP throttling on Render.
SESSION = providers.make_session()

app = FastAPI(title="Screenage Market Data Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# --- Caches (TTL in seconds) -------------------------------------------------
indices_cache: TTLCache = TTLCache(maxsize=8, ttl=60)
movers_cache: TTLCache = TTLCache(maxsize=8, ttl=120)
quote_cache: TTLCache = TTLCache(maxsize=512, ttl=60)
quotes_cache: TTLCache = TTLCache(maxsize=512, ttl=60)
fundamentals_cache: TTLCache = TTLCache(maxsize=512, ttl=900)
history_cache: TTLCache = TTLCache(maxsize=512, ttl=300)
screener_cache: TTLCache = TTLCache(maxsize=16, ttl=600)
option_chain_cache: TTLCache = TTLCache(maxsize=64, ttl=120)
tech_scan_cache: TTLCache = TTLCache(maxsize=32, ttl=600)
tech_row_cache: TTLCache = TTLCache(maxsize=512, ttl=600)
news_cache: TTLCache = TTLCache(maxsize=8, ttl=300)
calendar_cache: TTLCache = TTLCache(maxsize=8, ttl=900)
backtest_cache: TTLCache = TTLCache(maxsize=128, ttl=600)
forecast_cache: TTLCache = TTLCache(maxsize=128, ttl=600)
regime_cache: TTLCache = TTLCache(maxsize=16, ttl=300)
fear_greed_cache: TTLCache = TTLCache(maxsize=8, ttl=300)
corp_cache: TTLCache = TTLCache(maxsize=64, ttl=3600)

# Underlyings that NSE classifies as index options (everything else is Equity).
INDEX_OPTION_SYMBOLS: set[str] = {
    "NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50",
}

# --- Reference data ----------------------------------------------------------
# Indices shown in the top ticker strip (Yahoo Finance symbols).
INDEX_SYMBOLS: list[dict[str, str]] = [
    {"name": "NIFTY 50", "symbol": "^NSEI"},
    {"name": "SENSEX", "symbol": "^BSESN"},
    {"name": "BANK NIFTY", "symbol": "^NSEBANK"},
    {"name": "NIFTY IT", "symbol": "^CNXIT"},
    {"name": "NIFTY MIDCAP", "symbol": "^NSEMDCP50"},
    {"name": "INDIA VIX", "symbol": "^INDIAVIX"},
]

# Nifty 50 constituents (Yahoo `.NS` symbols) used to compute top gainers/losers.
NIFTY_50: list[str] = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
    "HINDUNILVR.NS", "ITC.NS", "SBIN.NS", "BHARTIARTL.NS", "KOTAKBANK.NS",
    "LT.NS", "AXISBANK.NS", "BAJFINANCE.NS", "ASIANPAINT.NS", "MARUTI.NS",
    "HCLTECH.NS", "SUNPHARMA.NS", "TITAN.NS", "ULTRACEMCO.NS", "WIPRO.NS",
    "NESTLEIND.NS", "ONGC.NS", "NTPC.NS", "POWERGRID.NS", "TMPV.NS",
    "TATASTEEL.NS", "JSWSTEEL.NS", "ADANIENT.NS", "ADANIPORTS.NS", "COALINDIA.NS",
    "BAJAJFINSV.NS", "GRASIM.NS", "HINDALCO.NS", "DRREDDY.NS", "CIPLA.NS",
    "BRITANNIA.NS", "EICHERMOT.NS", "HEROMOTOCO.NS", "DIVISLAB.NS", "TECHM.NS",
    "INDUSINDBK.NS", "BPCL.NS", "TATACONSUM.NS", "APOLLOHOSP.NS", "BAJAJ-AUTO.NS",
    "SBILIFE.NS", "HDFCLIFE.NS", "DMART.NS", "SHRIRAMFIN.NS", "M&M.NS",
    # --- Nifty Next 50 / broader large & mid caps (richer heatmap) ---
    "PNB.NS", "BANKBARODA.NS", "CANBK.NS", "IDFCFIRSTB.NS", "FEDERALBNK.NS",
    "CHOLAFIN.NS", "ICICIGI.NS", "ICICIPRULI.NS", "MUTHOOTFIN.NS", "PFC.NS", "RECLTD.NS",
    "LTIM.NS", "PERSISTENT.NS", "COFORGE.NS", "MPHASIS.NS",
    "GODREJCP.NS", "DABUR.NS", "MARICO.NS", "COLPAL.NS", "VBL.NS",
    "TVSMOTOR.NS", "ASHOKLEY.NS", "MOTHERSON.NS", "BOSCHLTD.NS",
    "VEDL.NS", "JINDALSTEL.NS", "NMDC.NS", "SAIL.NS",
    "LUPIN.NS", "TORNTPHARM.NS", "ZYDUSLIFE.NS", "BIOCON.NS",
    "AMBUJACEM.NS", "PIDILITIND.NS",
    "BEL.NS", "HAL.NS", "SIEMENS.NS", "POLYCAB.NS",
    "TRENT.NS", "HAVELLS.NS", "PAGEIND.NS",
    "GAIL.NS", "IOC.NS", "TATAPOWER.NS",
]


# Sector + approximate index weight (free-float, %) for each Nifty 50 stock.
# Used by the native heatmap (size = weight, colour = % change, group = sector).
NIFTY_50_META: dict[str, tuple[str, float]] = {
    "RELIANCE.NS": ("Energy", 9.2), "ONGC.NS": ("Energy", 1.0), "NTPC.NS": ("Energy", 1.4),
    "POWERGRID.NS": ("Energy", 1.2), "BPCL.NS": ("Energy", 0.5), "COALINDIA.NS": ("Energy", 0.9),
    "HDFCBANK.NS": ("Financials", 11.0), "ICICIBANK.NS": ("Financials", 7.8),
    "SBIN.NS": ("Financials", 3.0), "KOTAKBANK.NS": ("Financials", 2.4),
    "AXISBANK.NS": ("Financials", 3.0), "BAJFINANCE.NS": ("Financials", 2.2),
    "BAJAJFINSV.NS": ("Financials", 0.9), "INDUSINDBK.NS": ("Financials", 0.8),
    "SBILIFE.NS": ("Financials", 0.7), "HDFCLIFE.NS": ("Financials", 0.8),
    "SHRIRAMFIN.NS": ("Financials", 0.7),
    "TCS.NS": ("IT", 4.0), "INFY.NS": ("IT", 5.4), "HCLTECH.NS": ("IT", 1.6),
    "WIPRO.NS": ("IT", 0.7), "TECHM.NS": ("IT", 0.9),
    "HINDUNILVR.NS": ("FMCG", 2.2), "ITC.NS": ("FMCG", 4.0), "NESTLEIND.NS": ("FMCG", 0.9),
    "BRITANNIA.NS": ("FMCG", 0.5), "TATACONSUM.NS": ("FMCG", 0.7), "DMART.NS": ("FMCG", 0.6),
    "MARUTI.NS": ("Auto", 1.8), "TMPV.NS": ("Auto", 1.4), "EICHERMOT.NS": ("Auto", 0.7),
    "HEROMOTOCO.NS": ("Auto", 0.6), "BAJAJ-AUTO.NS": ("Auto", 0.9), "M&M.NS": ("Auto", 1.9),
    "TATASTEEL.NS": ("Metals", 1.1), "JSWSTEEL.NS": ("Metals", 0.9),
    "HINDALCO.NS": ("Metals", 0.9), "ADANIENT.NS": ("Metals", 0.7),
    "SUNPHARMA.NS": ("Pharma", 1.9), "DRREDDY.NS": ("Pharma", 0.7), "CIPLA.NS": ("Pharma", 0.8),
    "DIVISLAB.NS": ("Pharma", 0.6), "APOLLOHOSP.NS": ("Pharma", 0.6),
    "ULTRACEMCO.NS": ("Materials", 1.2), "GRASIM.NS": ("Materials", 0.9),
    "ASIANPAINT.NS": ("Materials", 1.0),
    "BHARTIARTL.NS": ("Telecom", 3.5),
    "LT.NS": ("Capital Goods", 3.6), "ADANIPORTS.NS": ("Capital Goods", 0.9),
    "TITAN.NS": ("Consumer", 1.3),
    # --- broader basket (approximate weights; size is relative) ---
    "PNB.NS": ("Financials", 0.8), "BANKBARODA.NS": ("Financials", 0.8),
    "CANBK.NS": ("Financials", 0.6), "IDFCFIRSTB.NS": ("Financials", 0.4),
    "FEDERALBNK.NS": ("Financials", 0.5), "CHOLAFIN.NS": ("Financials", 0.8),
    "ICICIGI.NS": ("Financials", 0.5), "ICICIPRULI.NS": ("Financials", 0.5),
    "MUTHOOTFIN.NS": ("Financials", 0.5), "PFC.NS": ("Financials", 0.7),
    "RECLTD.NS": ("Financials", 0.7),
    "LTIM.NS": ("IT", 1.2), "PERSISTENT.NS": ("IT", 0.7),
    "COFORGE.NS": ("IT", 0.6), "MPHASIS.NS": ("IT", 0.5),
    "GODREJCP.NS": ("FMCG", 0.6), "DABUR.NS": ("FMCG", 0.5),
    "MARICO.NS": ("FMCG", 0.5), "COLPAL.NS": ("FMCG", 0.5), "VBL.NS": ("FMCG", 0.7),
    "TVSMOTOR.NS": ("Auto", 0.9), "ASHOKLEY.NS": ("Auto", 0.5),
    "MOTHERSON.NS": ("Auto", 0.7), "BOSCHLTD.NS": ("Auto", 0.6),
    "VEDL.NS": ("Metals", 0.8), "JINDALSTEL.NS": ("Metals", 0.6),
    "NMDC.NS": ("Metals", 0.5), "SAIL.NS": ("Metals", 0.4),
    "LUPIN.NS": ("Pharma", 0.6), "TORNTPHARM.NS": ("Pharma", 0.7),
    "ZYDUSLIFE.NS": ("Pharma", 0.5), "BIOCON.NS": ("Pharma", 0.4),
    "AMBUJACEM.NS": ("Materials", 0.6), "PIDILITIND.NS": ("Materials", 0.7),
    "BEL.NS": ("Capital Goods", 1.0), "HAL.NS": ("Capital Goods", 1.0),
    "SIEMENS.NS": ("Capital Goods", 0.9), "POLYCAB.NS": ("Capital Goods", 0.6),
    "TRENT.NS": ("Consumer", 1.0), "HAVELLS.NS": ("Consumer", 0.6),
    "PAGEIND.NS": ("Consumer", 0.4),
    "GAIL.NS": ("Energy", 0.6), "IOC.NS": ("Energy", 0.6),
    "TATAPOWER.NS": ("Energy", 0.7),
}



def _quote_from_history(symbol: str) -> dict[str, Any] | None:
    """Return a normalized quote dict for a symbol via the quotes provider chain."""
    return providers.fetch_simple_quote_chain(symbol, _quote_from_history_yf)


def _quote_from_history_yf(symbol: str) -> dict[str, Any] | None:
    """yfinance single-quote from recent daily history, or None on failure."""
    try:
        df = yf.Ticker(symbol, session=SESSION).history(period="5d", interval="1d").dropna()
        if len(df) < 2:
            return None
        prev = float(df["Close"].iloc[-2])
        last = float(df["Close"].iloc[-1])
        if prev == 0:
            return None
        change = last - prev
        change_pct = (change / prev) * 100
        return {
            "symbol": symbol,
            "price": round(last, 2),
            "change": round(change, 2),
            "changePercent": round(change_pct, 2),
            "currency": "INR",
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("history failed for %s: %s", symbol, exc)
        return None


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "fundamentalsProviders": providers.get_fundamentals_providers(),
        "quotesProviders": providers.get_quotes_providers(),
        "historyProviders": providers.get_history_providers(),
        "fmpEnabled": providers.fmp_enabled(),
        "proxy": providers.proxy_status(),
    }


@app.get("/indices")
def get_indices() -> dict[str, list[dict[str, Any]]]:
    """Index values for the top ticker strip (NIFTY, SENSEX, BANK NIFTY, ...)."""
    if "data" in indices_cache:
        return {"indices": indices_cache["data"]}

    result: list[dict[str, Any]] = []
    for item in INDEX_SYMBOLS:
        quote = _quote_from_history(item["symbol"])
        if quote is None:
            continue
        quote["name"] = item["name"]
        result.append(quote)

    indices_cache["data"] = result
    return {"indices": result}


@app.get("/movers")
def get_movers(limit: int = 5) -> dict[str, list[dict[str, Any]]]:
    """Top gainers / losers / most-active among Nifty 50 (computed via yfinance)."""
    cache_key = f"movers:{limit}"
    if cache_key in movers_cache:
        return movers_cache[cache_key]

    rows: list[dict[str, Any]] = []
    try:
        data = yf.download(
            tickers=" ".join(NIFTY_50),
            period="5d",
            interval="1d",
            group_by="ticker",
            threads=True,
            progress=False,
            session=SESSION,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("yf.download failed: %s", exc)
        raise HTTPException(status_code=502, detail="Upstream data error") from exc

    for symbol in NIFTY_50:
        try:
            df = data[symbol].dropna()
            if len(df) < 2:
                continue
            prev_close = float(df["Close"].iloc[-2])
            last_close = float(df["Close"].iloc[-1])
            volume = float(df["Volume"].iloc[-1])
            if prev_close == 0:
                continue
            change = last_close - prev_close
            change_pct = (change / prev_close) * 100
            rows.append({
                "symbol": symbol,
                "name": symbol.replace(".NS", ""),
                "price": round(last_close, 2),
                "change": round(change, 2),
                "changePercent": round(change_pct, 2),
                "volume": int(volume),
            })
        except Exception:  # noqa: BLE001
            continue

    gainers = sorted(rows, key=lambda r: r["changePercent"], reverse=True)[:limit]
    losers = sorted(rows, key=lambda r: r["changePercent"])[:limit]
    most_active = sorted(rows, key=lambda r: r["volume"], reverse=True)[:limit]

    payload = {"gainers": gainers, "losers": losers, "mostActive": most_active}
    movers_cache[cache_key] = payload
    return payload


@app.get("/heatmap")
def get_heatmap() -> dict[str, list[dict[str, Any]]]:
    """All Nifty 50 stocks with % change, sector and index weight for the native
    treemap heatmap (one bulk download, cached like /movers)."""
    cache_key = "heatmap"
    if cache_key in movers_cache:
        return movers_cache[cache_key]

    try:
        data = yf.download(
            tickers=" ".join(NIFTY_50),
            period="5d",
            interval="1d",
            group_by="ticker",
            threads=True,
            progress=False,
            session=SESSION,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("heatmap yf.download failed: %s", exc)
        raise HTTPException(status_code=502, detail="Upstream data error") from exc

    cells: list[dict[str, Any]] = []
    for symbol in NIFTY_50:
        sector, weight = NIFTY_50_META.get(symbol, ("Other", 1.0))
        try:
            df = data[symbol].dropna()
            if len(df) < 2:
                continue
            prev_close = float(df["Close"].iloc[-2])
            last_close = float(df["Close"].iloc[-1])
            if prev_close == 0:
                continue
            change_pct = ((last_close - prev_close) / prev_close) * 100
            cells.append({
                "symbol": symbol.replace(".NS", ""),
                "sector": sector,
                "weight": weight,
                "price": round(last_close, 2),
                "changePercent": round(change_pct, 2),
            })
        except Exception:  # noqa: BLE001
            continue

    payload = {"cells": cells}
    movers_cache[cache_key] = payload
    return payload


@app.get("/market-regime")
def market_regime(vix_high: float = 16.0, lookback: int = 30) -> dict[str, Any]:
    """Overall Indian-market regime from NIFTY trend, India VIX and breadth.

    Classifies the market as Trending Up / Trending Down / Ranging / High
    Volatility and returns the supporting sub-metrics. `vix_high` sets the
    volatility threshold and `lookback` the trend-slope window. Research only.
    """
    vix_high = max(8.0, min(40.0, vix_high))
    lookback = max(10, min(120, lookback))
    cache_key = f"regime:{vix_high}:{lookback}"
    cached = regime_cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        ndf = yf.Ticker("^NSEI", session=SESSION).history(period="1y", interval="1d").dropna()
    except Exception as exc:  # noqa: BLE001
        logger.warning("market-regime NIFTY fetch failed: %s", exc)
        raise HTTPException(status_code=502, detail="Upstream data error") from exc
    if ndf.empty or len(ndf) < 60:
        raise HTTPException(status_code=502, detail="NIFTY history unavailable")

    closes = ndf["Close"].to_numpy(dtype=float)
    last = float(closes[-1])
    prev = float(closes[-2])
    change_pct = (last - prev) / prev * 100 if prev else 0.0
    sma50 = float(np.mean(closes[-50:]))
    sma200 = float(np.mean(closes[-200:])) if closes.size >= 200 else float(np.mean(closes))
    win = closes[-lookback:]
    # Normalized least-squares slope (% per day).
    xs = np.arange(win.size)
    slope_raw = float(np.polyfit(xs, win, 1)[0])
    slope = slope_raw / float(np.mean(win)) * 100 if np.mean(win) else 0.0
    log_ret = np.diff(np.log(closes[-60:]))
    ann_vol = float(np.std(log_ret)) * math.sqrt(252) * 100

    # India VIX latest level.
    vix = None
    try:
        vdf = yf.Ticker("^INDIAVIX", session=SESSION).history(period="5d", interval="1d").dropna()
        if not vdf.empty:
            vix = round(float(vdf["Close"].iloc[-1]), 2)
    except Exception:  # noqa: BLE001
        vix = None

    # Breadth from the cached heatmap basket (today's advancers).
    cells = get_heatmap().get("cells", [])
    total = len(cells)
    advancers = sum(1 for c in cells if c.get("changePercent", 0) > 0)
    breadth_pct = round(advancers / total * 100, 1) if total else 0.0

    high_vol = (vix is not None and vix >= vix_high) or ann_vol >= 22
    if high_vol:
        regime = "High Volatility"
        risk = "risk-off"
        note = "Elevated volatility — wider swings, signals less reliable."
    elif last > sma50 and sma50 >= sma200 and slope > 0.02:
        regime = "Trending Up"
        risk = "risk-on"
        note = "Broad uptrend — NIFTY above its averages with positive slope."
    elif last < sma50 and sma50 <= sma200 and slope < -0.02:
        regime = "Trending Down"
        risk = "risk-off"
        note = "Broad downtrend — NIFTY below its averages with negative slope."
    else:
        regime = "Ranging"
        risk = "neutral"
        note = "Sideways/consolidating — mean-reversion more likely than breakout."

    payload = {
        "regime": regime,
        "risk": risk,
        "note": note,
        "nifty": {
            "price": round(last, 2),
            "changePercent": round(change_pct, 2),
            "vsSma50Pct": round((last / sma50 - 1) * 100, 2),
            "vsSma200Pct": round((last / sma200 - 1) * 100, 2),
            "slopePctPerDay": round(slope, 3),
        },
        "vix": vix,
        "vixHigh": vix_high,
        "annualizedVolPct": round(ann_vol, 1),
        "breadthPct": breadth_pct,
        "advancers": advancers,
        "decliners": total - advancers,
        "universe": total,
    }
    regime_cache[cache_key] = payload
    return payload


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


@app.get("/fear-greed")
def fear_greed() -> dict[str, Any]:
    """Composite Fear & Greed index (0 = Extreme Fear, 100 = Extreme Greed) for
    the Indian market, blended from NIFTY momentum, India VIX, market breadth,
    NIFTY's 52-week position and the NIFTY put/call ratio. Each component is
    normalized 0-100 with a default weight; the UI can re-weight client-side."""
    cached = fear_greed_cache.get("fg")
    if cached is not None:
        return cached

    try:
        ndf = yf.Ticker("^NSEI", session=SESSION).history(period="1y", interval="1d").dropna()
    except Exception as exc:  # noqa: BLE001
        logger.warning("fear-greed NIFTY fetch failed: %s", exc)
        raise HTTPException(status_code=502, detail="Upstream data error") from exc
    if ndf.empty or len(ndf) < 60:
        raise HTTPException(status_code=502, detail="NIFTY history unavailable")

    closes = ndf["Close"].to_numpy(dtype=float)
    last = float(closes[-1])
    sma125 = float(np.mean(closes[-125:])) if closes.size >= 125 else float(np.mean(closes))
    hi52 = float(np.max(closes))
    lo52 = float(np.min(closes))
    ret20 = (last / float(closes[-21]) - 1) * 100 if closes.size >= 21 else 0.0

    components: list[dict[str, Any]] = []

    # 1) Momentum — NIFTY vs its 125-day average.
    mom_pct = (last / sma125 - 1) * 100
    components.append({
        "key": "momentum", "label": "Momentum", "weight": 0.25,
        "score": round(_clamp(50 + mom_pct * 5), 1),
        "value": f"{mom_pct:+.1f}% vs 125-DMA",
    })

    # 2) Volatility — India VIX (low VIX = greed).
    vix = None
    try:
        vdf = yf.Ticker("^INDIAVIX", session=SESSION).history(period="5d", interval="1d").dropna()
        if not vdf.empty:
            vix = round(float(vdf["Close"].iloc[-1]), 2)
    except Exception:  # noqa: BLE001
        vix = None
    if vix is not None:
        components.append({
            "key": "volatility", "label": "Volatility", "weight": 0.2,
            "score": round(_clamp((30 - vix) * 5), 1),
            "value": f"India VIX {vix}",
        })

    # 3) Breadth — % of basket advancing today.
    cells = get_heatmap().get("cells", [])
    if cells:
        adv = sum(1 for c in cells if c.get("changePercent", 0) > 0)
        breadth = adv / len(cells) * 100
        components.append({
            "key": "breadth", "label": "Breadth", "weight": 0.2,
            "score": round(_clamp(breadth), 1),
            "value": f"{adv}/{len(cells)} advancing",
        })

    # 4) 52-week strength — NIFTY position in its 1-year range.
    rng = hi52 - lo52
    pos52 = (last - lo52) / rng * 100 if rng > 0 else 50
    components.append({
        "key": "strength", "label": "52-Week Strength", "weight": 0.2,
        "score": round(_clamp(pos52), 1),
        "value": f"{pos52:.0f}% of 52w range",
    })

    # 5) Put/Call ratio — NIFTY (low PCR = greed). Optional (NSE may be flaky).
    try:
        oc = option_chain("NIFTY")
        pcr = oc.get("pcr")
        if pcr:
            components.append({
                "key": "putcall", "label": "Put/Call Ratio", "weight": 0.15,
                "score": round(_clamp(50 - (pcr - 1.0) * 100), 1),
                "value": f"PCR {pcr}",
            })
    except Exception:  # noqa: BLE001
        pass

    # Default (weighted) composite over available components.
    w_sum = sum(c["weight"] for c in components)
    composite = round(sum(c["score"] * c["weight"] for c in components) / w_sum, 1) if w_sum else 50.0

    if composite < 25:
        label = "Extreme Fear"
    elif composite < 45:
        label = "Fear"
    elif composite < 55:
        label = "Neutral"
    elif composite < 75:
        label = "Greed"
    else:
        label = "Extreme Greed"

    payload = {
        "composite": composite,
        "label": label,
        "components": components,
        "nifty": round(last, 2),
        "vix": vix,
    }
    fear_greed_cache["fg"] = payload
    return payload


@app.get("/corporate-actions")
def corporate_actions(symbols: str = "") -> dict[str, Any]:
    """Upcoming earnings dates and ex-dividend dates for a list of NSE symbols
    (from yfinance per-ticker calendar). Returns events sorted by date. Only the
    window [today-3d, today+150d] is kept. Research only."""
    requested = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not requested:
        return {"events": []}

    cache_key = ",".join(sorted(requested))
    cached = corp_cache.get(cache_key)
    if cached is not None:
        return cached

    today = datetime.now(timezone.utc).date()
    lo = today - timedelta(days=3)
    hi = today + timedelta(days=150)

    def _to_date_str(value: Any) -> str | None:
        if value is None:
            return None
        s = str(value)[:10]
        try:
            d = datetime.strptime(s, "%Y-%m-%d").date()
        except ValueError:
            return None
        return s if lo <= d <= hi else None

    def fetch(sym: str) -> list[dict[str, Any]]:
        resolved = _resolve_symbol(sym)
        try:
            cal = yf.Ticker(resolved, session=SESSION).calendar
        except Exception:  # noqa: BLE001
            return []
        if not cal or not isinstance(cal, dict):
            return []
        out: list[dict[str, Any]] = []
        ed = cal.get("Earnings Date")
        ed_val = ed[0] if isinstance(ed, list) and ed else (ed if not isinstance(ed, list) else None)
        ed_str = _to_date_str(ed_val)
        if ed_str:
            out.append({"symbol": sym, "type": "earnings", "date": ed_str})
        xd_str = _to_date_str(cal.get("Ex-Dividend Date"))
        if xd_str:
            out.append({"symbol": sym, "type": "ex_dividend", "date": xd_str})
        return out

    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(fetch, requested))

    events = [e for sub in results for e in sub]
    events.sort(key=lambda e: e["date"])
    payload = {"events": events}
    corp_cache[cache_key] = payload
    return payload


# Symbols polled for the dashboard news feed (broad coverage across sectors).
NEWS_BASKET: list[str] = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
    "BHARTIARTL.NS", "LT.NS", "SBIN.NS", "TATAMOTORS.NS", "ADANIENT.NS",
]


def _parse_iso(value: str | None) -> int:
    """ISO-8601 timestamp -> epoch seconds (0 on failure)."""
    if not value:
        return 0
    try:
        return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp())
    except Exception:  # noqa: BLE001
        return 0


def _news_for_symbol(symbol: str) -> list[dict[str, Any]]:
    try:
        items = yf.Ticker(symbol, session=SESSION).news or []
    except Exception as exc:  # noqa: BLE001
        logger.warning("news failed for %s: %s", symbol, exc)
        return []

    out: list[dict[str, Any]] = []
    for it in items:
        content = it.get("content") or {}
        title = content.get("title")
        if not title:
            continue
        provider = content.get("provider") or {}
        canonical = content.get("canonicalUrl") or {}
        click = content.get("clickThroughUrl") or {}
        url = (
            (canonical.get("url") if isinstance(canonical, dict) else None)
            or (click.get("url") if isinstance(click, dict) else None)
        )
        if not url:
            continue
        thumb = content.get("thumbnail") or {}
        image = thumb.get("originalUrl") if isinstance(thumb, dict) else None
        out.append({
            "id": it.get("id") or url,
            "headline": title,
            "summary": content.get("summary") or content.get("description") or "",
            "url": url,
            "source": provider.get("displayName") if isinstance(provider, dict) else None,
            "image": image,
            "datetime": _parse_iso(content.get("pubDate") or content.get("displayTime")),
        })
    return out


@app.get("/news")
def get_news(limit: int = 12) -> dict[str, list[dict[str, Any]]]:
    """Aggregated, de-duplicated market news from across the basket (yfinance).

    More varied than a single wire feed — pulls each symbol's headlines and
    merges them by title."""
    cache_key = f"news:{limit}"
    if cache_key in news_cache:
        return news_cache[cache_key]

    collected: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        for batch in pool.map(_news_for_symbol, NEWS_BASKET):
            collected.extend(batch)

    seen_titles: set[str] = set()
    unique: list[dict[str, Any]] = []
    for art in sorted(collected, key=lambda a: a["datetime"], reverse=True):
        key = (art["headline"] or "").strip().lower()
        if not key or key in seen_titles:
            continue
        seen_titles.add(key)
        unique.append(art)
        if len(unique) >= limit:
            break

    payload = {"articles": unique}
    news_cache[cache_key] = payload
    return payload


# Importance code from TradingView calendar -> our 1..3 scale (3 = high).
_IMPORTANCE_MAP = {1: 3, 0: 2, -1: 1}


@app.get("/calendar")
def get_calendar(days: int = 7, countries: str = "US,IN,GB,EU,CN,JP") -> dict[str, list[dict[str, Any]]]:
    """Upcoming economic-calendar events (free TradingView calendar JSON feed).

    Returns normalized events grouped client-side. `days` = look-ahead window,
    `countries` = comma list of ISO-2 codes."""
    cache_key = f"calendar:{days}:{countries}"
    if cache_key in calendar_cache:
        return calendar_cache[cache_key]

    now = datetime.now(timezone.utc)
    frm = now.strftime("%Y-%m-%dT00:00:00.000Z")
    to = (now + timedelta(days=max(1, days))).strftime("%Y-%m-%dT00:00:00.000Z")

    try:
        resp = SESSION.get(
            "https://economic-calendar.tradingview.com/events",
            params={"from": frm, "to": to, "countries": countries},
            headers={"Origin": "https://www.tradingview.com"},
            timeout=15,
        )
        resp.raise_for_status()
        raw = resp.json().get("result", [])
    except Exception as exc:  # noqa: BLE001
        logger.error("calendar fetch failed: %s", exc)
        return {"events": []}

    events: list[dict[str, Any]] = []
    for ev in raw:
        title = ev.get("title")
        if not title:
            continue
        events.append({
            "id": ev.get("id") or f"{ev.get('country')}-{title}-{ev.get('date')}",
            "title": title,
            "country": ev.get("country") or "",
            "currency": ev.get("currency") or "",
            "importance": _IMPORTANCE_MAP.get(ev.get("importance"), 1),
            "actual": ev.get("actual"),
            "forecast": ev.get("forecast"),
            "previous": ev.get("previous"),
            "unit": ev.get("unit") or "",
            "period": ev.get("period") or "",
            "category": ev.get("category") or "",
            "comment": ev.get("comment") or "",
            "source": ev.get("source") or "",
            "sourceUrl": ev.get("source_url") or "",
            "datetime": _parse_iso(ev.get("date")),
        })

    events.sort(key=lambda e: e["datetime"])
    payload = {"events": events}
    calendar_cache[cache_key] = payload
    return payload


@app.get("/quote/{symbol}")
def get_quote(symbol: str) -> dict[str, Any]:
    """Single quote for a Yahoo symbol (e.g. RELIANCE.NS)."""
    symbol = symbol.upper()
    if symbol in quote_cache:
        return quote_cache[symbol]
    quote = _quote_from_history(symbol)
    if quote is None:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")
    quote_cache[symbol] = quote
    return quote


def _resolve_symbol(symbol: str) -> str:
    """Pick the Yahoo symbol to query. Default to NSE (.NS) for plain symbols."""
    symbol = symbol.upper().strip()
    if "." in symbol or symbol.startswith("^"):
        return symbol
    return f"{symbol}.NS"


def _num(value: Any) -> float | None:
    """Coerce a value to float, or None if missing/invalid."""
    try:
        if value is None:
            return None
        out = float(value)
        return out
    except (TypeError, ValueError):
        return None


@app.get("/fundamentals/{symbol}")
def get_fundamentals(symbol: str) -> dict[str, Any]:
    """Company profile + key fundamental ratios for a stock (yfinance .info)."""
    payload = _fetch_fundamentals(symbol)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"No fundamentals for {symbol}")
    return payload


def _fetch_fundamentals(symbol: str) -> dict[str, Any] | None:
    """Cached fundamentals fetch via the configured provider chain.

    Tries each provider in FUNDAMENTALS_PROVIDERS order (e.g. "fmp,yfinance"),
    returning the first success. Default chain is yfinance-only, so behaviour is
    unchanged unless FMP is configured. Shared by /fundamentals and /screener.
    """
    resolved = _resolve_symbol(symbol)
    if resolved in fundamentals_cache:
        return fundamentals_cache[resolved]

    payload = providers.fetch_fundamentals_chain(resolved, symbol, _fetch_fundamentals_yf)
    if payload is not None:
        fundamentals_cache[resolved] = payload
    return payload


def _fetch_fundamentals_yf(resolved: str, symbol: str) -> dict[str, Any] | None:
    """yfinance fundamentals via get_info(). Yahoo throttles this hard from
    datacenter IPs — retry once on failure."""
    info = None
    for attempt in range(2):
        try:
            info = yf.Ticker(resolved, session=SESSION).get_info()
            if info and (info.get("regularMarketPrice") is not None or info.get("currentPrice") is not None):
                break
        except Exception as exc:  # noqa: BLE001
            logger.warning("get_info failed for %s (attempt %s): %s", resolved, attempt, exc)
        if attempt == 0:
            time.sleep(0.6)

    if not info or (info.get("regularMarketPrice") is None and info.get("currentPrice") is None):
        return None

    price = _num(info.get("currentPrice")) or _num(info.get("regularMarketPrice"))
    prev_close = _num(info.get("previousClose"))
    change = None
    change_pct = None
    if price is not None and prev_close not in (None, 0):
        change = round(price - prev_close, 2)
        change_pct = round((change / prev_close) * 100, 2)

    div_yield = _num(info.get("dividendYield"))
    # yfinance >=1.4 returns dividendYield already as a percentage (e.g. 0.46).
    if div_yield is not None:
        div_yield = round(div_yield, 2)

    payload: dict[str, Any] = {
        "symbol": resolved,
        "name": info.get("longName") or info.get("shortName") or symbol.upper(),
        "exchange": info.get("exchange"),
        "currency": info.get("currency", "INR"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "website": info.get("website"),
        "summary": info.get("longBusinessSummary"),
        "price": price,
        "previousClose": prev_close,
        "change": change,
        "changePercent": change_pct,
        "dayHigh": _num(info.get("dayHigh")),
        "dayLow": _num(info.get("dayLow")),
        "fiftyTwoWeekHigh": _num(info.get("fiftyTwoWeekHigh")),
        "fiftyTwoWeekLow": _num(info.get("fiftyTwoWeekLow")),
        "metrics": {
            "marketCap": _num(info.get("marketCap")),
            "enterpriseValue": _num(info.get("enterpriseValue")),
            "trailingPE": _num(info.get("trailingPE")),
            "forwardPE": _num(info.get("forwardPE")),
            "priceToBook": _num(info.get("priceToBook")),
            "pegRatio": _num(info.get("trailingPegRatio")),
            "eps": _num(info.get("trailingEps")),
            "beta": _num(info.get("beta")),
            "dividendYield": div_yield,
            "bookValue": _num(info.get("bookValue")),
            "roe": _pct(info.get("returnOnEquity")),
            "roa": _pct(info.get("returnOnAssets")),
            "profitMargin": _pct(info.get("profitMargins")),
            "operatingMargin": _pct(info.get("operatingMargins")),
            "revenue": _num(info.get("totalRevenue")),
            "grossProfit": _num(info.get("grossProfits")),
            "ebitda": _num(info.get("ebitda")),
            "debtToEquity": _num(info.get("debtToEquity")),
            "currentRatio": _num(info.get("currentRatio")),
            "revenueGrowth": _pct(info.get("revenueGrowth")),
            "earningsGrowth": _pct(info.get("earningsGrowth")),
        },
        "analyst": {
            "recommendation": info.get("recommendationKey"),
            "targetMean": _num(info.get("targetMeanPrice")),
            "targetHigh": _num(info.get("targetHighPrice")),
            "targetLow": _num(info.get("targetLowPrice")),
            "numberOfAnalysts": _num(info.get("numberOfAnalystOpinions")),
        },
        "_provider": "yfinance",
    }

    return payload


def _pct(value: Any) -> float | None:
    """Coerce a fractional ratio (0.123) to a percentage (12.3)."""
    out = _num(value)
    if out is None:
        return None
    return round(out * 100, 2)


# Allowed history ranges -> (yfinance period, interval).
HISTORY_RANGES: dict[str, tuple[str, str]] = {
    "1mo": ("1mo", "1d"),
    "3mo": ("3mo", "1d"),
    "6mo": ("6mo", "1d"),
    "1y": ("1y", "1d"),
    "2y": ("2y", "1d"),
    "5y": ("5y", "1wk"),
}


@app.get("/history/{symbol}")
def get_history(symbol: str, range: str = "6mo") -> dict[str, Any]:
    """Daily/weekly OHLC candles for a stock (for our own price chart)."""
    period, interval = HISTORY_RANGES.get(range, HISTORY_RANGES["6mo"])
    resolved = _resolve_symbol(symbol)
    cache_key = f"{resolved}:{range}"
    if cache_key in history_cache:
        return history_cache[cache_key]

    max_points = _RANGE_MAX_POINTS.get(range, 132)

    def _yf(sym: str) -> list[dict[str, Any]] | None:
        return _history_yf(sym, period, interval)

    candles = providers.fetch_history_chain(resolved, max_points, _yf)

    if not candles:
        raise HTTPException(status_code=404, detail=f"No history for {symbol}")

    payload = {"symbol": resolved, "range": range, "candles": candles}
    history_cache[cache_key] = payload
    return payload


# Approx trading-day counts per range, used to trim EOD-provider candles.
_RANGE_MAX_POINTS: dict[str, int] = {
    "1mo": 23, "3mo": 66, "6mo": 132, "1y": 252, "2y": 504, "5y": 260,
}


def _history_yf(resolved: str, period: str, interval: str) -> list[dict[str, Any]] | None:
    """yfinance OHLC candles for a symbol, or None on failure/empty."""
    try:
        df = yf.Ticker(resolved, session=SESSION).history(
            period=period, interval=interval
        ).dropna()
    except Exception as exc:  # noqa: BLE001
        logger.warning("history failed for %s: %s", resolved, exc)
        return None

    if df.empty:
        return None

    candles: list[dict[str, Any]] = []
    for idx, row in df.iterrows():
        candles.append({
            "time": idx.strftime("%Y-%m-%d"),
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
            "volume": int(row["Volume"]) if not _is_nan(row["Volume"]) else 0,
        })
    return candles


def _is_nan(value: Any) -> bool:
    try:
        return value != value  # NaN is not equal to itself
    except Exception:  # noqa: BLE001
        return False


@app.get("/quotes")
def get_quotes(symbols: str = "") -> dict[str, Any]:
    """Batch quotes for a watchlist.

    `symbols` is a comma-separated list (the symbols stored in our DB). Each
    item returns last price, day stats, 52-week range and a closing-price
    sparkline so the UI can render a Groww-style table without extra calls.
    """
    requested = [s.strip() for s in symbols.split(",") if s.strip()]
    results: list[dict[str, Any]] = []

    for raw in requested:
        resolved = _resolve_symbol(raw)
        cached = quotes_cache.get(resolved)
        if cached is not None:
            results.append({**cached, "requested": raw})
            continue

        payload = providers.fetch_quote_chain(resolved, raw, _quote_one_yf)
        if payload is None:
            results.append({"requested": raw, "symbol": resolved, "available": False})
            continue

        quotes_cache[resolved] = payload
        results.append({**payload, "requested": raw})

    return {"quotes": results}


def _quote_one_yf(resolved: str, raw: str) -> dict[str, Any] | None:
    """yfinance batch-quote payload for one symbol (price, day stats, 52w, spark)."""
    try:
        df = yf.Ticker(resolved, session=SESSION).history(
            period="1y", interval="1d"
        ).dropna()
    except Exception as exc:  # noqa: BLE001
        logger.warning("quote failed for %s: %s", resolved, exc)
        return None

    if df is None or df.empty:
        return None

    closes = df["Close"].tolist()
    last = df.iloc[-1]
    price = round(float(last["Close"]), 2)
    prev_close = round(float(df.iloc[-2]["Close"]), 2) if len(df) > 1 else price
    change = round(price - prev_close, 2)
    change_pct = round((change / prev_close) * 100, 2) if prev_close else 0.0
    spark = [round(float(c), 2) for c in closes[-30:]]

    return {
        "symbol": resolved,
        "available": True,
        "price": price,
        "open": round(float(last["Open"]), 2),
        "dayHigh": round(float(last["High"]), 2),
        "dayLow": round(float(last["Low"]), 2),
        "previousClose": prev_close,
        "change": change,
        "changePercent": change_pct,
        "volume": int(last["Volume"]) if not _is_nan(last["Volume"]) else 0,
        "week52High": round(float(df["High"].max()), 2),
        "week52Low": round(float(df["Low"].min()), 2),
        "sparkline": spark,
        "_provider": "yfinance",
    }


@app.get("/screener")
def screener(symbols: str = "") -> dict[str, Any]:
    """Batch lightweight fundamentals for a universe of stocks (AI screener).

    `symbols` is a comma-separated list of bare NSE tickers. Fundamentals are
    fetched concurrently (and individually cached) so the Next.js layer can
    apply numeric filters + AI ranking without N round-trips.
    """
    requested = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not requested:
        return {"stocks": []}

    cache_key = ",".join(sorted(requested))
    cached = screener_cache.get(cache_key)
    if cached is not None:
        return cached

    # Fewer workers = gentler on Yahoo's rate limiter (datacenter IPs get throttled).
    workers = int(os.environ.get("SCREENER_WORKERS", "3"))
    with ThreadPoolExecutor(max_workers=max(1, min(8, workers))) as pool:
        payloads = list(pool.map(_fetch_fundamentals, requested))

    stocks: list[dict[str, Any]] = []
    for sym, payload in zip(requested, payloads):
        if payload is None:
            continue
        m = payload["metrics"]
        stocks.append({
            "symbol": sym,
            "name": payload["name"],
            "sector": payload["sector"],
            "industry": payload["industry"],
            "price": payload["price"],
            "changePercent": payload["changePercent"],
            "marketCap": m["marketCap"],
            "trailingPE": m["trailingPE"],
            "forwardPE": m["forwardPE"],
            "priceToBook": m["priceToBook"],
            "pegRatio": m["pegRatio"],
            "roe": m["roe"],
            "roa": m["roa"],
            "profitMargin": m["profitMargin"],
            "operatingMargin": m["operatingMargin"],
            "revenueGrowth": m["revenueGrowth"],
            "earningsGrowth": m["earningsGrowth"],
            "debtToEquity": m["debtToEquity"],
            "dividendYield": m["dividendYield"],
            "beta": m["beta"],
        })

    result = {"stocks": stocks}
    screener_cache[cache_key] = result
    return result


# --- Market-wide technical scan ----------------------------------------------

def _sma(values: list[float], period: int) -> float | None:
    if len(values) < period:
        return None
    return sum(values[-period:]) / period


def _rsi(values: list[float], period: int = 14) -> float | None:
    if len(values) < period + 1:
        return None
    gain = 0.0
    loss = 0.0
    for i in range(len(values) - period, len(values)):
        diff = values[i] - values[i - 1]
        if diff >= 0:
            gain += diff
        else:
            loss -= diff
    avg_gain = gain / period
    avg_loss = loss / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def _fetch_technical_row(symbol: str) -> dict[str, Any] | None:
    """Lightweight technical snapshot (score/bias/regime/RSI) for one stock."""
    cached = tech_row_cache.get(symbol)
    if cached is not None:
        return cached

    resolved = _resolve_symbol(symbol)
    try:
        df = yf.Ticker(resolved, session=SESSION).history(
            period="1y", interval="1d"
        ).dropna()
    except Exception as exc:  # noqa: BLE001
        logger.warning("tech scan history failed for %s: %s", resolved, exc)
        return None

    if df.empty or len(df) < 40:
        return None

    closes = [float(c) for c in df["Close"].tolist()]
    volumes = [float(v) for v in df["Volume"].tolist()]
    last = closes[-1]
    prev = closes[-2] if len(closes) >= 2 else last
    change_pct = ((last - prev) / prev * 100) if prev else 0.0

    sma20 = _sma(closes, 20)
    sma50 = _sma(closes, 50)
    sma200 = _sma(closes, 200)
    rsi = _rsi(closes, 14)

    # Composite score 0-100, mirroring the TS scanner.
    score = 50.0
    if sma50 is not None:
        score += 10 if last > sma50 else -10
    if sma20 is not None and sma50 is not None:
        score += 8 if sma20 > sma50 else -8
    if sma200 is not None:
        score += 8 if last > sma200 else -8
    if rsi is not None:
        if rsi > 70:
            score -= 6
        elif rsi < 30:
            score += 6
        elif rsi > 55:
            score += 4
        elif rsi < 45:
            score -= 4

    # 20-day range position
    window = closes[-20:]
    lo, hi = min(window), max(window)
    if hi > lo:
        pos = (last - lo) / (hi - lo)
        score += (pos - 0.5) * 16

    # Volume confirmation
    if len(volumes) >= 20:
        avg_vol = sum(volumes[-20:]) / 20
        if avg_vol > 0 and volumes[-1] > 1.5 * avg_vol:
            score += 4 if change_pct >= 0 else -4

    score = max(0, min(100, round(score)))
    bias = "Bullish" if score >= 60 else "Bearish" if score <= 40 else "Neutral"

    # Regime via annualised volatility + slope of last 30 closes.
    rets = [
        (closes[i] - closes[i - 1]) / closes[i - 1]
        for i in range(max(1, len(closes) - 30), len(closes))
        if closes[i - 1]
    ]
    ann_vol = 0.0
    if len(rets) > 2:
        mean = sum(rets) / len(rets)
        var = sum((r - mean) ** 2 for r in rets) / (len(rets) - 1)
        ann_vol = (var ** 0.5) * (252 ** 0.5) * 100
    seg = closes[-30:]
    slope_pct = ((seg[-1] - seg[0]) / seg[0] / len(seg) * 100) if seg and seg[0] else 0.0
    if ann_vol > 45:
        regime = "High Volatility"
    elif slope_pct > 0.15:
        regime = "Trending Up"
    elif slope_pct < -0.15:
        regime = "Trending Down"
    else:
        regime = "Ranging"

    row = {
        "symbol": symbol,
        "price": round(last, 2),
        "changePercent": round(change_pct, 2),
        "score": score,
        "bias": bias,
        "regime": regime,
        "rsi": round(rsi, 1) if rsi is not None else None,
        "aboveSma50": (last > sma50) if sma50 is not None else None,
        "aboveSma200": (last > sma200) if sma200 is not None else None,
    }
    tech_row_cache[symbol] = row
    return row


@app.get("/technical-scan")
def technical_scan(symbols: str = "") -> dict[str, Any]:
    """Run the lightweight technical scanner across a list of NSE tickers."""
    requested = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not requested:
        return {"rows": []}

    cache_key = ",".join(sorted(requested))
    cached = tech_scan_cache.get(cache_key)
    if cached is not None:
        return cached

    with ThreadPoolExecutor(max_workers=8) as pool:
        payloads = list(pool.map(_fetch_technical_row, requested))

    rows = [p for p in payloads if p is not None]
    result = {"rows": rows}
    tech_scan_cache[cache_key] = result
    return result


# --- Strategy backtester -----------------------------------------------------

BACKTEST_RANGES = {"1y": "1y", "2y": "2y", "3y": "3y", "5y": "5y"}
BACKTEST_STRATEGIES = {"sma_cross", "rsi", "breakout"}


def _rsi_series(close: pd.Series, period: int) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, float("nan"))
    return 100 - (100 / (1 + rs))


def _positions_for_strategy(
    df: pd.DataFrame, strategy: str, params: dict[str, float]
) -> list[int]:
    """Return a list of 0/1 long positions per bar for the chosen rule."""
    close = df["Close"]
    n = len(df)
    pos = [0] * n

    if strategy == "sma_cross":
        fast_ma = close.rolling(int(params["fast"])).mean()
        slow_ma = close.rolling(int(params["slow"])).mean()
        for i in range(n):
            f, s = fast_ma.iloc[i], slow_ma.iloc[i]
            if pd.notna(f) and pd.notna(s):
                pos[i] = 1 if f > s else 0
    elif strategy == "rsi":
        rsi = _rsi_series(close, int(params["rsi_period"]))
        low, high = params["rsi_low"], params["rsi_high"]
        holding = 0
        for i in range(n):
            r = rsi.iloc[i]
            if pd.notna(r):
                if holding == 0 and r < low:
                    holding = 1
                elif holding == 1 and r > high:
                    holding = 0
            pos[i] = holding
    else:  # breakout
        window = int(params["breakout"])
        hi = close.rolling(window).max().shift(1)
        lo = close.rolling(window).min().shift(1)
        holding = 0
        for i in range(n):
            c, h, l = close.iloc[i], hi.iloc[i], lo.iloc[i]
            if pd.notna(h) and pd.notna(l):
                if holding == 0 and c > h:
                    holding = 1
                elif holding == 1 and c < l:
                    holding = 0
            pos[i] = holding
    return pos


@app.get("/backtest")
def backtest(
    symbol: str,
    strategy: str = "sma_cross",
    range_: str = Query("2y", alias="range"),
    fast: int = 20,
    slow: int = 50,
    rsi_period: int = 14,
    rsi_low: float = 30,
    rsi_high: float = 70,
    breakout: int = 20,
    capital: float = 100000,
    cost_pct: float = 0.05,
    stop_loss_pct: float = 0,
    take_profit_pct: float = 0,
    trailing_pct: float = 0,
) -> dict[str, Any]:
    """Event-driven long-only backtest of a simple rule on daily candles.

    Strategies: sma_cross (fast/slow SMA), rsi (oversold in / overbought out),
    breakout (N-day high/low channel). Optional risk controls (stop-loss,
    take-profit, trailing stop) are checked intrabar via the daily high/low,
    and a per-side cost models brokerage+slippage. Education only — not advice.
    """
    strategy = strategy.lower().strip()
    if strategy not in BACKTEST_STRATEGIES:
        raise HTTPException(status_code=400, detail=f"Unknown strategy '{strategy}'")
    period = BACKTEST_RANGES.get(range_, "2y")
    resolved = _resolve_symbol(symbol)
    params = {
        "fast": max(2, min(100, fast)),
        "slow": max(3, min(250, slow)),
        "rsi_period": max(2, min(50, rsi_period)),
        "rsi_low": max(5.0, min(50.0, rsi_low)),
        "rsi_high": max(50.0, min(95.0, rsi_high)),
        "breakout": max(5, min(120, breakout)),
        "capital": max(1000.0, min(1e9, capital)),
        "cost_pct": max(0.0, min(2.0, cost_pct)),
        "stop_loss_pct": max(0.0, min(90.0, stop_loss_pct)),
        "take_profit_pct": max(0.0, min(500.0, take_profit_pct)),
        "trailing_pct": max(0.0, min(90.0, trailing_pct)),
    }
    cache_key = f"{resolved}:{strategy}:{period}:{params}"
    cached = backtest_cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        df = yf.Ticker(resolved, session=SESSION).history(period=period, interval="1d").dropna()
    except Exception as exc:  # noqa: BLE001
        logger.warning("backtest history failed for %s: %s", resolved, exc)
        raise HTTPException(status_code=502, detail="Upstream data error") from exc

    if df.empty or len(df) < 30:
        raise HTTPException(status_code=404, detail=f"Not enough history for {symbol}")

    want = _positions_for_strategy(df, strategy, params)
    closes = df["Close"].tolist()
    highs = df["High"].tolist()
    lows = df["Low"].tolist()
    n = len(df)

    cost = params["cost_pct"] / 100.0
    sl = params["stop_loss_pct"] / 100.0
    tp = params["take_profit_pct"] / 100.0
    trail = params["trailing_pct"] / 100.0
    start_cap = params["capital"]

    # Event-driven simulation with intrabar risk controls.
    cash = start_cap
    shares = 0.0
    in_pos = False
    entry_price = 0.0
    entry_idx = 0
    peak = 0.0
    equity_vals: list[float] = []
    trades: list[dict[str, Any]] = []

    def record_trade(idx_in: int, idx_out: int, ep: float, xp: float, reason: str, open_trade: bool) -> None:
        pnl = shares * xp * (1 - cost) - shares * ep  # ₹ on the position
        label = df.index[idx_out].strftime("%Y-%m-%d") + (" (open)" if open_trade else "")
        trades.append({
            "entryDate": df.index[idx_in].strftime("%Y-%m-%d"),
            "exitDate": label,
            "entryPrice": round(ep, 2),
            "exitPrice": round(xp, 2),
            "returnPct": round((xp / ep - 1) * 100, 2),
            "pnl": round(pnl, 2),
            "bars": idx_out - idx_in,
            "exit": reason,
        })

    for i in range(n):
        c, hi, lo = closes[i], highs[i], lows[i]

        if in_pos:
            peak = max(peak, hi)
            stop_level = None
            if sl > 0:
                stop_level = entry_price * (1 - sl)
            if trail > 0:
                trail_level = peak * (1 - trail)
                stop_level = trail_level if stop_level is None else max(stop_level, trail_level)
            target = entry_price * (1 + tp) if tp > 0 else None

            exit_price = None
            reason = ""
            if stop_level is not None and lo <= stop_level:
                exit_price, reason = stop_level, ("trailing_stop" if trail > 0 else "stop_loss")
            elif target is not None and hi >= target:
                exit_price, reason = target, "take_profit"
            elif want[i] == 0:
                exit_price, reason = c, "signal"

            if exit_price is not None:
                cash = shares * exit_price * (1 - cost)
                record_trade(entry_idx, i, entry_price, exit_price, reason, False)
                shares = 0.0
                in_pos = False

        # Entry only on a rising edge of the signal (avoids same-bar re-entry after a stop).
        if not in_pos and want[i] == 1 and (i == 0 or want[i - 1] == 0):
            shares = cash * (1 - cost) / c
            entry_price = c
            entry_idx = i
            peak = hi
            cash = 0.0
            in_pos = True

        equity_vals.append(cash + (shares * c if in_pos else 0.0))

    if in_pos:  # mark open trade to last close
        record_trade(entry_idx, n - 1, entry_price, closes[-1], "open", True)

    equity = pd.Series(equity_vals, index=df.index)
    close = df["Close"]
    buyhold = close / close.iloc[0] * start_cap

    # Metrics.
    final_cap = float(equity.iloc[-1])
    total_return = final_cap / start_cap - 1.0
    bh_return = float(close.iloc[-1] / close.iloc[0]) - 1.0
    years = max(n / 252.0, 1e-6)
    cagr = (final_cap / start_cap) ** (1 / years) - 1.0 if final_cap > 0 else -1.0
    drawdown = equity / equity.cummax() - 1.0
    max_dd = float(drawdown.min())

    eq_ret = equity.pct_change().fillna(0.0)
    std = float(eq_ret.std())
    sharpe = float(eq_ret.mean() / std * math.sqrt(252)) if std > 0 else 0.0
    downside = eq_ret[eq_ret < 0]
    dstd = float(downside.std()) if len(downside) > 1 else 0.0
    sortino = float(eq_ret.mean() / dstd * math.sqrt(252)) if dstd > 0 else 0.0
    calmar = float(cagr / abs(max_dd)) if max_dd < 0 else 0.0

    wins = [t for t in trades if t["pnl"] > 0]
    losers = [t for t in trades if t["pnl"] <= 0]
    win_rate = round(len(wins) / len(trades) * 100, 1) if trades else 0.0
    avg_win = round(sum(t["returnPct"] for t in wins) / len(wins), 2) if wins else 0.0
    avg_loss = round(sum(t["returnPct"] for t in losers) / len(losers), 2) if losers else 0.0
    gross_win = sum(t["pnl"] for t in wins)
    gross_loss = abs(sum(t["pnl"] for t in losers))
    profit_factor = round(gross_win / gross_loss, 2) if gross_loss > 0 else (0.0 if not wins else 999.0)
    best = round(max((t["returnPct"] for t in trades), default=0.0), 2)
    worst = round(min((t["returnPct"] for t in trades), default=0.0), 2)
    avg_bars = round(sum(t["bars"] for t in trades) / len(trades), 1) if trades else 0.0
    # Max consecutive losses.
    max_consec = 0
    run = 0
    for t in trades:
        if t["pnl"] <= 0:
            run += 1
            max_consec = max(max_consec, run)
        else:
            run = 0
    exposure = round(sum(1 for v in want if v == 1) / n * 100, 1)

    # Equity curve (downsampled, indexed to 100).
    step = max(1, n // 400)
    curve = [{
        "time": df.index[i].strftime("%Y-%m-%d"),
        "strategy": round(float(equity.iloc[i]) / start_cap * 100, 2),
        "buyHold": round(float(buyhold.iloc[i]) / start_cap * 100, 2),
    } for i in range(0, n, step)]
    if (n - 1) % step != 0:
        curve.append({
            "time": df.index[-1].strftime("%Y-%m-%d"),
            "strategy": round(final_cap / start_cap * 100, 2),
            "buyHold": round(float(buyhold.iloc[-1]) / start_cap * 100, 2),
        })

    payload = {
        "symbol": resolved,
        "strategy": strategy,
        "range": range_,
        "params": params,
        "bars": n,
        "startDate": df.index[0].strftime("%Y-%m-%d"),
        "endDate": df.index[-1].strftime("%Y-%m-%d"),
        "metrics": {
            "totalReturnPct": round(total_return * 100, 2),
            "buyHoldReturnPct": round(bh_return * 100, 2),
            "cagrPct": round(cagr * 100, 2),
            "maxDrawdownPct": round(max_dd * 100, 2),
            "sharpe": round(sharpe, 2),
            "sortino": round(sortino, 2),
            "calmar": round(calmar, 2),
            "profitFactor": profit_factor,
            "winRatePct": win_rate,
            "trades": len(trades),
            "avgWinPct": avg_win,
            "avgLossPct": avg_loss,
            "bestTradePct": best,
            "worstTradePct": worst,
            "avgHoldBars": avg_bars,
            "maxConsecLosses": max_consec,
            "exposurePct": exposure,
            "startCapital": round(start_cap, 2),
            "finalCapital": round(final_cap, 2),
            "pnl": round(final_cap - start_cap, 2),
        },
        "equityCurve": curve,
        "trades": trades[-50:],
    }
    backtest_cache[cache_key] = payload
    return payload


# --- Monte Carlo price forecast ----------------------------------------------

FORECAST_DRIFT_MODES = {"balanced": 0.5, "neutral": 0.0, "momentum": 1.0}


@app.get("/forecast")
def forecast(
    symbol: str,
    horizon: int = 30,
    lookback: int = 252,
    paths: int = 1000,
    ci: int = 80,
    drift_mode: str = "balanced",
) -> dict[str, Any]:
    """Monte Carlo (Geometric Brownian Motion) price forecast.

    Simulates `paths` price trajectories `horizon` trading days forward from the
    drift/volatility estimated over `lookback` days, then returns the median path,
    a `ci`% confidence band, probability of profit and bull/base/bear scenarios.
    A probabilistic model on delayed data — research/education only, not advice.
    """
    symbol = symbol.upper().strip()
    horizon = max(5, min(252, horizon))
    lookback = max(60, min(1000, lookback))
    paths = max(200, min(5000, paths))
    ci = max(50, min(99, ci))
    drift_damp = FORECAST_DRIFT_MODES.get(drift_mode, 0.5)
    resolved = _resolve_symbol(symbol)

    cache_key = f"{resolved}:{horizon}:{lookback}:{paths}:{ci}:{drift_mode}"
    cached = forecast_cache.get(cache_key)
    if cached is not None:
        return cached

    # Need enough daily history to cover the lookback window.
    period = "5y" if lookback > 480 else ("2y" if lookback > 230 else "1y")
    try:
        df = yf.Ticker(resolved, session=SESSION).history(period=period, interval="1d").dropna()
    except Exception as exc:  # noqa: BLE001
        logger.warning("forecast history failed for %s: %s", resolved, exc)
        raise HTTPException(status_code=502, detail="Upstream data error") from exc

    closes = df["Close"].to_numpy(dtype=float)
    if closes.size < 60:
        raise HTTPException(status_code=404, detail=f"Not enough history for {symbol}")

    window = closes[-lookback:]
    log_ret = np.diff(np.log(window))
    mu = float(np.mean(log_ret))
    var = float(np.var(log_ret))
    sigma = float(np.std(log_ret))
    last = float(closes[-1])

    # GBM drift term (Itô): mu - 0.5*var, damped by the selected mode.
    drift = (mu - 0.5 * var) * drift_damp

    rng = np.random.default_rng(abs(hash(resolved)) % (2**32))
    shocks = rng.standard_normal((horizon, paths))
    daily_factors = np.exp(drift + sigma * shocks)
    # Cumulative product down the days → price paths (horizon × paths).
    price_paths = last * np.cumprod(daily_factors, axis=0)

    lo_pct = (100 - ci) / 2
    hi_pct = 100 - lo_pct
    median = np.median(price_paths, axis=1)
    lower = np.percentile(price_paths, lo_pct, axis=1)
    upper = np.percentile(price_paths, hi_pct, axis=1)

    finals = price_paths[-1]
    prob_profit = float(np.mean(finals > last)) * 100
    exp_return = float(np.median(finals) / last - 1) * 100
    var5 = float(np.percentile(finals, 5) / last - 1) * 100  # 5% worst-case return
    ann_vol = sigma * math.sqrt(252) * 100

    bull = float(np.percentile(finals, hi_pct))
    base = float(np.median(finals))
    bear = float(np.percentile(finals, lo_pct))

    # A few sample paths for the "spaghetti" visual (downsample paths only).
    sample_idx = rng.choice(paths, size=min(15, paths), replace=False)
    samples = [[round(float(price_paths[d, j]), 2) for d in range(horizon)] for j in sample_idx]

    payload = {
        "symbol": resolved,
        "lastClose": round(last, 2),
        "horizonDays": horizon,
        "ci": ci,
        "lookback": lookback,
        "paths": paths,
        "driftMode": drift_mode,
        "history": [round(float(c), 2) for c in closes[-60:]],
        "median": [round(float(v), 2) for v in median],
        "upper": [round(float(v), 2) for v in upper],
        "lower": [round(float(v), 2) for v in lower],
        "samplePaths": samples,
        "probProfitPct": round(prob_profit, 1),
        "expectedReturnPct": round(exp_return, 2),
        "downside5Pct": round(var5, 2),
        "annualizedVolPct": round(ann_vol, 1),
        "scenarios": {
            "bull": {"price": round(bull, 2), "returnPct": round((bull / last - 1) * 100, 2)},
            "base": {"price": round(base, 2), "returnPct": round((base / last - 1) * 100, 2)},
            "bear": {"price": round(bear, 2), "returnPct": round((bear / last - 1) * 100, 2)},
        },
    }
    forecast_cache[cache_key] = payload
    return payload


# --- Options analytics (NSE option chain) ------------------------------------

_NSE_HEADERS = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "referer": "https://www.nseindia.com/option-chain",
}
_nse_session: Any = None


def _warm_nse_session() -> Any:
    """Create (or refresh) a cookie-primed NSE session via curl_cffi."""
    global _nse_session
    sess = curl_requests.Session(impersonate="chrome")
    sess.get("https://www.nseindia.com/", timeout=15)
    sess.get("https://www.nseindia.com/option-chain", timeout=15)
    _nse_session = sess
    return sess


def _nse_get_json(path: str) -> dict[str, Any]:
    """GET an NSE API path, returning parsed JSON. Re-warms cookies once on failure."""
    global _nse_session
    url = f"https://www.nseindia.com{path}"
    for attempt in range(2):
        sess = _nse_session or _warm_nse_session()
        try:
            res = sess.get(url, headers=_NSE_HEADERS, timeout=15)
            if res.status_code == 200:
                return res.json()
        except Exception as exc:  # noqa: BLE001
            logger.warning("NSE request error %s (attempt %s): %s", path, attempt, exc)
        _warm_nse_session()  # cookies likely stale; refresh and retry
    raise HTTPException(status_code=502, detail="NSE option chain unavailable")


def _oi_num(value: Any) -> float:
    out = _num(value)
    return out if out is not None else 0.0


# Risk-free rate used for Black-Scholes Greeks (approx. Indian short-term yield).
_RISK_FREE_RATE = 0.065
_NORM = NormalDist()


def _time_to_expiry_years(expiry: str) -> float:
    """Years until an NSE expiry string like '31-Jul-2025' (expiry 15:30 IST)."""
    try:
        exp = datetime.strptime(expiry, "%d-%b-%Y")
    except ValueError:
        return 7 / 365  # safe fallback (~weekly)
    # Expiry settles 15:30 IST == 10:00 UTC.
    exp = exp.replace(hour=10, minute=0, tzinfo=timezone.utc)
    seconds = (exp - datetime.now(timezone.utc)).total_seconds()
    # Floor at ~1 hour so expiry-day Greeks stay finite.
    return max(seconds, 3600) / (365 * 24 * 3600)


def _bs_greeks(
    option_type: str, spot: float | None, strike: float | None,
    iv_pct: float | None, t_years: float,
) -> dict[str, float | None]:
    """Black-Scholes Greeks. iv_pct is IV in percent (e.g. 14.2). Returns None on bad input."""
    empty = {"delta": None, "gamma": None, "theta": None, "vega": None}
    if not spot or not strike or not iv_pct or iv_pct <= 0 or spot <= 0 or strike <= 0 or t_years <= 0:
        return empty
    sigma = iv_pct / 100.0
    sqrt_t = math.sqrt(t_years)
    try:
        d1 = (math.log(spot / strike) + (_RISK_FREE_RATE + 0.5 * sigma * sigma) * t_years) / (sigma * sqrt_t)
    except (ValueError, ZeroDivisionError):
        return empty
    d2 = d1 - sigma * sqrt_t
    pdf_d1 = _NORM.pdf(d1)
    discount = math.exp(-_RISK_FREE_RATE * t_years)
    gamma = pdf_d1 / (spot * sigma * sqrt_t)
    vega = spot * pdf_d1 * sqrt_t / 100.0  # per 1% change in IV
    if option_type == "CE":
        delta = _NORM.cdf(d1)
        theta = (-(spot * pdf_d1 * sigma) / (2 * sqrt_t) - _RISK_FREE_RATE * strike * discount * _NORM.cdf(d2)) / 365.0
    else:
        delta = _NORM.cdf(d1) - 1.0
        theta = (-(spot * pdf_d1 * sigma) / (2 * sqrt_t) + _RISK_FREE_RATE * strike * discount * _NORM.cdf(-d2)) / 365.0
    return {
        "delta": round(delta, 4),
        "gamma": round(gamma, 6),
        "theta": round(theta, 2),
        "vega": round(vega, 2),
    }


def _oi_buildup(change_oi: float, price_pchange: float | None) -> str:
    """Classic OI-buildup read from change in OI vs change in price."""
    if price_pchange is None or change_oi == 0 or price_pchange == 0:
        return "neutral"
    if change_oi > 0:
        return "long_buildup" if price_pchange > 0 else "short_buildup"
    return "short_covering" if price_pchange > 0 else "long_unwinding"


@app.get("/option-chain")
def option_chain(symbol: str = "NIFTY", expiry: str | None = None, strikes_each_side: int = 15) -> dict[str, Any]:
    """NSE option chain + derived analytics (PCR, Max Pain, OI & IV by strike).

    Index symbols (NIFTY, BANKNIFTY, ...) use the Indices feed; everything else
    is treated as a stock (Equity feed). Data is delayed/snapshot — research only.
    `strikes_each_side` controls how many strikes above/below ATM are returned (5-50).
    """
    symbol = symbol.upper().strip()
    strikes_each_side = max(5, min(50, strikes_each_side))
    cache_key = f"{symbol}:{expiry or 'near'}:{strikes_each_side}"
    cached = option_chain_cache.get(cache_key)
    if cached is not None:
        return cached

    opt_type = "Indices" if symbol in INDEX_OPTION_SYMBOLS else "Equity"

    contract = _nse_get_json(f"/api/option-chain-contract-info?symbol={symbol}")
    expiries: list[str] = contract.get("expiryDates", []) or []
    if not expiries:
        raise HTTPException(status_code=404, detail=f"No option contracts for {symbol}")
    selected = expiry if expiry in expiries else expiries[0]

    chain = _nse_get_json(
        f"/api/option-chain-v3?type={opt_type}&symbol={symbol}&expiry={selected}"
    )
    records = chain.get("records", {})
    underlying = _num(records.get("underlyingValue"))
    raw_rows = [r for r in records.get("data", []) if r.get("strikePrice") is not None]

    t_years = _time_to_expiry_years(selected)

    # Build per-strike CE/PE structure.
    strikes: list[dict[str, Any]] = []
    total_ce_oi = 0.0
    total_pe_oi = 0.0
    for r in raw_rows:
        ce = r.get("CE") or {}
        pe = r.get("PE") or {}
        ce_oi = _oi_num(ce.get("openInterest"))
        pe_oi = _oi_num(pe.get("openInterest"))
        total_ce_oi += ce_oi
        total_pe_oi += pe_oi
        strike_val = _num(r.get("strikePrice"))
        ce_iv = _num(ce.get("impliedVolatility"))
        pe_iv = _num(pe.get("impliedVolatility"))
        ce_change_oi = round(_oi_num(ce.get("changeinOpenInterest")), 2)
        pe_change_oi = round(_oi_num(pe.get("changeinOpenInterest")), 2)
        strikes.append({
            "strike": strike_val,
            "ce": {
                "oi": round(ce_oi, 2),
                "changeOi": ce_change_oi,
                "volume": int(_oi_num(ce.get("totalTradedVolume"))),
                "iv": ce_iv,
                "ltp": _num(ce.get("lastPrice")),
                "buildup": _oi_buildup(ce_change_oi, _num(ce.get("pChange"))),
                "greeks": _bs_greeks("CE", underlying, strike_val, ce_iv, t_years),
            },
            "pe": {
                "oi": round(pe_oi, 2),
                "changeOi": pe_change_oi,
                "volume": int(_oi_num(pe.get("totalTradedVolume"))),
                "iv": pe_iv,
                "ltp": _num(pe.get("lastPrice")),
                "buildup": _oi_buildup(pe_change_oi, _num(pe.get("pChange"))),
                "greeks": _bs_greeks("PE", underlying, strike_val, pe_iv, t_years),
            },
        })

    strikes.sort(key=lambda s: s["strike"] or 0)

    # Put/Call ratio (by open interest).
    pcr = round(total_pe_oi / total_ce_oi, 2) if total_ce_oi else None

    # Max Pain: the strike where total option-writer payout is minimized.
    max_pain = None
    if strikes:
        best_loss = None
        for cand in strikes:
            s_price = cand["strike"]
            if s_price is None:
                continue
            loss = 0.0
            for row in strikes:
                k = row["strike"]
                if k is None:
                    continue
                if k < s_price:
                    loss += row["ce"]["oi"] * (s_price - k)
                elif k > s_price:
                    loss += row["pe"]["oi"] * (k - s_price)
            if best_loss is None or loss < best_loss:
                best_loss = loss
                max_pain = s_price

    # OI walls (support/resistance): strikes carrying the most put/call OI.
    support = max(strikes, key=lambda s: s["pe"]["oi"], default=None)
    resistance = max(strikes, key=lambda s: s["ce"]["oi"], default=None)
    support_strike = support["strike"] if support else None
    resistance_strike = resistance["strike"] if resistance else None

    # ATM strike (closest to underlying) + a display window around it.
    atm_strike = None
    atm_row = None
    if underlying is not None and strikes:
        atm_row = min(strikes, key=lambda s: abs((s["strike"] or 0) - underlying))
        atm_strike = atm_row["strike"]
        atm_idx = next((i for i, s in enumerate(strikes) if s["strike"] == atm_strike), 0)
        lo = max(0, atm_idx - strikes_each_side)
        hi = min(len(strikes), atm_idx + strikes_each_side + 1)
        window = strikes[lo:hi]
    else:
        window = strikes

    # ATM straddle premium (CE + PE LTP at the ATM strike).
    atm_straddle = None
    if atm_row is not None:
        ce_ltp = atm_row["ce"]["ltp"]
        pe_ltp = atm_row["pe"]["ltp"]
        if ce_ltp is not None and pe_ltp is not None:
            atm_straddle = round(ce_ltp + pe_ltp, 2)

    # Max-pain payoff curve (writer loss at each strike in the window) for charting.
    max_pain_curve = []
    for cand in window:
        s_price = cand["strike"]
        if s_price is None:
            continue
        loss = 0.0
        for row in strikes:
            k = row["strike"]
            if k is None:
                continue
            if k < s_price:
                loss += row["ce"]["oi"] * (s_price - k)
            elif k > s_price:
                loss += row["pe"]["oi"] * (k - s_price)
        max_pain_curve.append({"strike": s_price, "loss": round(loss, 0)})

    payload = {
        "symbol": symbol,
        "type": opt_type,
        "underlying": underlying,
        "expiry": selected,
        "expiries": expiries,
        "atmStrike": atm_strike,
        "pcr": pcr,
        "maxPain": max_pain,
        "daysToExpiry": round(t_years * 365, 1),
        "support": support_strike,
        "resistance": resistance_strike,
        "atmStraddle": atm_straddle,
        "totalCeOi": round(total_ce_oi, 2),
        "totalPeOi": round(total_pe_oi, 2),
        "maxPainCurve": max_pain_curve,
        "strikes": window,
    }
    option_chain_cache[cache_key] = payload
    return payload
