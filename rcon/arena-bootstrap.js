#!/usr/bin/env node
"use strict";

/**
 * arena-bootstrap.js
 *
 * Runs two live arena validation scenarios in parallel:
 *   hatchet-bootstrap-arena — gatherer finds+gathers, crafts a crude hatchet autonomously
 *   chest-bootstrap-arena   — gatherer (seeded hatchet) chops a tree + places a chest
 *
 * PREREQUISITE: Run `/synth testgrid setup` once in-game (or pass --setup to do it automatically).
 * The scenarios self-resolve their grid slots — no coordinates need to be passed.
 *
 * Usage:
 *   node tools/rcon/arena-bootstrap.js [--local|--remote] [--save <name>]
 *        [--setup] [--timeout <ms>] [--deadline <ms>]
 *
 * --setup: automatically sends `/synth testgrid setup` before starting the arenas.
 * Polls both *-check every 5 s; deadline 180 s.
 * Calls both *-cleanup regardless of outcome.
 *
 * NOTE: The --x/--y/--z flags are accepted for backwards compatibility but ignored
 *       (the scenarios self-resolve spawn-anchored grid slots).
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

// ── RCON defaults (mirror synth-rcon.js) ─────────────────────────────────────
const DEFAULT_HOST       = "127.0.0.1";
const DEFAULT_PORT       = 25576;
const DEFAULT_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS   = 5_000;
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
    process.stderr.write(`arena-bootstrap: ignoring malformed ${file} (${err.message})\n`);
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
    x: 0,
    y: 192,
    z: 0,
    setup: false,
    help: false,
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
  node tools/rcon/arena-bootstrap.js [--local|--remote] [options]

Options:
  --save <name|path>  Save to target (resolution order: flag > save/dev-server.json > env > default)
  --host <host>       SynthRCON host (default: ${DEFAULT_HOST})
  --port <port>       SynthRCON port (default: ${DEFAULT_PORT})
  --token <value>     SynthRCON token (or SYNTH_RCON_TOKEN env var)
  --timeout <ms>      Per-request timeout (default: ${DEFAULT_TIMEOUT_MS})
  --deadline <ms>     Total polling deadline (default: ${DEFAULT_DEADLINE_MS})
  --setup             Automatically run /synth testgrid setup before starting arenas
  --x/--y/--z         Ignored (kept for backwards compat; arenas self-resolve grid slots)
  --local             Target local server; overrides HYTALE_REMOTE_ENABLED
  --remote            Target remote host; overrides HYTALE_REMOTE_ENABLED
  --help              Show this help

PREREQUISITE: run /synth testgrid setup once in-game (or pass --setup here).
Both arenas self-resolve spawn-anchored grid slots — no coordinates needed.
Both are polled until their GOAL is met or the deadline expires, then both are cleaned up.
`);
}

// ── RCON HTTP helper (copied from synth-rcon.js) ──────────────────────────────

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

// ── Scenario coordination ─────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extracts the state-dump line from the result text output.
 * The scenarios always emit a codes line like:
 *   codes: sticks=N fiber=N rubble=N hatchet=0 task=... pos=... elapsedMs=N
 */
function extractStateDump(output) {
  const match = output.match(/(sticks=\S+|logs=\S+)[^\n]*/);
  return match ? match[0] : output.trim();
}

function isPassed(output) {
  return /:\s*PASS\b/.test(output);
}

