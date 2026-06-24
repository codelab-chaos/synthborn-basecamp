#!/usr/bin/env node
/*
 * Build a loot / drop index from the unpacked Hytale assets in _Assets/.
 *
 * Two sources merge into one normalized stream:
 *
 *   1. Named drop-list registry under _Assets/Server/Drops/**.json
 *      Each file's basename is its DroplistId; top-level `Container` is the tree.
 *      Blocks and NPCs reference these by name (e.g. a bush's
 *      BlockType.Gathering.Soft.DropList = "Plant_Bush").
 *
 *   2. Block gather drops embedded in item files under
 *      _Assets/Server/Item/Items/**.json at BlockType.Gathering.{Soft,Breaking,Hard}.
 *      The DropList there is either a string (named ref into source 1) or an
 *      inline { Container: ... } tree. Gather config is inherited via `Parent`.
 *
 * Container grammar (see _Assets/Server/Drops):
 *   Single   { Item: { ItemId, Quantity? | QuantityMin/QuantityMax? }, Weight? }
 *   Multiple { Containers[] }  - each child rolls INDEPENDENTLY; child Weight is
 *                                a percent chance (Weight/100), absent = always.
 *   Choice   { Containers[], RollsMin?, RollsMax? } - pick child(ren) weighted by
 *                                Weight (relative); rolls = avg(RollsMin,RollsMax)|1.
 *   Droplist { DroplistId }    - reference into the named registry (recurse).
 *   Empty    {}                - nothing.
 *
 * Emits in docs/refs/recipes/:
 *   - loot.json   { droplists, blocks, byItem }  (resolved + expected per drop)
 *   - loot.txt    grep-friendly index (one line per source, plus a By-item section)
 *
 * "expected" is the mean count of an item produced by one resolution of the
 * tree; "chancePct" is P(at least one) across that item's contributions.
 *
 * Cross-platform Node, no deps.
 *
 * Usage:
 *   node tools/refs/recipes/extract-loot.js [--assets <dir>] [--out <dir>] [--verbose]
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const DEFAULT_ASSETS = path.join(REPO_ROOT, "_Assets");
const DEFAULT_OUT = path.join(REPO_ROOT, "docs", "refs", "recipes");

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} requires a value`);
      return v;
    };
    switch (a) {
      case "-h": case "--help": opts.help = true; return opts;
      case "--assets": opts.assets = next(); break;
      case "--out": opts.out = next(); break;
      case "--verbose": opts.verbose = true; break;
      default: throw new Error(`Unknown argument: ${a}`);
    }
  }
  return opts;
}

function usage() {
  console.log(`Usage: node tools/refs/recipes/extract-loot.js [options]

Options:
  --assets <dir>   _Assets root (default: ${DEFAULT_ASSETS})
  --out <dir>      Output dir   (default: ${DEFAULT_OUT})
  --verbose        Log every parsed source
  --help, -h       Show this help
`);
}

function* walkJson(root) {
  if (!fs.existsSync(root)) return;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith(".json")) yield full;
    }
  }
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    process.stderr.write(`  ! parse failed: ${path.relative(REPO_ROOT, file)} — ${err.message}\n`);
    return null;
  }
}

function relFile(file) {
  return path.relative(REPO_ROOT, file).replace(/\\/g, "/");
}

// --- registry of named drop-lists (source 1) -------------------------------

function loadDroplistRegistry(assetsDir, verbose) {
  const root = path.join(assetsDir, "Server", "Drops");
  const registry = new Map(); // id -> { id, sourceFile, container }
  for (const file of walkJson(root)) {
    const json = readJsonSafe(file);
    if (!json || typeof json.Container !== "object" || json.Container === null) continue;
    const id = path.basename(file, ".json");
    registry.set(id, { id, sourceFile: relFile(file), container: json.Container });
    if (verbose) console.log(`  droplist: ${id}`);
  }
  return registry;
}

// --- block gather drops (source 2), with Parent inheritance ----------------

function loadItemFiles(assetsDir, verbose) {
  const root = path.join(assetsDir, "Server", "Item", "Items");
  const items = new Map(); // id -> raw json
  for (const file of walkJson(root)) {
    const json = readJsonSafe(file);
    if (!json) continue;
    const id = path.basename(file, ".json");
    items.set(id, { id, sourceFile: relFile(file), json });
    if (verbose) console.log(`  item: ${id}`);
  }
  return items;
}

// Resolve BlockType.Gathering for an item, walking the Parent chain. Returns the
// nearest Gathering object found, or null. (We do not deep-merge parent/child
// gather modes; the nearest definition wins, which matches how variants override.)
function resolveGathering(itemId, items, seen = new Set()) {
  if (seen.has(itemId)) return null;
  seen.add(itemId);
  const entry = items.get(itemId);
  if (!entry) return null;
  const blockType = entry.json && entry.json.BlockType;
  if (blockType && blockType.Gathering && typeof blockType.Gathering === "object") {
    return { gathering: blockType.Gathering, definedBy: itemId };
  }
  const parent = entry.json && entry.json.Parent;
  if (typeof parent === "string" && parent) {
    return resolveGathering(parent, items, seen);
  }
  return null;
}

// --- container resolution → flat per-item contributions --------------------

function avgQuantity(item) {
  if (!item || typeof item !== "object") return 1;
  if (typeof item.Quantity === "number") return item.Quantity;
  const min = typeof item.QuantityMin === "number" ? item.QuantityMin : null;
  const max = typeof item.QuantityMax === "number" ? item.QuantityMax : null;
  if (min != null && max != null) return (min + max) / 2;
  if (min != null) return min;
  if (max != null) return max;
  return 1;
}

function qtyRange(item) {
  if (!item || typeof item !== "object") return [1, 1];
  if (typeof item.Quantity === "number") return [item.Quantity, item.Quantity];
  const min = typeof item.QuantityMin === "number" ? item.QuantityMin : 1;
  const max = typeof item.QuantityMax === "number" ? item.QuantityMax : min;
  return [min, max];
}

/*
 * Walk a container tree, accumulating per-item contributions into `acc`
 * (Map itemId -> { probs:[...], expected, minSum, maxSum }). `prob` is the
 * probability this subtree is reached. Recursion through named droplists is
 * guarded by `stack` to break cycles.
 */
