# AI Incident Commander

[![Launch in SuperPlane](http://superplane.com/badges/launch-in-superplane.svg)](http://app.superplane.com/install?repo=github.com/Shivoham102/ai-incident-commander)

> **Replace `REPLACE_GITHUB_OWNER`** with your GitHub username/org in the badge URL above before submitting.

An event-driven autonomous incident response system built on [SuperPlane](https://superplane.com).

When a Render deploy fails, the AI Incident Commander:
1. Fetches the deploy context + recent service logs from Render
2. Calls **Claude** to root-cause the failure and decide: `AUTO_ROLLBACK`, `RESTART`, or `PAGE_HUMAN`
3. Executes the chosen remediation autonomously — or pages the team on Slack
4. Records every incident (with MTTR) to a live Console

---

## Architecture

```
render.onDeploy(A failed) ──► Claude RCA (real logs)
                                   ├─ AUTO_ROLLBACK ──► rollback API (A) ──► redeploy Worker (B) ──► Slack ✅
                                   ├─ RESTART ────────► redeploy API (A) ──► redeploy Worker (B) ──► Slack ✅
                                   └─ PAGE_HUMAN ──────────────────────────────────────────────────► Slack 🚨
```

Two Render services — **real producer/consumer pair**:
- **Service A** (`incident-demo-api`) — job queue HTTP API (`demo-app/api/`); watched by `render.onDeploy`, rolled back / restarted on failure
- **Service B** (`incident-demo-worker`) — background worker (`demo-app/worker/`); polls Service A's `/api/jobs` every 5s, processes pending jobs; automatically redeployed after A is remediated

---

## Setup

### 1. Render — deploy two services

Deploy from the same repo `Shivoham102/ai-incident-commander` using different root directories:

**Service A — `incident-demo-api`**
| Setting | Value |
|---|---|
| Root Directory | `demo-app/api` |
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Instance Type | Free |
| Health Check | `/healthz` |

**Service B — `incident-demo-worker`**
| Setting | Value |
|---|---|
| Root Directory | `demo-app/worker` |
| Build Command | `npm install` |
| Start Command | `node worker.js` |
| Instance Type | Free |
| Env var | `WORKER_API_URL` = `https://incident-demo-api.onrender.com` (Service A's URL) |

Note both **service IDs** (`srv-…`) and your **owner ID** (`own-…`, visible in the Render dashboard URL).

### 2. SuperPlane — integrations + secret

1. Create org: **`hackatonsf-<your-team-name>`** at [app.superplane.com](https://app.superplane.com)
2. Connect integrations: **Render** (API key), **Claude** (Anthropic API key), **Slack**
3. Add a secret named **`RENDER_API_KEY`** — same value as your Render API key (used by the logs HTTP node)

### 3. Import

Click the **Launch in SuperPlane** badge above.

After import, open the canvas and fill in these placeholders on the relevant nodes:

| Placeholder | Where | Value |
|---|---|---|
| `REPLACE_SERVICE_A_ID` | `Watch Service A Deploys`, `Fetch Deploy Context`, `Execute Rollback`, `Execute Restart` | Render service ID for Service A |
| `REPLACE_SERVICE_B_ID` | `Health Snapshot (Service B)` | Render service ID for Service B |
| `REPLACE_RENDER_OWNER_ID` | `Fetch Service Logs` URL | Your Render owner ID (`own-…`) |
| `REPLACE_SLACK_CHANNEL_ID` | All Slack nodes | Your Slack channel ID |

Also verify that the **Claude model** field on the `AI Incident Commander` node resolves — it's an integration resource (select from the dropdown after connecting your Claude integration).

### 4. Hard prerequisites before demo

- [ ] **Enable Render deploy webhooks** — confirm the integration's webhook is active in your Render dashboard (powers `render.onDeploy`)
- [ ] **Seed a green deploy first** — run `./scripts/fix-deploy.sh` and wait for Service A to deploy successfully; this populates the `last_good` rollback target in canvas memory
- [ ] **Warm the service** — Render free services cold-start after 15 min idle; trigger the break right before presenting
- [ ] **Anthropic billing** — ensure starter credits or billing is active on the Anthropic API key

---

## Demo

### Setup
```bash
# Connect demo-app/ to your Service A's Git repo, then:
./scripts/fix-deploy.sh   # push a green deploy → seeds last_good rollback target
```

Wait for Service A's deploy to show **Live** in Render dashboard.

### Fire the three paths

| Command | Real crash injected | Real log Claude reads | Expected verdict |
|---|---|---|---|
| `./scripts/break-deploy.sh regression` | `undefined.timeout` access at startup | `TypeError: Cannot read properties of undefined (reading 'timeout')` + stack trace | `AUTO_ROLLBACK` |
| `./scripts/break-deploy.sh transient` | `require('pg')` (not in package.json) | `Error: Cannot find module 'pg'` | `RESTART` |
| `./scripts/break-deploy.sh migration` | Missing `DATABASE_URL` env check | `FATAL: DATABASE_URL not set — run database migrations before deploying this version` | `PAGE_HUMAN` |

After each `break-deploy.sh`:
1. Watch the SuperPlane canvas execute in real time
2. A new row appears in the **Incident Feed** Console with Claude's root cause
3. For resolved incidents: **MTTR** number widget updates

### Restore
```bash
./scripts/fix-deploy.sh   # push green commit → re-seeds last_good for next demo
```

---

## Console

The Console shows:
- **Avg MTTR** — average seconds-to-resolve over all auto-resolved incidents
- **Incidents handled** — total incident count
- **Incident Feed** — per-incident: service, Claude's AI root cause, action taken, status, MTTR
- **Worker Sync Status (Service B)** — latest redeploy status of the worker after each API remediation

---

## Cost

| Dependency | Free tier | Cost |
|---|---|---|
| Render (Service A + B, API, webhooks) | ✅ Free (750 hrs/mo) | $0 |
| Slack (bot + messaging) | ✅ Free | $0 |
| Claude API (`claude-sonnet-4-6`) | ⚠️ Pay-per-use | ~$0.01/incident (starter credits cover demo) |
| SuperPlane | ✅ Hackathon | $0 |

Switch model to `claude-haiku-4-5` in the canvas to halve cost further.

---

## Files

```
canvas.yaml               SuperPlane Canvas — 21-node incident automation flow
console.yaml              SuperPlane Console — MTTR + incident feed + worker status
demo-app/
  api/                    Service A — job queue HTTP API (watched by SuperPlane)
    package.json
    server.js             GET /healthz, GET/POST /api/jobs, POST /api/jobs/:id/process
  worker/                 Service B — job consumer (polls Service A every 5s)
    package.json
    worker.js             Requires WORKER_API_URL env var pointing at Service A
scripts/
  break-deploy.sh         Inject a real crash into api/server.js and push
  fix-deploy.sh           Restore clean api/server.js and push (seeds last_good)
```
