#!/usr/bin/env node
/*
 * Build the GitHub Pages static site and assemble a deployable artifact.
 *
 * Output:
 *   _site/index.html
 *   _site/apps/basecamp/
 *   _site/apps/recipe-kiosk/
 *   _site/apps/prefab-gallery/
 *   _site/apps/sdk-explorer/
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
const SITE_ROOT = path.join(BASECAMP_ROOT, "_site");

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

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function copyDirectory(source, destination) {
  fs.cpSync(source, destination, { recursive: true });
}

function requirePath(target) {
  if (!fs.existsSync(target)) {
    throw new Error(`${path.relative(BASECAMP_ROOT, target)} missing from Pages build`);
  }
}

function assembleSite(opts) {
  fs.rmSync(SITE_ROOT, { recursive: true, force: true });
  fs.mkdirSync(SITE_ROOT, { recursive: true });

  const files = ["index.html"];
  const directories = [
    "apps/basecamp",
    "apps/images",
  ];

  if (!opts.skipRecipe) {
    files.push("apps/recipe-kiosk/index.html");
    directories.push("apps/recipe-kiosk/assets", "apps/recipe-kiosk/data");
  }
  if (!opts.skipPrefabWeb) {
    files.push("apps/prefab-gallery/index.html", "apps/prefab-gallery/manifest.json");
    directories.push(
      "apps/prefab-gallery/assets",
      "apps/prefab-gallery/data",
      "apps/prefab-gallery/previews",
    );
  }
  if (!opts.skipSdk) {
    files.push("apps/sdk-explorer/index.html");
    directories.push("apps/sdk-explorer/assets", "apps/sdk-explorer/data");
  }

  for (const relativePath of files) {
    const source = path.join(BASECAMP_ROOT, relativePath);
    requirePath(source);
    copyFile(source, path.join(SITE_ROOT, relativePath));
  }
  for (const relativePath of directories) {
    const source = path.join(BASECAMP_ROOT, relativePath);
    requirePath(source);
    copyDirectory(source, path.join(SITE_ROOT, relativePath));
  }

  console.log(`[pages] artifact -> ${path.relative(BASECAMP_ROOT, SITE_ROOT)}`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(`Building GitHub Pages site from ${BASECAMP_ROOT}`);

  buildLandingPage();

  if (!opts.skipRecipe) buildRecipeKiosk(opts);
  if (!opts.skipPrefabWeb) buildPrefabGalleryWeb();
  if (!opts.skipSdk) buildSdkExplorer();

  assembleSite(opts);

  console.log("\n[done] GitHub Pages artifact ready in _site/");
  console.log("Enable: repo Settings → Pages → GitHub Actions");
}

try {
  main();
} catch (err) {
  console.error(`build-github-pages: ${err.message}`);
  process.exitCode = 1;
}
