#!/usr/bin/env node
/*
 * Hytale server log inspector. Wraps the file-system + grep patterns we keep running
 * by hand against `<save>/logs/*.log` so they don't show up as ad-hoc Bash calls.
 *
 * Subcommands:
 *   list                              Table of all saves with their newest log + activity.
 *   active                            Just the saves whose newest log is being written right now.
 *   newest <save>                     Print the path of the newest log for that save.
 *   tail <save> [-n N]                Last N lines of the newest log (default 30).
 *   grep <save> <pattern> [-A N] [-B N] [-C N] [--limit N]
 *                                     Regex search in the newest log. Default limit 50 matches.
 *   boot <save>                       Extract a summary of the most recent boot: version, auth,
 *                                     enabled plugins, last shutdown (if any).
 *
 * Cross-platform Node, no deps. Defaults to %APPDATA%\Hytale\UserData\Saves on Windows;
 * override the root with HYTALE_SAVES env var or `--saves-root <dir>`.
 */

"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function defaultSavesRoot() {
  if (process.env.HYTALE_SAVES) return process.env.HYTALE_SAVES;
  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "Hytale", "UserData", "Saves");
  }
  return null;
}

function parseArgs(argv) {
  const opts = { _: [], savesRoot: defaultSavesRoot(), json: false, lines: 30, limit: 50,
                 contextBefore: 0, contextAfter: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} requires a value`);
      return v;
    };
    switch (a) {
      case "-h": case "--help": opts.help = true; return opts;
      case "--json": opts.json = true; break;
      case "--saves-root": opts.savesRoot = next(); break;
      case "-n": case "--lines": opts.lines = Number(next()); break;
      case "--limit": opts.limit = Number(next()); break;
      case "-A": case "--after": opts.contextAfter = Number(next()); break;
      case "-B": case "--before": opts.contextBefore = Number(next()); break;
      case "-C": case "--context":
        { const v = Number(next()); opts.contextBefore = v; opts.contextAfter = v; }
        break;
      default:
        if (a.startsWith("-")) throw new Error(`Unknown option: ${a}`);
        opts._.push(a);
    }
  }
  return opts;
}

function usage() {
  console.log(`Usage:
  node tools/server/logs.js list                                 # all saves + newest log
  node tools/server/logs.js active                               # saves with a live log
  node tools/server/logs.js newest <save>                        # path of newest log
  node tools/server/logs.js tail <save> [-n N]                   # tail last N lines (default 30)
  node tools/server/logs.js grep <save> <pattern> [-A N] [-B N] [-C N] [--limit N]
  node tools/server/logs.js boot <save>                          # boot summary

Options:
  --saves-root <dir>     Override saves directory (env: HYTALE_SAVES).
                         Default on Windows: %APPDATA%\\Hytale\\UserData\\Saves
  --json                 Emit machine-readable output where supported (list/active/boot).
  --help, -h             Show this help.

Examples:
  node tools/server/logs.js list
  node tools/server/logs.js active
  node tools/server/logs.js tail overseer-test -n 50
  node tools/server/logs.js grep overseer-test "SynthOverseer|Enabled plugin"
  node tools/server/logs.js grep overseer-test "Authentication" -C 2
  node tools/server/logs.js boot overseer-test
`);
}

function listSaves(root) {
  if (!root || !fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);
}

function newestLogInSave(root, save) {
  const logsDir = path.join(root, save, "logs");
  if (!fs.existsSync(logsDir)) return null;
  let best = null;
  for (const f of fs.readdirSync(logsDir)) {
    if (!f.endsWith(".log")) continue;
    const full = path.join(logsDir, f);
    const st = fs.statSync(full);
    if (!best || st.mtimeMs > best.mtimeMs) {
      best = { save, name: f, full, mtimeMs: st.mtimeMs, size: st.size };
    }
  }
  return best;
}

function isLogActive(entry, withinMs = 30000) {
  // A live server writes log lines on a sub-second cadence (ticks, telemetry).
  // If the file hasn't been touched in 30s, it's almost certainly stopped.
  if (!entry) return false;
  return Date.now() - entry.mtimeMs < withinMs;
}

function shutdownInLog(file) {
  // Cheap check: read tail of the file, look for "Shutdown completed!".
  const buf = readTail(file, 8 * 1024);
  return buf.includes("Shutdown completed!");
}

function readTail(file, bytes) {
  const st = fs.statSync(file);
  if (st.size <= bytes) return fs.readFileSync(file, "utf8");
  const fd = fs.openSync(file, "r");
  try {
    const start = st.size - bytes;
    const data = Buffer.alloc(bytes);
    fs.readSync(fd, data, 0, bytes, start);
    return data.toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

function fmtRelativeMs(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function fmtBytes(b) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}K`;
  return `${(b / 1024 / 1024).toFixed(1)}M`;
}

