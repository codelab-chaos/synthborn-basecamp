#!/usr/bin/env node
/*
 * Build transitive crafting dependency trees from docs/refs/recipes/recipes.json.
 *
 * The recipe index is generated from _Assets by:
 *   node tools/refs/recipes/extract-recipes.js
 *
 * Default output targets all Tool_*, Weapon_*, and Armor_* craftable outputs
 * and writes:
 *   docs/refs/recipes/equipment-tech-tree.md
 *   docs/refs/recipes/equipment-tech-tree.json
 *
 * Usage:
 *   node tools/refs/recipes/build-dependency-tree.js
 *   node tools/refs/recipes/build-dependency-tree.js --item Tool_Hatchet_Iron
 *   node tools/refs/recipes/build-dependency-tree.js --prefix Tool_ --prefix Weapon_Sword_
 *   node tools/refs/recipes/build-dependency-tree.js --all
 *   node tools/refs/recipes/build-dependency-tree.js --include-salvage --max-depth 8
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const DEFAULT_RECIPES = path.join(REPO_ROOT, "docs", "refs", "recipes", "recipes.json");
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, "docs", "refs", "recipes");
const DEFAULT_PREFIXES = ["Tool_", "Weapon_", "Armor_"];
const DEFAULT_BASENAME = "equipment-tech-tree";
const ALL_BASENAME = "crafting-tech-tree";

const BENCH_ITEM_BY_REQUIREMENT_ID = {
  Alchemybench: "Bench_Alchemy",
  Arcanebench: "Bench_Arcane",
  Architects: "Bench_Builders",
  Architectsbench: "Bench_Builders",
  ArmorBench: "Bench_Armour",
  Armor_Bench: "Bench_Armour",
  Armory: "Bench_Armory",
  Builders: "Bench_Builders",
  Campfire: "Bench_Campfire",
  Cookingbench: "Bench_Cooking",
  Farmingbench: "Bench_Farming",
  Furnace: "Bench_Furnace",
  Furniture_Bench: "Bench_Furniture",
  Loombench: "Bench_Loom",
  Salvagebench: "Bench_Salvage",
  Tannery: "Bench_Tannery",
  Weapon_Bench: "Bench_Weapon",
  Workbench: "Bench_WorkBench",
};

const FREE_BENCH_IDS = new Set(["", "Fieldcraft", "TODO"]);

function parseArgs(argv) {
  const opts = {
    items: [],
    prefixes: [],
    all: false,
    basename: null,
    includeBenchDeps: true,
    includeSalvage: false,
    maxDepth: 10,
    outDir: DEFAULT_OUT_DIR,
    recipes: DEFAULT_RECIPES,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${arg} requires a value`);
      return value;
    };

    switch (arg) {
      case "-h":
      case "--help":
        opts.help = true;
        return opts;
      case "--item":
        opts.items.push(next());
        break;
      case "--prefix":
        opts.prefixes.push(next());
        break;
      case "--all":
        opts.all = true;
        break;
      case "--basename":
        opts.basename = next();
        break;
      case "--recipes":
        opts.recipes = next();
        break;
      case "--out":
        opts.outDir = next();
        break;
      case "--max-depth":
        opts.maxDepth = Number(next());
        if (!Number.isFinite(opts.maxDepth) || opts.maxDepth < 1) {
          throw new Error("--max-depth must be a positive number");
        }
        break;
      case "--include-salvage":
        opts.includeSalvage = true;
        break;
      case "--no-bench-deps":
        opts.includeBenchDeps = false;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return opts;
}

function usage() {
  console.log(`Usage: node tools/refs/recipes/build-dependency-tree.js [options]

Options:
  --item <id>          Build one specific output tree. May be repeated.
  --prefix <prefix>    Build all outputs starting with prefix. May be repeated.
                       Default: ${DEFAULT_PREFIXES.join(", ")}
  --all                Build all craftable non-salvage outputs.
  --basename <name>    Output basename. Default: ${DEFAULT_BASENAME},
                       or ${ALL_BASENAME} when --all is used.
  --recipes <file>     Recipe index from extract-recipes.js.
                       Default: ${DEFAULT_RECIPES}
  --out <dir>          Output directory.
                       Default: ${DEFAULT_OUT_DIR}
  --max-depth <n>      Stop recursion after this depth. Default: 10.
  --no-bench-deps      Do not recurse into required bench recipes.
  --include-salvage    Include Salvage_* recipes as craftable sources.
  --help, -h           Show this help.
`);
}

function readRecipeIndex(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Recipe index not found: ${file}. Run node tools/refs/recipes/extract-recipes.js first.`);
  }
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(payload.recipes)) {
    throw new Error(`Recipe index has no recipes array: ${file}`);
  }
  return payload;
}

function isSalvageRecipe(recipe) {
  return recipe.id.startsWith("Salvage_")
    || recipe.sourceFile.includes("/Recipes/Salvage/")
    || (Array.isArray(recipe.bench) && recipe.bench.some(bench => bench.id === "Salvagebench"));
}

function outputIds(recipe) {
  return Array.isArray(recipe.outputs)
    ? recipe.outputs.filter(out => out.kind === "item").map(out => out.id)
    : [];
}

function benchText(bench) {
  if (!Array.isArray(bench) || bench.length === 0) return "";
  return bench.map(entry => {
    const id = entry.id || "?";
    const categories = Array.isArray(entry.categories) && entry.categories.length
      ? `,${entry.categories.join(",")}`
      : "";
    return `${entry.type || "?"}[${id}${categories}]`;
  }).join(" or ");
}

function benchDependencyIds(bench) {
  if (!Array.isArray(bench) || bench.length === 0) return [];
  if (bench.some(entry => FREE_BENCH_IDS.has(entry.id || ""))) return [];

  const ids = [];
  for (const entry of bench) {
    const benchItemId = BENCH_ITEM_BY_REQUIREMENT_ID[entry.id];
    if (benchItemId && !ids.includes(benchItemId)) ids.push(benchItemId);
  }
  return ids;
}

function inputKey(input) {
  return input.kind === "resource" ? `${input.id}(type)` : input.id;
}

function inputText(input) {
  return `${input.quantity}x ${inputKey(input)}`;
}

function recipeRank(recipe, targetId) {
  let rank = 0;
  if (recipe.id !== targetId) rank += 10;
  if (recipe.source !== "embedded") rank += 1;
  rank += recipe.inputs.length / 100;
  return rank;
}

function buildRecipeMap(recipes, includeSalvage) {
  const byOutput = new Map();
  for (const recipe of recipes) {
    if (!includeSalvage && isSalvageRecipe(recipe)) continue;
    for (const id of outputIds(recipe)) {
      if (!byOutput.has(id)) byOutput.set(id, []);
      byOutput.get(id).push(recipe);
    }
  }

  const chosen = new Map();
  for (const [id, candidates] of byOutput.entries()) {
    candidates.sort((a, b) => recipeRank(a, id) - recipeRank(b, id) || a.id.localeCompare(b.id));
    chosen.set(id, candidates[0]);
  }
  return chosen;
}

function collectTargets(recipes, opts) {
  const explicit = new Set(opts.items);
  if (explicit.size > 0) return [...explicit].sort();

  if (opts.all) {
    const targets = new Set();
    for (const recipe of recipes) {
      if (!opts.includeSalvage && isSalvageRecipe(recipe)) continue;
      for (const id of outputIds(recipe)) targets.add(id);
    }
    return [...targets].sort();
  }

  const prefixes = opts.prefixes.length ? opts.prefixes : DEFAULT_PREFIXES;
  const targets = new Set();
  for (const recipe of recipes) {
    if (!opts.includeSalvage && isSalvageRecipe(recipe)) continue;
    for (const id of outputIds(recipe)) {
      if (prefixes.some(prefix => id.startsWith(prefix))) targets.add(id);
    }
  }
  return [...targets].sort();
}

function buildNode(itemId, recipeByOutput, opts, stack = []) {
  if (stack.includes(itemId)) {
    return { id: itemId, cycle: true, children: [] };
  }
  if (stack.length >= opts.maxDepth) {
    return { id: itemId, depthLimit: true, children: [] };
  }

  const recipe = recipeByOutput.get(itemId);
  if (!recipe) {
    return { id: itemId, leaf: true, children: [] };
  }

  const children = recipe.inputs.map(input => ({
    kind: input.kind,
    id: input.id,
    quantity: input.quantity,
    key: inputKey(input),
    dependency: input.kind === "item"
      ? buildNode(input.id, recipeByOutput, opts, [...stack, itemId])
      : { id: inputKey(input), leaf: true, resource: true, children: [] },
  }));

  if (opts.includeBenchDeps) {
    for (const benchId of benchDependencyIds(recipe.bench)) {
      if (benchId === itemId) continue;
      children.push({
        kind: "bench",
        id: benchId,
        quantity: 1,
        key: benchId,
        dependency: buildNode(benchId, recipeByOutput, opts, [...stack, itemId]),
      });
    }
  }

  return {
    id: itemId,
    recipeId: recipe.id,
    sourceFile: recipe.sourceFile,
    bench: recipe.bench,
    timeSeconds: recipe.timeSeconds,
    knowledgeRequired: recipe.knowledgeRequired === true,
    children,
  };
}

function addLeafTotals(node, multiplier, totals) {
  if (node.leaf || node.resource || node.cycle || node.depthLimit) {
    totals.set(node.id, (totals.get(node.id) || 0) + multiplier);
    return;
  }

  for (const child of node.children) {
    addLeafTotals(child.dependency, multiplier * child.quantity, totals);
  }
}

function summarizeLeaves(tree) {
  const totals = new Map();
  addLeafTotals(tree, 1, totals);
  return [...totals.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([id, quantity]) => ({ id, quantity }));
}

function renderNode(node, lines, indent = "") {
  let suffix = "";
  if (node.cycle) suffix = " (cycle)";
  else if (node.depthLimit) suffix = " (depth limit)";
  else if (node.leaf || node.resource) suffix = " (raw/unknown)";
  else {
    const parts = [];
    if (node.recipeId && node.recipeId !== node.id) parts.push(`recipe=${node.recipeId}`);
    const bench = benchText(node.bench);
    if (bench) parts.push(`bench=${bench}`);
    if (node.timeSeconds != null) parts.push(`${node.timeSeconds}s`);
    if (node.knowledgeRequired) parts.push("knowledge-required");
    suffix = parts.length ? ` (${parts.join("; ")})` : "";
  }

  lines.push(`${indent}- ${node.id}${suffix}`);
  for (const child of node.children || []) {
    const label = child.kind === "bench" ? "requires bench" : "needs";
    lines.push(`${indent}  - ${label} ${inputText(child)}`);
    renderNode(child.dependency, lines, `${indent}    `);
  }
}

function renderMarkdown(payload) {
  const lines = [];
  lines.push(`# ${payload.title}`);
  lines.push("");
  lines.push(`> Generated ${payload.generatedAt} from \`${payload.recipeIndex}\`.`);
  lines.push("");
  lines.push("This file is generated. Regenerate with:");
  lines.push("");
  lines.push("```powershell");
  lines.push("node tools/refs/recipes/build-dependency-tree.js");
  lines.push("```");
  lines.push("");
  lines.push("The generator uses the asset-derived recipe index and prefers non-salvage crafting/processing recipes by default. `(type)` means a resource-type input such as any matching log, rock, or rubble item.");
  lines.push("");
  lines.push("Required craft benches are included as dependency branches when the bench requirement maps to a craftable `Bench_*` item. Free fieldcraft recipes do not add bench branches.");
  lines.push("");
  lines.push(`Targets: ${payload.targets.length}`);
  lines.push("");

  lines.push("## Aggregate Raw Or Unresolved Inputs");
  lines.push("");
  for (const entry of payload.aggregateLeaves) {
    lines.push(`- ${entry.quantity}x ${entry.id}`);
  }
  lines.push("");

  lines.push("## Trees");
  lines.push("");
  for (const tree of payload.trees) {
    lines.push(`### ${tree.id}`);
    lines.push("");
    lines.push("Raw/unresolved inputs:");
    for (const entry of tree.leaves) lines.push(`- ${entry.quantity}x ${entry.id}`);
    lines.push("");
    renderNode(tree.tree, lines);
    lines.push("");
  }

  return lines.join("\n");
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    return;
  }

  const recipeFile = path.resolve(opts.recipes);
  const outDir = path.resolve(opts.outDir);
  const index = readRecipeIndex(recipeFile);
  const recipeByOutput = buildRecipeMap(index.recipes, opts.includeSalvage);
  const targets = collectTargets(index.recipes, opts).filter(id => recipeByOutput.has(id));
  const basename = opts.basename || (opts.all ? ALL_BASENAME : DEFAULT_BASENAME);
  const title = opts.all ? "Crafting Tech Tree" : "Equipment Tech Tree";

  const trees = targets.map(id => {
    const tree = buildNode(id, recipeByOutput, opts);
    return { id, leaves: summarizeLeaves(tree), tree };
  });

  const aggregate = new Map();
  for (const entry of trees) {
    for (const leaf of entry.leaves) {
      aggregate.set(leaf.id, (aggregate.get(leaf.id) || 0) + leaf.quantity);
    }
  }

  const payload = {
    title,
    generatedAt: new Date().toISOString(),
    recipeIndex: path.relative(REPO_ROOT, recipeFile).replace(/\\/g, "/"),
    options: {
      includeSalvage: opts.includeSalvage,
      includeBenchDeps: opts.includeBenchDeps,
      maxDepth: opts.maxDepth,
      all: opts.all,
      prefixes: opts.items.length || opts.all ? [] : (opts.prefixes.length ? opts.prefixes : DEFAULT_PREFIXES),
      items: opts.items,
    },
    targets,
    aggregateLeaves: [...aggregate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([id, quantity]) => ({ id, quantity })),
    trees,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `${basename}.json`);
  const mdPath = path.join(outDir, `${basename}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(mdPath, renderMarkdown(payload));

  console.log(`Targets: ${targets.length}`);
  console.log(`Wrote: ${path.relative(REPO_ROOT, mdPath)}`);
  console.log(`Wrote: ${path.relative(REPO_ROOT, jsonPath)}`);
}

try {
  main();
} catch (err) {
  console.error(`build-dependency-tree: ${err.message}`);
  process.exitCode = 1;
}
