#!/usr/bin/env node
/**
 * Walks _Assets/Server/Prefabs/ and indexes every .prefab.json file by extracting
 * metadata (anchor, block count, bounding box, top dominant blocks) without loading the
 * full block list into long-lived memory. Writes two artefacts:
 *
 *   docs/hytale-prefabs.md           — browsable category-grouped markdown for humans
 *                                       and for the LLM to read as catalog context.
 *   docs/hytale-prefabs-index.json   — flat array of per-prefab metadata, suitable for
 *                                       the future `search_prefabs` / `prefab_details`
 *                                       tools to query at runtime.
 *
 * Both files are committed; re-run after Hytale ships new prefabs.
 *
 * Hytale .prefab.json shape:
 *   { version, blockIdVersion, anchorX, anchorY, anchorZ, blocks: [{x,y,z,name}, ...] }
 *
 * Usage:
 *   node tools/overseer/index-hytale-prefabs.js
 *   node tools/overseer/index-hytale-prefabs.js --root /custom/path/to/Prefabs
 *   node tools/overseer/index-hytale-prefabs.js --md-out docs/hytale-prefabs.md
 *   node tools/overseer/index-hytale-prefabs.js --json-out docs/hytale-prefabs-index.json
 */
const fs = require("node:fs");
const path = require("node:path");
const { modDir } = require("../library/workspace");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_ROOT = path.join(REPO_ROOT, "_Assets/Server/Prefabs");
const DEFAULT_MD = path.join(REPO_ROOT, "docs/hytale-prefabs.md");
const DEFAULT_JSON = path.join(REPO_ROOT, "docs/hytale-prefabs-index.json");
/** Plugin-bundled copy — the SearchPrefabsTool reads from the classpath at this path. */
const PLUGIN_RESOURCE_JSON = path.join(
  modDir("SynthOverseer"),
  "src/main/resources/synthoverseer/prefabs/hytale-prefabs-index.json"
);

const TOP_BLOCKS_PER_PREFAB = 5;

function parseArgs(argv) {
  const opts = { root: DEFAULT_ROOT, mdOut: DEFAULT_MD, jsonOut: DEFAULT_JSON };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") opts.root = path.resolve(argv[++i]);
    else if (a === "--md-out") opts.mdOut = path.resolve(argv[++i]);
    else if (a === "--json-out") opts.jsonOut = path.resolve(argv[++i]);
    else if (a === "-h" || a === "--help") {
      console.log(`Usage: node tools/overseer/index-hytale-prefabs.js [--root PATH] [--md-out FILE] [--json-out FILE]`);
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(1);
    }
  }
  return opts;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".prefab.json")) out.push(full);
  }
  return out;
}

/** Extract metadata from one prefab without keeping the full block list in memory. */
function indexPrefab(file, rootDir) {
  const raw = fs.readFileSync(file, "utf8");
  const json = JSON.parse(raw);
  const blocks = Array.isArray(json.blocks) ? json.blocks : [];

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const counts = new Map();

  for (const b of blocks) {
    if (typeof b.x !== "number" || typeof b.y !== "number" || typeof b.z !== "number") continue;
    if (b.x < minX) minX = b.x; if (b.x > maxX) maxX = b.x;
    if (b.y < minY) minY = b.y; if (b.y > maxY) maxY = b.y;
    if (b.z < minZ) minZ = b.z; if (b.z > maxZ) maxZ = b.z;
    if (b.name) counts.set(b.name, (counts.get(b.name) || 0) + 1);
  }

  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_BLOCKS_PER_PREFAB)
    .map(([name, count]) => ({ name, count }));

  const rel = path.relative(rootDir, file).split(path.sep).join("/");
  const id = rel.replace(/\.prefab\.json$/, "");
  const dirRel = rel.replace(/\/[^/]+\.prefab\.json$/, "");
  const segments = dirRel.split("/");
  const category = segments[0] || "(root)";
  const subcategory = segments.slice(1).join("/") || "(top)";

  return {
    id,
    path: rel,
    category,
    subcategory,
    anchor: [json.anchorX ?? 0, json.anchorY ?? 0, json.anchorZ ?? 0],
    version: json.version ?? null,
    blockIdVersion: json.blockIdVersion ?? null,
    block_count: blocks.length,
    footprint: blocks.length > 0
      ? { min: [minX, minY, minZ], max: [maxX, maxY, maxZ],
          size: [maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1] }
      : null,
    top_blocks: top,
  };
}

