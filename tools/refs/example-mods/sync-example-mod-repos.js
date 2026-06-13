#!/usr/bin/env node
"use strict";

/*
 * Sync Hytale example source-code repos into ./_mod-example-sourcecode/.
 *
 * The destination is intentionally gitignored and VS Code ignored: these are
 * research inputs, not basecamp source files.
 *
 * Usage:
 *   node tools/refs/example-mods/sync-example-mod-repos.js --list
 *   node tools/refs/example-mods/sync-example-mod-repos.js
 *   node tools/refs/example-mods/sync-example-mod-repos.js --only HyCitizens
 *   node tools/refs/example-mods/sync-example-mod-repos.js --force
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { BASECAMP_ROOT, WORKSPACE_ROOT } = require("../../lib/workspace");

const DEFAULT_CONFIG = path.join(__dirname, "example-mod-repos.json");

function parseArgs(argv) {
  const opts = {
    config: DEFAULT_CONFIG,
    force: false,
    list: false,
    only: new Set(),
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (!value) throw new Error(`${arg} requires a value`);
      return value;
    };
    if (arg === "--config") opts.config = path.resolve(next());
    else if (arg === "--force") opts.force = true;
    else if (arg === "--list") opts.list = true;
    else if (arg === "--only") opts.only.add(next());
    else if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function usage() {
  console.log(`Usage:
  node tools/refs/example-mods/sync-example-mod-repos.js [options]

Options:
  --list            Print configured example repos and exit
  --only <id>       Sync/list only one repository id; repeatable
  --force           Replace existing destination directories
  --config <file>   Alternate manifest JSON
`);
}

function resolveTokenPath(value) {
  return value
    .replaceAll("{basecamp}", BASECAMP_ROOT)
    .replaceAll("{workspace}", WORKSPACE_ROOT);
}

function loadConfig(file) {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(parsed.repositories)) {
    throw new Error(`${file} must contain a repositories array`);
  }
  const destination = resolveTokenPath(parsed.destination || "{basecamp}/_mod-example-sourcecode");
  return parsed.repositories.map((repo) => normalizeRepo(repo, destination));
}

function normalizeRepo(repo, destination) {
  for (const key of ["id", "dir"]) {
    if (!repo[key]) throw new Error(`example repo entry missing ${key}: ${JSON.stringify(repo)}`);
  }
  return {
    ...repo,
    sourcePath: repo.sourcePath ? resolveTokenPath(repo.sourcePath) : null,
    targetPath: path.join(destination, repo.dir),
  };
}

function matches(repo, opts) {
  return opts.only.size === 0 || opts.only.has(repo.id);
}

function run(command, args, opts = {}) {
  const res = spawnSync(command, args, { stdio: "inherit", shell: false, ...opts });
  if (res.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${res.status}`);
  }
}

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function copyTree(source, target) {
  fs.cpSync(source, target, {
    recursive: true,
    dereference: false,
    filter: (src) => {
      const base = path.basename(src);
      return base !== ".git" && base !== "_git";
    },
  });
}

function listRepos(repos) {
  for (const repo of repos) {
    const mode = repo.url ? "clone" : "copy";
    const relTarget = path.relative(BASECAMP_ROOT, repo.targetPath);
    const source = repo.url || repo.sourcePath || "(missing source)";
    console.log(`${repo.id.padEnd(26)} ${mode.padEnd(6)} ${relTarget.padEnd(44)} ${source}`);
  }
}

function updateExistingGitRepo(repo) {
  console.log(`\n== update ${repo.id}`);
  run("git", ["-C", repo.targetPath, "pull", "--ff-only"]);
}

function cloneRepo(repo) {
  console.log(`\n== clone ${repo.id} <- ${repo.url}`);
  fs.mkdirSync(path.dirname(repo.targetPath), { recursive: true });
  run("git", ["clone", "--depth", "1", repo.url, repo.targetPath]);
}

function copySnapshot(repo) {
  if (!repo.sourcePath || !fs.existsSync(repo.sourcePath)) {
    throw new Error(`${repo.id} has no clone URL and sourcePath is missing`);
  }
  console.log(`\n== copy ${repo.id} <- ${path.relative(BASECAMP_ROOT, repo.sourcePath)}`);
  fs.mkdirSync(path.dirname(repo.targetPath), { recursive: true });
  copyTree(repo.sourcePath, repo.targetPath);
}

function syncRepo(repo, force) {
  const exists = fs.existsSync(repo.targetPath);
  const hasGit = fs.existsSync(path.join(repo.targetPath, ".git"));

  if (force && exists) rmrf(repo.targetPath);
  else if (exists && hasGit) return updateExistingGitRepo(repo);
  else if (exists) {
    console.log(`\n== keep ${repo.id}`);
    console.log(`   ${path.relative(BASECAMP_ROOT, repo.targetPath)} exists without .git; pass --force to replace it`);
    return;
  }

  if (repo.url) cloneRepo(repo);
  else copySnapshot(repo);
}

function main() {
  const opts = parseArgs(process.argv);
  const repos = loadConfig(opts.config).filter((repo) => matches(repo, opts));

  if (opts.list) {
    listRepos(repos);
    return;
  }

  for (const repo of repos) syncRepo(repo, opts.force);
  console.log(`\nDone. ${repos.length} example repo entries processed.`);
}

main();
