#!/usr/bin/env python3
"""Add a Gemma-written `ai` block to market.json — best-effort, never fatal.

Runs after fetch.py in the pipeline. Reads the freshly written market.json plus
the previous run's snapshot, assembles a strictly-factual brief of the day's
numbers, and asks the local Gemma model (Ollama on hugin) to write:

  ai.todaysRead    — a 2–3 sentence FT-style market note
  ai.sinceLastRun  — one sentence on what changed vs the previous run (or null)
  ai.buckets{key}  — a short state-of-play clause per category

The model only ever sees the numbers below; it is told never to invent causes,
news, or figures. Anything goes wrong (Ollama down, timeout, bad JSON) and we
simply leave `ai` off and exit 0 — the frontend falls back to computed text and
the deploy is never blocked.

Usage: python data/annotate.py   (run after data/fetch.py writes market.json)
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MARKET = ROOT / "public" / "data" / "market.json"
PREV = HERE / "prev_market.json"

OLLAMA = "http://localhost:11434/api/generate"
MODEL = "gemma4:31b"
TIMEOUT = 240  # the 31B model may need to load into VRAM on the first call


def rows(data: dict) -> list[dict]:
    return [c for b in data["buckets"].values() for c in b["members"]]


def median(vals: list[float]) -> float:
    if not vals:
        return 0.0
    s = sorted(vals)
    m = len(s) // 2
    return s[m] if len(s) % 2 else (s[m - 1] + s[m]) / 2


def r40(c: dict):
    return (c.get("fundamentals") or {}).get("ruleOf40")


def build_facts(data: dict, prev: dict | None) -> dict:
    rs = rows(data)
    hist = data.get("history") or []
    last = hist[-1] if hist else {}
    trough = min(hist, key=lambda p: p["medianYtd"]) if hist else {}
    srt = sorted(rs, key=lambda c: c["ytdPct"], reverse=True)
    winner, loser = srt[0], srt[-1]
    runner = next((c for c in srt if c["ytdPct"] <= 150), winner)

    qos = [c for c in rs if (v := r40(c)) is not None and v >= 40 and c["ytdPct"] < 0]
    pfh = [c for c in rs if (v := r40(c)) is not None and v < 25 and c["ytdPct"] > 0]
    pass40 = [c for c in rs if (v := r40(c)) is not None and v >= 40]

    facts: dict = {
        "asOf": data["asOf"],
        "names": len(rs),
        "aboveWater": sum(1 for c in rs if c["ytdPct"] >= 0),
        "medianYtd": last.get("medianYtd"),
        "troughDate": trough.get("date"),
        "troughMedian": trough.get("medianYtd"),
        "igvYtd": last.get("igvYtd"),
        "spxYtd": last.get("spxYtd"),
        "biggestWinner": {"name": winner["name"], "ytd": winner["ytdPct"], "isOutlier": winner["ytdPct"] > 150},
        "representativeWinner": {"name": runner["name"], "ytd": runner["ytdPct"]},
        "biggestLoser": {"name": loser["name"], "ytd": loser["ytdPct"]},
        "lensCounts": {
            "passes40": len(pass40),
            "qualityOnSale": len(qos),
            "pricedForHope": len(pfh),
        },
        "qualityOnSaleExamples": [c["name"] for c in sorted(qos, key=lambda c: r40(c), reverse=True)[:3]],
        "pricedForHopeExamples": [c["name"] for c in sorted(pfh, key=lambda c: c["ytdPct"], reverse=True)[:3]],
        "buckets": {},
    }
    for key, b in data["buckets"].items():
        m = b["members"]
        ys = [c["ytdPct"] for c in m]
        s = sorted(m, key=lambda c: c["ytdPct"], reverse=True)
        facts["buckets"][key] = {
            "label": b["label"],
            "medianYtd": round(median(ys), 1),
            "inRed": sum(1 for y in ys if y < 0),
            "total": len(m),
            "topWinner": {"name": s[0]["name"], "ytd": s[0]["ytdPct"]},
            "topLoser": {"name": s[-1]["name"], "ytd": s[-1]["ytdPct"]},
        }

    if prev:
        prev_ytd = {c["ticker"]: c["ytdPct"] for c in rows(prev)}
        now_ytd = {c["ticker"]: c for c in rs}
        above = [now_ytd[t]["name"] for t, y in prev_ytd.items()
                 if t in now_ytd and y < 0 <= now_ytd[t]["ytdPct"]]
        below = [now_ytd[t]["name"] for t, y in prev_ytd.items()
                 if t in now_ytd and now_ytd[t]["ytdPct"] < 0 <= y]
        moves = [(now_ytd[t]["name"], round(now_ytd[t]["ytdPct"] - y, 1))
                 for t, y in prev_ytd.items() if t in now_ytd]
        moves.sort(key=lambda x: abs(x[1]), reverse=True)
        facts["sinceLast"] = {
            "prevAsOf": prev.get("generatedAt"),
            "newlyAboveWater": above,
            "newlyBelowWater": below,
            "biggestMoves": [{"name": n, "deltaPct": d} for n, d in moves[:3] if abs(d) >= 0.3],
        }
    return facts


PROMPT = """You are a markets sub-editor for a Financial Times–style web tracker of \
SaaS stocks during the 2026 "SaaSpocalypse" (an AI-driven software sell-off and its \
uneven recovery). Write tight, dry, precise copy. British editorial register. No hype, \
no emojis, no exclamation marks, no second person.