/** Aggregate a list of prefab metadata for the markdown's group rows. */
function aggregate(group) {
  const counts = new Map();
  let sizeMin = [Infinity, Infinity, Infinity];
  let sizeMax = [-Infinity, -Infinity, -Infinity];
  let blockMin = Infinity, blockMax = -Infinity;
  for (const p of group) {
    if (p.footprint && p.footprint.size) {
      const s = p.footprint.size;
      sizeMin[0] = Math.min(sizeMin[0], s[0]); sizeMax[0] = Math.max(sizeMax[0], s[0]);
      sizeMin[1] = Math.min(sizeMin[1], s[1]); sizeMax[1] = Math.max(sizeMax[1], s[1]);
      sizeMin[2] = Math.min(sizeMin[2], s[2]); sizeMax[2] = Math.max(sizeMax[2], s[2]);
    }
    blockMin = Math.min(blockMin, p.block_count);
    blockMax = Math.max(blockMax, p.block_count);
    for (const tb of p.top_blocks) counts.set(tb.name, (counts.get(tb.name) || 0) + tb.count);
  }
  const dominant = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);
  return {
    count: group.length,
    block_range: [blockMin, blockMax],
    size_min: sizeMin.every((n) => Number.isFinite(n)) ? sizeMin : null,
    size_max: sizeMax.every((n) => Number.isFinite(n)) ? sizeMax : null,
    dominant_blocks: dominant,
  };
}

function describeCategory(cat) {
  // Hand-curated one-liners. Anything not listed gets a default heuristic from the name.
  const map = {
    Blocksets: "Block-set palettes used by world generation.",
    Cave: "Natural cave details — formations, geysers, hives, mineral nodes, organics, stalagmites.",
    Dungeon: "Dungeon room pieces and connectors — Challenge Gates, Crypts, Goblin Lairs, Labyrinths, Magic Ruins, Outlander Temples, Rift halls, plus per-stone variants (Sandstone / Shale / Slate / Stone).",
    Mineshaft: "Mineshaft structures — shafts, slopes, surface entries, wood (Fir/Dry) variants.",
    Mineshaft_Drift: "Procedural mineshaft drift stages.",
    Monuments: "Themed structures and incidental builds — Challenge, Encounter, Incidental (biome-themed houses + camps), Story, Unique.",
    Npc: "NPC-faction props — Dragons, Feran, Hedera, Kweebec, Outlander, Scarak, Slothian, Trork, Yeti.",
    Plants: "Plant detail props — Bush, Cacti, Coral, Driftwood, Jungle, Mushroom, Seaweed, Twisted Wood.",
    Rock_Formations: "Naturalistic rock cluster prefabs for terrain detail.",
    Spawn: "Player-spawn-related structures.",
    Testing: "Internal test fixtures (skip unless explicitly relevant).",
    TestTree: "Internal test fixtures.",
    Trees: "Tree variants placed by world generation.",
    Unique: "One-off named prefabs.",
  };
  return map[cat] || `${cat} prefabs.`;
}

function fmtRange(arr) {
  if (!arr || arr.length === 0) return "—";
  if (arr[0] === arr[1]) return String(arr[0]);
  return `${arr[0]}–${arr[1]}`;
}

function fmtSizeRange(sMin, sMax) {
  if (!sMin || !sMax) return "—";
  if (sMin[0] === sMax[0] && sMin[1] === sMax[1] && sMin[2] === sMax[2]) {
    return `${sMin[0]}×${sMin[1]}×${sMin[2]}`;
  }
  return `${sMin[0]}×${sMin[1]}×${sMin[2]} → ${sMax[0]}×${sMax[1]}×${sMax[2]}`;
}

