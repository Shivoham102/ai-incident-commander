# AI Incident Commander

[![Launch in SuperPlane](http://superplane.com/badges/launch-in-superplane.svg)](http://app.superplane.com/install?repo=github.com/REPLACE_GITHUB_OWNER/ai-incident-commander)

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
render.onDeploy(failed) ──► Claude RCA (real logs)
                                 ├─ AUTO_ROLLBACK ──► render.rollbackDeploy ──► resolve ──► Slack ✅
                                 ├─ RESTART ────────► render.deploy ───────────► resolve ──► Slack ✅
                                 └─ PAGE_HUMAN ─────────────────────────────────────────► Slack 🚨
```

Two Render services used:
- **Service A** (`incident-demo-api`) — the watched app; rolled back / restarted on failure
- **Service B** (`incident-demo-canary`) — health-check target; snapshot stored to Console after each resolution

---

## Setup

### 1. Render — deploy two services

Deploy `demo-app/` **twice** on [render.com](https://render.com) (free tier):

| Service | Name suggestion | Role |
|---|---|---|
| Service A | `incident-demo-api` | Watched + rollback/restart target |
| Service B | `incident-demo-canary` | Health-check snapshot target |

For both: **Environment** = Node, **Build Command** = `npm install`, **Start Command** = `node server.js`.

Note:
- Both **service IDs** (format: `srv-…`)
- Your **owner ID** (format: `own-…`, visible in the Render API or dashboard URL)

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

| Command | Failure injected | Expected Claude verdict |
|---|---|---|
| `./scripts/break-deploy.sh regression` | Boot crash — `TypeError` | `AUTO_ROLLBACK` → rollback to last-good |
| `./scripts/break-deploy.sh transient` | Build/boot `ECONNRESET` | `RESTART` → fresh deploy with cache clear |
| `./scripts/break-deploy.sh migration` | Schema mismatch — DB migration pending | `PAGE_HUMAN` → Slack 🚨 |

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
- **Service Health (Service B)** — latest health snapshot from Service B after each resolution

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
canvas.yaml          SuperPlane Canvas — 21-node incident automation flow
console.yaml         SuperPlane Console — MTTR + incident feed + service health
demo-app/            Minimal Node/Express service deployed to Render
  package.json
  server.js          FAIL_MODE-driven failures for deterministic demos
scripts/
  break-deploy.sh    Push a failure-mode commit to trigger an incident
  fix-deploy.sh      Restore green state + seed last_good rollback target
```
