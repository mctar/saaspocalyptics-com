#!/usr/bin/env bash
# Shared pipeline: ONE batched fetch feeds BOTH SaaSpocalyptics sites.
#
#   .com  (this repo, mctar/saaspocalyptics-com)  -> saaspocalyptics.com
#   btrbot (sibling repo, mctar/saaspocalyptics)   -> saaspocalyptics.btrbot.com
#
# The .com fetcher produces the superset market.json (buckets + history +
# benchmarks + fundamentals). The btrbot UI reads only `buckets`, so the same
# file feeds it untouched. Runs a few times a day via a user systemd timer on
# hugin. One fetch, not two — so Yahoo sees a single batched request per run.
#
# Body wrapped in main() so a mid-run self-update can't corrupt the running file.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

COM="$(cd "$(dirname "$0")" && pwd)"
BTR="$(cd "$COM/../saaspocalyptics" && pwd)"
COM_REPO="git@github.com:mctar/saaspocalyptics-com.git"
BTR_REPO="git@github.com:mctar/saaspocalyptics.git"
DATA_REL="public/data/market.json"

# Update a repo to latest main without tripping on the regenerated market.json:
# discard the working-tree copy first so the ff-only pull is always clean.
self_update() {
    local dir="$1"
    git -C "$dir" checkout -- "$DATA_REL" 2>/dev/null || true
    git -C "$dir" pull --ff-only --quiet origin main || echo "warn: pull failed in $dir; using current checkout"
    [ -d "$dir/node_modules" ] || ( cd "$dir" && npm ci )
}

# Build a repo and publish its dist/ to gh-pages, committing only on change.
publish() {
    local dir="$1" url="$2" tmp="$3"
    ( cd "$dir" && npm run build )
    rm -rf "$tmp"
    git clone --branch gh-pages --single-branch --depth 1 "$url" "$tmp" 2>/dev/null
    find "$tmp" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
    cp -R "$dir/dist/." "$tmp"/
    ( cd "$tmp"
      git add -A
      if git diff --cached --quiet; then
          echo "  $(basename "$dir"): no changes"
      else
          git commit -q -m "Update market data $(date -u +%Y-%m-%dT%H:%MZ)"
          git push -q origin gh-pages
          echo "  $(basename "$dir"): deployed"
      fi )
    rm -rf "$tmp"
}

main() {
    self_update "$COM"
    self_update "$BTR"

    # Ensure the Python env for the (single) fetch.
    if [ ! -d "$COM/.venv" ]; then
        python3 -m venv "$COM/.venv"
        "$COM/.venv/bin/pip" install -q -r "$COM/data/requirements.txt"
    fi

    # THE fetch — writes the superset to the .com repo. Exits non-zero (and aborts
    # this script via set -e) if <80% of tickers resolve, so a throttled run never
    # publishes gutted data to either site.
    "$COM/.venv/bin/python" "$COM/data/fetch.py"

    # Same data feeds btrbot (it ignores the extra keys).
    cp "$COM/$DATA_REL" "$BTR/$DATA_REL"

    publish "$COM" "$COM_REPO" /tmp/scom-ghp
    publish "$BTR" "$BTR_REPO" /tmp/sbtr-ghp
    echo "Done $(date -u +%Y-%m-%dT%H:%MZ)."
}

main "$@"
