#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

function usage() {
  console.log(`Usage:
  node worldgenV2/tools/worldgen-inspect.js inspect <asset.json> [--out <summary.md>] [--curves-dir <dir>]
  node worldgenV2/tools/worldgen-inspect.js validate <asset.json>
  node worldgenV2/tools/worldgen-inspect.js plot-curves <asset.json> --out-dir <dir>
  node worldgenV2/tools/worldgen-inspect.js patch-curve <asset.json> --index <n> --points <in:out,...> --out <asset.json>
  node worldgenV2/tools/worldgen-inspect.js generate-hybrid --base <biome.json> --graft <biome.json> --name <Name> --out <biome.json> [--take props,material,tint,environment]
  node worldgenV2/tools/worldgen-inspect.js generate-worldstructure --default-biome <BiomeName> --out <worldstructure.json> [--spawn-y <y>]
  node worldgenV2/tools/worldgen-inspect.js generate-stitch-worldstructure --biomes <BiomeA,BiomeB,...> --out <worldstructure.json> [--default-biome <BiomeName>]
  node worldgenV2/tools/worldgen-inspect.js apply-template <template.json>

Examples:
  node worldgenV2/tools/worldgen-inspect.js inspect _Assets/Server/HytaleGenerator/Biomes/Experimental/BasicForest.json --out worldgenV2/summaries/BasicForest.md --curves-dir worldgenV2/summaries/BasicForest-curves
  node worldgenV2/tools/worldgen-inspect.js generate-hybrid --base _Assets/Server/HytaleGenerator/Biomes/Experimental/Mountains.json --graft _Assets/Server/HytaleGenerator/Biomes/Experimental/BasicForest.json --name MountainForestAtmosphere --out worldgenV2/generated/Biomes/Experimental/MountainForestAtmosphere.json --take environment
`);
}

