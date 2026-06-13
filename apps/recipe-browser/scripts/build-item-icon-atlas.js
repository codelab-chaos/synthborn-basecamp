#!/usr/bin/env node
/*
 * Pack Hytale item icons into paginated WebP atlases + manifest for recipe-browser.
 *
 * Requires local _Assets (ULA) and sharp (devDependency).
 *
 * Usage:
 *   node scripts/build-item-icon-atlas.js
 *   node scripts/build-item-icon-atlas.js --all-items
 *   node scripts/build-item-icon-atlas.js --assets ../../../_Assets --quality 0.85
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { paginateAtlas, DEFAULT_TILE, DEFAULT_COLS } = require("../../library/atlas-layout");
const {
  collectItemIcons,
  collectRecipeItemIds,
  filterIconsForRecipes,
} = require("../../library/resolve-item-icons");

const appRoot = path.resolve(__dirname, "..");
const basecampRoot = path.resolve(appRoot, "../..");

function parseArgs(argv) {
  const args = {
    assets: path.join(basecampRoot, "_Assets"),
    out: path.join(appRoot, "data", "icons-atlas"),
    recipes: path.join(basecampRoot, "docs", "refs", "recipes", "recipes.json"),
    loot: path.join(basecampRoot, "docs", "refs", "recipes", "loot.json"),
    tile: DEFAULT_TILE,
    cols: DEFAULT_COLS,
    quality: 0.85,
    allItems: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => argv[++i];
    if (arg === "--assets") args.assets = path.resolve(value());
    else if (arg === "--out") args.out = path.resolve(value());
    else if (arg === "--recipes") args.recipes = path.resolve(value());
    else if (arg === "--loot") args.loot = path.resolve(value());
    else if (arg === "--tile") args.tile = Number(value());
    else if (arg === "--cols") args.cols = Number(value());
    else if (arg === "--quality") args.quality = Number(value());
    else if (arg === "--all-items") args.allItems = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  return args;
}

async function loadSharp() {
  try {
    return require("sharp");
  } catch {
    throw new Error(
      "sharp is required — run: npm install (from apps/recipe-browser)",
    );
  }
}

async function buildPage(sharp, page, entries, tile, quality) {
  const composites = [];

  for (const placement of page.placements) {
    const entry = entries[placement.index];
    composites.push({
      input: await sharp(entry.iconPath)
        .resize(tile, tile, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
      left: placement.x,
      top: placement.y,
    });
  }

  const base = sharp({
    create: {
      width: page.width,
      height: page.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  const fileName = `atlas-${page.pageIndex}.webp`;
  const outPath = path.join(page.outDir, fileName);
  await base.composite(composites).webp({ quality: Math.round(quality * 100) }).toFile(outPath);

  return {
    file: fileName,
    width: page.width,
    height: page.height,
    cols: page.cols,
    rows: page.rows,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sharp = await loadSharp();

  if (!fs.existsSync(args.assets)) {
    throw new Error(`Missing _Assets at ${args.assets}`);
  }

  console.log(`Scanning item icons in ${args.assets}`);
  const allIcons = collectItemIcons(args.assets);
  console.log(`  resolved ${allIcons.size} item PNGs`);

  let icons = allIcons;
  if (!args.allItems) {
    const recipeIds = collectRecipeItemIds(args.recipes, args.loot);
    icons = filterIconsForRecipes(allIcons, recipeIds);
    console.log(`  recipe/loot scope: ${recipeIds.size} ids → ${icons.size} with icons`);
  }

  const entries = [...icons.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([itemId, iconPath]) => ({ itemId, iconPath }));

  if (entries.length === 0) {
    throw new Error("No icons to pack — check _Assets and recipe data paths.");
  }

  fs.mkdirSync(args.out, { recursive: true });

  const pages = paginateAtlas(entries.length, args.tile, args.cols).map((page) => ({
    ...page,
    outDir: args.out,
  }));

  const manifest = {
    tile: args.tile,
    cols: args.cols,
    format: "webp",
    generatedAt: new Date().toISOString(),
    scope: args.allItems ? "all-items" : "recipe-loot",
    itemCount: entries.length,
    pages: [],
    items: {},
  };

  console.log(`Packing ${entries.length} icons into ${pages.length} atlas page(s)`);

  for (const page of pages) {
    const pageMeta = await buildPage(sharp, page, entries, args.tile, args.quality);
    manifest.pages.push(pageMeta);

    for (const placement of page.placements) {
      const { itemId } = entries[placement.index];
      manifest.items[itemId] = {
        page: page.pageIndex,
        x: placement.x,
        y: placement.y,
        w: args.tile,
        h: args.tile,
      };
    }

    const outFile = path.join(args.out, pageMeta.file);
    const sizeKb = (fs.statSync(outFile).size / 1024).toFixed(1);
    console.log(`  ${pageMeta.file} ${pageMeta.width}x${pageMeta.height} (${sizeKb} KB)`);
  }

  const manifestPath = path.join(args.out, "manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`, "utf8");
  console.log(`Wrote ${path.relative(appRoot, manifestPath)}`);
}

main().catch((err) => {
  console.error(`build-item-icon-atlas: ${err.message}`);
  process.exitCode = 1;
});
