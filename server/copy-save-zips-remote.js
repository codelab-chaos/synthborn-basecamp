#!/usr/bin/env node
/*
 * Copy Hytale save .zip files from Windows Saves to the Mac and unzip them.
 *
 * Usage:
 *   node tools/server/copy-save-zips-remote.js
 *   node tools/server/copy-save-zips-remote.js overseer-test synthtest-02
 *   node tools/server/copy-save-zips-remote.js --keep-zips   # do not delete zips on Mac after unzip
 *
 * Expects zips at %APPDATA%/Hytale/UserData/Saves/<name>.zip
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  configureRemoteHost,
  requireRemoteHostConfig,
  sshTarget,
  sshRun,
  opensshBin,
  sshConfigArgs,
  testSshConnection,
  runChecked,
  scpRemoteSpec,
  remotePathQuote,
} = require("../library/remote-host");

const IS_WINDOWS = process.platform === "win32";

function localSavesRoot() {
  if (IS_WINDOWS && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "Hytale", "UserData", "Saves");
  }
  throw new Error("local saves root only configured for Windows");
}

function remoteSavesRoot() {
  const saves = process.env.HYTALE_REMOTE_SAVES;
  if (!saves) throw new Error("HYTALE_REMOTE_SAVES not set");
  return saves.replace(/\/$/, "");
}

function parseArgs(argv) {
  const opts = { keepZips: false, names: [] };
  for (const arg of argv) {
    if (arg === "--keep-zips") opts.keepZips = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    else opts.names.push(arg);
  }
  return opts;
}

function usage() {
  console.log(`Usage:
  node tools/server/copy-save-zips-remote.js [save-name...] [--keep-zips]

Copies <save>.zip from local Saves to the Mac, then unzips into Saves/<save>/.
With no names, copies every *.zip in the local Saves folder.`);
}

function main() {
  configureRemoteHost({ remote: true });
  requireRemoteHostConfig();

  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    return;
  }

  const savesRoot = localSavesRoot();
  let zips = fs.readdirSync(savesRoot)
    .filter((name) => name.endsWith(".zip"))
    .map((name) => path.join(savesRoot, name));

  if (opts.names.length > 0) {
    zips = opts.names.map((name) => {
      const base = name.replace(/\.zip$/i, "");
      const file = path.join(savesRoot, `${base}.zip`);
      if (!fs.existsSync(file)) throw new Error(`Zip not found: ${file}`);
      return file;
    });
  }

  if (zips.length === 0) {
    throw new Error(`No .zip files in ${savesRoot}`);
  }

  testSshConnection();
  const target = sshTarget();
  const remoteRoot = remoteSavesRoot();
  sshRun(`mkdir -p ${remotePathQuote(remoteRoot)}`);

  console.log(`Copying ${zips.length} zip(s) to ${remoteRoot} ...`);
  runChecked(
    "scp",
    opensshBin("scp"),
    [...sshConfigArgs(), ...zips, scpRemoteSpec(target, `${remoteRoot}/`)],
  );

  const names = zips.map((z) => path.basename(z));
  const unzipCmd = names.map((n) => `unzip -o -q ${remotePathQuote(`${remoteRoot}/${n}`)}`).join(" && ");
  const cleanup = opts.keepZips ? "" : ` && rm -f ${names.map((n) => remotePathQuote(`${remoteRoot}/${n}`)).join(" ")}`;
  console.log("Extracting on Mac...");
  sshRun(`cd ${remotePathQuote(remoteRoot)} && ${unzipCmd}${cleanup} && ls -la`);

  console.log("Done.");
  for (const z of zips) {
    console.log(`  ${path.basename(z, ".zip")}/`);
  }
}

try {
  main();
} catch (err) {
  console.error(`copy-save-zips-remote: ${err.message}`);
  process.exit(1);
}