function main() {
  const args = process.argv.slice(2);
  const command = args.shift();
  if (!command || command === "--help" || command === "-h") {
    usage();
    return;
  }

  switch (command) {
    case "inspect":
      inspectCommand(args);
      break;
    case "plot-curves":
      plotCurvesCommand(args);
      break;
    case "validate":
      validateCommand(args);
      break;
    case "patch-curve":
      patchCurveCommand(args);
      break;
    case "generate-hybrid":
      generateHybridCommand(args);
      break;
    case "generate-worldstructure":
      generateWorldstructureCommand(args);
      break;
    case "generate-stitch-worldstructure":
      generateStitchWorldstructureCommand(args);
      break;
    case "apply-template":
      applyTemplateCommand(args);
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function inspectCommand(args) {
  const input = requirePositional(args, "asset.json");
  const opts = parseOptions(args);
  const asset = readJson(input);
  const curves = collectCurves(asset);
  const summary = renderSummary(input, asset, curves);

  if (opts.out) {
    writeText(opts.out, summary);
    console.log(`summary -> ${opts.out}`);
  } else {
    process.stdout.write(summary);
  }

  if (opts["curves-dir"]) {
    writeCurveSvgs(curves, opts["curves-dir"], input);
    console.log(`curves -> ${opts["curves-dir"]}`);
  }
}

function plotCurvesCommand(args) {
  const input = requirePositional(args, "asset.json");
  const opts = parseOptions(args);
  if (!opts["out-dir"]) throw new Error("plot-curves requires --out-dir <dir>");
  const asset = readJson(input);
  const curves = collectCurves(asset);
  writeCurveSvgs(curves, opts["out-dir"], input);
  console.log(`wrote ${curves.length} curve SVG(s) -> ${opts["out-dir"]}`);
}

function validateCommand(args) {
  const input = requirePositional(args, "asset.json");
  const asset = readJson(input);
  const validation = validateAsset(asset);
  console.log(renderValidation(input, validation));
  if (validation.blockers.length > 0) process.exitCode = 2;
}

function patchCurveCommand(args) {
  const input = requirePositional(args, "asset.json");
  const opts = parseOptions(args);
  const index = parseInt(requiredOption(opts, "index"), 10);
  const out = requiredOption(opts, "out");
  const points = parsePoints(requiredOption(opts, "points"));
  const asset = readJson(input);
  const curves = collectCurves(asset);

  if (!Number.isInteger(index) || index < 0 || index >= curves.length) {
    throw new Error(`Curve index ${opts.index} is out of range. Found ${curves.length} curve(s).`);
  }

  curves[index].node.Points = points.map((point) => ({
    ...makeNodeId("CurvePoint"),
    In: point.in,
    Out: point.out,
  }));
  writeJson(out, asset);
  console.log(`patched curve ${index} -> ${out}`);
}

function generateHybridCommand(args) {
  const opts = parseOptions(args);
  const basePath = requiredOption(opts, "base");
  const graftPath = requiredOption(opts, "graft");
  const out = requiredOption(opts, "out");
  const name = requiredOption(opts, "name");
  const take = (opts.take || "props,material,tint")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const base = readJson(basePath);
  const graft = readJson(graftPath);
  const result = structuredCloneJson(base);
  result.Name = name;

  if (take.includes("props") && graft.Props !== undefined) result.Props = structuredCloneJson(graft.Props);
  if (take.includes("material") && graft.MaterialProvider !== undefined) result.MaterialProvider = structuredCloneJson(graft.MaterialProvider);
  if (take.includes("tint") && graft.TintProvider !== undefined) result.TintProvider = structuredCloneJson(graft.TintProvider);
  if (take.includes("environment") && graft.EnvironmentProvider !== undefined) result.EnvironmentProvider = structuredCloneJson(graft.EnvironmentProvider);

  annotate(result, {
    GeneratedBy: "worldgen-inspect generate-hybrid",
    Base: normalizePath(basePath),
    Graft: normalizePath(graftPath),
    Take: take,
  });

  writeJson(out, result);
  const validation = validateAsset(result);
  if (validation.blockers.length > 0) {
    console.warn(renderValidation(out, validation));
  }
  console.log(`hybrid biome ${name} -> ${out}`);
}

function generateWorldstructureCommand(args) {
  const opts = parseOptions(args);
  const defaultBiome = requiredOption(opts, "default-biome");
  const out = requiredOption(opts, "out");
  const spawnY = Number(opts["spawn-y"] || 200);
  const worldstructure = {
    Type: "NoiseRange",
    Biomes: [],
    DefaultBiome: defaultBiome,
    DefaultTransitionDistance: 32,
    MaxBiomeEdgeDistance: 32,
    Density: {
      Type: "Imported",
      Name: "Biome-Map",
    },
    SpawnPositions: {
      Type: "Imported",
      Name: "Spawns",
    },
    Framework: [
      {
        Type: "Positions",
        Entries: [
          {
            Name: "Spawns",
            Positions: {
              Type: "List",
              ExportAs: "Spawns",
              Positions: [
                { X: 0, Y: spawnY, Z: 0 },
                { X: 30, Y: spawnY, Z: 0 },
                { X: 10, Y: spawnY, Z: 20 },
              ],
            },
          },
        ],
      },
      {
        Type: "DecimalConstants",
        Entries: [
          { Name: "Base", Value: 100 },
          { Name: "Water", Value: 100 },
          { Name: "Bedrock", Value: 0 },
        ],
      },
    ],
    Tags: {
      Template: [],
    },
  };
  writeJson(out, worldstructure);
  console.log(`worldstructure for ${defaultBiome} -> ${out}`);
}

function generateStitchWorldstructureCommand(args) {
  const opts = parseOptions(args);
  const biomes = requiredOption(opts, "biomes")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (biomes.length < 2) throw new Error("generate-stitch-worldstructure requires at least two biome names");
  const out = requiredOption(opts, "out");
  const defaultBiome = opts["default-biome"] || biomes[0];
  const step = 2 / biomes.length;
  const ranges = biomes.map((biome, index) => ({
    Biome: biome,
    Min: roundRange(-1 + step * index),
    Max: roundRange(index === biomes.length - 1 ? 1 : -1 + step * (index + 1)),
  }));
  const worldstructure = {
    Type: "NoiseRange",
    Biomes: ranges,
    DefaultBiome: defaultBiome,
    DefaultTransitionDistance: 32,
    MaxBiomeEdgeDistance: 32,
    Density: {
      Type: "Imported",
      Name: "Biome-Map",
    },
    Framework: [
      {
        Type: "DecimalConstants",
        Entries: [
          { Name: "Base", Value: 100 },
          { Name: "Water", Value: 100 },
          { Name: "Bedrock", Value: 0 },
        ],
      },
    ],
    Tags: {
      Template: ["synthborn-stitch"],
    },
  };
  writeJson(out, worldstructure);
  console.log(`stitched worldstructure ${biomes.join(", ")} -> ${out}`);
}

function applyTemplateCommand(args) {
  const templatePath = requirePositional(args, "template.json");
  const template = readJson(templatePath);
  const root = path.dirname(path.resolve(templatePath));
  const resolveTemplatePath = (value) => path.resolve(root, value);

  if (template.type === "hybrid_biome") {
    generateHybridCommand([
      "--base",
      resolveTemplatePath(template.base),
      "--graft",
      resolveTemplatePath(template.graft),
      "--name",
      template.name,
      "--out",
      resolveTemplatePath(template.out),
      "--take",
      (template.take || ["props", "material", "tint"]).join(","),
    ]);
    return;
  }

  if (template.type === "worldstructure") {
    generateWorldstructureCommand([
      "--default-biome",
      template.defaultBiome,
      "--out",
      resolveTemplatePath(template.out),
      "--spawn-y",
      String(template.spawnY || 200),
    ]);
    return;
  }

  if (template.type === "stitch_worldstructure") {
    generateStitchWorldstructureCommand([
      "--biomes",
      template.biomes.join(","),
      "--default-biome",
      template.defaultBiome || template.biomes[0],
      "--out",
      resolveTemplatePath(template.out),
    ]);
    return;
  }

  throw new Error(`Unsupported template type: ${template.type}`);
}

function renderSummary(input, asset, curves) {
  const nodeCounts = collectNodeCounts(asset);
  const exported = collectByKey(asset, "ExportAs");
  const imported = collectImportedNames(asset);
  const simpleNoise = collectNodesByType(asset, /^SimplexNoise/);
  const cellNoise = collectNodesByType(asset, /^CellNoise/);
  const materials = summarizeMaterialProvider(asset.MaterialProvider);
  const props = summarizeProps(asset.Props);
  const validation = validateAsset(asset);

  return `# ${path.basename(input)}

- Path: \`${normalizePath(input)}\`
- Asset name: \`${asset.Name || "(none)"}\`
- Root type: \`${asset.Type || asset.$Title || "Biome"}\`

## Top-Level

${Object.keys(asset)
  .filter((key) => !key.startsWith("$"))
  .map((key) => `- \`${key}\`${asset[key] && typeof asset[key] === "object" && asset[key].Type ? `: ${asset[key].Type}` : ""}`)
  .join("\n")}

## Provider Counts

${Object.entries(nodeCounts)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 40)
  .map(([type, count]) => `- ${type}: ${count}`)
  .join("\n") || "- None found"}

