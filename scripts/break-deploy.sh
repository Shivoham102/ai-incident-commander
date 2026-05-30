#!/usr/bin/env bash
# break-deploy.sh <mode>
#
# Commits a failure-mode change to demo-app/server.js and pushes to Service A's
# branch, triggering a Render deploy that fails and fires render.onDeploy.
#
# Modes:
#   regression  -> FATAL TypeError at boot   -> Claude returns AUTO_ROLLBACK
#   transient   -> ECONNRESET at build/boot  -> Claude returns RESTART
#   migration   -> DB schema mismatch        -> Claude returns PAGE_HUMAN
#
# Usage: ./scripts/break-deploy.sh regression
set -euo pipefail

MODE="${1:-}"
if [[ -z "$MODE" ]]; then
  echo "Usage: $0 <regression|transient|migration>" >&2
  exit 1
fi

case "$MODE" in
  regression|transient|migration) ;;
  *)
    echo "Unknown mode '$MODE'. Choose: regression, transient, migration" >&2
    exit 1
    ;;
esac

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER="$REPO_ROOT/demo-app/server.js"

# Inject FAIL_MODE env override at the top of server.js
# (Render reads env vars set on the service, so we embed a hardcoded override
#  purely for the demo to avoid needing dashboard access mid-demo.)
TMPFILE=$(mktemp)
# Replace the FAIL_MODE line with the chosen mode
sed "s/const FAIL_MODE = process.env.FAIL_MODE || \"\";/const FAIL_MODE = process.env.FAIL_MODE || \"$MODE\";/" \
  "$SERVER" > "$TMPFILE"
mv "$TMPFILE" "$SERVER"

cd "$REPO_ROOT"
git add demo-app/server.js
git commit -m "demo: inject FAIL_MODE=$MODE to trigger $MODE failure path"
git push

echo ""
echo "Pushed FAIL_MODE=$MODE to Service A."
echo "Watch Render dashboard + SuperPlane canvas for the deploy_ended event."
echo "Expected Claude verdict: $(case $MODE in regression) echo AUTO_ROLLBACK;; transient) echo RESTART;; migration) echo PAGE_HUMAN;; esac)"
