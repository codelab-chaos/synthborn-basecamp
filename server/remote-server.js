#!/usr/bin/env node
/*
 * Start/stop/restart Hytale servers on the Mac host configured in remote-host.env.
 *
 * Stop uses SSH to POST `stop` to SynthRCON on the Mac localhost (SynthRCON rejects
 * remote /command from the LAN). Start uses SSH to launch java on the Mac.
 *
 * Usage:
 *   node tools/server/remote-server.js start overseer-test [--max-ram 6] [--wait]
 *   node tools/server/remote-server.js stop overseer-test
 *   node tools/server/remote-server.js restart synthtest-02 [--wait]
 *   node tools/server/remote-server.js status overseer-test
 *   node tools/server/remote-server.js status --all
 */

"use strict";

const {
  configureRemoteHost,
  requireRemoteHostConfig,
  SAVE_RCON_PORTS,
  resolveSaveRconPort,
  remoteServerHealth,
  remoteStopServer,
  remoteStartServer,
  remoteRestartServer,
  waitForRemoteHealth,
  sshTarget,
  printModeBanner,
} = require("../library/remote-host");

function usage() {
  console.log(`Usage:
  node tools/server/remote-server.js start <save> [--max-ram N] [--min-ram N] [--wait]
  node tools/server/remote-server.js stop <save> [--force] [--force]
  node tools/server/remote-server.js restart <save> [--max-ram N] [--wait] [--force]
  node tools/server/remote-server.js status <save>
  node tools/server/remote-server.js status --all

Known saves (RCON ports): ${Object.entries(SAVE_RCON_PORTS).map(([s, p]) => `${s}=${p}`).join(", ")}

Configure mods/SynthOverseer/remote-host.env (or SynthUnits):
  HYTALE_REMOTE_SSH, HYTALE_REMOTE_SAVES, HYTALE_REMOTE_REPO, HYTALE_REMOTE_INSTALL`);
}

function parseArgs(argv) {
  const opts = {
    command: null,
    save: null,
    all: false,
    wait: false,
    force: false,
    maxRamGB: null,
    minRamGB: null,
    skipRunningCheck: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        opts.help = true;
        return opts;
      case "--all":
        opts.all = true;
        break;
      case "--wait":
        opts.wait = true;
        break;
      case "--force":
        opts.force = true;
        break;
      case "--skip-running-check":
        opts.skipRunningCheck = true;
        break;
      case "--max-ram":
        opts.maxRamGB = Number(argv[++i]);
        break;
      case "--min-ram":
        opts.minRamGB = Number(argv[++i]);
        break;
      default:
        if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
        if (!opts.command) opts.command = arg;
        else if (!opts.save) opts.save = arg;
        else throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  return opts;
}

function serverOptions(opts) {
  return {
    maxRamGB: opts.maxRamGB,
    minRamGB: opts.minRamGB,
    skipRunningCheck: opts.skipRunningCheck,
    wait: opts.wait,
    force: opts.force,
  };
}

function printStatus(saveName) {
  const port = resolveSaveRconPort(saveName);
  const health = remoteServerHealth(saveName);
  const state = health.ok ? "UP" : "DOWN";
  console.log(`${saveName.padEnd(22)} ${state.padEnd(6)} rcon=${port ?? "?"} host=${process.env.SYNTH_RCON_HOST || "?"}`);
  if (optsVerbose() && health.output) {
    console.log(health.output);
  }
}

let verbose = false;
function optsVerbose() { return verbose; }

function main() {
  configureRemoteHost({ remote: true });
  requireRemoteHostConfig();

  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    return;
  }
  if (!opts.command) {
    usage();
    throw new Error("Missing command: start | stop | restart | status");
  }

  printModeBanner("remote-server");
  console.log(`ssh target: ${sshTarget()}`);

  if (opts.command === "status") {
    if (opts.all) {
      for (const saveName of Object.keys(SAVE_RCON_PORTS)) {
        printStatus(saveName);
      }
      return;
    }
    if (!opts.save) throw new Error("status requires a save name or --all");
    verbose = true;
    printStatus(opts.save);
    return;
  }

  if (!opts.save) {
    throw new Error(`${opts.command} requires a save name (e.g. overseer-test)`);
  }

  switch (opts.command) {
    case "start":
      console.log(`→ starting ${opts.save} on Mac`);
      remoteStartServer(opts.save, serverOptions(opts));
      if (opts.wait) {
        console.log("→ waiting for RCON health");
        const health = waitForRemoteHealth(opts.save);
        console.log(health.output || '{"ok":true}');
      }
      console.log("Done.");
      break;
    case "stop":
      console.log(`→ stopping ${opts.save} via RCON${opts.force ? " (force: SSH fallback)" : ""}`);
      remoteStopServer(opts.save, { force: opts.force });
      console.log("Done.");
      break;
    case "restart":
      console.log(`→ restarting ${opts.save}`);
      remoteRestartServer(opts.save, serverOptions(opts));
      console.log("Done.");
      break;
    default:
      throw new Error(`Unknown command: ${opts.command}`);
  }
}

try {
  main();
} catch (err) {
  console.error(`remote-server: ${err.message}`);
  process.exit(1);
}
