#!/usr/bin/env node
/*
 * Copy an entire Hytale save directory from this PC to the Mac host in remote-host.env.
 *
 * Usage:
 *   node tools/server/copy-save-remote.js overseer-test
 *   node tools/server/copy-save-remote.js synthtest-02 --dry-run
 *   node tools/server/copy-save-remote.js overseer-test --replace   # rename existing remote copy first
 *
 * Requires passwordless SSH (see remote-host.env.example). Uses HYTALE_REMOTE_SSH when set
 * (e.g. hytale-mac from ~/.ssh/config), otherwise user@host from remote-host.env.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  configureRemoteHost,
  localSaveDir,
  remoteSaveDir,
  requireRemoteHostConfig,
  sshTarget,
  sshRun,
  shellQuote,
  remotePathQuote,
  scpRemoteSpec,
  opensshBin,
  sshConfigArgs,
  testSshConnection,
  runChecked,
} = require("../library/remote-host");

const IS_WINDOWS = process.platform === "win32";

function usage() {
  console.log(`Usage:
  node tools/server/copy-save-remote.js <save-name> [options]

Options:
  --replace          If the save already exists on the Mac, rename it to <save>.bak-<timestamp> first
  --dry-run          Print the copy plan without transferring
  --help, -h         Show this help

Examples:
  node tools/server/copy-save-remote.js overseer-test
  node tools/server/copy-save-remote.js synthtest-02 --replace

Reads mods/SynthOverseer/remote-host.env and mods/SynthUnits/remote-host.env.
Set HYTALE_REMOTE_SSH=hytale-mac to use your ~/.ssh/config Host alias.`);
}

function parseArgs(argv) {
  const opts = { replace: false, dryRun: false, save: null };
  for (const arg of argv) {
    switch (arg) {
      case "-h":
      case "--help":
        opts.help = true;
        break;
      case "--replace":
        opts.replace = true;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      default:
        if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
        if (opts.save) throw new Error(`Unexpected argument: ${arg}`);
        opts.save = arg;
    }
  }
  return opts;
}

function formatPathForScp(localPath) {
  if (IS_WINDOWS) {
    return localPath.replace(/\\/g, "/");
  }
  return localPath;
}

function dirSizeHuman(dirPath) {
  if (IS_WINDOWS) {
    const res = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `$s=(Get-ChildItem -Recurse -LiteralPath ${JSON.stringify(dirPath)} -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum; if($s){[math]::Round($s/1GB,2)}else{0}`,
      ],
      { encoding: "utf8", shell: false },
    );
    const gb = Number(String(res.stdout).trim());
    return Number.isFinite(gb) && gb > 0 ? `~${gb} GB` : "unknown size";
  }
  const res = spawnSync("du", ["-sh", dirPath], { encoding: "utf8" });
  return res.stdout?.split(/\s+/)[0]?.trim() || "unknown size";
}

function hasRsync() {
  if (IS_WINDOWS) return false;
  return spawnSync("rsync", ["--version"], { stdio: "ignore" }).status === 0;
}

function copySave(localDir, remoteDir, dryRun) {
  const target = sshTarget();
  const remoteParent = path.posix.dirname(remoteDir.replace(/\\/g, "/"));
  const remoteBase = path.posix.basename(remoteDir.replace(/\\/g, "/"));
  const localSrc = formatPathForScp(localDir);

  if (dryRun) {
    console.log(`[dry-run] local:  ${localDir}`);
    console.log(`[dry-run] remote: ${remoteDir}`);
    console.log(`[dry-run] ssh:    ${target}`);
    return;
  }

  sshRun(`mkdir -p ${remotePathQuote(remoteParent)}`);

  if (hasRsync()) {
    const remoteDest = scpRemoteSpec(target, `${remoteParent}/${remoteBase}/`);
    runChecked(
      "rsync",
      "rsync",
      ["-az", "--partial", "--info=progress2", `${localSrc}/`, remoteDest],
    );
    return;
  }

  runChecked(
    "scp",
    opensshBin("scp"),
    [...sshConfigArgs(), "-r", "-C", localSrc, scpRemoteSpec(target, `${remoteParent}/`)],
  );
}

function main() {
  configureRemoteHost({ remote: true });
  requireRemoteHostConfig();

  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    return;
  }
  if (!opts.save) {
    usage();
    throw new Error("Missing save name (e.g. overseer-test)");
  }

  const localDir = localSaveDir(opts.save);
  if (!fs.existsSync(localDir)) {
    throw new Error(`Local save not found: ${localDir}`);
  }

  const remoteDir = remoteSaveDir(opts.save);
  const size = dirSizeHuman(localDir);

  console.log(`Copy save: ${opts.save}`);
  console.log(`  from: ${localDir} (${size})`);
  console.log(`  to:   ${remoteDir}`);
  console.log(`  via:  ssh ${sshTarget()}`);
  console.log();

  if (opts.dryRun) {
    copySave(localDir, remoteDir, true);
    return;
  }

  testSshConnection();

  if (opts.replace) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backup = `${remoteDir}.bak-${stamp}`;
    sshRun(
      `if [ -d ${remotePathQuote(remoteDir)} ]; then mv ${remotePathQuote(remoteDir)} ${remotePathQuote(backup)} && echo "renamed existing save to ${backup}"; fi`,
    );
  }

  console.log("Transfer starting — large saves take several minutes...");
  copySave(localDir, remoteDir, false);
  console.log();
  console.log("Done.");
  console.log(`On the Mac, start with:`);
  console.log(`  node tools/server/start-server.js --save ${JSON.stringify(remoteDir)} --background`);
}

try {
  main();
} catch (err) {
  console.error(`copy-save-remote: ${err.message}`);
  process.exit(1);
}
