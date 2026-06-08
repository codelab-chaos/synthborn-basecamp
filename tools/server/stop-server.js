#!/usr/bin/env node
/*
 * Sends `stop` to the running Hytale server via SynthRCON for a clean shutdown.
 *
 * No external dependencies — uses Node's built-in http like synth-rcon.js.
 *
 * Usage:
 *   node tools/server/stop-server.js [--save <name-or-path>] [--host X] [--port N] [--token X] [--timeout 30000]
 *
 * Resolution order for host/port: CLI flag → <save>/dev-server.json → env var → default (127.0.0.1:25576)
 * Environment fallbacks: HYTALE_SAVE, SYNTH_RCON_HOST, SYNTH_RCON_PORT, SYNTH_RCON_TOKEN, SYNTH_RCON_TIMEOUT_MS
 */

"use strict";

const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const {
  configureRemoteHost,
  parseRemoteFlags,
  stripRemoteFlags,
  isRemoteEnabled,
} = require("../library/remote-host");

configureRemoteHost(parseRemoteFlags(process.argv.slice(2)));

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 25576;
const DEFAULT_TIMEOUT_MS = 30000;

function usage() {
  console.log(`Usage:
  node tools/server/stop-server.js [options]

Options:
  --save <name|path>  Save to target — name under %APPDATA%/Hytale/UserData/Saves or absolute path.
                      The save's dev-server.json supplies rconHost/rconPort if no flag is given.
  --host <host>       SynthRCON host (overrides save config; default: ${DEFAULT_HOST}).
  --port <port>       SynthRCON port (overrides save config; default: ${DEFAULT_PORT}).
  --token <value>     SynthRCON token (or SYNTH_RCON_TOKEN env var).
  --timeout <ms>      Request timeout in ms (default: ${DEFAULT_TIMEOUT_MS}).
  --local             RCON to 127.0.0.1; overrides HYTALE_REMOTE_ENABLED
  --remote            RCON to Mac host; overrides HYTALE_REMOTE_ENABLED
  --help, -h          Show this help.

Resolution order for host/port: CLI flag > <save>/dev-server.json > env var > default.
`);
}

function parseArgs(argv) {
  argv = stripRemoteFlags(argv);
  const opts = {
    save: process.env.HYTALE_SAVE || null,
    host: null,
    port: null,
    token: process.env.SYNTH_RCON_TOKEN || "",
    timeoutMs: Number(process.env.SYNTH_RCON_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${arg} requires a value`);
      return v;
    };
    switch (arg) {
      case "-h":
      case "--help": opts.help = true; return opts;
      case "--save": opts.save = next(); break;
      case "--host": opts.host = next(); break;
      case "--port": opts.port = Number(next()); break;
      case "--token": opts.token = next(); break;
      case "--timeout": opts.timeoutMs = Number(next()); break;
      default: throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

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
    console.warn(`stop-server: ignoring malformed ${file} (${err.message})`);
    return {};
  }
}

function sendStop(opts) {
  const payload = JSON.stringify({ command: "stop" });
  const headers = {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    Accept: "application/json",
  };
  if (opts.token) headers["X-SynthRCON-Token"] = opts.token;

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: opts.host,
        port: opts.port,
        path: "/command",
        method: "POST",
        headers,
        timeout: opts.timeoutMs,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => { data += c; });
        res.on("end", () => {
          // The server is shutting down — it may close mid-response.
          // Treat any 2xx (or hang-up after dispatch) as success.
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(data ? JSON.parse(data) : {}); }
            catch { resolve({}); }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("stop request timed out")));
    req.on("error", (err) => {
      // ECONNRESET / EPIPE while server tears down is expected.
      if (["ECONNRESET", "EPIPE"].includes(err.code)) resolve({ note: "connection closed by server" });
      else reject(err);
    });
    req.end(payload);
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { usage(); return; }

  const saveConfig = loadSaveConfig(resolveSavePath(opts.save));
  const host = opts.host
    || (isRemoteEnabled() && process.env.SYNTH_RCON_HOST ? process.env.SYNTH_RCON_HOST : null)
    || saveConfig.rconHost
    || process.env.SYNTH_RCON_HOST
    || DEFAULT_HOST;
  const port = opts.port || saveConfig.rconPort || Number(process.env.SYNTH_RCON_PORT) || DEFAULT_PORT;

  if (!Number.isInteger(port) || port <= 0) throw new Error("port must be a positive integer");

  const resolved = { ...opts, host, port };
  console.log(`Sending stop to ${host}:${port} ...`);
  const result = await sendStop(resolved);
  if (result.messages?.length) console.log(result.messages.join("\n"));
  if (result.note) console.log(result.note);
  console.log("Stop dispatched.");
}

main().catch((err) => {
  console.error(`stop-server: ${err.message}`);
  process.exitCode = 1;
});