function cmdList(opts) {
  const root = opts.savesRoot;
  const rows = [];
  for (const save of listSaves(root)) {
    const log = newestLogInSave(root, save);
    if (!log) { rows.push({ save, log: null, active: false }); continue; }
    const active = isLogActive(log) && !shutdownInLog(log.full);
    rows.push({ save, log, active });
  }
  rows.sort((a, b) => (b.log?.mtimeMs ?? 0) - (a.log?.mtimeMs ?? 0));

  if (opts.json) {
    console.log(JSON.stringify(rows.map(r => ({
      save: r.save,
      newestLog: r.log?.name ?? null,
      mtime: r.log ? new Date(r.log.mtimeMs).toISOString() : null,
      sizeBytes: r.log?.size ?? 0,
      active: r.active,
    })), null, 2));
    return;
  }

  const now = Date.now();
  console.log("save".padEnd(22) + "  active  newest log".padEnd(40) + "  age      size");
  console.log("-".repeat(22) + "  " + "-".repeat(6) + "  " + "-".repeat(36) + "  " + "-".repeat(7) + "  " + "-".repeat(6));
  for (const r of rows) {
    const flag = r.active ? "LIVE" : "—";
    const name = r.log?.name ?? "<no logs>";
    const age = r.log ? fmtRelativeMs(now - r.log.mtimeMs) : "—";
    const size = r.log ? fmtBytes(r.log.size) : "—";
    console.log(`${r.save.padEnd(22)}  ${flag.padEnd(6)}  ${name.padEnd(36)}  ${age.padEnd(7)}  ${size}`);
  }
}

function cmdActive(opts) {
  const root = opts.savesRoot;
  const live = [];
  for (const save of listSaves(root)) {
    const log = newestLogInSave(root, save);
    if (!log) continue;
    if (isLogActive(log) && !shutdownInLog(log.full)) live.push({ save, log });
  }
  if (opts.json) {
    console.log(JSON.stringify(live.map(r => ({
      save: r.save,
      newestLog: r.log.name,
      mtime: new Date(r.log.mtimeMs).toISOString(),
      ageSeconds: Math.round((Date.now() - r.log.mtimeMs) / 1000),
    })), null, 2));
    return;
  }
  if (!live.length) { console.log("No active servers found."); return; }
  for (const r of live) {
    const age = fmtRelativeMs(Date.now() - r.log.mtimeMs);
    console.log(`${r.save}\t${r.log.full}\tage=${age}`);
  }
}

function cmdNewest(opts) {
  const save = opts._[0];
  if (!save) throw new Error("newest requires a save name");
  const log = newestLogInSave(opts.savesRoot, save);
  if (!log) throw new Error(`No logs for save: ${save}`);
  console.log(log.full);
}

function cmdTail(opts) {
  const save = opts._[0];
  if (!save) throw new Error("tail requires a save name");
  const log = newestLogInSave(opts.savesRoot, save);
  if (!log) throw new Error(`No logs for save: ${save}`);
  const lines = fs.readFileSync(log.full, "utf8").split(/\r?\n/);
  const slice = lines.slice(-Math.max(1, opts.lines));
  for (const line of slice) console.log(line);
}

