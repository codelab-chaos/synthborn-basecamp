#!/usr/bin/env node
/*
 * Build basecamp-index.json and the root shell for the static landing page.
 *
 * The local build writes disposable app output in place, then
 * build-github-pages.js stages the public files under _site/ for deployment.
 *
 *   node scripts/build-basecamp-index-json.js
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const BASECAMP_ROOT = path.resolve(__dirname, "..");
const LANDING_DIR = path.join(BASECAMP_ROOT, "apps", "basecamp");
const REPO_BLOB_BASE = "https://github.com/codelab-chaos/synthborn-basecamp/blob/main";

const DOC_LINKS = [
  {
    section: "Start here",
    items: [
      { href: "README.md", label: "Repository README", desc: "Overview, CLI workflows, knowledge layers" },
      { href: "llm.txt", label: "llm.txt", desc: "Compact agent routing map" },
      { href: "docs/README.md", label: "Docs index", desc: "Full docs hub and regeneration table" },
      { href: "docs/llm-hytale-modding-kb.md", label: "Hytale modding KB", desc: "API and workflow router for agents" },
    ],
  },
  {
    section: "Reference data",
    items: [
      { href: "docs/refs/README.md", label: "Reference data index", desc: "SDK, recipes, labels, prefabs" },
      { href: "docs/sdk/README.md", label: "SDK reference", desc: "Search classes and methods by topic" },
      { href: "docs/refs/recipes/README.md", label: "Recipes & loot", desc: "Craft chains, sources, benches, drops" },
      { href: "docs/refs/labels/README.md", label: "English labels", desc: "Item id ↔ display name lookup" },
      { href: "docs/refs/prefabs/README.md", label: "Prefab catalog", desc: "Vanilla prefab metadata index" },
    ],
  },
  {
    section: "Guides",
    items: [
      { href: "docs/hytale-mod-quickref/README.md", label: "Mod quickref", desc: "Curated server-side modding topics" },
      { href: "docs/hytale-mod-quickref/01-modding-overview.md", label: "Modding overview", desc: "Quickref chapter 1" },
      { href: "docs/hytale-mod-quickref/02-server-plugins.md", label: "Server plugins", desc: "Quickref chapter 2" },
      { href: "docs/hytale-mod-quickref/05-npc-roles-and-ai.md", label: "NPC roles & AI", desc: "Quickref chapter 5" },
      { href: "docs/hytale-mod-quickref/09-verified-api-cheatsheet.md", label: "Verified API cheatsheet", desc: "Quickref chapter 9" },
      { href: "docs/hytale-version-update-checklist.md", label: "Version update checklist", desc: "Assets and API bump workflow" },
    ],
  },
];

const ROOT_INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Synthborn Basecamp</title>
    <link rel="stylesheet" href="apps/basecamp/basecamp-index.css" />
  </head>
  <body>
    <div id="basecamp-root" aria-busy="true"></div>
    <script src="apps/basecamp/basecamp-index.js" data-config="apps/basecamp/basecamp-index.json"></script>
  </body>
</html>
`;

function buildBasecampIndexConfig() {
  return {
    title: "Synthborn Basecamp",
    lead: "",
    banner: {
      src: "apps/images/basecamp-banner.png",
      alt: "Synthborn Basecamp",
    },
    apps: [
      {
        tile: "recipe-kiosk",
        href: "apps/recipe-kiosk/",
        title: "Recipe Kiosk",
      },
      {
        tile: "prefab-gallery",
        href: "apps/prefab-gallery/",
        title: "Prefab Gallery",
      },
      {
        tile: "sdk-explorer",
        href: "apps/sdk-explorer/",
        title: "SDK Explorer",
        image: "apps/images/sdk-explorer-icon.png",
      },
    ],
    docSections: DOC_LINKS.map((section) => ({
      section: section.section,
      items: section.items.map((item) => ({
        ...item,
        href: `${REPO_BLOB_BASE}/${item.href}`,
      })),
    })),
    footer:
      "Source documentation opens on GitHub. Regenerate GitHub Pages apps with "
      + "cd tools && npm run pages:build.",
  };
}

function writeJson(target, config) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  console.log(`wrote ${path.relative(BASECAMP_ROOT, target)}`);
}

function writeRootIndexHtml(rootDir) {
  const out = path.join(rootDir, "index.html");
  fs.writeFileSync(out, ROOT_INDEX_HTML, "utf8");
  console.log(`wrote ${path.relative(BASECAMP_ROOT, out)}`);
}

function main() {
  writeJson(path.join(LANDING_DIR, "basecamp-index.json"), buildBasecampIndexConfig());
  writeRootIndexHtml(BASECAMP_ROOT);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildBasecampIndexConfig,
  writeRootIndexHtml,
  DOC_LINKS,
  LANDING_DIR,
};
