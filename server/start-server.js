#!/usr/bin/env node
/*
 * Launches the Hytale dedicated server independent of the client.
 *
 * Cross-platform: Windows, Linux, macOS. Uses only Node built-ins.
 *
 * Defaults are tuned for local single-developer use: offline auth, save at
 * synth-test-01 (Windows), bundled JRE, AOT cache enabled.
 *
 * Usage:
 *   node tools/server/start-server.js [options] [-- <extra HytaleServer args>]
 *
 * Options:
 *   --save <path>          Save directory (cwd for the server)
 *   --install <path>       Hytale install root (contains game/latest/Server/...)
 *   --java <path>          Override java executable (default: bundled JRE)
 *   --auth-mode <mode>     authenticated | offline | insecure (default: offline)
 *   --bind <addr:port>     --bind value. Resolution: this flag → <save>/dev-server.json `bind` field
 *                          → $HYTALE_BIND → 0.0.0.0:5520 (Hytale default).
 *   --min-ram <GB>         -Xms in GB (default: 2)
 *   --max-ram <GB>         -Xmx in GB (default: 4)
 *   --no-aot               Skip -XX:AOTCache
 *   --skip-running-check   Do not check whether the bind port is already in use
 *   --background           Spawn detached and return
 *   --dry-run              Print the command without launching
 *   --help, -h             Show this help
 *
 * Environment fallbacks:
 *   HYTALE_SAVE, HYTALE_INSTALL, HYTALE_JAVA
 */

"use strict";

const fs = require("node:fs");
const dgram = require("node:dgram");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const { configureRemoteHost, parseRemoteFlags } = require("../library/remote-host");

configureRemoteHost(parseRemoteFlags(process.argv.slice(2)));

const IS_WINDOWS = process.platform === "win32";
const JAVA_BIN = IS_WINDOWS ? "java.exe" : "java";