function buildMarkdown(prefabs) {
  const byCategory = new Map();
  const bySubcat = new Map();
  for (const p of prefabs) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, []);
    byCategory.get(p.category).push(p);
    const key = `${p.category}|${p.subcategory}`;
    if (!bySubcat.has(key)) bySubcat.set(key, []);
    bySubcat.get(key).push(p);
  }

  const lines = [];
  lines.push("# Hytale Prefab Catalog");
  lines.push("");
  lines.push(`Generated by \`tools/overseer/index-hytale-prefabs.js\` on ${new Date().toISOString()}.`);
  lines.push("Re-run after Hytale ships a new build to refresh.");
  lines.push("");
  lines.push(`Total prefabs indexed: **${prefabs.length}**`);
  lines.push("");
  lines.push("## Top-Level Categories");
  lines.push("");
  lines.push("| Category | Count | Description |");
  lines.push("|---|---:|---|");

  const sortedCategories = [...byCategory.keys()].sort();
  for (const cat of sortedCategories) {
    const count = byCategory.get(cat).length;
    lines.push(`| [\`${cat}\`](#${cat.toLowerCase().replace(/_/g, "-")}) | ${count} | ${describeCategory(cat)} |`);
  }
  lines.push("");

  for (const cat of sortedCategories) {
    const catPrefabs = byCategory.get(cat);
    lines.push(`## ${cat}`);
    lines.push("");
    lines.push(`*${describeCategory(cat)}*`);
    lines.push("");
    lines.push(`Count: **${catPrefabs.length}**`);
    lines.push("");

    // Per-subcategory breakdown
    const subKeys = [...bySubcat.keys()].filter((k) => k.startsWith(cat + "|")).sort();
    if (subKeys.length === 0) {
      lines.push("(no subcategories)");
      lines.push("");
      continue;
    }

    lines.push("| Subcategory | Count | Block range | Footprint range | Dominant block types |");
    lines.push("|---|---:|---:|---|---|");
    for (const k of subKeys) {
      const group = bySubcat.get(k);
      const sub = k.split("|")[1];
      const agg = aggregate(group);
      lines.push(
        `| \`${sub}\` | ${agg.count} | ${fmtRange(agg.block_range)} | ${fmtSizeRange(agg.size_min, agg.size_max)} | ${agg.dominant_blocks.map((n) => `\`${n}\``).join(", ") || "—"} |`
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## Notes For Tool Authors");
  lines.push("");
  lines.push("- A flat per-prefab index is written alongside this file at `docs/hytale-prefabs-index.json` for runtime queries.");
  lines.push("- Prefab `id` in the index is the path relative to `_Assets/Server/Prefabs/` minus the `.prefab.json` extension. Pass that id straight to `PrefabStore.getServerPrefab(...)` when the loader is wired up.");
  lines.push("- Footprint size = `max - min + 1` per axis in voxels. Use it to filter by buildable scale.");
  lines.push("- `top_blocks` in the JSON index lists each prefab's most-used 5 block ids by count — useful for biome / theme filtering before loading the full file.");
  lines.push("");

  return lines.join("\n");
}

function main() {
  const opts = parseArgs(process.argv);
  if (!fs.existsSync(opts.root)) {
    console.error(`Prefab root not found: ${opts.root}`);
    process.exit(1);
  }

  console.log(`Walking ${opts.root} ...`);
  const files = walk(opts.root);
  console.log(`Found ${files.length} .prefab.json files. Indexing...`);

  const prefabs = [];
  let failures = 0;
  let lastProgress = 0;
  for (let i = 0; i < files.length; i++) {
    try {
      prefabs.push(indexPrefab(files[i], opts.root));
    } catch (e) {
      failures++;
      if (failures <= 5) console.warn(`  parse failed: ${files[i]} — ${e.message}`);
    }
    if (Date.now() - lastProgress > 1500) {
      lastProgress = Date.now();
      process.stdout.write(`  ${i + 1}/${files.length}\r`);
    }
  }
  process.stdout.write(`\n`);
  if (failures > 0) console.warn(`  total failures: ${failures}`);

  // Sort for stable diffs
  prefabs.sort((a, b) => a.id.localeCompare(b.id));

  // Write JSON index
  fs.mkdirSync(path.dirname(opts.jsonOut), { recursive: true });
  fs.writeFileSync(opts.jsonOut, JSON.stringify({
    version: 1,
    generated_at: new Date().toISOString(),
    root: path.relative(REPO_ROOT, opts.root).split(path.sep).join("/"),
    total: prefabs.length,
    prefabs,
  }, null, 2));
  console.log(`Wrote JSON index:  ${opts.jsonOut} (${prefabs.length} entries)`);

  // Write markdown
  fs.mkdirSync(path.dirname(opts.mdOut), { recursive: true });
  fs.writeFileSync(opts.mdOut, buildMarkdown(prefabs));
  console.log(`Wrote markdown:    ${opts.mdOut}`);

  // Write plugin-bundled copy so SearchPrefabsTool's classpath load picks it up at jar
  // build time. Same JSON content as the docs copy.
  const pluginJson = PLUGIN_RESOURCE_JSON;
  fs.mkdirSync(path.dirname(pluginJson), { recursive: true });
  fs.copyFileSync(opts.jsonOut, pluginJson);
  console.log(`Wrote plugin copy: ${pluginJson}`);
}

main();