function walkContainer(container, prob, registry, acc, stack) {
  if (!container || typeof container !== "object" || prob <= 0) return;
  const type = container.Type;

  if (type === "Single") {
    const item = container.Item;
    const itemId = item && item.ItemId;
    if (typeof itemId !== "string" || !itemId) return;
    const avg = avgQuantity(item);
    const [min, max] = qtyRange(item);
    let rec = acc.get(itemId);
    if (!rec) { rec = { probs: [], expected: 0, minSum: 0, maxSum: 0 }; acc.set(itemId, rec); }
    rec.probs.push(prob);
    rec.expected += prob * avg;
    rec.minSum += prob * min;
    rec.maxSum += prob * max;
    return;
  }

  if (type === "Multiple") {
    const children = Array.isArray(container.Containers) ? container.Containers : [];
    for (const child of children) {
      // Each child rolls independently; Weight (when present) is a percent chance.
      const childProb = typeof child.Weight === "number" ? Math.min(1, child.Weight / 100) : 1;
      walkContainer(child, prob * childProb, registry, acc, stack);
    }
    return;
  }

  if (type === "Choice") {
    const children = Array.isArray(container.Containers) ? container.Containers : [];
    const total = children.reduce((s, c) => s + (typeof c.Weight === "number" ? c.Weight : 1), 0);
    if (total <= 0) return;
    const rollsMin = typeof container.RollsMin === "number" ? container.RollsMin : 1;
    const rollsMax = typeof container.RollsMax === "number" ? container.RollsMax : rollsMin;
    const rolls = (rollsMin + rollsMax) / 2;
    for (const child of children) {
      const w = typeof child.Weight === "number" ? child.Weight : 1;
      const childProb = rolls * (w / total); // expected times selected
      walkContainer(child, prob * childProb, registry, acc, stack);
    }
    return;
  }

  if (type === "Droplist") {
    const id = container.DroplistId || container.DropListId || container.Id;
    if (typeof id !== "string" || !id) return;
    if (stack.includes(id)) return; // cycle guard
    const entry = registry.get(id);
    if (!entry) {
      // record the unresolved reference as a pseudo-item so it's visible
      const key = `@droplist:${id}`;
      let rec = acc.get(key);
      if (!rec) { rec = { probs: [], expected: 0, minSum: 0, maxSum: 0, unresolved: true }; acc.set(key, rec); }
      rec.probs.push(prob);
      return;
    }
    walkContainer(entry.container, prob, registry, acc, [...stack, id]);
    return;
  }

  if (type === "Empty") return;

  // Unknown container type: try to recurse into Containers if present.
  if (Array.isArray(container.Containers)) {
    for (const child of container.Containers) walkContainer(child, prob, registry, acc, stack);
  }
}

