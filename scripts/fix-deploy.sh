#!/usr/bin/env bash
# fix-deploy.sh
#
# Restores demo-app/server.js to a healthy state, pushes to Service A's branch,
# and triggers a successful deploy that seeds the last_good memory with a
# known-good deploy ID (required before break-deploy.sh can test the rollback path).
#
# Run this ONCE before any demo to ensure a rollback target exists.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER="$REPO_ROOT/demo-app/server.js"

# Restore FAIL_MODE to empty (healthy boot)
TMPFILE=$(mktemp)
sed 's/const FAIL_MODE = process.env.FAIL_MODE || "[^"]*";/const FAIL_MODE = process.env.FAIL_MODE || "";/' \
  "$SERVER" > "$TMPFILE"
mv "$TMPFILE" "$SERVER"

cd "$REPO_ROOT"
git add demo-app/server.js
git commit -m "demo: restore healthy boot (clear FAIL_MODE)"
git push

echo ""
echo "Pushed healthy commit to Service A."
echo "Wait for the Render deploy to succeed (~1-2 min), then run:"
echo "  ./scripts/break-deploy.sh <regression|transient|migration>"
echo ""
echo "The successful deploy will fire render.onDeploy (succeeded) -> SuperPlane"
echo "caches it as last_good -> rollback target is now seeded."
