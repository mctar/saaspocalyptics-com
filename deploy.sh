#!/usr/bin/env bash
# Refresh market data, build the app, and publish dist/ to the gh-pages branch.
# Runs hourly on hugin via a user systemd timer (see README). GitHub Pages serves
# gh-pages at saaspocalyptics.btrbot.com. The CNAME lives in public/ so Vite
# copies it into dist/ on build.
#
# The whole body is wrapped in main() so bash parses the entire script before
# executing — that way the self-update step below can safely change this very
# file mid-run (the next run picks up the new version).
set -euo pipefail

# cron/systemd run with a bare PATH; cover Homebrew (mac) and system (Linux) bins
# so node/npm resolve on both the Mac and hugin.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV="$SCRIPT_DIR/.venv"
DIST_DIR="$SCRIPT_DIR/dist"
DEPLOY_DIR="/tmp/saaspocalyptics-com-ghp"
REPO="git@github.com:mctar/saaspocalyptics-com.git"

main() {
    cd "$SCRIPT_DIR"

    # 0. Self-update: track origin/main so pushes reach production automatically.
    #    Reinstall deps only when their lockfiles actually changed.
    if [ -d .git ]; then
        local node_before node_after py_before py_after
        node_before=$(git rev-parse HEAD:package-lock.json 2>/dev/null || true)
        py_before=$(git rev-parse HEAD:data/requirements.txt 2>/dev/null || true)
        git pull --ff-only --quiet origin main || echo "warn: git pull failed; building current checkout"
        node_after=$(git rev-parse HEAD:package-lock.json 2>/dev/null || true)
        py_after=$(git rev-parse HEAD:data/requirements.txt 2>/dev/null || true)

        if [ ! -d node_modules ] || [ "$node_before" != "$node_after" ]; then
            echo "Node dependencies changed — running npm ci."
            npm ci
        fi
        if [ ! -d "$VENV" ]; then
            echo "Creating Python venv."
            python3 -m venv "$VENV"
            "$VENV/bin/pip" install -q -r data/requirements.txt
        elif [ "$py_before" != "$py_after" ]; then
            echo "Python dependencies changed — updating venv."
            "$VENV/bin/pip" install -q -r data/requirements.txt
        fi
    fi

    # 1. Refresh data, then build the static site (dist/ includes data/ and CNAME).
    "$VENV/bin/python" "$SCRIPT_DIR/data/fetch.py"
    npm run build

    # 2. Publish dist/ to gh-pages.
    rm -rf "$DEPLOY_DIR"
    git clone --branch gh-pages --single-branch --depth 1 "$REPO" "$DEPLOY_DIR" 2>/dev/null

    # Replace contents wholesale (so removed files disappear), keep .git.
    find "$DEPLOY_DIR" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
    cp -R "$DIST_DIR"/. "$DEPLOY_DIR"/

    cd "$DEPLOY_DIR"
    git add -A
    if git diff --cached --quiet; then
        echo "No changes to deploy."
    else
        git commit -m "Update market data $(date -u +%Y-%m-%dT%H:%MZ)"
        git push origin gh-pages
        echo "Deployed."
    fi

    rm -rf "$DEPLOY_DIR"
}

main "$@"
