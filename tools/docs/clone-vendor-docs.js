#!/usr/bin/env node
"use strict";

// Clone the third-party Hytale reference repos into docs/external/.
//
// These are NOT vendored into basecamp (docs/external/ is gitignored) — they're
// pulled in on demand for local reference. Run after a fresh checkout, or to update.
//
// Usage:
//   node tools/docs/clone-vendor-docs.js            # clone missing, fast-forward existing
//   node tools/docs/clone-vendor-docs.js --force    # remove and re-clone every repo
//   node tools/docs/clone-vendor-docs.js --list     # print the repo list and exit

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { BASECAMP_ROOT } = require("../library/workspace");

const DEST_ROOT = path.join(BASECAMP_ROOT, "docs", "external");

// dir = folder under docs/external/; url = git remote. Shallow-cloned (--depth 1).
const REPOS = [
  { dir: "HytaleCompleteAPI", url: "https://github.com/GalacticOrgOfDev/HytaleCompleteAPI.git" },
  { dir: "hytale-docs", url: "https://github.com/vulpeslab/hytale-docs.git" },
  { dir: "hytale-modding-handbook", url: "https://github.com/inkthorne/hytale-modding-handbook.git" },
  { dir: "hytale-modding-site", url: "https://github.com/HytaleModding/site.git" },
];

function git(args, opts = {}) {
  const res = spawnSync("git", args, { stdio: "inherit", shell: false, ...opts });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed with exit code ${res.status}`);
  }
}

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function cloneRepo(repo, force) {
  const target = path.join(DEST_ROOT, repo.dir);
  const hasGit = fs.existsSync(path.join(target, ".git"));

  if (force && fs.existsSync(target)) {
    console.log(`\n== re-clone ${repo.dir} (--force)`);
    rmrf(target);
  } else if (hasGit) {
    console.log(`\n== update ${repo.dir}`);
    git(["-C", target, "pull", "--ff-only"]);
    return;
  } else if (fs.existsSync(target)) {
    console.warn(
      `\n!! ${repo.dir} exists but has no .git (was its .git stripped?). `
      + "Leaving it as-is — pass --force to replace with a fresh clone.",
    );
    return;
  }

  console.log(`\n== clone ${repo.dir} <- ${repo.url}`);
  git(["clone", "--depth", "1", repo.url, target]);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--list")) {
    for (const r of REPOS) console.log(`${r.dir.padEnd(26)} ${r.url}`);
    return;
  }
  const force = argv.includes("--force");

  fs.mkdirSync(DEST_ROOT, { recursive: true });
  for (const repo of REPOS) cloneRepo(repo, force);

  console.log(`\nDone. ${REPOS.length} reference repos under ${path.relative(BASECAMP_ROOT, DEST_ROOT)}/`);
}

main();