## Exports

${exported.map((value) => `- \`${value}\``).join("\n") || "- None found"}

## Imports

${imported.map((value) => `- \`${value}\``).join("\n") || "- None found"}

## Validation

${renderValidationLines(validation).join("\n")}

## Noise Knobs

${renderNoise("Simplex", simpleNoise)}
${renderNoise("Cell", cellNoise)}

## Curves

${curves
  .map((curve, index) => {
    const points = curve.points.map((point) => `[${point.In}, ${point.Out}]`).join(", ");
    return `- ${index}: ${curve.path} (${curve.points.length} point${curve.points.length === 1 ? "" : "s"}) ${points}`;
  })
  .join("\n") || "- None found"}

## Materials

${materials}

## Props

${props}
`;
}

function renderNoise(label, nodes) {
  if (nodes.length === 0) return `- ${label}: none`;
  return nodes
    .map((entry, index) => {
      const node = entry.node;
      return `- ${label} ${index}: ${entry.path} scale=${node.Scale ?? "?"} octaves=${node.Octaves ?? "?"} lacunarity=${node.Lacunarity ?? "?"} persistence=${node.Persistence ?? "?"} seed=${node.Seed ?? "?"}`;
    })
    .join("\n");
}

function summarizeMaterialProvider(provider) {
  if (!provider) return "- None found";
  const lines = [`- Type: ${provider.Type || "(unknown)"}`];
  for (const key of ["Solid", "Empty", "Fluid", "Material", "Queue"]) {
    if (provider[key] !== undefined) lines.push(`- ${key}: ${summarizeShort(provider[key])}`);
  }
  return lines.join("\n");
}

function summarizeProps(props) {
  if (!props) return "- None found";
  const entries = Array.isArray(props) ? props : Object.values(props);
  if (entries.length === 0) return "- None found";
  return entries
    .slice(0, 40)
    .map((prop, index) => {
      const type = prop.Type || "(unknown)";
      const exported = prop.ExportAs ? ` export=${prop.ExportAs}` : "";
      const assignment = prop.Assignment ? ` assignment=${summarizeShort(prop.Assignment)}` : "";
      const assignments = prop.Assignments ? ` assignments=${summarizeShort(prop.Assignments)}` : "";
      const prefab = prop.Prefab ? ` prefab=${summarizeShort(prop.Prefab)}` : "";
      return `- ${index}: ${type}${exported}${assignment}${assignments}${prefab}`;
    })
    .join("\n");
}

function validateAsset(asset) {
  const exported = new Set(collectByKey(asset, "ExportAs"));
  const imported = collectImportedNames(asset);
  const graftPrefix = asset.$SynthbornWorldgen && asset.$SynthbornWorldgen.Graft
    ? path.basename(asset.$SynthbornWorldgen.Graft, ".json")
    : null;
  const knownExternal = new Set([
    "Base",
    "Water",
    "Bedrock",
    "Biome-Map",
    "Spawns",
    "World-River-Map",
    "Floor_Grass_Pattern",
  ]);
  const missingLocal = imported.filter((name) => graftPrefix && name.startsWith(graftPrefix) && !exported.has(name) && !knownExternal.has(name));
  return {
    blockers: missingLocal.map((name) => `Imported provider \`${name}\` is not exported in this asset.`),
    warnings: imported
      .filter((name) => !exported.has(name) && !knownExternal.has(name) && !looksLocalProviderName(name))
      .map((name) => `External import \`${name}\` must exist in the active worldgen/framework context.`),
  };
}

