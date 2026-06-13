#!/usr/bin/env node
/**
 * Extracts reusable building-block metadata from reference prefab packs.
 *
 * This does not copy prefab content into the mod. It indexes shape, palette, rotations,
 * and inferred module roles so we can design procedural builders from real examples.
 *
 * Usage:
 *   node tools/refs/prefabs/extract-prefab-modules.js
 *   node tools/refs/prefabs/extract-prefab-modules.js --root _references/example-prefabs
 *   node tools/refs/prefabs/extract-prefab-modules.js --json-out docs/procbuild/reference-prefab-modules.json
 *   node tools/refs/prefabs/extract-prefab-modules.js --md-out docs/procbuild/reference-prefab-modules.md
 */
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const DEFAULT_ROOT = path.join(REPO_ROOT, "_references", "example-prefabs");
const DEFAULT_JSON = path.join(REPO_ROOT, "docs", "procbuild", "reference-prefab-modules.json");
const DEFAULT_MD = path.join(REPO_ROOT, "docs", "procbuild", "reference-prefab-modules.md");
const TOP_BLOCKS = 12;

function parseArgs(argv) {
  const opts = { root: DEFAULT_ROOT, jsonOut: DEFAULT_JSON, mdOut: DEFAULT_MD };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") opts.root = path.resolve(argv[++i]);
    else if (a === "--json-out") opts.jsonOut = path.resolve(argv[++i]);
    else if (a === "--md-out") opts.mdOut = path.resolve(argv[++i]);
    else if (a === "-h" || a === "--help") {
      console.log("Usage: node tools/refs/prefabs/extract-prefab-modules.js [--root PATH] [--json-out FILE] [--md-out FILE]");
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(1);
    }
  }
  return opts;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".prefab.json")) out.push(full);
  }
  return out;
}

