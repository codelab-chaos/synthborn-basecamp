#!/usr/bin/env node
"use strict";

/**
 * arena-gather-all.js
 *
 * Runs the third live-arena validation scenario:
 *   gatherer-all-arena — empty gatherer (default gather-everything mode, batch-target=3)
 *                        clears 15 mixed gatherables (fiber/sticks/rubble) from a cube-cleared arena.
 *
 * PREREQUISITE: Run `/synth testgrid setup` once in-game (or pass --setup to do it automatically).
 * The scenario self-resolves grid slot 2 from the spawn-anchored grid — no coordinates needed.
 *
 * Usage:
 *   node tools/rcon/arena-gather-all.js [--local|--remote] [--save <name>]
 *        [--setup] [--timeout <ms>] [--deadline <ms>]
 *
 * --setup: automatically sends `/synth testgrid setup` before starting.
 * Polls gatherer-all-arena-check every 5 s printing the state line until cleared==15 or the
 * 180 s deadline expires, then calls cleanup.
 */

const http = require("node:http");
const fs   = require("node:fs");
const path = require("node:path");

const {
  configureRemoteHost,
  parseRemoteFlags,
  stripRemoteFlags,
  isRemoteEnabled,
} = require("../library/remote-host");

const cliArgv = process.argv.slice(2);
configureRemoteHost(parseRemoteFlags(cliArgv));

// ── RCON defaults ─────────────────────────────────────────────────────────────
const DEFAULT_HOST        = "127.0.0.1";
const DEFAULT_PORT        = 25576;
const DEFAULT_TIMEOUT_MS  = 5_000;
const POLL_INTERVAL_MS    = 5_000;
const DEFAULT_DEADLINE_MS = 180_000;

// ── Arg parsing ───────────────────────────────────────────────────────────────

function resolveSavePath(save) {
  if (!save) return null;
  if (path.isAbsolute(save) || save.includes(path.sep) || save.includes("/")) return save;
  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "Hytale", "UserData", "Saves", save);
  }
  return null;
}

function loadSaveConfig(savePath) {
  if (!savePath) return {};
  const file = path.join(savePath, "dev-server.json");
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    const out = {};
    if (typeof parsed.rconHost === "string") out.rconHost = parsed.rconHost;
    if (Number.isInteger(parsed.rconPort)) out.rconPort = parsed.rconPort;
    return out;
  } catch (err) {
    process.stderr.write(`arena-gather-all: ignoring malformed ${file} (${err.message})\n`);
    return {};
  }
}

function parseArgs(argv) {
  argv = stripRemoteFlags(argv);
  const opts = {
    save:       process.env.HYTALE_SAVE || null,
    host:       null,
    port:       null,
    token:      process.env.SYNTH_RCON_TOKEN || "",
    timeoutMs:  Number(process.env.SYNTH_RCON_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    deadlineMs: DEFAULT_DEADLINE_MS,
    setup:      false,
    help:       false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") { opts.help = true; continue; }
    if (arg === "--save")    { opts.save      = argv[++i]; continue; }
    if (arg === "--host")    { opts.host      = argv[++i]; continue; }
    if (arg === "--port")    { opts.port      = Number(argv[++i]); continue; }
    if (arg === "--token")   { opts.token     = argv[++i]; continue; }
    if (arg === "--timeout") { opts.timeoutMs = Number(argv[++i]); continue; }
    if (arg === "--deadline"){ opts.deadlineMs = Number(argv[++i]); continue; }
    if (arg === "--setup")   { opts.setup     = true; continue; }
    // --x/--y/--z accepted for backwards compat but ignored (grid self-resolves).
    if (arg === "--x")       { ++i; continue; }
    if (arg === "--y")       { ++i; continue; }
    if (arg === "--z")       { ++i; continue; }
  }

  const saveConfig = loadSaveConfig(resolveSavePath(opts.save));
  if (!opts.host) {
    opts.host = isRemoteEnabled() && process.env.SYNTH_RCON_HOST
      ? process.env.SYNTH_RCON_HOST
      : saveConfig.rconHost || process.env.SYNTH_RCON_HOST || DEFAULT_HOST;
  }
  if (!opts.port) {
    opts.port = saveConfig.rconPort || Number(process.env.SYNTH_RCON_PORT) || DEFAULT_PORT;
  }
  return opts;
}

function usage() {
  console.log(`Usage:
  node tools/rcon/arena-gather-all.js [--local|--remote] [options]

Options:
  --save <name|path>  Save to target (resolution order: flag > save/dev-server.json > env > default)
  --host <host>       SynthRCON host (default: ${DEFAULT_HOST})
  --port <port>       SynthRCON port (default: ${DEFAULT_PORT})
  --token <value>     SynthRCON token (or SYNTH_RCON_TOKEN env var)
  --timeout <ms>      Per-request timeout (default: ${DEFAULT_TIMEOUT_MS})
  --deadline <ms>     Total polling deadline (default: ${DEFAULT_DEADLINE_MS})
  --setup             Automatically run /synth testgrid setup before starting
  --x/--y/--z         Ignored (kept for compat; scenario self-resolves grid slot 2)
  --local             Target local server; overrides HYTALE_REMOTE_ENABLED
  --remote            Target remote host; overrides HYTALE_REMOTE_ENABLED
  --help              Show this help

PREREQUISITE: run /synth testgrid setup once in-game (or pass --setup here).
Polls gatherer-all-arena-check every 5 s printing state-dump until cleared==15 or deadline.
Calls cleanup regardless of outcome.
`);
}

// ── RCON HTTP helper ──────────────────────────────────────────────────────────

function requestJson(opts, urlPath, method, body) {
  const payload = body ? JSON.stringify(body) : "";
  const headers = { Accept: "application/json" };
  if (payload) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(payload);
  }
  if (opts.token) {
    headers["X-SynthRCON-Token"] = opts.token;
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: opts.host, port: opts.port, path: urlPath, method, headers, timeout: opts.timeoutMs },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => { data += c; });
        res.on("end", () => {
          let parsed;
          try { parsed = data ? JSON.parse(data) : {}; }
          catch (e) { reject(new Error(`Expected JSON, got: ${data}`)); return; }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
            return;
          }
          resolve(parsed);
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("RCON request timed out")));
    req.on("error", reject);
    req.end(payload);
  });
}

