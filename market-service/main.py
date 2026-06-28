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
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Any
import yfinance as yf
from cachetools import TTLCache
from curl_cffi import requests as curl_requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("market-service")

# Browser-impersonating session so Yahoo Finance does not block requests.
SESSION = curl_requests.Session(impersonate="chrome")

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
    """Return a normalized quote dict for a Yahoo symbol, or None on failure."""
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
def health() -> dict[str, str]:
    return {"status": "ok"}


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
    """Cached fundamentals fetch. Returns the payload dict, or None on failure.

    Shared by the /fundamentals endpoint and the /screener batch endpoint.
    """
    resolved = _resolve_symbol(symbol)
    if resolved in fundamentals_cache:
        return fundamentals_cache[resolved]

    try:
        info = yf.Ticker(resolved, session=SESSION).get_info()
    except Exception as exc:  # noqa: BLE001
        logger.warning("get_info failed for %s: %s", resolved, exc)
        return None

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
    }

    fundamentals_cache[resolved] = payload
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

    try:
        df = yf.Ticker(resolved, session=SESSION).history(
            period=period, interval=interval
        ).dropna()
    except Exception as exc:  # noqa: BLE001
        logger.warning("history failed for %s: %s", resolved, exc)
        raise HTTPException(status_code=502, detail="Upstream data error") from exc

    if df.empty:
        raise HTTPException(status_code=404, detail=f"No history for {symbol}")

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

    payload = {"symbol": resolved, "range": range, "candles": candles}
    history_cache[cache_key] = payload
    return payload


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

        try:
            df = yf.Ticker(resolved, session=SESSION).history(
                period="1y", interval="1d"
            ).dropna()
        except Exception as exc:  # noqa: BLE001
            logger.warning("quote failed for %s: %s", resolved, exc)
            df = None

        if df is None or df.empty:
            results.append({"requested": raw, "symbol": resolved, "available": False})
            continue

        closes = df["Close"].tolist()
        last = df.iloc[-1]
        price = round(float(last["Close"]), 2)
        prev_close = round(float(df.iloc[-2]["Close"]), 2) if len(df) > 1 else price
        change = round(price - prev_close, 2)
        change_pct = round((change / prev_close) * 100, 2) if prev_close else 0.0
        spark = [round(float(c), 2) for c in closes[-30:]]

        payload = {
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
        }
        quotes_cache[resolved] = payload
        results.append({**payload, "requested": raw})

    return {"quotes": results}


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

    with ThreadPoolExecutor(max_workers=8) as pool:
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


@app.get("/option-chain")
def option_chain(symbol: str = "NIFTY", expiry: str | None = None) -> dict[str, Any]:
    """NSE option chain + derived analytics (PCR, Max Pain, OI & IV by strike).

    Index symbols (NIFTY, BANKNIFTY, ...) use the Indices feed; everything else
    is treated as a stock (Equity feed). Data is delayed/snapshot — research only.
    """
    symbol = symbol.upper().strip()
    cache_key = f"{symbol}:{expiry or 'near'}"
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
        strikes.append({
            "strike": _num(r.get("strikePrice")),
            "ce": {
                "oi": round(ce_oi, 2),
                "changeOi": round(_oi_num(ce.get("changeinOpenInterest")), 2),
                "volume": int(_oi_num(ce.get("totalTradedVolume"))),
                "iv": _num(ce.get("impliedVolatility")),
                "ltp": _num(ce.get("lastPrice")),
            },
            "pe": {
                "oi": round(pe_oi, 2),
                "changeOi": round(_oi_num(pe.get("changeinOpenInterest")), 2),
                "volume": int(_oi_num(pe.get("totalTradedVolume"))),
                "iv": _num(pe.get("impliedVolatility")),
                "ltp": _num(pe.get("lastPrice")),
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

    # ATM strike (closest to underlying) + a display window around it.
    atm_strike = None
    if underlying is not None and strikes:
        atm_strike = min(strikes, key=lambda s: abs((s["strike"] or 0) - underlying))["strike"]
        atm_idx = next((i for i, s in enumerate(strikes) if s["strike"] == atm_strike), 0)
        lo = max(0, atm_idx - 15)
        hi = min(len(strikes), atm_idx + 16)
        window = strikes[lo:hi]
    else:
        window = strikes

    payload = {
        "symbol": symbol,
        "type": opt_type,
        "underlying": underlying,
        "expiry": selected,
        "expiries": expiries,
        "atmStrike": atm_strike,
        "pcr": pcr,
        "maxPain": max_pain,
        "totalCeOi": round(total_ce_oi, 2),
        "totalPeOi": round(total_pe_oi, 2),
        "strikes": window,
    }
    option_chain_cache[cache_key] = payload
    return payload