CRITICAL: use ONLY the figures in the JSON below. Never invent a cause, a news event, \
a company, or a number that is not given. If you don't have a figure, don't imply one. \
YTD = year-to-date vs the first 2026 close. "Rule of 40" = revenue growth % + operating \
margin %; >=40 is healthy. "Quality on sale" = Rule of 40 >= 40 yet down YTD. "Priced \
for hope" = Rule of 40 < 25 yet up YTD.

Return ONLY a JSON object with these keys:
- "todaysRead": 2-3 sentences on the state of the cohort today (breadth, the recovery \
  from the trough, the gap to the S&P, the lens picture).
- "sinceLastRun": ONE sentence on what changed versus the previous run, or null if the \
  "sinceLast" field is absent or empty.
- "buckets": an object keyed by the same bucket keys, each a SHORT clause (<= 14 words) \
  characterising that category from its stats.

DATA:
"""


def call_gemma(facts: dict) -> dict | None:
    payload = {
        "model": MODEL,
        "prompt": PROMPT + json.dumps(facts, ensure_ascii=False),
        "stream": False,
        "format": "json",
        "keep_alive": "10m",
        "options": {"temperature": 0.2, "num_predict": 700, "top_p": 0.9},
    }
    req = urllib.request.Request(
        OLLAMA, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        out = json.loads(resp.read())
    return json.loads(out["response"])


def validate(ai: dict, facts: dict) -> dict | None:
    """Keep only well-formed, sane fields; drop anything off."""
    if not isinstance(ai, dict):
        return None
    clean: dict = {}
    tr = ai.get("todaysRead")
    if isinstance(tr, str) and 40 <= len(tr) <= 600:
        clean["todaysRead"] = tr.strip()
    slr = ai.get("sinceLastRun")
    if isinstance(slr, str) and 10 <= len(slr) <= 300:
        clean["sinceLastRun"] = slr.strip()
    bk = ai.get("buckets")
    if isinstance(bk, dict):
        good = {k: v.strip() for k, v in bk.items()
                if k in facts["buckets"] and isinstance(v, str) and 5 <= len(v) <= 160}
        if good:
            clean["buckets"] = good
    return clean or None


def main() -> None:
    try:
        data = json.loads(MARKET.read_text())
    except Exception as exc:
        print(f"annotate: can't read market.json ({exc}); skipping", file=sys.stderr)
        return  # nothing to annotate; exit 0

    prev = None
    if PREV.exists():
        try:
            prev = json.loads(PREV.read_text())
        except Exception:
            prev = None

    try:
        facts = build_facts(data, prev)
        ai = validate(call_gemma(facts), facts)
        if ai:
            ai["model"] = MODEL
            ai["generatedAt"] = data.get("generatedAt")
            data["ai"] = ai
            MARKET.write_text(json.dumps(data, indent=2, ensure_ascii=False))
            print(f"annotate: wrote ai block ({', '.join(ai)})")
        else:
            print("annotate: model output failed validation; leaving ai off", file=sys.stderr)
    except Exception as exc:
        print(f"annotate: best-effort skip ({type(exc).__name__}: {exc})", file=sys.stderr)
    finally:
        # Snapshot current data for the next run's diff, regardless of AI outcome.
        try:
            PREV.write_text(MARKET.read_text())
        except Exception:
            pass


if __name__ == "__main__":
    main()
