"""
Pluggable market-data providers + proxy support.

Why this exists
---------------
Yahoo Finance (yfinance) aggressively rate-limits / blocks requests from cloud
datacenter IPs (e.g. Render). `get_info()` is the worst-hit call, which makes
the /fundamentals and /screener endpoints flaky in production while working fine
from a home IP.

This module provides two complementary, fully-optional fixes — both grounded in
how the yfinance community works around datacenter blocking:

1. PROXY SUPPORT (`make_session`): route every yfinance request through an
   HTTP(S) proxy you trust (residential/allowed). One env var fixes ALL
   endpoints (movers, heatmap, history, quotes, fundamentals…).

2. ALTERNATE FUNDAMENTALS PROVIDER (`fetch_fundamentals_chain`): a configurable
   fallback chain. If you set an API key for Financial Modeling Prep (FMP), the
   service uses FMP first for company fundamentals and falls back to yfinance.
   FMP's profile/ratios endpoints are available worldwide (incl. NSE `.NS`) and
   work from cloud IPs.

Everything degrades gracefully: with no env config, behaviour is unchanged
(yfinance only, no proxy).

Configuration (env)
-------------------
    MARKET_PROXY            single proxy applied to http+https (e.g. http://user:pass@host:port)
    MARKET_HTTP_PROXY       override http proxy only
    MARKET_HTTPS_PROXY      override https proxy only
    FUNDAMENTALS_PROVIDERS  comma list, order = fallback (default "yfinance"); e.g. "fmp,yfinance"
    FMP_API_KEY             Financial Modeling Prep API key (enables the "fmp" provider)
"""

from __future__ import annotations

import logging
import os
from typing import Any, Callable

from curl_cffi import requests as curl_requests

logger = logging.getLogger("market-service.providers")

FMP_BASE = "https://financialmodelingprep.com/stable"
HTTP_TIMEOUT = 12


# --- Proxy / session ---------------------------------------------------------

def _proxies_from_env() -> dict[str, str]:
    single = os.getenv("MARKET_PROXY", "").strip()
    http_proxy = os.getenv("MARKET_HTTP_PROXY", "").strip() or single
    https_proxy = os.getenv("MARKET_HTTPS_PROXY", "").strip() or single
    proxies: dict[str, str] = {}
    if http_proxy:
        proxies["http"] = http_proxy
    if https_proxy:
        proxies["https"] = https_proxy
    return proxies


def make_session() -> curl_requests.Session:
    """A Chrome-impersonating session, optionally routed through a proxy."""
    session = curl_requests.Session(impersonate="chrome")
    proxies = _proxies_from_env()
    if proxies:
        session.proxies.update(proxies)
        logger.info("market-service: using proxy for upstream requests")
    return session


def proxy_status() -> dict[str, Any]:
    proxies = _proxies_from_env()
    return {"enabled": bool(proxies), "scopes": sorted(proxies.keys())}


# --- Helpers -----------------------------------------------------------------

