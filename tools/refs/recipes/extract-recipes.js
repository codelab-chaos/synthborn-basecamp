#!/usr/bin/env node
/*
 * Build a crafting/salvage recipe index from the unpacked Hytale assets in
 * _Assets/.  Two sources merge into one normalized stream:
 *
 *   1. Standalone recipe files under _Assets/Server/Item/Recipes/**.json
 *      (output is explicit via PrimaryOutput / Output[])
 *   2. Item files with an embedded `Recipe` field under
 *      _Assets/Server/Item/Items/**.json
 *      (output is implicit — the item itself, quantity 1)
 *
 * Emits two artifacts in docs/refs/recipes/:
 *
 *   - recipes.txt   grep-friendly index (one line per recipe, plus
 *                   "By output:" and "By input:" sections)
 *   - recipes.json  structured data + derived byInput / byOutput indexes
 *                   for programmatic use
 *
 * Cross-platform Node, no deps. See _Assets/ memory note for what's in there.
 *
 * Usage:
 *   node tools/refs/recipes/extract-recipes.js [--assets <dir>] [--out <dir>]
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
  console.log(`Usage: node tools/refs/recipes/extract-recipes.js [options]

Options:
  --assets <dir>   _Assets root (default: ${DEFAULT_ASSETS})
  --out <dir>      Output dir   (default: ${DEFAULT_OUT})
  --verbose        Log every parsed file
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

function ingredientFromInput(input) {
  // Inputs come as either { ItemId, Quantity } or { ResourceTypeId, Quantity }
  if (typeof input !== "object" || input === null) return null;
  const qty = Number(input.Quantity) || 1;
  if (typeof input.ItemId === "string") {
    return { kind: "item", id: input.ItemId, quantity: qty };
  }
  if (typeof input.ResourceTypeId === "string") {
    return { kind: "resource", id: input.ResourceTypeId, quantity: qty };
  }
  return null;
}

function outputFromOutput(output) {
  if (typeof output !== "object" || output === null) return null;
  const qty = Number(output.Quantity) || 1;
  if (typeof output.ItemId === "string") {
    return { kind: "item", id: output.ItemId, quantity: qty };
  }
  return null;
}

function normalizeBench(benchArr) {
  if (!Array.isArray(benchArr)) return [];
  return benchArr.map(b => ({
    type: b?.Type || "",
    id: b?.Id || "",
    categories: Array.isArray(b?.Categories) ? b.Categories : [],
  }));
}

function recipeFromStandalone(file, json) {
  const recipe = json;
  if (!Array.isArray(recipe.Input) || recipe.Input.length === 0) return null;

  const inputs = recipe.Input.map(ingredientFromInput).filter(Boolean);
  const outputs = Array.isArray(recipe.Output)
    ? recipe.Output.map(outputFromOutput).filter(Boolean)
    : recipe.PrimaryOutput
      ? [outputFromOutput(recipe.PrimaryOutput)].filter(Boolean)
      : [];

  return {
    id: path.basename(file, ".json"),
    source: "standalone",
    sourceFile: path.relative(REPO_ROOT, file).replace(/\\/g, "/"),
    inputs,
    outputs,
    bench: normalizeBench(recipe.BenchRequirement),
    timeSeconds: typeof recipe.TimeSeconds === "number" ? recipe.TimeSeconds : null,
    knowledgeRequired: recipe.KnowledgeRequired === true,
  };
}

function recipeFromItem(file, json) {
  const recipe = json?.Recipe;
  if (!recipe || !Array.isArray(recipe.Input) || recipe.Input.length === 0) return null;

  const id = path.basename(file, ".json");
  const inputs = recipe.Input.map(ingredientFromInput).filter(Boolean);

  // For embedded recipes, output defaults to the item itself, qty 1, unless
  // the recipe explicitly overrides via PrimaryOutput / Output[].
  let outputs;
  if (Array.isArray(recipe.Output) && recipe.Output.length) {
    outputs = recipe.Output.map(outputFromOutput).filter(Boolean);
  } else if (recipe.PrimaryOutput) {
    outputs = [outputFromOutput(recipe.PrimaryOutput)].filter(Boolean);
  } else {
    outputs = [{ kind: "item", id, quantity: 1 }];
  }

  return {
    id,
    source: "embedded",
    sourceFile: path.relative(REPO_ROOT, file).replace(/\\/g, "/"),
    inputs,
    outputs,
    bench: normalizeBench(recipe.BenchRequirement),
    timeSeconds: typeof recipe.TimeSeconds === "number" ? recipe.TimeSeconds : null,
    knowledgeRequired: recipe.KnowledgeRequired === true,
  };
}

function collect(assetsDir, verbose) {
  const recipes = [];
  const standaloneRoot = path.join(assetsDir, "Server", "Item", "Recipes");
  const itemsRoot = path.join(assetsDir, "Server", "Item", "Items");

  let standaloneCount = 0;
  let embeddedCount = 0;
  let scanned = 0;

  for (const file of walkJson(standaloneRoot)) {
    scanned++;
    const json = readJsonSafe(file);
    if (!json) continue;
    const r = recipeFromStandalone(file, json);
    if (r) { recipes.push(r); standaloneCount++; if (verbose) console.log(`  standalone: ${r.id}`); }
  }

  for (const file of walkJson(itemsRoot)) {
    scanned++;
    const json = readJsonSafe(file);
    if (!json) continue;
    const r = recipeFromItem(file, json);
    if (r) { recipes.push(r); embeddedCount++; if (verbose) console.log(`  embedded:   ${r.id}`); }
  }

  recipes.sort((a, b) => a.id.localeCompare(b.id));
  return { recipes, scanned, standaloneCount, embeddedCount };
}

function ingredientToText(ing) {
  const suffix = ing.kind === "resource" ? "(type)" : "";
  return `${ing.quantity}×${ing.id}${suffix}`;
}

function outputToText(out) {
  return `${out.quantity}×${out.id}`;
}

function benchToText(bench) {
  if (!bench.length) return "—";
  return bench.map(b => {
    const tag = [b.id || "?", ...(b.categories || [])].filter(Boolean).join(",");
    return `${b.type}[${tag}]`;
  }).join(" or ");
}

function recipeLine(r) {
  const inputs = r.inputs.map(ingredientToText).join(" + ") || "—";
  const outputs = r.outputs.map(outputToText).join(" + ") || "—";
  const time = r.timeSeconds != null ? `${r.timeSeconds}s` : "—";
  const knowledge = r.knowledgeRequired ? " | knowledge-required" : "";
  return `- ${r.id} | ${inputs} → ${outputs} | bench=${benchToText(r.bench)} | ${time}${knowledge}`;
}

function buildIndexes(recipes) {
  const byInput = new Map();
  const byOutput = new Map();
  for (const r of recipes) {
    for (const ing of r.inputs) {
      const key = ing.kind === "resource" ? `${ing.id}(type)` : ing.id;
      if (!byInput.has(key)) byInput.set(key, []);
      byInput.get(key).push(r.id);
    }
    for (const out of r.outputs) {
      if (!byOutput.has(out.id)) byOutput.set(out.id, []);
      byOutput.get(out.id).push(r.id);
    }
  }
  const sortedMap = (m) => {
    const obj = {};
    for (const key of [...m.keys()].sort()) obj[key] = m.get(key).slice().sort();
    return obj;
  };
  return { byInput: sortedMap(byInput), byOutput: sortedMap(byOutput) };
}

function renderText({ recipes, byInput, byOutput, generatedAt }) {
  const lines = [];
  lines.push("# Hytale Recipe Reference");
  lines.push("");
  lines.push(`> Generated ${generatedAt} from \`_Assets/Server/Item/Recipes/\` (standalone) and \`_Assets/Server/Item/Items/\` (embedded \`Recipe\` blocks).`);
  lines.push("");
  lines.push("Each entry: `id | inputs → outputs | bench | time`. `(type)` after an ingredient means it accepts any item of that ResourceType (e.g. `Wood_Trunk(type)` matches any trunk wood). `bench=Type[Id,Categories]`.");
  lines.push("");
  lines.push("Regenerate: `node tools/refs/recipes/extract-recipes.js`");
  lines.push("");

  lines.push(`## Recipes (${recipes.length})`);
  lines.push("");
  for (const r of recipes) lines.push(recipeLine(r));
  lines.push("");

  lines.push(`## By output (${Object.keys(byOutput).length} items)`);
  lines.push("");
  for (const out of Object.keys(byOutput)) {
    lines.push(`### ${out}`);
    for (const id of byOutput[out]) lines.push(`- ${id}`);
    lines.push("");
  }

  lines.push(`## By input (${Object.keys(byInput).length} ingredients)`);
  lines.push("");
  for (const inp of Object.keys(byInput)) {
    lines.push(`### ${inp}`);
    for (const id of byInput[inp]) lines.push(`- ${id}`);
    lines.push("");
  }

  return lines.join("\n");
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
  const { recipes, scanned, standaloneCount, embeddedCount } = collect(assetsDir, opts.verbose);
  const { byInput, byOutput } = buildIndexes(recipes);
  const generatedAt = new Date().toISOString();

  const jsonPayload = {
    generatedAt,
    counts: {
      recipes: recipes.length,
      standalone: standaloneCount,
      embedded: embeddedCount,
      scannedFiles: scanned,
    },
    recipes,
    byInput,
    byOutput,
  };

  fs.writeFileSync(path.join(outDir, "recipes.json"), JSON.stringify(jsonPayload, null, 2));
  fs.writeFileSync(path.join(outDir, "recipes.txt"), renderText({ recipes, byInput, byOutput, generatedAt }));

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Scanned ${scanned} JSON files in ${elapsed}s`);
  console.log(`  ${standaloneCount} standalone recipes`);
  console.log(`  ${embeddedCount} embedded recipes`);
  console.log(`  ${recipes.length} total → recipes.txt + recipes.json`);
}

try {
  main();
} catch (err) {
  console.error(`extract-recipes: ${err.message}`);
  process.exitCode = 1;
}
