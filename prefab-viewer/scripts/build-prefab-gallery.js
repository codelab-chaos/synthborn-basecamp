#!/usr/bin/env node
/*
 * Build prefab gallery data: manifest.json + per-prefab voxel JSON.
 *
 * Output layout (default ../../docs/prefab-gallery):
 *   manifest.json
 *   data/<source-folder>/<prefab-stem>.vox
 *
 * Run alone or via `npm run build:data` / `npm run build` in tools/prefab-viewer.
 */

const fs = require("fs");
const path = require("path");
const {
  readPrefab,
  normalizeBlocks,
  getBounds,
  safeStem,
} = require("./render-prefab-views.js");
const { encodeVoxelFileV3, rgbToHex } = require("./library/voxel-payload.js");
const { formatPrefabLabel } = require("./library/prefab-label.js");

const REPO_ROOT = path.resolve(__dirname, "../../..");

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.inputs.length === 0) {
    printUsage(args.help ? 0 : 1);
  }

  const outRoot = path.resolve(args.out || path.join(REPO_ROOT, "docs/prefab-gallery"));
  const dataRoot = path.join(outRoot, "data");
  const assetsRoot = path.resolve(args.assets || path.join(REPO_ROOT, "_Assets"));
  const htmlDir = outRoot;
  const assetIndex = buildAssetIndex(assetsRoot);
  const limit = args.limit == null ? Infinity : Math.max(0, Number(args.limit) | 0);
  const sources = collectSources(args.inputs);
  const prefabs = sources.flatMap((source) => source.prefabs.map((prefabPath) => ({ source, prefabPath })));

  fs.mkdirSync(outRoot, { recursive: true });
  if (fs.existsSync(dataRoot)) fs.rmSync(dataRoot, { recursive: true, force: true });
  fs.mkdirSync(dataRoot, { recursive: true });

  const entries = [];
  let rendered = 0;
  for (const item of prefabs.slice(0, limit)) {
    const entry = renderPrefab(item.source, item.prefabPath, {
      dataRoot,
      htmlDir,
      assetIndex,
    });
    if (entry) {
      entries.push(entry);
      rendered++;
      if (rendered % 250 === 0 || rendered === 1) {
        console.log(`[gallery] ${rendered} prefab(s) processed...`);
      }
    }
  }

  writeManifest(outRoot, entries, {
    generatedAt: new Date(),
    assetsRoot,
  });

  console.log(`[done] ${rendered} prefab(s) -> ${outRoot}`);
}

function parseArgs(argv) {
  const args = { inputs: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--out") args.out = requireValue(argv, ++i, "--out");
    else if (arg === "--assets") args.assets = requireValue(argv, ++i, "--assets");
    else if (arg === "--limit") args.limit = Number(requireValue(argv, ++i, "--limit"));
    else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    else args.inputs.push(arg);
  }
  return args;
}

function requireValue(argv, i, name) {
  if (i >= argv.length) throw new Error(`${name} requires a value`);
  return argv[i];
}

function printUsage(code) {
  const script = path.relative(process.cwd(), __filename);
  console.log(`Usage:
  node ${script} <prefab.json|directory> [more inputs...] [--out docs/prefab-gallery]

Options:
  --out DIR     Gallery output folder. Default: <repo>/docs/prefab-gallery
  --assets DIR  Hytale _Assets folder. Default: <repo>/_Assets
  --limit N     Process only the first N prefabs for a quick sample.

Examples:
  node ${script} ../../_Assets/Server/Prefabs
  node ${script} ../../_Assets/Server/Prefabs --limit 40`);
  process.exit(code);
}

const EXCLUDED_SOURCE_MARKERS = [
  "/_references/example-prefabs",
  "/example-prefabs/",
  "/mods/",
];

function isExcludedPrefabSource(resolved) {
  const normalized = resolved.replace(/\\/g, "/").toLowerCase();
  return EXCLUDED_SOURCE_MARKERS.some((marker) => normalized.includes(marker));
}