def _num(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _pct(value: Any) -> float | None:
    out = _num(value)
    return None if out is None else round(out * 100, 2)


def get_fundamentals_providers() -> list[str]:
    raw = os.getenv("FUNDAMENTALS_PROVIDERS", "yfinance")
    names = [p.strip().lower() for p in raw.split(",") if p.strip()]
    return names or ["yfinance"]


def get_quotes_providers() -> list[str]:
    raw = os.getenv("QUOTES_PROVIDERS", "yfinance")
    names = [p.strip().lower() for p in raw.split(",") if p.strip()]
    return names or ["yfinance"]


def get_history_providers() -> list[str]:
    raw = os.getenv("HISTORY_PROVIDERS", "yfinance")
    names = [p.strip().lower() for p in raw.split(",") if p.strip()]
    return names or ["yfinance"]


# --- Financial Modeling Prep (FMP) provider ----------------------------------

def fmp_enabled() -> bool:
    return bool(os.getenv("FMP_API_KEY", "").strip())


_FMP_SESSION = curl_requests.Session()


def _fmp_get(path: str, symbol: str) -> Any | None:
    key = os.getenv("FMP_API_KEY", "").strip()
    if not key:
        return None
    try:
        resp = _FMP_SESSION.get(
            f"{FMP_BASE}/{path}",
            params={"symbol": symbol, "apikey": key},
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code != 200:
            logger.warning("FMP %s for %s -> HTTP %s", path, symbol, resp.status_code)
            return None
        return resp.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("FMP %s for %s failed: %s", path, symbol, exc)
        return None


def _parse_range(value: Any) -> tuple[float | None, float | None]:
    """FMP profile `range` is a "low-high" string, e.g. "1234.5-2345.6"."""
    if not isinstance(value, str) or "-" not in value:
        return None, None
    try:
        lo_s, hi_s = value.split("-", 1)
        return _num(lo_s), _num(hi_s)
    except Exception:  # noqa: BLE001
        return None, None


def fetch_fmp_fundamentals(resolved_symbol: str, display_symbol: str) -> dict[str, Any] | None:
    """Build the standard fundamentals payload from FMP (profile + ratios-ttm)."""
    profile_arr = _fmp_get("profile", resolved_symbol)
    if not isinstance(profile_arr, list) or not profile_arr:
        return None
    p = profile_arr[0]
    price = _num(p.get("price"))
    if price is None:
        return None  # let the chain fall back

    ratios_arr = _fmp_get("ratios-ttm", resolved_symbol)
    r = ratios_arr[0] if isinstance(ratios_arr, list) and ratios_arr else {}

    low52, high52 = _parse_range(p.get("range"))
    change = _num(p.get("change"))
    change_pct = _num(p.get("changePercentage"))
    prev_close = round(price - change, 2) if (price is not None and change is not None) else None

    div_yield = _pct(r.get("dividendYieldTTM"))

    payload: dict[str, Any] = {
        "symbol": resolved_symbol,
        "name": p.get("companyName") or display_symbol.upper(),
        "exchange": p.get("exchange") or p.get("exchangeShortName"),
        "currency": p.get("currency", "INR"),
        "sector": p.get("sector"),
        "industry": p.get("industry"),
        "website": p.get("website"),
        "summary": p.get("description"),
        "price": price,
        "previousClose": prev_close,
        "change": round(change, 2) if change is not None else None,
        "changePercent": round(change_pct, 2) if change_pct is not None else None,
        "dayHigh": None,
        "dayLow": None,
        "fiftyTwoWeekHigh": high52,
        "fiftyTwoWeekLow": low52,
        "metrics": {
            "marketCap": _num(p.get("marketCap")),
            "enterpriseValue": _num(r.get("enterpriseValueMultipleTTM")),
            "trailingPE": _num(r.get("priceToEarningsRatioTTM")) or _num(r.get("peRatioTTM")),
            "forwardPE": None,
            "priceToBook": _num(r.get("priceToBookRatioTTM")) or _num(r.get("pbRatioTTM")),
            "pegRatio": _num(r.get("priceToEarningsGrowthRatioTTM")) or _num(r.get("pegRatioTTM")),
            "eps": _num(r.get("netIncomePerShareTTM")),
            "beta": _num(p.get("beta")),
            "dividendYield": div_yield,
            "bookValue": _num(r.get("bookValuePerShareTTM")),
            "roe": _pct(r.get("returnOnEquityTTM")),
            "roa": _pct(r.get("returnOnAssetsTTM")),
            "profitMargin": _pct(r.get("netProfitMarginTTM")),
            "operatingMargin": _pct(r.get("operatingProfitMarginTTM")),
            "revenue": None,
            "grossProfit": None,
            "ebitda": None,
            "debtToEquity": _num(r.get("debtToEquityRatioTTM")) or _num(r.get("debtEquityRatioTTM")),
            "currentRatio": _num(r.get("currentRatioTTM")),
            "revenueGrowth": None,
            "earningsGrowth": None,
        },
        "analyst": {
            "recommendation": None,
            "targetMean": None,
            "targetHigh": None,
            "targetLow": None,
            "numberOfAnalysts": None,
        },
        "_provider": "fmp",
    }
    return payload


# --- FMP quote / history (EOD) providers -------------------------------------

def fetch_fmp_quote(resolved_symbol: str, raw_symbol: str) -> dict[str, Any] | None:
    """Build the /quotes payload from FMP end-of-day light history (1 call).

    EOD data has no intraday open/high/low, so those are left None. Provides
    last price, day change, 52-week range, volume and a closing sparkline.
    """
    items = _fmp_get("historical-price-eod/light", resolved_symbol)
    if not isinstance(items, list) or len(items) < 2:
        return None
    # FMP returns most-recent first.
    prices = [_num(it.get("price")) for it in items if _num(it.get("price")) is not None]
    if len(prices) < 2:
        return None
    last = prices[0]
    prev = prices[1]
    change = round(last - prev, 2)
    change_pct = round((change / prev) * 100, 2) if prev else 0.0
    window = prices[:252]
    spark = [round(p, 2) for p in reversed(prices[:30])]
    return {
        "symbol": resolved_symbol,
        "available": True,
        "price": round(last, 2),
        "open": None,
        "dayHigh": None,
        "dayLow": None,
        "previousClose": round(prev, 2),
        "change": change,
        "changePercent": change_pct,
        "volume": int(_num(items[0].get("volume")) or 0),
        "week52High": round(max(window), 2),
        "week52Low": round(min(window), 2),
        "sparkline": spark,
        "_provider": "fmp",
    }


def fetch_fmp_simple_quote(resolved_symbol: str) -> dict[str, Any] | None:
    """Minimal quote (symbol/price/change/changePercent/currency) from FMP EOD."""
    q = fetch_fmp_quote(resolved_symbol, resolved_symbol)
    if not q:
        return None
    return {
        "symbol": resolved_symbol,
        "price": q["price"],
        "change": q["change"],
        "changePercent": q["changePercent"],
        "currency": "INR",
    }


def fetch_fmp_history(resolved_symbol: str, max_points: int) -> list[dict[str, Any]] | None:
    """OHLC candles (ascending) from FMP full EOD history, trimmed to max_points."""
    items = _fmp_get("historical-price-eod/full", resolved_symbol)
    if not isinstance(items, list) or not items:
        return None
    candles: list[dict[str, Any]] = []
    for it in items:  # most-recent first
        o, h, l, c = _num(it.get("open")), _num(it.get("high")), _num(it.get("low")), _num(it.get("close"))
        date = it.get("date")
        if None in (o, h, l, c) or not date:
            continue
        candles.append({
            "time": str(date)[:10],
            "open": round(o, 2),
            "high": round(h, 2),
            "low": round(l, 2),
            "close": round(c, 2),
            "volume": int(_num(it.get("volume")) or 0),
        })
    if not candles:
        return None
    candles.reverse()  # ascending by date
    if max_points and len(candles) > max_points:
        candles = candles[-max_points:]
    return candles


# --- Orchestration -----------------------------------------------------------

def fetch_fundamentals_chain(
    resolved_symbol: str,
    display_symbol: str,
    yfinance_fetch: Callable[[str, str], dict[str, Any] | None],
) -> dict[str, Any] | None:
    """Try providers in configured order; return the first non-empty payload.

    `yfinance_fetch(resolved, display)` is supplied by main.py so this module
    stays free of yfinance-specific mapping/caching concerns.
    """
    for provider in get_fundamentals_providers():
        try:
            if provider == "fmp":
                if not fmp_enabled():
                    continue
                payload = fetch_fmp_fundamentals(resolved_symbol, display_symbol)
            elif provider == "yfinance":
                payload = yfinance_fetch(resolved_symbol, display_symbol)
            else:
                logger.warning("Unknown fundamentals provider '%s' — skipping", provider)
                continue
            if payload:
                return payload
        except Exception as exc:  # noqa: BLE001
            logger.warning("provider '%s' failed for %s: %s", provider, resolved_symbol, exc)
    return None


def fetch_quote_chain(
    resolved_symbol: str,
    raw_symbol: str,
    yfinance_fetch: Callable[[str, str], dict[str, Any] | None],
) -> dict[str, Any] | None:
    """Batch-quote payload via the QUOTES_PROVIDERS chain."""
    for provider in get_quotes_providers():
        try:
            if provider == "fmp":
                if not fmp_enabled():
                    continue
                payload = fetch_fmp_quote(resolved_symbol, raw_symbol)
            elif provider == "yfinance":
                payload = yfinance_fetch(resolved_symbol, raw_symbol)
            else:
                logger.warning("Unknown quotes provider '%s' — skipping", provider)
                continue
            if payload:
                return payload
        except Exception as exc:  # noqa: BLE001
            logger.warning("quotes provider '%s' failed for %s: %s", provider, resolved_symbol, exc)
    return None


def fetch_simple_quote_chain(
    resolved_symbol: str,
    yfinance_fetch: Callable[[str], dict[str, Any] | None],
) -> dict[str, Any] | None:
    """Minimal quote via the QUOTES_PROVIDERS chain (for /quote)."""
    for provider in get_quotes_providers():
        try:
            if provider == "fmp":
                if not fmp_enabled():
                    continue
                payload = fetch_fmp_simple_quote(resolved_symbol)
            elif provider == "yfinance":
                payload = yfinance_fetch(resolved_symbol)
            else:
                continue
            if payload:
                return payload
        except Exception as exc:  # noqa: BLE001
            logger.warning("quote provider '%s' failed for %s: %s", provider, resolved_symbol, exc)
    return None


def fetch_history_chain(
    resolved_symbol: str,
    max_points: int,
    yfinance_fetch: Callable[[str], list[dict[str, Any]] | None],
) -> list[dict[str, Any]] | None:
    """OHLC candles via the HISTORY_PROVIDERS chain."""
    for provider in get_history_providers():
        try:
            if provider == "fmp":
                if not fmp_enabled():
                    continue
                candles = fetch_fmp_history(resolved_symbol, max_points)
            elif provider == "yfinance":
                candles = yfinance_fetch(resolved_symbol)
            else:
                logger.warning("Unknown history provider '%s' — skipping", provider)
                continue
            if candles:
                return candles
        except Exception as exc:  # noqa: BLE001
            logger.warning("history provider '%s' failed for %s: %s", provider, resolved_symbol, exc)
    return None
