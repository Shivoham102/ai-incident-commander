"use strict";

const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// FAIL_MODE is set by break-deploy.sh commits to steer the AI's verdict.
// Values: "regression" | "transient" | "migration" | unset (healthy)
const FAIL_MODE = process.env.FAIL_MODE || "";

// Emit a steering log line before anything else so it appears in Render logs
// and is picked up by the Fetch Service Logs -> Claude pipeline.
if (FAIL_MODE === "regression") {
  console.error("FATAL TypeError at requestHandler (server.js:42): Cannot read properties of undefined (reading 'id')");
  process.exit(1);
}

if (FAIL_MODE === "transient") {
  console.error("Error: ECONNRESET fetching dependency mirror; transient network error during npm install");
  process.exit(1);
}

if (FAIL_MODE === "migration") {
  console.error("FATAL: relation \"users_v2\" does not exist — pending migration must be applied before deploying this version");
  process.exit(1);
}

// Healthy boot
app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/", (_req, res) => {
  res.json({ service: "incident-demo-api", status: "running" });
});

app.listen(PORT, () => {
  console.log(`incident-demo-api listening on port ${PORT}`);
});