function slug(s) {
  return s
    .replace(/\.prefab\.json$/i, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function countKeyword(blockName, keywords) {
  const lower = blockName.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

function blockKind(name) {
  if (countKeyword(name, ["roof"])) return "roof";
  if (countKeyword(name, ["stairs", "stair"])) return "stair";
  if (countKeyword(name, ["door"])) return "door";
  if (countKeyword(name, ["window"])) return "window";
  if (countKeyword(name, ["fence"])) return "fence";
  if (countKeyword(name, ["beam"])) return "beam";
  if (countKeyword(name, ["trunk", "wood", "planks", "log"])) return "wood";
  if (countKeyword(name, ["stone", "rock", "cobble", "brick", "slate", "shale"])) return "stone";
  if (countKeyword(name, ["leaf", "leaves", "plant", "grass", "flower", "soil"])) return "organic";
  return "other";
}

function inferRole(id, pack) {
  const s = `${pack}/${id}`.toLowerCase();
  const rules = [
    [/gatehouse|gate_house|gate/, "gatehouse"],
    [/wall.*straight|straight.*wall/, "wall_straight"],
    [/wall.*corner|corner.*wall/, "wall_corner"],
    [/wall.*curv|curv.*wall/, "wall_curved"],
    [/wall.*diag|diag.*wall/, "wall_diagonal"],
    [/tower/, "tower"],
    [/farmhouse/, "farmhouse"],
    [/cottage|cozy.*house|small.*house|house/, "house"],
    [/inn/, "inn"],
    [/bridge/, "bridge"],
    [/tree/, "tree"],
  ];
  for (const [re, role] of rules) {
    if (re.test(s)) return role;
  }
  return "scene_or_prop";
}

function inferConnectors(role) {
  switch (role) {
    case "wall_straight":
      return [{ side: "north", kind: "wall" }, { side: "south", kind: "wall" }];
    case "wall_corner":
    case "wall_curved":
      return [{ side: "north", kind: "wall" }, { side: "east", kind: "wall" }];
    case "wall_diagonal":
      return [{ side: "northwest", kind: "wall" }, { side: "southeast", kind: "wall" }];
    case "gatehouse":
      return [{ side: "west", kind: "wall" }, { side: "east", kind: "wall" }, { side: "center", kind: "passage" }];
    case "tower":
      return [{ side: "north", kind: "wall" }, { side: "east", kind: "wall" }, { side: "south", kind: "wall" }, { side: "west", kind: "wall" }];
    case "house":
    case "farmhouse":
    case "inn":
      return [{ side: "front", kind: "entrance" }];
    default:
      return [];
  }
}

function tagsFor(module) {
  const tags = [module.role];
  const c = module.counts;
  if (c.roof > 0) tags.push("roofed");
  if (c.door > 0) tags.push("has_door");
  if (c.window > 0) tags.push("has_windows");
  if (c.fence > 0) tags.push("uses_fence");
  if (c.stone > c.wood) tags.push("stone_dominant");
  if (c.wood >= c.stone && c.wood > 0) tags.push("wood_dominant");
  const [sx, sy, sz] = module.size;
  if (sx <= 13 && sz <= 13 && sy <= 14) tags.push("compact");
  if (sx > 20 || sz > 20 || sy > 20) tags.push("large");
  return [...new Set(tags)];
}

function indexPrefab(file, root) {
  const raw = fs.readFileSync(file, "utf8");
  const json = JSON.parse(raw);
  const blocks = Array.isArray(json.blocks) ? json.blocks : [];
  const rel = path.relative(root, file).split(path.sep).join("/");
  const pack = rel.split("/")[0] || "(root)";
  const id = slug(rel);
  const sourceName = path.basename(file);
  const role = inferRole(sourceName, pack);

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const blockCounts = new Map();
  const rotations = new Map();
  const counts = { roof: 0, stair: 0, door: 0, window: 0, fence: 0, beam: 0, wood: 0, stone: 0, organic: 0, other: 0 };
  let solidBlockCount = 0;

  for (const b of blocks) {
    if (typeof b.x !== "number" || typeof b.y !== "number" || typeof b.z !== "number") continue;
    minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x);
    minY = Math.min(minY, b.y); maxY = Math.max(maxY, b.y);
    minZ = Math.min(minZ, b.z); maxZ = Math.max(maxZ, b.z);
    if (b.name && b.name !== "Empty") {
      solidBlockCount++;
      blockCounts.set(b.name, (blockCounts.get(b.name) || 0) + 1);
      counts[blockKind(b.name)]++;
      if (Number.isInteger(b.rotation)) {
        if (!rotations.has(b.name)) rotations.set(b.name, new Set());
        rotations.get(b.name).add(b.rotation);
      }
    }
  }

  const topBlocks = [...blockCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_BLOCKS)
    .map(([name, count]) => ({ name, count }));

  const rotationSummary = [...rotations.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, values]) => ({ name, values: [...values].sort((a, b) => a - b) }));

  const size = blocks.length > 0 ? [maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1] : [0, 0, 0];
  const module = {
    id,
    source_path: rel,
    pack,
    role,
    role_confidence: role.startsWith("wall_") || role === "tower" || role === "gatehouse" ? "high" : "medium",
    anchor: [json.anchorX ?? 0, json.anchorY ?? 0, json.anchorZ ?? 0],
    bounds: blocks.length > 0 ? { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] } : null,
    size,
    cell_count: blocks.length,
    solid_block_count: solidBlockCount,
    block_count: solidBlockCount,
    counts,
    connectors: inferConnectors(role),
    connectors_inferred: true,
    top_blocks: topBlocks,
    rotations: rotationSummary,
    version: json.version ?? null,
    blockIdVersion: json.blockIdVersion ?? null,
  };
  module.tags = tagsFor(module);
  return module;
}