function chanceAny(probs) {
  // P(at least one) treating contributions as independent; clamp each to [0,1].
  let none = 1;
  for (const p of probs) none *= (1 - Math.min(1, Math.max(0, p)));
  return 1 - none;
}

function resolveTree(container, registry, startId) {
  const acc = new Map();
  walkContainer(container, 1, registry, acc, startId ? [startId] : []);
  const drops = [...acc.entries()].map(([itemId, rec]) => ({
    item: itemId,
    expected: round(rec.expected),
    chancePct: rec.unresolved ? null : Math.round(chanceAny(rec.probs) * 100),
    qtyMin: round(rec.minSum),
    qtyMax: round(rec.maxSum),
    unresolved: rec.unresolved === true,
  }));
  drops.sort((a, b) => b.expected - a.expected || a.item.localeCompare(b.item));
  return drops;
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

// --- assembly --------------------------------------------------------------

function collect(assetsDir, verbose) {
  const registry = loadDroplistRegistry(assetsDir, verbose);
  const items = loadItemFiles(assetsDir, verbose);

  // Resolve every named droplist.
  const droplists = [];
  for (const entry of registry.values()) {
    droplists.push({
      id: entry.id,
      sourceFile: entry.sourceFile,
      drops: resolveTree(entry.container, registry, entry.id),
    });
  }
  droplists.sort((a, b) => a.id.localeCompare(b.id));

  // Resolve block gather drops.
  const blocks = [];
  const GATHER_MODES = ["Soft", "Breaking", "Hard"];
  for (const entry of items.values()) {
    const resolved = resolveGathering(entry.id, items);
    if (!resolved) continue;
    const modes = {};
    let any = false;
    for (const mode of GATHER_MODES) {
      const cfg = resolved.gathering[mode];
      if (!cfg || typeof cfg !== "object") continue;
      let container = null;
      let droplistRef = null;
      if (typeof cfg.DropList === "string") {
        droplistRef = cfg.DropList;
        const reg = registry.get(cfg.DropList);
        container = reg ? reg.container : null;
      } else if (cfg.DropList && typeof cfg.DropList === "object" && cfg.DropList.Container) {
        container = cfg.DropList.Container;
      } else if (cfg.Container) {
        container = cfg.Container;
      }
      if (!container && !droplistRef) continue;
      modes[mode] = {
        gatherType: cfg.GatherType || null,
        droplistRef,
        drops: container ? resolveTree(container, registry, droplistRef || entry.id)
          : [{ item: `@droplist:${droplistRef}`, expected: 0, chancePct: null, qtyMin: 0, qtyMax: 0, unresolved: true }],
      };
      any = true;
    }
    if (!any) continue;
    blocks.push({
      id: entry.id,
      sourceFile: entry.sourceFile,
      gatheringDefinedBy: resolved.definedBy === entry.id ? null : resolved.definedBy,
      modes,
    });
  }
  blocks.sort((a, b) => a.id.localeCompare(b.id));

  // Reverse index: item -> every source that can drop it.
  const byItem = new Map();
  const addByItem = (itemId, source) => {
    if (itemId.startsWith("@droplist:")) return;
    if (!byItem.has(itemId)) byItem.set(itemId, []);
    byItem.get(itemId).push(source);
  };
  for (const dl of droplists) {
    for (const d of dl.drops) addByItem(d.item, { kind: "droplist", id: dl.id, expected: d.expected, chancePct: d.chancePct });
  }
  for (const b of blocks) {
    for (const [mode, m] of Object.entries(b.modes)) {
      for (const d of m.drops) addByItem(d.item, { kind: "block", id: b.id, mode, expected: d.expected, chancePct: d.chancePct });
    }
  }
  const byItemObj = {};
  for (const key of [...byItem.keys()].sort()) {
    byItemObj[key] = byItem.get(key).sort((a, b) => (b.expected || 0) - (a.expected || 0));
  }

  return { registry, items, droplists, blocks, byItem: byItemObj };
}

// --- text rendering --------------------------------------------------------

function dropToText(d) {
  const chance = d.unresolved ? "unresolved" : `${d.chancePct}%`;
  return `${d.item} x${d.expected}~ (${chance})`;
}

function renderText({ droplists, blocks, byItem, generatedAt }) {
  const lines = [];
  lines.push("# Hytale Loot / Drop Reference");
  lines.push("");
  lines.push(`> Generated ${generatedAt} from \`_Assets/Server/Drops/\` (named drop-lists) and \`_Assets/Server/Item/Items/\` (block \`BlockType.Gathering\`).`);
  lines.push("");
  lines.push("`x<n>~` is the mean count per resolution; `(p%)` is P(at least one). Query with `node tools/refs/recipes/gamedata.js drops <id>` / `source <item>`.");
  lines.push("");
  lines.push("Regenerate: `node tools/refs/recipes/extract-loot.js`");
  lines.push("");

  lines.push(`## Blocks (${blocks.length})`);
  lines.push("");
  for (const b of blocks) {
    for (const [mode, m] of Object.entries(b.modes)) {
      const drops = m.drops.map(dropToText).join(", ") || "—";
      const ref = m.droplistRef ? ` [list=${m.droplistRef}]` : "";
      lines.push(`- ${b.id} (${mode}${m.gatherType ? "/" + m.gatherType : ""})${ref} → ${drops}`);
    }
  }
  lines.push("");

  lines.push(`## Named drop-lists (${droplists.length})`);
  lines.push("");
  for (const dl of droplists) {
    const drops = dl.drops.map(dropToText).join(", ") || "—";
    lines.push(`- ${dl.id} → ${drops}`);
  }
  lines.push("");

  lines.push(`## By item (${Object.keys(byItem).length})`);
  lines.push("");
  for (const item of Object.keys(byItem)) {
    lines.push(`### ${item}`);
    for (const s of byItem[item]) {
      const loc = s.kind === "block" ? `${s.id} (${s.mode})` : `droplist ${s.id}`;
      lines.push(`- ${loc} — x${s.expected}~ (${s.chancePct == null ? "?" : s.chancePct + "%"})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function readPinnedHytaleVersion() {
  const sdkSource = path.join(REPO_ROOT, "docs", "sdk", ".sdk-source.json");
  try {
    const data = JSON.parse(fs.readFileSync(sdkSource, "utf8"));
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { usage(); return; }

  const assetsDir = path.resolve(opts.assets || DEFAULT_ASSETS);
  const outDir = path.resolve(opts.out || DEFAULT_OUT);
  if (!fs.existsSync(assetsDir)) throw new Error(`Assets directory not found: ${assetsDir}`);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Assets : ${assetsDir}`);
  console.log(`Output : ${outDir}`);
  console.log("");

  const t0 = Date.now();
  const { droplists, blocks, byItem } = collect(assetsDir, opts.verbose);
  const generatedAt = new Date().toISOString();

  const jsonPayload = {
    generatedAt,
    hytaleVersion: readPinnedHytaleVersion(),
    counts: {
      droplists: droplists.length,
      blocks: blocks.length,
      items: Object.keys(byItem).length,
    },
    droplists,
    blocks,
    byItem,
  };

  fs.writeFileSync(path.join(outDir, "loot.json"), JSON.stringify(jsonPayload, null, 2));
  fs.writeFileSync(path.join(outDir, "loot.txt"), renderText({ droplists, blocks, byItem, generatedAt }));

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Resolved in ${elapsed}s`);
  console.log(`  ${droplists.length} named drop-lists`);
  console.log(`  ${blocks.length} blocks with gather drops`);
  console.log(`  ${Object.keys(byItem).length} distinct dropped items → loot.txt + loot.json`);
}

try {
  main();
} catch (err) {
  console.error(`extract-loot: ${err.message}`);
  process.exitCode = 1;
}