function renderValidation(input, validation) {
  return [`Validation: ${input}`, ...renderValidationLines(validation)].join("\n");
}

function renderValidationLines(validation) {
  const lines = [];
  if (validation.blockers.length === 0 && validation.warnings.length === 0) {
    return ["- No obvious missing local imports found."];
  }
  for (const blocker of validation.blockers) lines.push(`- BLOCKER: ${blocker}`);
  for (const warning of validation.warnings) lines.push(`- WARN: ${warning}`);
  return lines;
}

function looksLocalProviderName(name) {
  return /Terrain|Base|Mask|Scanner|Erosion|Sticks|LeafPiles|River/.test(name);
}

function roundRange(value) {
  return Math.round(value * 1000000) / 1000000;
}

function writeCurveSvgs(curves, outDir, sourcePath) {
  fs.mkdirSync(outDir, { recursive: true });
  curves.forEach((curve, index) => {
    const safeName = `${String(index).padStart(2, "0")}-${path.basename(sourcePath, ".json")}.svg`;
    writeText(path.join(outDir, safeName), renderCurveSvg(curve, index, sourcePath));
  });
}

function renderCurveSvg(curve, index, sourcePath) {
  const width = 720;
  const height = 360;
  const pad = 48;
  const points = curve.points.map((point) => ({ x: Number(point.In), y: Number(point.Out) }));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, -1);
  const maxY = Math.max(...ys, 1);
  const sx = (x) => pad + ((x - minX) / Math.max(maxX - minX, 0.000001)) * (width - pad * 2);
  const sy = (y) => height - pad - ((y - minY) / Math.max(maxY - minY, 0.000001)) * (height - pad * 2);
  const polyline = points.map((point) => `${sx(point.x).toFixed(2)},${sy(point.y).toFixed(2)}`).join(" ");
  const circles = points
    .map((point) => `<circle cx="${sx(point.x).toFixed(2)}" cy="${sy(point.y).toFixed(2)}" r="4"><title>${point.x}, ${point.y}</title></circle>`)
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#111827"/>
  <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#6b7280"/>
  <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#6b7280"/>
  <text x="${pad}" y="24" fill="#e5e7eb" font-family="monospace" font-size="14">curve ${index}: ${escapeXml(path.basename(sourcePath))}</text>
  <text x="${pad}" y="${height - 14}" fill="#9ca3af" font-family="monospace" font-size="12">x ${minX}..${maxX}</text>
  <text x="${width - 150}" y="${height - 14}" fill="#9ca3af" font-family="monospace" font-size="12">y ${minY}..${maxY}</text>
  <polyline points="${polyline}" fill="none" stroke="#38bdf8" stroke-width="3"/>
  ${circles}