function cmdGrep(opts) {
  const save = opts._[0];
  const pattern = opts._[1];
  if (!save || !pattern) throw new Error("grep requires <save> <pattern>");
  const log = newestLogInSave(opts.savesRoot, save);
  if (!log) throw new Error(`No logs for save: ${save}`);
  const re = new RegExp(pattern);
  const lines = fs.readFileSync(log.full, "utf8").split(/\r?\n/);
  const before = Math.max(0, opts.contextBefore);
  const after = Math.max(0, opts.contextAfter);
  const limit = Math.max(1, opts.limit);

  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      hits.push(i);
      if (hits.length >= limit) break;
    }
  }
  if (!hits.length) { console.log(`(no matches in ${log.name})`); return; }
  console.log(`# ${log.full}`);
  console.log(`# ${hits.length} match${hits.length === 1 ? "" : "es"}` + (hits.length === limit ? ` (limit ${limit})` : ""));
  const printed = new Set();
  for (const h of hits) {
    const start = Math.max(0, h - before);
    const end = Math.min(lines.length - 1, h + after);
    if (printed.size && start > 0 && !printed.has(start - 1)) console.log("--");
    for (let i = start; i <= end; i++) {
      if (printed.has(i)) continue;
      const marker = i === h ? ":" : "-";
      console.log(`${(i + 1).toString().padStart(6)}${marker} ${lines[i]}`);
      printed.add(i);
    }
  }
}

function cmdBoot(opts) {
  const save = opts._[0];
  if (!save) throw new Error("boot requires a save name");
  const log = newestLogInSave(opts.savesRoot, save);
  if (!log) throw new Error(`No logs for save: ${save}`);
  const text = fs.readFileSync(log.full, "utf8");

  const grab = (re) => {
    const m = re.exec(text);
    return m ? m[1].trim() : null;
  };
  const grabAll = (re) => {
    const out = [];
    let m;
    while ((m = re.exec(text)) !== null) out.push(m[1].trim());
    return out;
  };

  const summary = {
    log: log.full,
    booted: grab(/Booting up HytaleServer - Version: ([^,]+)/),
    revision: grab(/Booting up HytaleServer - Version: [^,]+, Revision: (\w+)/),
    authMode: grab(/Authentication mode: (\w+)/),
    authResult: grab(/Authentication successful! Mode: (\w+)/),
    profile: grab(/Auto-selected profile: ([^\n]+?)\s*$/m),
    serverBooted: /Hytale Server Booted!/.test(text),
    serverBootElapsed: grab(/Hytale Server Booted!.*took ([^\n]+?)$/m),
    bindings: grabAll(/Server certificate registered.*\n.*?L:\/?([^\]\n]+)\]/g),
    enabledPlugins: grabAll(/Enabled plugin (\S+)/g),
    shuttingDown: /Shutdown triggered!!!/.test(text) || /Shutdown completed!/.test(text),
    shutdownCompleted: /Shutdown completed!/.test(text),
    stopTriggeredBy: grab(/SynthRCON executed command: (stop)/),
    severeCount: (text.match(/SEVERE/g) || []).length,
  };

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  console.log(`Save:           ${save}`);
  console.log(`Log:            ${log.full}`);
  console.log(`Server version: ${summary.booted || "?"}` + (summary.revision ? ` (${summary.revision})` : ""));
  console.log(`Auth mode:      ${summary.authMode || "?"}` + (summary.authResult ? ` (resolved: ${summary.authResult})` : ""));
  if (summary.profile) console.log(`Profile:        ${summary.profile}`);
  console.log(`Booted:         ${summary.serverBooted ? "yes" : "no"}` + (summary.serverBootElapsed ? ` in ${summary.serverBootElapsed}` : ""));
  console.log(`Enabled plugins (${summary.enabledPlugins.length}):`);
  for (const p of summary.enabledPlugins) console.log(`  ${p}`);
  console.log(`SEVERE count:   ${summary.severeCount}`);
  console.log(`Shutdown:       ${summary.shutdownCompleted ? "completed" : summary.shuttingDown ? "in progress" : "no"}`);
  if (summary.stopTriggeredBy) console.log(`Stop trigger:   SynthRCON received \`${summary.stopTriggeredBy}\``);
}

function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === "-h" || cmd === "--help") { usage(); return; }

  const opts = parseArgs(argv.slice(1));
  if (opts.help) { usage(); return; }
  if (!opts.savesRoot) throw new Error("Could not determine saves root. Set HYTALE_SAVES or pass --saves-root.");

  switch (cmd) {
    case "list":    cmdList(opts); break;
    case "active":  cmdActive(opts); break;
    case "newest":  cmdNewest(opts); break;
    case "tail":    cmdTail(opts); break;
    case "grep":    cmdGrep(opts); break;
    case "boot":    cmdBoot(opts); break;
    default:        usage(); throw new Error(`Unknown subcommand: ${cmd}`);
  }
}

try {
  main();
} catch (err) {
  console.error(`logs: ${err.message}`);
  process.exitCode = 1;
}
