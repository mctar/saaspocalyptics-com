#!/usr/bin/env python3
"""Fetch YTD daily prices for the SaaSpocalyptics universe and write market.json.

Reads data/tickers.yaml, pulls daily history from the YTD baseline to today via
yfinance, computes per-company performance metrics, and writes the static artifact
the React app consumes at public/data/market.json.

Tickers that return no data are logged and skipped — a bad symbol or a closed
foreign market degrades gracefully instead of failing the whole run.

Usage:
    python data/fetch.py            # fetch everything, write market.json
    python data/fetch.py --dry-run  # fetch and print a summary, don't write
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

try:
    import yfinance as yf
except ImportError:
    sys.exit("yfinance not installed. Run: pip install -r data/requirements.txt")

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
TICKERS_FILE = HERE / "tickers.yaml"
OUTPUT_FILE = ROOT / "public" / "data" / "market.json"

# Number of points to keep in each row's sparkline. Downsampled evenly from the
# full daily series to keep market.json small while preserving the shape.
SPARKLINE_POINTS = 40


def load_config() -> dict:
    with open(TICKERS_FILE) as f:
        return yaml.safe_load(f)


def downsample(values: list[float], target: int) -> list[float]:
    """Evenly pick ~target points from values, always keeping first and last."""
    n = len(values)
    if n <= target:
        return [round(v, 4) for v in values]
    step = (n - 1) / (target - 1)
    idx = sorted({round(i * step) for i in range(target)})
    return [round(values[i], 4) for i in idx]


def fetch_one(ticker: str, name: str, currency: str, start: str) -> dict | None:
    """Return metrics for one ticker, or None if no usable data."""
    try:
        hist = yf.Ticker(ticker).history(start=start, auto_adjust=True, interval="1d")
    except Exception as exc:  # network / parsing / unknown symbol
        print(f"  ! {ticker:<8} fetch error: {exc}", file=sys.stderr)
        return None

    if hist is None or hist.empty or "Close" not in hist:
        print(f"  ! {ticker:<8} no data, skipping", file=sys.stderr)
        return None

    closes = [float(c) for c in hist["Close"].dropna().tolist()]
    if len(closes) < 2:
        print(f"  ! {ticker:<8} too few points ({len(closes)}), skipping", file=sys.stderr)
        return None

    baseline = closes[0]
    last = closes[-1]
    high = max(closes)
    low = min(closes)
    last_date = hist.index[-1].strftime("%Y-%m-%d")

    def pct(frm: float, to: float) -> float:
        return round((to - frm) / frm * 100, 2) if frm else 0.0

    return {
        "ticker": ticker,
        "name": name,
        "currency": currency,
        "baseline": round(baseline, 2),
        "last": round(last, 2),
        "lastDate": last_date,
        "ytdPct": pct(baseline, last),
        "fromHighPct": pct(high, last),   # <= 0; how far below the YTD peak
        "fromLowPct": pct(low, last),     # >= 0; how far above the YTD trough
        "sparkline": downsample(closes, SPARKLINE_POINTS),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch SaaSpocalyptics market data.")
    parser.add_argument("--dry-run", action="store_true", help="don't write the file")
    args = parser.parse_args()

    config = load_config()
    ytd_start = config.get("meta", {}).get("ytd_start", "2026-01-01")
    buckets_cfg = config["buckets"]

    out_buckets: dict[str, dict] = {}
    total, ok = 0, 0

    for key, bucket in buckets_cfg.items():
        members = bucket.get("members", [])
        print(f"\n{bucket.get('label', key)} ({len(members)} names)")
        rows = []
        for m in members:
            total += 1
            row = fetch_one(
                m["ticker"], m["name"], m.get("currency", "USD"), ytd_start
            )
            if row:
                ok += 1
                arrow = "▲" if row["ytdPct"] >= 0 else "▼"
                print(f"  {arrow} {row['ticker']:<8} {row['ytdPct']:+6.1f}%  {row['name']}")
                rows.append(row)
        # Default sort: worst YTD first, so the carnage reads top-down.
        rows.sort(key=lambda r: r["ytdPct"])
        out_buckets[key] = {
            "label": bucket.get("label", key),
            "blurb": bucket.get("blurb", ""),
            "members": rows,
        }

    payload = {
        "asOf": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "baselineDate": ytd_start,
        "buckets": out_buckets,
    }

    print(f"\nFetched {ok}/{total} tickers.")

    # Safety valve: a rate-limited or network-starved run can come back with most
    # or all tickers empty. Never overwrite the last-good market.json with a
    # gutted one — exit non-zero so deploy.sh aborts and the published data stands.
    MIN_OK_RATIO = 0.8
    if total == 0 or ok / total < MIN_OK_RATIO:
        sys.exit(
            f"error: only {ok}/{total} tickers resolved (< {MIN_OK_RATIO:.0%}). "
            "Refusing to overwrite last-good data — likely a rate limit; retry later."
        )

    if args.dry_run:
        print("(dry run — not writing)")
        return

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"Wrote {OUTPUT_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