async function runArenas(opts) {
  console.log(`arena-bootstrap: starting two grid-anchored arena scenarios`);
  console.log(`  hatchet-bootstrap-arena (slot 0) — self-resolves spawn-anchored grid`);
  console.log(`  chest-bootstrap-arena   (slot 1) — self-resolves spawn-anchored grid`);
  console.log();

  // ── OPTIONAL TESTGRID SETUP ───────────────────────────────────────────────
  if (opts.setup) {
    console.log("arena-bootstrap: running /synth testgrid setup...");
    try {
      const setupOut = await sendCommand(opts, "synth testgrid setup");
      console.log(setupOut);
    } catch (e) {
      console.error(`arena-bootstrap: testgrid setup failed — ${e.message}`);
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
  // Pass dummy coords (0 0 0) — the scenarios self-resolve from the grid and ignore them.
  const startCmd1 = `validate hatchet-bootstrap-arena-start at 0,0,0`;
  const startCmd2 = `validate chest-bootstrap-arena-start at 0,0,0`;

  const [startOut1, startOut2] = await Promise.all([
    sendCommand(opts, startCmd1),
    sendCommand(opts, startCmd2),
  ]);

  console.log(`> ${startCmd1}  (coords ignored; self-resolves grid slot 0)`);
  console.log(startOut1);
  console.log();
  console.log(`> ${startCmd2}  (coords ignored; self-resolves grid slot 1)`);
  console.log(startOut2);
  console.log();

  const startedHatchet = isPassed(startOut1);
  const startedChest   = isPassed(startOut2);

  if (!startedHatchet) {
    console.error("arena-bootstrap: hatchet-bootstrap-arena-start FAILED — aborting");
  }
  if (!startedChest) {
    console.error("arena-bootstrap: chest-bootstrap-arena-start FAILED — aborting");
  }
  if (!startedHatchet || !startedChest) {
    await cleanup(opts);
    process.exitCode = 1;
    return;
  }

  // ── POLL ───────────────────────────────────────────────────────────────────
  const deadline = Date.now() + opts.deadlineMs;
  let hatchetDone = false;
  let chestDone   = false;
  let lastHatchetState = "";
  let lastChestState   = "";

  console.log(`arena-bootstrap: polling every ${POLL_INTERVAL_MS / 1000}s (deadline ${opts.deadlineMs / 1000}s)`);
  console.log();

  while ((!hatchetDone || !chestDone) && Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const [checkOut1, checkOut2] = await Promise.all([
      hatchetDone ? Promise.resolve("") : sendCommand(opts, "validate hatchet-bootstrap-arena-check"),
      chestDone   ? Promise.resolve("") : sendCommand(opts, "validate chest-bootstrap-arena-check"),
    ]);

    if (!hatchetDone) {
      const state = extractStateDump(checkOut1);
      if (state !== lastHatchetState) {
        console.log(`[hatchet] ${state}`);
        lastHatchetState = state;
      }
      if (isPassed(checkOut1)) {
        hatchetDone = true;
        console.log("[hatchet] GOAL MET");
      }
    }

    if (!chestDone) {
      const state = extractStateDump(checkOut2);
      if (state !== lastChestState) {
        console.log(`[chest  ] ${state}`);
        lastChestState = state;
      }
      if (isPassed(checkOut2)) {
        chestDone = true;
        console.log("[chest  ] GOAL MET");
      }
    }
  }

  console.log();

  // ── FINAL VERDICTS ─────────────────────────────────────────────────────────
  const hatchetPass = hatchetDone;
  const chestPass   = chestDone;

  console.log(`hatchet-bootstrap-arena: ${hatchetPass ? "PASS" : "FAIL (deadline)"}`);
  if (lastHatchetState) console.log(`  last state: ${lastHatchetState}`);

  console.log(`chest-bootstrap-arena:   ${chestPass   ? "PASS" : "FAIL (deadline)"}`);
  if (lastChestState) console.log(`  last state: ${lastChestState}`);

  console.log();

  // ── CLEANUP ────────────────────────────────────────────────────────────────
  await cleanup(opts);

  if (!hatchetPass || !chestPass) {
    process.exitCode = 1;
  }
}

async function cleanup(opts) {
  console.log("arena-bootstrap: running cleanup...");
  const cmds = [
    "validate hatchet-bootstrap-arena-cleanup",
    "validate chest-bootstrap-arena-cleanup",
  ];
  await Promise.all(cmds.map(async (cmd) => {
    try {
      const out = await sendCommand(opts, cmd);
      console.log(`> ${cmd}`);
      if (out) console.log(out);
    } catch (e) {
      console.log(`> ${cmd} [error: ${e.message}]`);
    }
  }));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    return;
  }

  if (!Number.isInteger(opts.port) || opts.port <= 0) {
    throw new Error("SynthRCON port must be a positive integer.");
  }
  await runArenas(opts);
}

main().catch((err) => {
  console.error(`arena-bootstrap: ${err.message}`);
  process.exitCode = 1;
});