function aggregatePack(modules) {
  const roleCounts = new Map();
  const tagCounts = new Map();
  for (const m of modules) {
    roleCounts.set(m.role, (roleCounts.get(m.role) || 0) + 1);
    for (const tag of m.tags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }
  return {
    count: modules.length,
    roles: Object.fromEntries([...roleCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    tags: Object.fromEntries([...tagCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
  };
}

function markdown(catalog) {
  const lines = [];
  lines.push("# Reference Prefab Module Catalog");
  lines.push("");
  lines.push(`Generated by \`tools/refs/prefabs/extract-prefab-modules.js\` on ${catalog.generated_at}.`);
  lines.push("");
  lines.push("This is an analysis catalog, not a runtime dependency. Connectors and roles are inferred from file names and block composition until validated in game.");
  lines.push("");
  lines.push(`Total modules indexed: **${catalog.modules.length}**`);
  lines.push("");
  lines.push("## Packs");
  lines.push("");
  lines.push("| Pack | Count | Roles | Useful read |");
  lines.push("|---|---:|---|---|");
  for (const [pack, summary] of Object.entries(catalog.pack_summaries)) {
    const roles = Object.entries(summary.roles).map(([k, v]) => `\`${k}\` ${v}`).join(", ");
    lines.push(`| ${pack} | ${summary.count} | ${roles} | ${packNote(pack)} |`);
  }
  lines.push("");
  lines.push("## Extracted Modules");
  lines.push("");
  lines.push("| Module | Role | Size | Blocks | Connectors | Top blocks |");
  lines.push("|---|---|---:|---:|---|---|");
  for (const m of catalog.modules) {
    const size = m.size.join("x");
    const connectors = m.connectors.length > 0
      ? m.connectors.map((c) => `${c.side}:${c.kind}`).join(", ")
      : "-";
    const top = m.top_blocks.slice(0, 5).map((b) => `${b.name} ${b.count}`).join(", ");
    lines.push(`| \`${m.id}\` | \`${m.role}\` | ${size} | ${m.block_count} | ${connectors} | ${top} |`);
  }
  lines.push("");
  lines.push("## Rotation Hints");
  lines.push("");
  lines.push("Only modules with rotated blocks are listed. These are the strongest references for roof, stair, beam, fence, and door orientation.");
  lines.push("");
  for (const m of catalog.modules.filter((x) => x.rotations.length > 0)) {
    lines.push(`### \`${m.id}\``);
    lines.push("");
    for (const r of m.rotations.slice(0, 20)) {
      lines.push(`- \`${r.name}\`: ${r.values.join(", ")}`);
    }
    if (m.rotations.length > 20) lines.push(`- ... ${m.rotations.length - 20} more block types`);
    lines.push("");
  }
  return lines.join("\n");
}

function packNote(pack) {
  if (pack.includes("TKM City Walls")) return "Best immediate modular wall kit.";
  if (pack.includes("TKM Farmhouses")) return "Best compact house grammar source.";
  if (pack.includes("HyTinys")) return "Best style/palette source; many full scenes.";
  if (pack.includes("mc-bx")) return "General house motifs; less modular.";
  if (pack.includes("Two_cozy")) return "Good cozy-house proportions and roof/window examples.";
  return "Reference pack.";
}

function ensureParent(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function main() {
  const opts = parseArgs(process.argv);
  const files = walk(opts.root).sort((a, b) => a.localeCompare(b));
  const modules = files.map((file) => indexPrefab(file, opts.root));
  const byPack = new Map();
  for (const m of modules) {
    if (!byPack.has(m.pack)) byPack.set(m.pack, []);
    byPack.get(m.pack).push(m);
  }
  const packSummaries = {};
  for (const [pack, packModules] of [...byPack.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    packSummaries[pack] = aggregatePack(packModules);
  }
  const catalog = {
    generated_at: new Date().toISOString(),
    source_root: path.relative(REPO_ROOT, opts.root).split(path.sep).join("/"),
    schema: "hytale.reference_prefab_modules.v1",
    module_count: modules.length,
    pack_summaries: packSummaries,
    modules,
  };

  ensureParent(opts.jsonOut);
  ensureParent(opts.mdOut);
  fs.writeFileSync(opts.jsonOut, JSON.stringify(catalog, null, 2) + "\n", "utf8");
  fs.writeFileSync(opts.mdOut, markdown(catalog) + "\n", "utf8");
  console.log(`wrote ${path.relative(REPO_ROOT, opts.jsonOut)}`);
  console.log(`wrote ${path.relative(REPO_ROOT, opts.mdOut)}`);
  console.log(`indexed ${modules.length} prefab modules from ${path.relative(REPO_ROOT, opts.root)}`);
}

main();
