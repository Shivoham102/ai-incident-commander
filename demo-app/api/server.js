"use strict";

const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// In-memory job queue — worker polls this and processes pending jobs
const jobs = [
  { id: 1, type: "email", payload: { to: "user@example.com" }, status: "pending", createdAt: new Date().toISOString() },
  { id: 2, type: "report", payload: { reportId: "rpt-42" }, status: "pending", createdAt: new Date().toISOString() },
];
let nextId = 3;

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

app.listen(PORT, () => {
  console.log(`[api] incident-demo-api listening on port ${PORT}`);
  console.log(`[api] ${jobs.length} jobs pre-loaded — worker should connect to process them`);
});
