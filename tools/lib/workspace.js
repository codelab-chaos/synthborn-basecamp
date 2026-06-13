"use strict";

// Single source of truth for the on-disk workspace layout.
//
// The repo was split out of the old `hytale-mods` monorepo: tooling and docs
// now live in `synthborn-basecamp`, and each mod is its own sibling repo under
// the workspace root. Jar / logical module names stay the same (SynthRCON,
// SynthOverseer, SynthUnits, SynthTerrascape) — only the directory layout moved.
//
//   <workspace root>/                 (e.g. ~/git/hytale-mods)
//   ├── synthborn-basecamp/  (= BASECAMP_ROOT)  tools/, docs/, _Assets/,
//   ├── synthborn-rcon/
//   ├── synthborn-overseer/
//   ├── synthborn-kyn/                builds the SynthUnits jar
//   └── synthborn-terrascape/
//
// Deployment config now lives in each deployable mod repo. Basecamp keeps this
// workspace map for shared helper scripts and legacy references.

const path = require("node:path");

// tools/lib/workspace.js -> synthborn-basecamp
const BASECAMP_ROOT = path.resolve(__dirname, "..", "..");
// parent of basecamp; holds the mod siblings
const WORKSPACE_ROOT = path.resolve(BASECAMP_ROOT, "..");

// Logical module / jar name -> sibling repo directory name under WORKSPACE_ROOT.
const MODULE_DIRS = {
  SynthRCON: "synthborn-rcon",
  SynthOverseer: "synthborn-overseer",
  SynthUnits: "synthborn-kyn",
  SynthTerrascape: "synthborn-terrascape",
};

/** Absolute path to a mod's repo, keyed by its logical/jar name. */
function modDir(moduleName) {
  const dir = MODULE_DIRS[moduleName];
  if (!dir) {
    throw new Error(
      `Unknown module: ${moduleName}. Known modules: ${Object.keys(MODULE_DIRS).join(", ")}`,
    );
  }
  return path.join(WORKSPACE_ROOT, dir);
}

/** Absolute path to a file/dir at the workspace root. */
function workspacePath(...segments) {
  return path.join(WORKSPACE_ROOT, ...segments);
}

module.exports = {
  BASECAMP_ROOT,
  WORKSPACE_ROOT,
  MODULE_DIRS,
  modDir,
  workspacePath,
};
