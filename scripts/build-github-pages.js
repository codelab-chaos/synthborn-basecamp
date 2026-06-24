#!/usr/bin/env node
/*
 * Build the GitHub Pages static site in place.
 *
 * Output:
 *   index.html
 *   apps/basecamp/basecamp-index.json
 *   apps/recipe-kiosk/
 *   apps/prefab-gallery/
 *   apps/sdk-explorer/
 *
 * Usage: node scripts/build-github-pages.js [--skip-recipe] [--skip-prefab-web] [--skip-sdk] [--icons]
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const BASECAMP_ROOT = path.resolve(__dirname, "..");
const APPS_ROOT = path.join(BASECAMP_ROOT, "apps");
const ASSETS_ROOT = path.join(BASECAMP_ROOT, "_Assets");

function parseArgs(argv) {
  return {
    skipRecipe: argv.includes("--skip-recipe"),
    skipPrefabWeb: argv.includes("--skip-prefab-web"),
    skipSdk: argv.includes("--skip-sdk"),
    icons: argv.includes("--icons"),
  };
}

function run(label, command, args, cwd) {
  console.log(`\n== ${label}`);
  console.log(`$ ${command} ${args.join(" ")}`);
  const res = spawnSync(command, args, { cwd, stdio: "inherit", shell: false });
  if (res.status !== 0) {
    throw new Error(`${label} failed (exit ${res.status})`);
  }
}

function npmRun(appDir, script) {
  run(`npm run ${script}`, "npm", ["run", script], appDir);
}

function buildLandingPage() {
  run("landing index", process.execPath, ["scripts/build-basecamp-index-json.js"], BASECAMP_ROOT);
}

function buildRecipeKiosk(opts) {
  const appDir = path.join(APPS_ROOT, "recipe-kiosk");

  npmRun(appDir, "sync-data");
  if (opts.icons && fs.existsSync(ASSETS_ROOT)) {
    npmRun(appDir, "build-icons");
  } else if (opts.icons) {
    console.warn("[pages] --icons skipped: _Assets/ not found");
  }
  npmRun(appDir, "build-web");
  console.log(`[pages] recipe-kiosk -> ${path.relative(BASECAMP_ROOT, appDir)}`);
}

function ensureNoJekyll() {
  const file = path.join(BASECAMP_ROOT, ".nojekyll");
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, "", "utf8");
    console.log("[pages] created .nojekyll");
  }
}

function buildPrefabGalleryWeb() {
  const appDir = path.join(APPS_ROOT, "prefab-gallery");
  const required = [
    path.join(appDir, "manifest.json"),
    path.join(appDir, "data", "packs"),
    path.join(appDir, "previews", "atlas"),
  ];
  for (const target of required) {
    if (!fs.existsSync(target)) {
      throw new Error(`${path.relative(BASECAMP_ROOT, target)} missing; run npm run build in apps/prefab-gallery`);
    }
  }
  npmRun(appDir, "build-web");
  console.log(`[pages] prefab-gallery -> ${path.relative(BASECAMP_ROOT, appDir)}`);
}

function buildSdkExplorer() {
  const appDir = path.join(APPS_ROOT, "sdk-explorer");
  npmRun(appDir, "build");
  console.log(`[pages] sdk-explorer -> ${path.relative(BASECAMP_ROOT, appDir)}`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(`Building GitHub Pages site from ${BASECAMP_ROOT}`);

  ensureNoJekyll();
  buildLandingPage();

  if (!opts.skipRecipe) buildRecipeKiosk(opts);
  if (!opts.skipPrefabWeb) buildPrefabGalleryWeb();
  if (!opts.skipSdk) buildSdkExplorer();

  console.log("\n[done] GitHub Pages bundle ready at repo root");
  console.log("Enable: repo Settings → Pages → Deploy from branch → main → /");
}

try {
  main();
} catch (err) {
  console.error(`build-github-pages: ${err.message}`);
  process.exitCode = 1;
}
