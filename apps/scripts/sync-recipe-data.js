#!/usr/bin/env node
/*
 * Copy docs/refs/recipes/*.json into app data/ folders for static serving.
 *
 * Usage: node apps/scripts/sync-recipe-data.js [recipe-kiosk|tech-tree|all]
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const APPS_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(APPS_ROOT, "..");
const DOCS_RECIPES = path.join(REPO_ROOT, "docs", "refs", "recipes");
const SDK_SOURCE = path.join(REPO_ROOT, "docs", "sdk", ".sdk-source.json");

function readPinnedHytaleVersion() {
  try {
    const data = JSON.parse(fs.readFileSync(SDK_SOURCE, "utf8"));
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

function stampHytaleVersion(filePath) {
  const version = readPinnedHytaleVersion();
  if (!version || !fs.existsSync(filePath)) return;
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (data.hytaleVersion === version) return;
  data.hytaleVersion = version;
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

const APP_FILES = {
  "recipe-kiosk": ["recipes.json", "loot.json"],
};

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function syncApp(appName) {
  const files = APP_FILES[appName];
  if (!files) throw new Error(`Unknown app: ${appName}`);
  const outDir = path.join(APPS_ROOT, appName, "data");
  for (const name of files) {
    const src = path.join(DOCS_RECIPES, name);
    if (!fs.existsSync(src)) {
      throw new Error(`Missing ${src} — regenerate recipe docs first.`);
    }
    const dest = path.join(outDir, name);
    copyFile(src, dest);
    stampHytaleVersion(dest);
    const size = fs.statSync(dest).size;
    console.log(`  ${path.relative(APPS_ROOT, dest)} (${(size / 1024 / 1024).toFixed(2)} MB)`);
  }
}

function main() {
  const target = process.argv[2] || "all";
  const apps = target === "all" ? Object.keys(APP_FILES) : [target];
  console.log(`Syncing recipe data from ${DOCS_RECIPES}`);
  for (const app of apps) {
    console.log(`\n${app}:`);
    syncApp(app);
  }
}

try {
  main();
} catch (err) {
  console.error(`sync-recipe-data: ${err.message}`);
  process.exitCode = 1;
}
