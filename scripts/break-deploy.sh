#!/usr/bin/env bash
# break-deploy.sh <mode>
#
# Injects a REAL crash into demo-app/api/server.js, commits, and pushes.
# Render auto-deploys Service A -> deploy fails -> render.onDeploy fires ->
# SuperPlane canvas runs -> Claude reads the real crash log -> decides.
#
# Modes:
#   regression  -> TypeError at startup (code bug)     -> Claude: AUTO_ROLLBACK
#   transient   -> missing module (dependency issue)   -> Claude: RESTART
#   migration   -> missing DATABASE_URL (env/schema)   -> Claude: PAGE_HUMAN
#
# Usage: ./scripts/break-deploy.sh regression
set -euo pipefail

MODE="${1:-}"
if [[ -z "$MODE" ]]; then
  echo "Usage: $0 <regression|transient|migration>" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER="$REPO_ROOT/demo-app/api/server.js"

case "$MODE" in
  regression)
    # Inject a real TypeError: access property on undefined at startup.
    # Node will crash with a full stack trace before the server binds.
    INJECT='const _cfg = undefined; const _t = _cfg.timeout; // regression: bad config access'
    COMMIT_MSG="feat: load config from central store (breaks on undefined)"
    ;;
  transient)
    # Require a module that is not in package.json -> Cannot find module error.
    # Looks like a missing dependency / environment issue -> RESTART makes sense.
    INJECT="const _db = require('pg'); // transient: pg driver not installed in this env"
    COMMIT_MSG="feat: add postgres connection pooling"
    ;;
  migration)
    # Explicit migration guard: exits non-zero with a clear message if DATABASE_URL
    # is not set. Tells Claude a DB migration is required -> PAGE_HUMAN.
    INJECT="if (!process.env.DATABASE_URL) { console.error('FATAL: DATABASE_URL not set — run database migrations before deploying this version'); process.exit(1); }"
    COMMIT_MSG="feat: require database v2 schema (migration needed)"
    ;;
  *)
    echo "Unknown mode '$MODE'. Choose: regression, transient, migration" >&2
    exit 1
    ;;
esac

# Insert the injection line after the first "use strict"; line
TMPFILE=$(mktemp)
awk -v inject="$INJECT" '
  /^"use strict";/ { print; print inject; next }
  { print }
' "$SERVER" > "$TMPFILE"
mv "$TMPFILE" "$SERVER"

cd "$REPO_ROOT"
git add demo-app/api/server.js
git commit -m "$COMMIT_MSG"
git push

echo ""
echo "Pushed $MODE failure to Service A (demo-app/api)."
echo "Watch Render dashboard + SuperPlane canvas for the deploy_ended event."
echo "Expected Claude verdict: $(case $MODE in regression) echo AUTO_ROLLBACK;; transient) echo RESTART;; migration) echo PAGE_HUMAN;; esac)"
