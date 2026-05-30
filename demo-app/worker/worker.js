"use strict";

// Service B: polls Service A's job queue every 5s and processes pending jobs.
// Requires env var: WORKER_API_URL=https://<service-a>.onrender.com

const API_URL = process.env.WORKER_API_URL;
const POLL_INTERVAL_MS = 5000;

if (!API_URL) {
  console.error("[worker] FATAL: WORKER_API_URL env var is not set");
  process.exit(1);
}

// Bind a port so Render's web service health check passes
const http = require("http");
http.createServer((_req, res) => res.writeHead(200) && res.end("ok")).listen(process.env.PORT || 3001);

console.log(`[worker] incident-demo-worker started`);
console.log(`[worker] polling ${API_URL} every ${POLL_INTERVAL_MS / 1000}s`);

async function poll() {
  try {
    const res = await fetch(`${API_URL}/api/jobs`);
    if (!res.ok) {
      console.error(`[worker] API returned ${res.status} — is Service A healthy?`);
      return;
    }
    const { jobs } = await res.json();
    const pending = jobs.filter((j) => j.status === "pending");
    if (pending.length === 0) {
      console.log(`[worker] no pending jobs`);
      return;
    }
    for (const job of pending) {
      const r = await fetch(`${API_URL}/api/jobs/${job.id}/process`, { method: "POST" });
      if (r.ok) {
        console.log(`[worker] processed job id=${job.id} type=${job.type}`);
      } else {
        console.error(`[worker] failed to process job id=${job.id}: HTTP ${r.status}`);
      }
    }
  } catch (err) {
    console.error(`[worker] fetch error: ${err.message} — Service A may be down`);
  }
}

// Poll immediately on start, then on interval
poll();
setInterval(poll, POLL_INTERVAL_MS);
