#!/usr/bin/env node
"use strict";

/*
 * Sync external reference repositories from a JSON manifest.
 *
 * Usage:
 *   node tools/refs/reference-docs/sync-reference-repos.js --list
 *   node tools/refs/reference-docs/sync-reference-repos.js
 *   node tools/refs/reference-docs/sync-reference-repos.js --kind docs
 *   node tools/refs/reference-docs/sync-reference-repos.js --force
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { BASECAMP_ROOT, WORKSPACE_ROOT } = require("../../lib/workspace");

const DEFAULT_CONFIG = path.join(__dirname, "reference-repos.json");

function parseArgs(argv) {
  const opts = {
    config: DEFAULT_CONFIG,
    force: false,
    list: false,
    kinds: new Set(),
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
    else if (arg === "--kind") opts.kinds.add(next());
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
  node tools/refs/reference-docs/sync-reference-repos.js [options]

Options:
  --list            Print configured repositories and exit
  --kind <kind>     Sync/list only one kind; repeatable
  --only <id>       Sync/list only one repository id; repeatable
  --force           Re-clone cloneable repositories
  --config <file>   Alternate manifest JSON
`);
}

function loadConfig(file) {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(parsed.repositories)) {
    throw new Error(`${file} must contain a repositories array`);
  }
  return parsed.repositories.map((repo) => normalizeRepo(repo));
}

function normalizeRepo(repo) {
  for (const key of ["id", "kind", "dir", "destRoot"]) {
    if (!repo[key]) throw new Error(`reference repo entry missing ${key}: ${JSON.stringify(repo)}`);
  }
  return {
    shallow: true,
    ...repo,
    destRoot: resolveTokenPath(repo.destRoot),
  };
}

function resolveTokenPath(value) {
  return value
    .replaceAll("{basecamp}", BASECAMP_ROOT)
    .replaceAll("{workspace}", WORKSPACE_ROOT);
}

function matches(repo, opts) {
  if (opts.kinds.size > 0 && !opts.kinds.has(repo.kind)) return false;
  if (opts.only.size > 0 && !opts.only.has(repo.id)) return false;
  return true;
}

function git(args, opts = {}) {
  const res = spawnSync("git", args, { stdio: "inherit", shell: false, ...opts });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed with exit code ${res.status}`);
  }
}

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function repoPath(repo) {
  return path.join(repo.destRoot, repo.dir);
}

function listRepos(repos) {
  for (const repo of repos) {
    const url = repo.url || "(local/manual)";
    const rel = path.relative(BASECAMP_ROOT, repoPath(repo));
    console.log(`${repo.id.padEnd(28)} ${repo.kind.padEnd(18)} ${rel.padEnd(48)} ${url}`);
  }
}

function syncLocalReference(repo) {
  const target = repoPath(repo);
  const exists = fs.existsSync(target);
  console.log(`\n== local ${repo.id}`);
  console.log(`   ${path.relative(BASECAMP_ROOT, target)} ${exists ? "exists" : "missing"}`);
  if (!exists) {
    console.warn("   no URL configured; restore this reference manually or add a url to reference-repos.json");
  }
}

function syncCloneable(repo, force) {
  const target = repoPath(repo);
  const hasGit = fs.existsSync(path.join(target, ".git"));

  if (force && fs.existsSync(target)) {
    console.log(`\n== re-clone ${repo.id} (--force)`);
    rmrf(target);
  } else if (hasGit) {
    console.log(`\n== update ${repo.id}`);
    git(["-C", target, "pull", "--ff-only"]);
    return;
  } else if (fs.existsSync(target)) {
    console.warn(
      `\n!! ${repo.id} exists but has no .git. Leaving it as-is; pass --force to replace it with a fresh clone.`,
    );
    return;
  }

  console.log(`\n== clone ${repo.id} <- ${repo.url}`);
  fs.mkdirSync(repo.destRoot, { recursive: true });
  const args = ["clone"];
  if (repo.shallow !== false) args.push("--depth", "1");
  args.push(repo.url, target);
  git(args);
}

function main() {
  const opts = parseArgs(process.argv);
  const repos = loadConfig(opts.config).filter((repo) => matches(repo, opts));

  if (opts.list) {
    listRepos(repos);
    return;
  }

  for (const repo of repos) {
    if (repo.url) syncCloneable(repo, opts.force);
    else syncLocalReference(repo);
  }

  console.log(`\nDone. ${repos.length} reference repo entries processed.`);
}

main();
