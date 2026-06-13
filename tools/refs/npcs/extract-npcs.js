#!/usr/bin/env node
/**
 * Walk _Assets/Server/NPC/Roles/ and emit a flat JSON catalog of NPC role metadata.
 *
 * Usage:
 *   node tools/refs/npcs/extract-npcs.js
 *   node tools/refs/npcs/extract-npcs.js --assets _Assets --out docs/npcs/npcs-en.json
 */
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const DEFAULT_ASSETS = path.join(REPO_ROOT, "_Assets");
const DEFAULT_OUT = path.join(REPO_ROOT, "docs", "npcs", "npcs-en.json");

function parseArgs(argv) {
  const opts = { assets: DEFAULT_ASSETS, out: DEFAULT_OUT };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (!value) throw new Error(`${arg} requires a value`);
      return value;
    };
    if (arg === "--assets") opts.assets = path.resolve(next());
    else if (arg === "--out") opts.out = path.resolve(next());
    else if (arg === "-h" || arg === "--help") {
      console.log("Usage: node tools/refs/npcs/extract-npcs.js [--assets <dir>] [--out <file>]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, results);
    else if (entry.name.endsWith(".json")) results.push(full);
  }
  return results;
}

function attitudeFor(categoryLower) {
  if (categoryLower.includes("aggressive") || categoryLower.includes("undead")
      || categoryLower.includes("elemental")) return "hostile";
  if (categoryLower.includes("livestock") || categoryLower.includes("critter")) return "passive";
  if (categoryLower.includes("intelligent") && !categoryLower.includes("aggressive")) return "neutral";
  return "unknown";
}

function extract(root) {
  const out = {};
  const skipped = [];
  for (const file of walk(root)) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      const id = path.basename(file, ".json");
      const relPath = path.relative(root, file).split(path.sep).join("/").replace(/\.json$/, "");
      const category = path.posix.dirname(relPath);
      const modify = raw.Modify || {};

      out[id] = {
        id,
        category,
        attitude: attitudeFor(category.toLowerCase()),
        reference: raw.Reference || null,
        maxHealth: modify.MaxHealth ?? null,
        dropList: modify.DropList ?? null,
        appearance: modify.Appearance ?? null,
      };
    } catch (e) {
      skipped.push({ file, err: e.message });
    }
  }
  return { out, skipped };
}

function main() {
  const opts = parseArgs(process.argv);
  const root = path.join(opts.assets, "Server", "NPC", "Roles");
  if (!fs.existsSync(root)) {
    throw new Error(`NPC roles root not found: ${root}`);
  }
  const { out, skipped } = extract(root);
  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  fs.writeFileSync(opts.out, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log(`wrote ${path.relative(REPO_ROOT, opts.out)}`);
  console.log(`extracted ${Object.keys(out).length} NPC roles`);
  console.log(`skipped ${skipped.length}`);
}

main();