function readPatchline(hytaleRoot) {
  // The launcher records the active branch (release | pre-release) here.
  try {
    const raw = fs.readFileSync(path.join(hytaleRoot, "patchline.json"), "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.patchline === "string" && parsed.patchline) return parsed.patchline;
  } catch { /* fall through */ }
  return null;
}

function defaultInstall() {
  if (process.env.HYTALE_INSTALL) return process.env.HYTALE_INSTALL;
  if (IS_WINDOWS && process.env.APPDATA) {
    const hytaleRoot = path.join(process.env.APPDATA, "Hytale");
    const installRoot = path.join(hytaleRoot, "install");
    const candidates = [readPatchline(hytaleRoot), "release", "pre-release"].filter(Boolean);
    for (const branch of candidates) {
      const candidate = path.join(installRoot, branch, "package");
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  // No reliable cross-distro default for Linux/macOS — let user pass --install.
  return null;
}

function defaultSave() {
  if (process.env.HYTALE_SAVE) return process.env.HYTALE_SAVE;
  if (IS_WINDOWS && process.env.APPDATA) {
    // overseer-test is the SynthOverseer dev save; synthtest-02 is the SynthUnits save.
    // Override with HYTALE_SAVE or --save to point elsewhere.
    return path.join(process.env.APPDATA, "Hytale", "UserData", "Saves", "overseer-test");
  }
  return null;
}

function usage() {
  console.log(`Usage:
  node tools/server/start-server.js [options] [-- <extra HytaleServer args>]

Options:
  --save <path>          Save directory (cwd for the server)
  --install <path>       Hytale install root (contains game/latest/Server/...)
  --java <path>          Override java executable (default: bundled JRE)
  --auth-mode <mode>     authenticated | offline | insecure (default: offline)
  --bind <addr:port>     --bind value. Falls back to <save>/dev-server.json then env HYTALE_BIND then 0.0.0.0:5520.
  --min-ram <GB>         -Xms in GB (default: 2)
  --max-ram <GB>         -Xmx in GB (default: 4)
  --no-aot               Skip -XX:AOTCache
  --skip-running-check   Do not check whether the bind port is already in use
  --background           Spawn detached and return
  --dry-run              Print the command without launching
  --help, -h             Show this help

Environment fallbacks:
  HYTALE_SAVE, HYTALE_INSTALL, HYTALE_JAVA

Examples:
  node tools/server/start-server.js
  node tools/server/start-server.js --background
  node tools/server/start-server.js --auth-mode authenticated
  node tools/server/start-server.js -- --boot-command "synth list"
`);
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || (typeof value === "string" && value.startsWith("--") && value !== "--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parseArgs(argv) {
  const opts = {
    save: defaultSave(),
    install: defaultInstall(),
    java: process.env.HYTALE_JAVA || null,
    authMode: "authenticated",
    bind: null,                  // resolved later: --bind > <save>/dev-server.json > $HYTALE_BIND > default
    minRamGB: 2,
    maxRamGB: 4,
    noAot: false,
    skipRunningCheck: false,
    background: false,
    dryRun: false,
    extra: [],
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i++];
    switch (arg) {
      case "-h":
      case "--help":
        opts.help = true;
        return opts;
      case "--save":
        opts.save = requireValue(argv, i++, arg);
        break;
      case "--install":
        opts.install = requireValue(argv, i++, arg);
        break;
      case "--java":
        opts.java = requireValue(argv, i++, arg);
        break;
      case "--auth-mode":
        opts.authMode = requireValue(argv, i++, arg);
        break;
      case "--bind":
        opts.bind = requireValue(argv, i++, arg);
        break;
      case "--min-ram":
        opts.minRamGB = Number(requireValue(argv, i++, arg));
        break;
      case "--max-ram":
        opts.maxRamGB = Number(requireValue(argv, i++, arg));
        break;
      case "--no-aot":
        opts.noAot = true;
        break;
      case "--skip-running-check":
        opts.skipRunningCheck = true;
        break;
      case "--background":
        opts.background = true;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--":
        opts.extra = argv.slice(i);
        i = argv.length;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function mustExist(p, label) {
  if (!p) throw new Error(`${label} not set (pass the flag or env var).`);
  if (!fs.existsSync(p)) throw new Error(`${label} not found at: ${p}`);
  return path.resolve(p);
}

function resolveBundledJava(install) {
  const candidates = [
    path.join(install, "jre", "latest", "Contents", "Home", "bin", JAVA_BIN),
    path.join(install, "jre", "latest", "bin", JAVA_BIN),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[candidates.length - 1];
}

/**
 * Read a per-save dev-server.json if it exists. Returns a partial config object
 * (any subset of bind/rconHost/rconPort), or {} if no file or parse failure.
 *
 * Shared with stop-server.js and synth-rcon.js (each duplicates this logic with
 * a small helper rather than introducing a shared module — keep tools self-contained).
 */
function loadSaveConfig(savePath) {
  if (!savePath) return {};
  const file = path.join(savePath, "dev-server.json");
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    const out = {};
    if (typeof parsed.bind === "string") out.bind = parsed.bind;
    if (typeof parsed.rconHost === "string") out.rconHost = parsed.rconHost;
    if (Number.isInteger(parsed.rconPort)) out.rconPort = parsed.rconPort;
    return out;
  } catch (err) {
    console.warn(`start-server: ignoring malformed ${file} (${err.message})`);
    return {};
  }
}

const DEFAULT_BIND = "0.0.0.0:5520";   // Hytale default; overridden by save's dev-server.json
const VALID_AUTH = new Set(["authenticated", "offline", "insecure"]);

function parseBind(bind) {
  const value = String(bind || "").trim();
  const lastColon = value.lastIndexOf(":");
  if (lastColon <= 0 || lastColon === value.length - 1) {
    throw new Error(`--bind must be in host:port form, got: ${bind}`);
  }

  const host = value.slice(0, lastColon).replace(/^\[(.*)\]$/, "$1");
  const port = Number(value.slice(lastColon + 1));
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`--bind port must be between 1 and 65535, got: ${value.slice(lastColon + 1)}`);
  }

  return { host, port };
}

function canBindUdp({ host, port }) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket(host.includes(":") ? "udp6" : "udp4");
    let settled = false;

    const closeWith = (result) => {
      if (settled) return;
      settled = true;
      socket.close(() => resolve(result));
    };

    socket.once("error", (err) => {
      if (settled) return;
      settled = true;
      socket.close(() => {
        if (err.code === "EADDRINUSE" || err.code === "EACCES") resolve(false);
        else reject(err);
      });
    });
    socket.once("listening", () => closeWith(true));
    socket.bind({ address: host, port, exclusive: true });
  });
}

async function assertServerPortAvailable(bind) {
  const available = await canBindUdp(parseBind(bind));
  if (available) return;

  throw new Error(
    `another server is already listening on ${bind}. ` +
    "Stop it first with `node tools/server/stop-server.js` if SynthRCON is available, " +
    "or free the port manually. Pass --skip-running-check to bypass this guard."
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    return;
  }

  // Resolve bind + SynthRCON host/port from --flag > save's dev-server.json > env > defaults.
  // The host/port travel to the SynthRCON plugin as JVM system properties; the plugin reads
  // `synthrcon.host` / `synthrcon.port` at boot. dev-server.json is the single source of truth
  // both for our CLI tools and for the actual plugin bind, so they always agree.
  const saveConfig = loadSaveConfig(opts.save);
  if (!opts.bind) {
    opts.bind = saveConfig.bind
      || (process.env.HYTALE_BIND && process.env.HYTALE_BIND.trim())
      || DEFAULT_BIND;
  }
  opts.rconHost = saveConfig.rconHost || null;
  opts.rconPort = saveConfig.rconPort || null;

  if (!VALID_AUTH.has(opts.authMode)) {
    throw new Error(`--auth-mode must be one of ${[...VALID_AUTH].join(", ")}`);
  }
  if (!Number.isFinite(opts.minRamGB) || opts.minRamGB <= 0) throw new Error("--min-ram must be > 0");
  if (!Number.isFinite(opts.maxRamGB) || opts.maxRamGB < opts.minRamGB) {
    throw new Error("--max-ram must be >= --min-ram");
  }

  const install = mustExist(opts.install, "Hytale install root");
  const save = mustExist(opts.save, "Save directory");
  const serverDir = path.join(install, "game", "latest", "Server");
  const jar = mustExist(path.join(serverDir, "HytaleServer.jar"), "HytaleServer.jar");
  const assets = mustExist(path.join(install, "game", "latest", "Assets.zip"), "Assets.zip");

  const java = opts.java
    ? mustExist(opts.java, "java executable")
    : mustExist(resolveBundledJava(install), "Bundled JRE");

  const aotPath = path.join(serverDir, "HytaleServer.aot");
  const useAot = !opts.noAot && fs.existsSync(aotPath);

  const jvmArgs = [`-Xms${opts.minRamGB}G`, `-Xmx${opts.maxRamGB}G`];
  if (useAot) jvmArgs.push(`-XX:AOTCache=${aotPath}`);
  // Forward dev-server.json's rconHost/rconPort so the SynthRCON plugin binds where we expect.
  if (opts.rconHost) jvmArgs.push(`-Dsynthrcon.host=${opts.rconHost}`);
  if (opts.rconPort) jvmArgs.push(`-Dsynthrcon.port=${opts.rconPort}`);
  jvmArgs.push("-jar", jar);

  const serverArgs = [
    "--assets", assets,
    "--auth-mode", opts.authMode,
    "--bind", opts.bind,
    ...opts.extra,
  ];

  const allArgs = [...jvmArgs, ...serverArgs];

  console.log("Hytale server launch");
  console.log(`  save     : ${save}`);
  console.log(`  jar      : ${jar}`);
  console.log(`  assets   : ${assets}`);
  console.log(`  java     : ${java}`);
  console.log(`  auth     : ${opts.authMode}`);
  console.log(`  bind     : ${opts.bind}`);
  console.log(`  ram      : ${opts.minRamGB}G..${opts.maxRamGB}G`);
  console.log(`  aot      : ${useAot ? "on" : "off"}`);
  if (opts.extra.length) console.log(`  extra    : ${opts.extra.join(" ")}`);
  console.log("");

  if (opts.dryRun) {
    console.log(`> ${java} ${allArgs.join(" ")}`);
    return;
  }

  if (!opts.skipRunningCheck) {
    await assertServerPortAvailable(opts.bind);
  }

  if (opts.background) {
    const child = spawn(java, allArgs, {
      cwd: save,
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.unref();
    console.log(`Started detached. PID = ${child.pid}. Logs: ${path.join(save, "logs")}`);
    console.log(`Stop with: node tools/server/stop-server.js`);
    return;
  }

  const child = spawn(java, allArgs, {
    cwd: save,
    stdio: "inherit",
  });

  const forward = (signal) => () => {
    if (!child.killed) child.kill(signal);
  };
  process.on("SIGINT", forward("SIGINT"));
  process.on("SIGTERM", forward("SIGTERM"));

  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error(`start-server: ${err.message}`);
  process.exitCode = 1;
});
