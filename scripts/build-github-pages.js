#!/usr/bin/env node
/*
 * Build static apps into docs/ for GitHub Pages (project site root = /docs on main).
 *
 * Output:
 *   docs/index.html
 *   docs/recipe-browser/
 *   docs/prefab-gallery/
 *
 * Usage: node scripts/build-github-pages.js [--skip-recipe] [--skip-prefab] [--icons]
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const BASECAMP_ROOT = path.resolve(__dirname, "..");
const APPS_ROOT = path.join(BASECAMP_ROOT, "apps");
const DOCS_ROOT = path.join(BASECAMP_ROOT, "docs");
const ASSETS_ROOT = path.join(BASECAMP_ROOT, "_Assets");

function parseArgs(argv) {
  return {
    skipRecipe: argv.includes("--skip-recipe"),
    skipPrefab: argv.includes("--skip-prefab"),
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

function rimraf(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyTree(srcRoot, destRoot, options = {}) {
  const { includeDirNames = null, excludeDirNames = new Set() } = options;
  if (!fs.existsSync(srcRoot)) {
    if (options.optional) return;
    throw new Error(`Missing source tree: ${srcRoot}`);
  }
  for (const name of fs.readdirSync(srcRoot)) {
    if (excludeDirNames.has(name)) continue;
    const src = path.join(srcRoot, name);
    const dest = path.join(destRoot, name);
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      if (includeDirNames && !includeDirNames.includes(name)) continue;
      copyTree(src, dest, { includeDirNames: null, excludeDirNames });
    } else {
      copyFile(src, dest);
    }
  }
}

function writeLandingIndex() {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Synthborn Basecamp</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0f1419;
        --card: #1a222c;
        --text: #e8edf2;
        --muted: #8b9aab;
        --accent: #5b9fd4;
        --border: #2a3544;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        background: radial-gradient(1200px 600px at 20% -10%, #1e3a5f 0%, transparent 55%),
          var(--bg);
        color: var(--text);
        line-height: 1.5;
      }
      main {
        max-width: 720px;
        margin: 0 auto;
        padding: 48px 24px 64px;
      }
      h1 { font-size: 1.75rem; margin: 0 0 8px; font-weight: 600; }
      p.lead { color: var(--muted); margin: 0 0 32px; }
      ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 12px;
      }
      a.card {
        display: block;
        padding: 20px 22px;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--card);
        color: var(--text);
        text-decoration: none;
        transition: border-color 0.15s ease, transform 0.15s ease;
      }
      a.card:hover {
        border-color: var(--accent);
        transform: translateY(-1px);
      }
      a.card strong { display: block; font-size: 1.1rem; color: var(--accent); }
      a.card span { color: var(--muted); font-size: 0.95rem; }
      footer {
        margin-top: 40px;
        font-size: 0.85rem;
        color: var(--muted);
      }
      footer a { color: var(--accent); }
    </style>
  </head>
  <body>
    <main>
      <h1>Synthborn Basecamp</h1>
      <p class="lead">Hytale mod reference tools — recipes, items, and prefab gallery.</p>
      <ul>
        <li>
          <a class="card" href="recipe-browser/">
            <strong>Recipe Browser</strong>
            <span>Items, craft chains, benches, loot sources</span>
          </a>
        </li>
        <li>
          <a class="card" href="prefab-gallery/">
            <strong>Prefab Gallery</strong>
            <span>Voxel previews and catalog search</span>
          </a>
        </li>
      </ul>
      <footer>
        Built for GitHub Pages with relative asset paths.
        <a href="README.md">Docs index</a>
      </footer>
    </main>
  </body>
</html>
`;
  const out = path.join(DOCS_ROOT, "index.html");
  fs.writeFileSync(out, html, "utf8");
  console.log(`\n[pages] wrote ${path.relative(BASECAMP_ROOT, out)}`);
}

function buildRecipeBrowser(opts) {
  const appDir = path.join(APPS_ROOT, "recipe-browser");
  const dest = path.join(DOCS_ROOT, "recipe-browser");
  rimraf(dest);

  npmRun(appDir, "sync-data");
  if (opts.icons && fs.existsSync(ASSETS_ROOT)) {
    npmRun(appDir, "build-icons");
  } else if (opts.icons) {
    console.warn("[pages] --icons skipped: _Assets/ not found");
  }
  npmRun(appDir, "build-web");

  copyTree(appDir, dest, {
    excludeDirNames: new Set(["node_modules", "src", "scripts"]),
  });
  console.log(`[pages] recipe-browser -> ${path.relative(BASECAMP_ROOT, dest)}`);
}

function buildPrefabGallery() {
  const appDir = path.join(APPS_ROOT, "prefab-gallery");
  const dest = path.join(DOCS_ROOT, "prefab-gallery");
  rimraf(dest);

  if (!fs.existsSync(path.join(appDir, "manifest.json"))) {
    throw new Error("apps/prefab-gallery/manifest.json missing — run npm run build-source there first");
  }

  npmRun(appDir, "build-web");

  fs.mkdirSync(dest, { recursive: true });
  copyFile(path.join(appDir, "index.html"), path.join(dest, "index.html"));
  copyTree(path.join(appDir, "assets"), path.join(dest, "assets"));
  copyFile(path.join(appDir, "manifest.json"), path.join(dest, "manifest.json"));

  copyTree(path.join(appDir, "data"), path.join(dest, "data"), { optional: true });
  copyTree(path.join(appDir, "previews"), path.join(dest, "previews"), { optional: true });

  const packsDir = path.join(appDir, "data", "packs");
  const previewsDir = path.join(appDir, "previews", "atlas");
  if (!fs.existsSync(packsDir)) {
    console.warn("[pages] prefab-gallery: data/packs/ missing — 3D voxel loads will fail");
  }
  if (!fs.existsSync(previewsDir)) {
    console.warn("[pages] prefab-gallery: previews/atlas/ missing — card thumbnails may fail");
  }

  console.log(`[pages] prefab-gallery -> ${path.relative(BASECAMP_ROOT, dest)}`);
}

function ensureNoJekyll() {
  const file = path.join(DOCS_ROOT, ".nojekyll");
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, "", "utf8");
    console.log("[pages] created docs/.nojekyll");
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(`Building GitHub Pages output under ${DOCS_ROOT}`);

  ensureNoJekyll();
  writeLandingIndex();

  if (!opts.skipRecipe) buildRecipeBrowser(opts);
  if (!opts.skipPrefab) buildPrefabGallery();

  console.log("\n[done] GitHub Pages bundle ready in docs/");
  console.log("Enable: repo Settings → Pages → Build from branch → main → /docs");
}

try {
  main();
} catch (err) {
  console.error(`build-github-pages: ${err.message}`);
  process.exitCode = 1;
}
