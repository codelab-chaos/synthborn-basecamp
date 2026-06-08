#!/usr/bin/env node
/**
 * Triggers the SynthOverseer plugin's `/os commands` subcommand via SynthRCON and copies
 * the generated cheat sheet from the save's mods directory into a repo-friendly location
 * so it can be committed.
 *
 * The plugin walks `CommandManager.get().getCommandRegistration()` at runtime and writes
 * `<save>/mods/synthoverseer/console-commands.md`. This script is just a dev wrapper that
 * runs the command and stages the output where you can commit it.
 *
 * Why this can't be purely static: console commands are registered at runtime by each
 * plugin during its setup() — there's no static index to read from the server jar. We need
 * a live server to enumerate them.
 *
 * Usage:
 *   node tools/overseer/dump-console-commands.js                  # defaults: --save overseer-test, --out docs/console-commands.md
 *   node tools/overseer/dump-console-commands.js --save other-save
 *   node tools/overseer/dump-console-commands.js --out mods/SynthOverseer/console-commands.md
 *   node tools/overseer/dump-console-commands.js --no-copy        # leave the file in <save>/mods/synthoverseer/
 *
 * Requires the named save's server to be running with SynthOverseer + SynthRCON deployed.
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_SAVE = "overseer-test";
const DEFAULT_OUT = path.join(REPO_ROOT, "docs/console-commands.md");

function parseArgs(argv) {
  const opts = { save: DEFAULT_SAVE, out: DEFAULT_OUT, copy: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--save") opts.save = argv[++i];
    else if (a === "--out") opts.out = path.resolve(argv[++i]);
    else if (a === "--no-copy") opts.copy = false;
    else if (a === "-h" || a === "--help") {
      console.log(`Usage: node tools/overseer/dump-console-commands.js [--save NAME] [--out PATH] [--no-copy]`);
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(1);
    }
  }
  return opts;
}

function resolveSavePath(saveName) {
  const appData = process.env.APPDATA || path.join(process.env.HOME || "", "AppData/Roaming");
  return path.join(appData, "Hytale/UserData/Saves", saveName);
}

function main() {
  const opts = parseArgs(process.argv);
  const savePath = resolveSavePath(opts.save);
  const generatedPath = path.join(savePath, "mods/synthoverseer/console-commands.md");

  if (!fs.existsSync(savePath)) {
    console.error(`Save directory not found: ${savePath}`);
    process.exit(1);
  }

  console.log(`Triggering /os commands on save "${opts.save}" via SynthRCON...`);
  const rconScript = path.join(REPO_ROOT, "tools/rcon/synth-rcon.js");
  const result = spawnSync("node", [rconScript, "--save", opts.save, "os", "commands"], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });

  if (result.status !== 0) {
    console.error(`RCON call failed (exit ${result.status})`);
    if (result.stderr) console.error(result.stderr);
    if (result.stdout) console.error(result.stdout);
    process.exit(1);
  }

  // RCON dispatches and the plugin replies inline; the server-side write happens before the
  // reply is sent, so by the time RCON returns the file should be on disk.
  process.stdout.write(result.stdout);

  if (!fs.existsSync(generatedPath)) {
    console.error(`Plugin did not write expected file: ${generatedPath}`);
    console.error(`Check that SynthOverseer is loaded on save "${opts.save}" and the /os commands subcommand is wired in.`);
    process.exit(1);
  }

  const stat = fs.statSync(generatedPath);
  console.log(`Generated: ${generatedPath} (${stat.size} bytes, ${stat.mtime.toISOString()})`);

  if (opts.copy) {
    fs.mkdirSync(path.dirname(opts.out), { recursive: true });
    fs.copyFileSync(generatedPath, opts.out);
    console.log(`Copied to: ${opts.out}`);
  } else {
    console.log(`--no-copy set; leaving file in the save's mods directory.`);
  }
}

main();
