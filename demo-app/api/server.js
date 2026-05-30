"use strict";

const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const SEED_JOBS = [
  { id: 1, type: "email",   payload: { to: "alice@example.com" },   status: "pending" },
  { id: 2, type: "email",   payload: { to: "bob@example.com" },     status: "pending" },
  { id: 3, type: "report",  payload: { reportId: "rpt-42" },        status: "pending" },
  { id: 4, type: "report",  payload: { reportId: "rpt-43" },        status: "pending" },
  { id: 5, type: "export",  payload: { format: "csv", rows: 1200 }, status: "pending" },
  { id: 6, type: "export",  payload: { format: "pdf", rows: 340 },  status: "pending" },
  { id: 7, type: "notify",  payload: { channel: "slack" },          status: "pending" },
  { id: 8, type: "cleanup", payload: { olderThanDays: 30 },         status: "pending" },
];

function seedJobs() {
  return SEED_JOBS.map((j) => ({ ...j, createdAt: new Date().toISOString() }));
}

let jobs = seedJobs();
let nextId = 9;

// ── API ──────────────────────────────────────────────────────────────────────

app.get("/healthz", (_req, res) => {
  const pending = jobs.filter((j) => j.status === "pending").length;
  res.json({ status: "ok", uptime: Math.floor(process.uptime()), jobs: jobs.length, pending });
});

app.get("/api/jobs", (_req, res) => {
  res.json({ jobs });
});

app.post("/api/jobs", (req, res) => {
  const { type, payload } = req.body;
  if (!type) return res.status(400).json({ error: "type is required" });
  const job = { id: nextId++, type, payload: payload || {}, status: "pending", createdAt: new Date().toISOString() };
  jobs.push(job);
  console.log(`[api] job created id=${job.id} type=${job.type}`);
  res.status(201).json({ job });
});

app.post("/api/jobs/:id/process", (req, res) => {
  const job = jobs.find((j) => j.id === Number(req.params.id));
  if (!job) return res.status(404).json({ error: "job not found" });
  if (job.status === "done") return res.json({ job });
  job.status = "done";
  job.processedAt = new Date().toISOString();
  console.log(`[api] job processed id=${job.id} type=${job.type}`);
  res.json({ job });
});

// Reset all jobs back to pending — use before demo runs
app.post("/demo/reset", (_req, res) => {
  jobs = seedJobs();
  nextId = 9;
  console.log("[api] demo reset — all jobs back to pending");
  res.json({ message: "reset ok", jobs });
});

// ── DASHBOARD ────────────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>incident-demo-api</title>
  <meta http-equiv="refresh" content="3">
  <style>
    body { font-family: monospace; background: #0f1117; color: #e2e8f0; padding: 2rem; }
    h1 { color: #7c3aed; margin-bottom: 0.25rem; }
    p  { color: #94a3b8; margin-top: 0; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th { text-align: left; color: #94a3b8; border-bottom: 1px solid #334155; padding: 0.5rem 1rem; }
    td { padding: 0.5rem 1rem; border-bottom: 1px solid #1e293b; }
    .pending { color: #fbbf24; }
    .done    { color: #34d399; }
    .btn { margin-top: 1.5rem; padding: 0.6rem 1.2rem; background: #7c3aed; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem; }
    .btn:hover { background: #6d28d9; }
  </style>
</head>
<body>
  <h1>incident-demo-api</h1>
  <p>Auto-refreshes every 3s. Worker polls every 5s.</p>
  <table>
    <tr><th>ID</th><th>Type</th><th>Status</th><th>Processed At</th></tr>
    ${jobs.map((j) => `<tr>
      <td>${j.id}</td>
      <td>${j.type}</td>
      <td class="${j.status}">${j.status}</td>
      <td>${j.processedAt || "—"}</td>
    </tr>`).join("")}
  </table>
  <form action="/demo/reset" method="POST">
    <button class="btn" type="submit">Reset all jobs to pending</button>
  </form>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`[api] incident-demo-api listening on port ${PORT}`);
  console.log(`[api] ${jobs.length} jobs pre-loaded`);
});
