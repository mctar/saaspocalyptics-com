#!/usr/bin/env python3
"""Fetch SaaSpocalyptics market data and write the superset market.json.

Pulls every tracked ticker plus the benchmarks in ONE batched yf.download call
(curl_cffi browser impersonation, when installed, keeps Yahoo from throttling),
then derives:
  * per-company YTD metrics + sparkline (as before),
  * a `history` series — per-trading-day cross-sectional aggregates (median YTD,
    share above water, per-bucket medians) plus benchmark YTD lines, which powers
    the .com recovery-arc chart,
  * `fundamentals` per company (revenue growth, operating margin, rule-of-40),
    refreshed at most once a day and cached on disk so the frequent price runs
    don't hammer Yahoo's heavier endpoints.

The same file feeds both sites: the btrbot UI reads only `buckets`; the .com UI
also reads `history`/`benchmarks`/`fundamentals`. Extra keys are harmless to the
older UI.

Usage:
  python data/fetch.py                 # prices + history (+ fundamentals if cache stale)
  python data/fetch.py --dry-run       # fetch + summary, don't write
  python data/fetch.py --no-fundamentals  # skip the daily fundamentals refresh
  python data/fetch.py --fundamentals-only # only refresh the fundamentals cache
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

# yfinance auto-selects curl_cffi when it's importable, but its bundled TLS lib
# is broken on hugin's aarch64 Linux (every request fails). Hide curl_cffi so
# yfinance uses plain requests. A single batched download a few times a day is
# gentle enough on Yahoo without browser impersonation.
sys.modules["curl_cffi"] = None  # type: ignore[assignment]

try:
    import yfinance as yf
    import pandas as pd
except ImportError:
    sys.exit("deps missing. Run: pip install -r data/requirements.txt")

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
TICKERS_FILE = HERE / "tickers.yaml"
OUTPUT_FILE = ROOT / "public" / "data" / "market.json"
FUND_CACHE = HERE / "fundamentals_cache.json"

SPARKLINE_POINTS = 40
HISTORY_POINTS = 90          # downsample the arc series to keep market.json small
MIN_OK_RATIO = 0.8           # safety valve: refuse to publish a gutted dataset


# --------------------------------------------------------------------------- #
# config + small helpers
# --------------------------------------------------------------------------- #
def load_config() -> dict:
    with open(TICKERS_FILE) as f:
        return yaml.safe_load(f)


def pct(frm: float, to: float) -> float:
    return round((to - frm) / frm * 100, 2) if frm else 0.0


def downsample(values: list, target: int) -> list:
    n = len(values)
    if n <= target:
        return values
    step = (n - 1) / (target - 1)
    idx = sorted({round(i * step) for i in range(target)})
    return [values[i] for i in idx]


def median(values: list[float]) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    mid = len(s) // 2
    return s[mid] if len(s) % 2 else (s[mid - 1] + s[mid]) / 2


# --------------------------------------------------------------------------- #
# batched price download
# --------------------------------------------------------------------------- #
def download_closes(symbols: list[str], start: str) -> dict[str, "pd.Series"]:
    """One batched request for all symbols. Returns {symbol: close Series} for
    symbols that came back with usable data; missing/empty ones are dropped."""
    df = yf.download(
        symbols,
        start=start,
        interval="1d",
        auto_adjust=True,
        group_by="ticker",
        threads=True,
        progress=False,
    )
    out: dict[str, pd.Series] = {}
    for sym in symbols:
        try:
            s = df[sym]["Close"] if len(symbols) > 1 else df["Close"]
        except (KeyError, TypeError):
            continue
        s = s.dropna()
        if len(s) >= 2:
            s.index = s.index.tz_localize(None).normalize()
            out[sym] = s
    return out


# --------------------------------------------------------------------------- #
# fundamentals (daily-cached)
# --------------------------------------------------------------------------- #
def load_fund_cache() -> dict:
    if FUND_CACHE.exists():
        try:
            return json.loads(FUND_CACHE.read_text())
        except Exception:
            pass
    return {"date": "", "data": {}}


def refresh_fundamentals(tickers: list[str], today: str) -> dict:
    """Pull revenue growth / operating margin / rule-of-40 per ticker. Heavy
    (one .info call each), so this runs at most once a day; the cache carries it
    between price runs. Per-ticker failures are skipped, not fatal."""
    cache = load_fund_cache()
    if cache.get("date") == today and cache.get("data"):
        print(f"  fundamentals: cache is current ({today}), skipping refresh")
        return cache["data"]

    print(f"  fundamentals: refreshing {len(tickers)} names…")
    data: dict[str, dict] = {}
    for t in tickers:
        try:
            info = yf.Ticker(t).info
        except Exception:
            continue
        rev_growth = info.get("revenueGrowth")       # YoY, fraction
        op_margin = info.get("operatingMargins")      # fraction
        if rev_growth is None and op_margin is None:
            continue
        entry = {}
        if rev_growth is not None:
            entry["revenueGrowthPct"] = round(rev_growth * 100, 1)
        if op_margin is not None:
            entry["operatingMarginPct"] = round(op_margin * 100, 1)
        if rev_growth is not None and op_margin is not None:
            entry["ruleOf40"] = round((rev_growth + op_margin) * 100, 1)
        if info.get("marketCap"):
            entry["marketCap"] = info["marketCap"]
        data[t] = entry

    FUND_CACHE.write_text(json.dumps({"date": today, "data": data}, indent=2))
    print(f"  fundamentals: cached {len(data)}/{len(tickers)}")
    return data


# --------------------------------------------------------------------------- #
# history (cross-sectional aggregates per trading day)
# --------------------------------------------------------------------------- #
def build_history(
    company_series: dict[str, "pd.Series"],
    bucket_of: dict[str, str],
    bench_series: dict[str, "pd.Series"],
) -> list[dict]:
    """For each trading day on the union calendar, compute the cross-sectional
    median YTD, share above water, and per-bucket medians, plus benchmark YTD."""
    if not company_series:
        return []

    spine = sorted(set().union(*[set(s.index) for s in company_series.values()]))
    spine = pd.DatetimeIndex(spine)

    # Forward-fill each series onto the common spine; YTD vs its own first close.
    ytd: dict[str, pd.Series] = {}
    for sym, s in company_series.items():
        r = s.reindex(spine).ffill()
        base = s.iloc[0]
        ytd[sym] = (r / base - 1.0) * 100.0

    bench_ytd: dict[str, pd.Series] = {}
    for sym, s in bench_series.items():
        r = s.reindex(spine).ffill()
        bench_ytd[sym] = (r / s.iloc[0] - 1.0) * 100.0

    rows = []
    for d in spine:
        vals = [ytd[sym][d] for sym in ytd if pd.notna(ytd[sym][d])]
        if not vals:
            continue
        by_bucket: dict[str, list[float]] = {}
        for sym in ytd:
            v = ytd[sym][d]
            if pd.notna(v):
                by_bucket.setdefault(bucket_of[sym], []).append(v)
        entry = {
            "date": d.strftime("%Y-%m-%d"),
            "medianYtd": round(median(vals), 2),
            "pctUp": round(sum(1 for v in vals if v >= 0) / len(vals) * 100, 1),
            "buckets": {k: round(median(v), 2) for k, v in by_bucket.items()},
        }
        for sym, key in (("IGV", "igvYtd"), ("^GSPC", "spxYtd")):
            if sym in bench_ytd and pd.notna(bench_ytd[sym][d]):
                entry[key] = round(bench_ytd[sym][d], 2)
        rows.append(entry)

    return downsample(rows, HISTORY_POINTS)


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch SaaSpocalyptics market data.")
    parser.add_argument("--dry-run", action="store_true", help="don't write the file")
    parser.add_argument("--no-fundamentals", action="store_true", help="skip fundamentals")
    parser.add_argument("--fundamentals-only", action="store_true", help="only refresh cache")
    args = parser.parse_args()

    config = load_config()
    ytd_start = config.get("meta", {}).get("ytd_start", "2026-01-01")
    buckets_cfg = config["buckets"]
    benchmarks = config.get("benchmarks", [])
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    company_members = [m for b in buckets_cfg.values() for m in b.get("members", [])]
    company_tickers = [m["ticker"] for m in company_members]
    bench_tickers = [b["ticker"] for b in benchmarks]

    if args.fundamentals_only:
        refresh_fundamentals(company_tickers, today)
        return

    # One batched request for everything.
    print(f"Batched download: {len(company_tickers)} names + {len(bench_tickers)} benchmarks…")
    series = download_closes(company_tickers + bench_tickers, ytd_start)
    company_series = {t: series[t] for t in company_tickers if t in series}
    bench_series = {t: series[t] for t in bench_tickers if t in series}

    bucket_of = {m["ticker"]: key for key, b in buckets_cfg.items() for m in b.get("members", [])}
    fundamentals = {} if args.no_fundamentals else refresh_fundamentals(company_tickers, today)

    out_buckets: dict[str, dict] = {}
    total, ok = 0, 0
    for key, bucket in buckets_cfg.items():
        rows = []
        for m in bucket.get("members", []):
            total += 1
            s = company_series.get(m["ticker"])
            if s is None:
                print(f"  ! {m['ticker']:<8} no data, skipping", file=sys.stderr)
                continue
            ok += 1
            closes = [round(float(c), 4) for c in s.tolist()]
            row = {
                "ticker": m["ticker"],
                "name": m["name"],
                "currency": m.get("currency", "USD"),
                "baseline": round(closes[0], 2),
                "last": round(closes[-1], 2),
                "lastDate": s.index[-1].strftime("%Y-%m-%d"),
                "ytdPct": pct(closes[0], closes[-1]),
                "fromHighPct": pct(max(closes), closes[-1]),
                "fromLowPct": pct(min(closes), closes[-1]),
                "sparkline": downsample(closes, SPARKLINE_POINTS),
            }
            if m["ticker"] in fundamentals:
                row["fundamentals"] = fundamentals[m["ticker"]]
            rows.append(row)
        rows.sort(key=lambda r: r["ytdPct"])
        out_buckets[key] = {
            "label": bucket.get("label", key),
            "blurb": bucket.get("blurb", ""),
            "members": rows,
        }

    print(f"\nFetched {ok}/{total} tickers, {len(bench_series)}/{len(bench_tickers)} benchmarks.")

    if total == 0 or ok / total < MIN_OK_RATIO:
        sys.exit(
            f"error: only {ok}/{total} tickers resolved (< {MIN_OK_RATIO:.0%}). "
            "Refusing to overwrite last-good data — likely a rate limit; retry later."
        )

    history = build_history(company_series, bucket_of, bench_series)
    print(f"History: {len(history)} points.")

    payload = {
        "asOf": today,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "baselineDate": ytd_start,
        "buckets": out_buckets,
        "benchmarks": [{"ticker": b["ticker"], "name": b["name"]} for b in benchmarks
                       if b["ticker"] in bench_series],
        "history": history,
    }

    if args.dry_run:
        print("(dry run — not writing)")
        return

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"Wrote {OUTPUT_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