</svg>
`;
}

function collectCurves(root) {
  const curves = [];
  walk(root, (node, nodePath) => {
    if (node && typeof node === "object" && node.Type === "Manual" && Array.isArray(node.Points)) {
      curves.push({ path: nodePath, node, points: node.Points });
    }
  });
  return curves;
}

function collectNodeCounts(root) {
  const counts = {};
  walk(root, (node) => {
    if (node && typeof node === "object" && typeof node.Type === "string") {
      counts[node.Type] = (counts[node.Type] || 0) + 1;
    }
  });
  return counts;
}

function collectByKey(root, key) {
  const values = new Set();
  walk(root, (node) => {
    if (node && typeof node === "object" && typeof node[key] === "string") {
      values.add(node[key]);
    }
  });
  return [...values].sort((a, b) => a.localeCompare(b));
}

function collectImportedNames(root) {
  const values = new Set();
  walk(root, (node) => {
    if (node && typeof node === "object" && node.Type === "Imported" && typeof node.Name === "string") {
      values.add(node.Name);
    }
  });
  return [...values].sort((a, b) => a.localeCompare(b));
}

function collectNodesByType(root, pattern) {
  const nodes = [];
  walk(root, (node, nodePath) => {
    if (node && typeof node === "object" && typeof node.Type === "string" && pattern.test(node.Type)) {
      nodes.push({ path: nodePath, node });
    }
  });
  return nodes;
}

function walk(value, visit, nodePath = "$") {
  visit(value, nodePath);
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((child, index) => walk(child, visit, `${nodePath}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    walk(child, visit, `${nodePath}.${key}`);
  }
}

function parseOptions(args) {
  const opts = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) throw new Error(`Unexpected positional argument: ${arg}`);
    const key = arg.slice(2);
    const value = args[i + 1];
    if (!value || value.startsWith("--")) {
      opts[key] = true;
    } else {
      opts[key] = value;
      i += 1;
    }
  }
  return opts;
}

function requirePositional(args, label) {
  const value = args.shift();
  if (!value || value.startsWith("--")) throw new Error(`Missing ${label}`);
  return value;
}

function requiredOption(opts, key) {
  if (!opts[key] || opts[key] === true) throw new Error(`Missing --${key} <value>`);
  return opts[key];
}

function parsePoints(value) {
  return value.split(",").map((pair) => {
    const [rawIn, rawOut] = pair.split(":");
    const input = Number(rawIn);
    const output = Number(rawOut);
    if (!Number.isFinite(input) || !Number.isFinite(output)) {
      throw new Error(`Invalid curve point: ${pair}`);
    }
    return { in: input, out: output };
  });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, "\t")}\n`, "utf8");
}

function writeText(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, "utf8");
}

function structuredCloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizePath(file) {
  return file.split(path.sep).join("/");
}

function summarizeShort(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (value.Type) return `{Type:${value.Type}${value.Name ? `, Name:${value.Name}` : ""}${value.ExportAs ? `, ExportAs:${value.ExportAs}` : ""}}`;
  return JSON.stringify(value).slice(0, 120);
}

function annotate(asset, data) {
  asset.$SynthbornWorldgen = {
    ...(asset.$SynthbornWorldgen || {}),
    ...data,
  };
}

function makeNodeId(prefix) {
  return { $NodeId: `${prefix}-${cryptoRandomId()}` };
}

function cryptoRandomId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

try {
  main();
} catch (error) {
  console.error(`worldgen-inspect: ${error.message}`);
  process.exit(1);
}