async function sendCommand(opts, command) {
  const resp = await requestJson(opts, "/command", "POST", { command });
  const messages = Array.isArray(resp.messages) ? resp.messages : [];
  return messages.join("\n");
}

// ── Scenario helpers ──────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extracts the state-dump line from the check output.
 * The scenario emits: codes: cleared=N/15 fiberLeft=N woodLeft=N stoneLeft=N ...
 */
function extractStateDump(output) {
  const match = output.match(/(cleared=\S+)[^\n]*/);
  return match ? match[0] : output.trim();
}

function isPassed(output) {
  return /:\s*PASS\b/.test(output);
}

// ── Main flow ─────────────────────────────────────────────────────────────────

async function runGathererAll(opts) {
  console.log(`arena-gather-all: starting gatherer-all-arena (slot 2)`);
  console.log(`  scenario: empty gatherer, default gather-everything mode, batch-target=3`);
  console.log(`  goal:     clear all 15 staged gatherables (5 fiber + 5 sticks + 5 rubble)`);
  console.log();

  // ── OPTIONAL TESTGRID SETUP ───────────────────────────────────────────────
  if (opts.setup) {
    console.log("arena-gather-all: running /synth testgrid setup...");
    try {
      const setupOut = await sendCommand(opts, "synth testgrid setup");
      console.log(setupOut);
    } catch (e) {
      console.error(`arena-gather-all: testgrid setup failed — ${e.message}`);
      process.exitCode = 1;
      return;
    }
    console.log();
  } else {
    console.log("NOTE: ensure /synth testgrid setup has been run once before this script.");
    console.log("      Pass --setup to run it automatically.");
    console.log();
  }

  // ── START ──────────────────────────────────────────────────────────────────
  // Pass dummy coords — the scenario self-resolves from the grid.
  const startCmd = `validate gatherer-all-arena-start at 0,0,0`;
  let startOut;
  try {
    startOut = await sendCommand(opts, startCmd);
  } catch (e) {
    console.error(`arena-gather-all: start command failed — ${e.message}`);
    await cleanup(opts);
    process.exitCode = 1;
    return;
  }

  console.log(`> ${startCmd}  (coords ignored; self-resolves grid slot 2)`);
  console.log(startOut);
  console.log();

  if (!isPassed(startOut)) {
    console.error("arena-gather-all: gatherer-all-arena-start FAILED — aborting");
    await cleanup(opts);
    process.exitCode = 1;
    return;
  }

  // ── POLL ───────────────────────────────────────────────────────────────────
  const deadline = Date.now() + opts.deadlineMs;
  let done = false;
  let lastState = "";

  console.log(`arena-gather-all: polling every ${POLL_INTERVAL_MS / 1000}s (deadline ${opts.deadlineMs / 1000}s)`);
  console.log();

  while (!done && Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    let checkOut;
    try {
      checkOut = await sendCommand(opts, "validate gatherer-all-arena-check");
    } catch (e) {
      console.warn(`arena-gather-all: check request error — ${e.message}`);
      continue;
    }

    const state = extractStateDump(checkOut);
    if (state !== lastState) {
      console.log(`[gather-all] ${state}`);
      lastState = state;
    }
    if (isPassed(checkOut)) {
      done = true;
      console.log("[gather-all] GOAL MET — all 15 blocks cleared");
    }
  }

  console.log();

  // ── FINAL VERDICT ──────────────────────────────────────────────────────────
  const passed = done;
  console.log(`gatherer-all-arena: ${passed ? "PASS" : "FAIL (deadline)"}`);
  if (lastState) console.log(`  last state: ${lastState}`);
  console.log();

  // ── CLEANUP ────────────────────────────────────────────────────────────────
  await cleanup(opts);

  if (!passed) {
    process.exitCode = 1;
  }
}

async function cleanup(opts) {
  console.log("arena-gather-all: running cleanup...");
  try {
    const out = await sendCommand(opts, "validate gatherer-all-arena-cleanup");
    console.log("> validate gatherer-all-arena-cleanup");
    if (out) console.log(out);
  } catch (e) {
    console.log(`> validate gatherer-all-arena-cleanup [error: ${e.message}]`);
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    return;
  }

  if (!Number.isInteger(opts.port) || opts.port <= 0) {
    throw new Error("SynthRCON port must be a positive integer.");
  }
  await runGathererAll(opts);
}

main().catch((err) => {
  console.error(`arena-gather-all: ${err.message}`);
  process.exitCode = 1;
});
