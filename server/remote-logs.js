#!/usr/bin/env node
/*
 * Remote Hytale server log inspector for the Mac host configured in remote-host.env.
 *
 * Local logs:  node tools/server/logs.js ...
 * Remote logs: node tools/server/remote-logs.js ...
 */

"use strict";

const path = require("node:path");

const {
  SAVE_RCON_PORTS,
  configureRemoteHost,
  remoteSaveDir,
  remotePathQuote,
  sshRun,
} = require("../library/remote-host");

const DEFAULT_AUTH_PATTERN = "auth|authorization|device/verify|user_code|serverAuthUnavailable|Mutual authentication|Token Source|Credential storage";
const DEFAULT_BOOT_PATTERN = "Booting up HytaleServer|Hytale Server Booted|Authentication mode|Authentication successful|No server tokens configured|Enabled plugin|SynthRCON listening|SynthOverseer setup complete|SynthTerrascape started|SEVERE|ERROR";

function usage() {
  console.log(`Usage:
  node tools/server/remote-logs.js list
  node tools/server/remote-logs.js newest <save>
  node tools/server/remote-logs.js tail <save> [-n N]
  node tools/server/remote-logs.js grep <save> <pattern> [-n N]
  node tools/server/remote-logs.js boot <save> [-n N]
  node tools/server/remote-logs.js auth <save> [-n N]

Known saves: ${Object.keys(SAVE_RCON_PORTS).join(", ")}

Examples:
  node tools/server/remote-logs.js list
  node tools/server/remote-logs.js tail overseer-test -n 80
  node tools/server/remote-logs.js auth synth-worldview-mvp
  node tools/server/remote-logs.js grep overseer-test "serverAuthUnavailable|Mutual authentication"
`);
}

function parseArgs(argv) {
  const opts = { _: [], lines: 80 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        opts.help = true;
        return opts;
      case "-n":
      case "--lines":
        opts.lines = Number(requireValue(argv, ++i, arg));
        break;
      default:
        if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
        opts._.push(arg);
    }
  }
  return opts;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || String(value).startsWith("-")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function logsGlob(saveName) {
  return `${remotePathQuote(path.posix.join(remoteSaveDir(saveName), "logs"))}/*_server.log`;
}

function newestLogCommand(saveName) {
  return `ls -t ${logsGlob(saveName)} 2>/dev/null | head -1`;
}

function newestLog(saveName) {
  const out = sshRun(newestLogCommand(saveName), { silent: true }).trim();
  if (!out) throw new Error(`No remote server logs found for ${saveName}`);
  return out;
}

function cmdList() {
  for (const saveName of Object.keys(SAVE_RCON_PORTS)) {
    const command = [
      `L=$(${newestLogCommand(saveName)})`,
      `if [ -z "$L" ]; then echo ${shQuote(saveName)}" DOWN no-log"; else`,
      `MT=$(stat -f '%Sm' -t '%Y-%m-%dT%H:%M:%S' "$L" 2>/dev/null || true)`,
      `SZ=$(stat -f '%z' "$L" 2>/dev/null || echo 0)`,
      `echo ${shQuote(saveName)}" log=$L mtime=$MT size=$SZ"`,
      "fi",
    ].join("; ");
    process.stdout.write(sshRun(command, { silent: true }));
  }
}

function cmdNewest(opts) {
  const saveName = opts._[0];
  if (!saveName) throw new Error("newest requires a save name");
  console.log(newestLog(saveName));
}

function cmdTail(opts) {
  const saveName = opts._[0];
  if (!saveName) throw new Error("tail requires a save name");
  const file = newestLog(saveName);
  console.log(`# ${file}`);
  process.stdout.write(sshRun(`tail -n ${Number(opts.lines) || 80} ${remotePathQuote(file)}`, { silent: true }));
}

function cmdGrep(opts, patternOverride = null) {
  const saveName = opts._[0];
  const pattern = patternOverride || opts._[1];
  if (!saveName || !pattern) throw new Error("grep requires <save> <pattern>");
  const file = newestLog(saveName);
  console.log(`# ${file}`);
  const command = `grep -Ein -- ${shQuote(pattern)} ${remotePathQuote(file)} | tail -n ${Number(opts.lines) || 80}`;
  const out = sshRun(command, { silent: true });
  process.stdout.write(out || `(no matches for ${pattern})\n`);
}

function main() {
  configureRemoteHost({ remote: true });

  const argv = process.argv.slice(2);
  const command = argv[0];
  if (!command || command === "-h" || command === "--help") {
    usage();
    return;
  }

  const opts = parseArgs(argv.slice(1));
  if (opts.help) {
    usage();
    return;
  }

  switch (command) {
    case "list":
      cmdList();
      break;
    case "newest":
      cmdNewest(opts);
      break;
    case "tail":
      cmdTail(opts);
      break;
    case "grep":
      cmdGrep(opts);
      break;
    case "boot":
      cmdGrep(opts, DEFAULT_BOOT_PATTERN);
      break;
    case "auth":
      cmdGrep(opts, DEFAULT_AUTH_PATTERN);
      break;
    default:
      usage();
      throw new Error(`Unknown subcommand: ${command}`);
  }
}

try {
  main();
} catch (err) {
  console.error(`remote-logs: ${err.message}`);
  process.exitCode = 1;
}