function collectSources(inputs) {
  return inputs.flatMap((input) => {
    const resolved = path.resolve(input);
    if (!fs.existsSync(resolved)) throw new Error(`Input not found: ${input}`);
    if (isExcludedPrefabSource(resolved)) {
      console.warn(`[skip] Third-party/creator prefab source excluded: ${input}`);
      return [];
    }
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      const prefabs = [];
      collectPrefabs(resolved, prefabs);
      return [{ root: resolved, label: sourceLabel(resolved), prefabs }];
    }
    const parent = path.dirname(resolved);
    if (isExcludedPrefabSource(parent)) {
      console.warn(`[skip] Third-party/creator prefab file excluded: ${input}`);
      return [];
    }
    return [{ root: parent, label: sourceLabel(parent), prefabs: [resolved] }];
  });
}

function sourceLabel(resolved) {
  const normalized = resolved.replace(/\\/g, "/").toLowerCase();
  if (normalized.includes("/_assets/server/prefabs")) return "Vanilla _Assets";
  if (normalized.includes("/_references/example-prefabs") || normalized.includes("/mods/")) {
    return `Creator Prefab Mods/${path.basename(resolved)}`;
  }
  return safeStem(path.basename(resolved));
}

function buildPrefabTags(source, relativeDir) {
  const parts = relativeDir === "." ? [] : relativeDir.split(path.sep).map(safeStem).filter(Boolean);
  if (source.label === "Vanilla _Assets") return parts;
  if (source.label.startsWith("Creator Prefab Mods/")) {
    return [source.label.slice("Creator Prefab Mods/".length)];
  }
  return source.label ? [source.label] : [];
}

function buildTagTree(entries) {
  const tree = {};
  for (const entry of entries) {
    const tags = entry.tags || [];
    for (let i = 0; i < tags.length - 1; i++) {
      const parent = tags[i];
      const child = tags[i + 1];
      if (!tree[parent]) tree[parent] = new Set();
      tree[parent].add(child);
    }
  }
  const sorted = {};
  for (const [parent, children] of Object.entries(tree)) {
    sorted[parent] = Array.from(children).sort((a, b) => a.localeCompare(b));
  }
  return sorted;
}

function collectPrefabs(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectPrefabs(full, out);
    else if (/\.prefab\.json$/i.test(entry.name) || (/\.json$/i.test(entry.name) && !entry.name.toLowerCase().includes("desktop"))) {
      out.push(full);
    }
  }
  out.sort((a, b) => a.localeCompare(b));
}

function renderPrefab(source, prefabPath, options) {
  let prefab;
  try {
    prefab = readPrefab(prefabPath);
  } catch (err) {
    console.warn(`[skip] ${prefabPath}: ${err.message}`);
    return null;
  }

  const blocks = normalizeBlocks(prefab.blocks || [], (name) => colorForAssetBlock(options.assetIndex, name));
  if (blocks.length === 0) {
    console.warn(`[skip] ${prefabPath}: no non-empty blocks`);
    return null;
  }

  const bounds = getBounds(blocks);
  const relativeFile = path.relative(source.root, prefabPath);
  const relativeDir = path.dirname(relativeFile);
  const stem = safeStem(path.basename(prefabPath).replace(/\.prefab\.json$/i, "").replace(/\.json$/i, ""));
  const folderParts = [
    source.label,
    ...(relativeDir === "." ? [] : relativeDir.split(path.sep).map(safeStem).filter(Boolean)),
  ].filter(Boolean);
  const dataOutDir = path.join(options.dataRoot, ...folderParts);
  fs.mkdirSync(dataOutDir, { recursive: true });

  const materials = collectMaterials(blocks, options.assetIndex);
  const voxelPath = path.join(dataOutDir, `${stem}.vox`);
  fs.writeFileSync(voxelPath, encodeVoxelFileV3(blocks, bounds));

  const prefabPathLabel = folderParts.join(" / ") || "root";
  const tags = buildPrefabTags(source, relativeDir);
  return {
    label: formatPrefabLabel(stem),
    id: stem,
    path: prefabPathLabel,
    tags,
    sourceGroup: source.label.startsWith("Vanilla")
      ? "Vanilla _Assets"
      : source.label.startsWith("Creator Prefab Mods")
        ? "Creator Prefab Mods"
        : "Other",
    blockCount: blocks.length,
    bounds: `${bounds.sizeX} x ${bounds.sizeY} x ${bounds.sizeZ}`,
    voxelData: toPosix(path.relative(options.htmlDir, voxelPath)),
    materials,
  };
}

function buildAssetIndex(assetsRoot) {
  const byName = new Map();
  const itemRoot = path.join(assetsRoot, "Server", "Item", "Items");
  if (!fs.existsSync(itemRoot)) {
    console.warn(`[assets] item root not found: ${itemRoot}`);
    return { assetsRoot, byName };
  }
  const files = [];
  collectJsonFiles(itemRoot, files);
  for (const file of files) {
    let json;
    try {
      json = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    const blockType = json.BlockType;
    if (!blockType) continue;
    const id = path.basename(file, ".json");
    const color = parseHexColor(blockType.TextureComputedColor || blockType.ParticleColor);
    byName.set(id.toLowerCase(), {
      id,
      color,
      itemPath: file,
    });
  }
  console.log(`[assets] indexed ${byName.size} block item(s) from ${itemRoot}`);
  return { assetsRoot, byName };
}

function collectJsonFiles(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJsonFiles(full, out);
    else if (entry.name.toLowerCase().endsWith(".json")) out.push(full);
  }
}

function colorForAssetBlock(assetIndex, name) {
  const meta = assetIndex.byName.get(String(name).toLowerCase());
  return meta?.color || fallbackColorForBlock(name);
}

function fallbackColorForBlock(name) {
  const { normalizeBlocks } = require("./render-prefab-views.js");
  return normalizeBlocks([{ x: 0, y: 0, z: 0, name }], null)[0]?.color || [145, 145, 145];
}

function parseHexColor(value) {
  if (!value || typeof value !== "string") return null;
  const m = value.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function collectMaterials(blocks, assetIndex) {
  const counts = new Map();
  for (const block of blocks) {
    const key = block.name.toLowerCase();
    const existing = counts.get(key) || { name: block.name, count: 0 };
    existing.count++;
    counts.set(key, existing);
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 10)
    .map((mat) => {
      const meta = assetIndex.byName.get(mat.name.toLowerCase());
      return {
        name: mat.name,
        count: mat.count,
        color: rgbToHex(meta?.color || fallbackColorForBlock(mat.name)),
      };
    });
}

function writeManifest(outRoot, entries, meta) {
  const tagList = Array.from(
    new Set(entries.map((entry) => entry.tags?.[0]).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const tagTree = buildTagTree(entries);
  const groups = Array.from(new Set(entries.map((entry) => entry.sourceGroup))).sort((a, b) => a.localeCompare(b));
  const manifestPath = path.join(outRoot, "manifest.json");
  const fd = fs.openSync(manifestPath, "w");
  const write = (chunk) => fs.writeSync(fd, chunk, null, "utf8");

  write('{"entries":[');
  for (let i = 0; i < entries.length; i++) {
    if (i > 0) write(",");
    write(JSON.stringify(entries[i]));
  }
  write(`],"tagList":${JSON.stringify(tagList)}`);
  write(`,"tagTree":${JSON.stringify(tagTree)}`);
  write(`,"groups":${JSON.stringify(groups)}`);
  write(`,"generatedAt":${JSON.stringify(meta.generatedAt.toISOString())}`);
  write(`,"assetsRoot":${JSON.stringify(meta.assetsRoot)}`);
  write(`,"previewMode":${JSON.stringify("compact voxel JSON + Three.js")}}\n`);
  fs.closeSync(fd);
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

try {
  main();
} catch (err) {
  console.error(`[error] ${err.message}`);
  process.exit(1);
}
