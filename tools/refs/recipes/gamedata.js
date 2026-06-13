#!/usr/bin/env node
/*
 * One tool to search the Hytale game-data the synth planner cares about: the
 * crafting tech tree (recipes) and the loot tables (block/gather/NPC drops).
 *
 * Reads the generated indexes:
 *   docs/refs/recipes/recipes.json   (node tools/refs/recipes/extract-recipes.js)
 *   docs/refs/recipes/loot.json      (node tools/refs/recipes/extract-loot.js)
 * If either is missing/stale, regenerate with those two scripts first.
 *
 * Subcommands (all accept partial/glob/regex ids, case-insensitive):
 *
 *   find    <pat>            Fuzzy-find any id across recipes, items, droplists.
 *   recipe  <id>            Show the recipe(s) that output an item.
 *   make    <item> [-q n] [-d depth]
 *                           Transitive craft tree for an item (benches, time,
 *                           knowledge gates) + aggregated raw inputs.
 *   uses    <item>          Recipes that CONSUME this item/resource.
 *   bench   <name>          Recipes performed at a bench (id, category, or the
 *                           mapped Bench_* item). Great for "what cooks here".
 *   drops   <block>         Loot table for a block id (all gather modes).
 *   source  <item>          Every way to obtain an item: recipes that output it
 *                           + blocks/droplists that drop it, ranked.
 *
 * Examples:
 *   node tools/refs/recipes/gamedata.js bench Campfire
 *   node tools/refs/recipes/gamedata.js make Weapon_Sword_Copper
 *   node tools/refs/recipes/gamedata.js source Ingredient_Leather
 *   node tools/refs/recipes/gamedata.js drops Plant_Bush
 *   node tools/refs/recipes/gamedata.js find Tannery
 *
 * Add --json to any subcommand for machine-readable output.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const RECIPES_FILE = path.join(REPO_ROOT, "docs", "refs", "recipes", "recipes.json");
const LOOT_FILE = path.join(REPO_ROOT, "docs", "refs", "recipes", "loot.json");

// Bench requirement id -> craftable bench item (kept in sync with build-dependency-tree.js).
const BENCH_ITEM_BY_REQUIREMENT_ID = {
  Alchemybench: "Bench_Alchemy", Arcanebench: "Bench_Arcane", Architects: "Bench_Builders",
  Architectsbench: "Bench_Builders", ArmorBench: "Bench_Armour", Armor_Bench: "Bench_Armour",
  Armory: "Bench_Armory", Builders: "Bench_Builders", Campfire: "Bench_Campfire",
  Cookingbench: "Bench_Cooking", Farmingbench: "Bench_Farming", Furnace: "Bench_Furnace",
  Furniture_Bench: "Bench_Furniture", Loombench: "Bench_Loom", Salvagebench: "Bench_Salvage",
  Tannery: "Bench_Tannery", Weapon_Bench: "Bench_Weapon", Workbench: "Bench_WorkBench",
};

function loadJson(file, hint) {
  if (!fs.existsSync(file)) {
    throw new Error(`${path.relative(REPO_ROOT, file)} not found. Run ${hint} first.`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function loadRecipes() {
  return loadJson(RECIPES_FILE, "node tools/refs/recipes/extract-recipes.js");
}
function loadLoot() {
  return loadJson(LOOT_FILE, "node tools/refs/recipes/extract-loot.js");
}

// --- matching helpers ------------------------------------------------------

function makeMatcher(pattern) {
  // Glob-ish: * -> .*, ? -> . ; otherwise treat as case-insensitive substring,
  // unless it looks like a regex (/.../).
  if (pattern.startsWith("/") && pattern.endsWith("/") && pattern.length > 2) {
    return new RegExp(pattern.slice(1, -1), "i");
  }
  if (pattern.includes("*") || pattern.includes("?")) {
    const re = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
    return new RegExp(`^${re}$`, "i");
  }
  const lower = pattern.toLowerCase();
  return { test: (s) => s.toLowerCase().includes(lower) };
}

// Resolve a user token to a concrete id from candidates: exact (case-insensitive)
// wins; else unique substring match; else null + the candidate list for hinting.
function resolveId(token, candidates) {
  const exact = candidates.find((c) => c.toLowerCase() === token.toLowerCase());
  if (exact) return { id: exact, matches: [exact] };
  const m = makeMatcher(token);
  const matches = candidates.filter((c) => m.test(c));
  if (matches.length === 1) return { id: matches[0], matches };
  return { id: null, matches };
}

// --- formatting ------------------------------------------------------------

function inputKey(input) {
  return input.kind === "resource" ? `${input.id}(type)` : input.id;
}
function benchText(bench) {
  if (!Array.isArray(bench) || bench.length === 0) return "—";
  return bench.map((b) => {
    const cat = Array.isArray(b.categories) && b.categories.length ? "," + b.categories.join(",") : "";
    const item = BENCH_ITEM_BY_REQUIREMENT_ID[b.id];
    return `${b.type || "?"}[${b.id || "?"}${cat}]${item ? `→${item}` : ""}`;
  }).join(" or ");
}
function recipeLine(r) {
  const inputs = r.inputs.map((i) => `${i.quantity}x ${inputKey(i)}`).join(" + ") || "—";
  const outputs = r.outputs.map((o) => `${o.quantity}x ${o.id}`).join(" + ") || "—";
  const time = r.timeSeconds != null ? `${r.timeSeconds}s` : "—";
  const k = r.knowledgeRequired ? " | knowledge-required" : "";
  return `${inputs} → ${outputs} | bench=${benchText(r.bench)} | ${time}${k}`;
}

function hintMatches(matches, label) {
  if (matches.length === 0) return `No ${label} matched.`;
  const head = matches.slice(0, 25).map((m) => `  ${m}`).join("\n");
  const more = matches.length > 25 ? `\n  …(${matches.length - 25} more)` : "";
  return `Ambiguous — ${matches.length} ${label} matched:\n${head}${more}`;
}

// --- recipe index helpers --------------------------------------------------

function isSalvage(r) {
  return r.id.startsWith("Salvage_") || (r.sourceFile || "").includes("/Recipes/Salvage/")
    || (Array.isArray(r.bench) && r.bench.some((b) => b.id === "Salvagebench"));
}
function buildByOutput(recipes, includeSalvage) {
  const map = new Map();
  for (const r of recipes) {
    if (!includeSalvage && isSalvage(r)) continue;
    for (const o of r.outputs) {
      if (o.kind !== "item") continue;
      if (!map.has(o.id)) map.set(o.id, []);
      map.get(o.id).push(r);
    }
  }
  // Reduce each output to a single chosen recipe: prefer the recipe whose own id
  // matches the output, then non-embedded, then fewest inputs.
  const chosen = new Map();
  for (const [id, list] of map) {
    list.sort((a, b) => {
      const ra = (a.id === id ? 0 : 10) + (a.source === "embedded" ? 1 : 0) + a.inputs.length / 100;
      const rb = (b.id === id ? 0 : 10) + (b.source === "embedded" ? 1 : 0) + b.inputs.length / 100;
      return ra - rb || a.id.localeCompare(b.id);
    });
    chosen.set(id, list[0]);
  }
  return chosen;
}

// --- subcommands -----------------------------------------------------------

function cmdFind(args, flags) {
  const recipes = loadRecipes();
  const loot = loadLoot();
  const m = makeMatcher(args[0] || "");
  const recipeIds = new Set(recipes.recipes.map((r) => r.id));
  const outputIds = new Set();
  const inputIds = new Set();
  for (const r of recipes.recipes) {
    for (const o of r.outputs) outputIds.add(o.id);
    for (const i of r.inputs) inputIds.add(inputKey(i));
  }
  const blockIds = new Set(loot.blocks.map((b) => b.id));
  const droplistIds = new Set(loot.droplists.map((d) => d.id));
  const droppedItems = new Set(Object.keys(loot.byItem));

  const sect = (label, set) => [...set].filter((s) => m.test(s)).sort();
  const result = {
    recipes: sect("recipes", recipeIds),
    outputs: sect("outputs", outputIds),
    inputs: sect("inputs", inputIds),
    blocks: sect("blocks", blockIds),
    droplists: sect("droplists", droplistIds),
    droppedItems: sect("droppedItems", droppedItems),
  };
  if (flags.json) return console.log(JSON.stringify(result, null, 2));
  for (const [k, v] of Object.entries(result)) {
    if (!v.length) continue;
    console.log(`# ${k} (${v.length})`);
    for (const id of v.slice(0, 60)) console.log(`  ${id}`);
    if (v.length > 60) console.log(`  …(${v.length - 60} more)`);
    console.log("");
  }
}

function cmdRecipe(args, flags) {
  const recipes = loadRecipes();
  const byOut = buildByOutput(recipes.recipes, flags.includeSalvage);
  const { id, matches } = resolveId(args[0] || "", [...byOut.keys()]);
  if (!id) return console.log(hintMatches(matches, "outputs"));
  const list = byOut.get(id);
  const all = recipes.recipes.filter((r) => r.outputs.some((o) => o.id === id));
  if (flags.json) return console.log(JSON.stringify(all, null, 2));
  console.log(`# ${id} — ${all.length} recipe(s)`);
  for (const r of all) console.log(`- [${r.id}] ${recipeLine(r)}`);
}

function buildTree(itemId, byOut, depth, maxDepth, stack, out) {
  const pad = "  ".repeat(depth);
  if (stack.includes(itemId)) { out.push(`${pad}- ${itemId} (cycle)`); return; }
  if (depth > maxDepth) { out.push(`${pad}- ${itemId} (depth limit)`); return; }
  const r = byOut.get(itemId);
  if (!r) { out.push(`${pad}- ${itemId} (raw/gathered)`); return { raw: { [itemId]: 1 } }; }
  const parts = [];
  if (r.id !== itemId) parts.push(`recipe=${r.id}`);
  parts.push(`bench=${benchText(r.bench)}`);
  if (r.timeSeconds != null) parts.push(`${r.timeSeconds}s`);
  if (r.knowledgeRequired) parts.push("knowledge");
  out.push(`${pad}- ${itemId} (${parts.join("; ")})`);
  const raw = {};
  for (const inp of r.inputs) {
    const key = inputKey(inp);
    out.push(`${pad}  needs ${inp.quantity}x ${key}`);
    if (inp.kind === "item") {
      const sub = buildTree(inp.id, byOut, depth + 2, maxDepth, [...stack, itemId], out);
      if (sub && sub.raw) for (const [k, v] of Object.entries(sub.raw)) raw[k] = (raw[k] || 0) + v * inp.quantity;
    } else {
      raw[key] = (raw[key] || 0) + inp.quantity;
    }
  }
  // bench dependency note
  for (const b of r.bench || []) {
    const benchItem = BENCH_ITEM_BY_REQUIREMENT_ID[b.id];
    if (benchItem && benchItem !== itemId) raw[`(bench) ${benchItem}`] = 1;
  }
  return { raw };
}

function cmdMake(args, flags) {
  const recipes = loadRecipes();
  const byOut = buildByOutput(recipes.recipes, flags.includeSalvage);
  const { id, matches } = resolveId(args[0] || "", [...byOut.keys()]);
  if (!id) return console.log(hintMatches(matches, "craftable outputs"));
  const maxDepth = flags.depth != null ? flags.depth : 12;
  const out = [];
  const res = buildTree(id, byOut, 0, maxDepth, [], out);
  if (flags.json) return console.log(JSON.stringify({ id, tree: out, raw: res && res.raw }, null, 2));
  console.log(`# make ${id}`);
  console.log(out.join("\n"));
  if (res && res.raw && Object.keys(res.raw).length) {
    console.log("\n## aggregate raw / gathered inputs + benches");
    for (const [k, v] of Object.entries(res.raw).sort()) console.log(`- ${v}x ${k}`);
  }
}

function cmdUses(args, flags) {
  const recipes = loadRecipes();
  const allInputs = new Set();
  for (const r of recipes.recipes) for (const i of r.inputs) allInputs.add(inputKey(i));
  const token = args[0] || "";
  const { id, matches } = resolveId(token, [...allInputs]);
  const targetId = id || token;
  const consumers = recipes.recipes.filter((r) =>
    r.inputs.some((i) => inputKey(i) === targetId || i.id.toLowerCase() === token.toLowerCase()));
  if (!consumers.length) {
    if (!id && matches.length) return console.log(hintMatches(matches, "inputs"));
    return console.log(`Nothing consumes ${targetId}.`);
  }
  if (flags.json) return console.log(JSON.stringify(consumers, null, 2));
  console.log(`# ${targetId} consumed by ${consumers.length} recipe(s)`);
  for (const r of consumers) console.log(`- [${r.id}] ${recipeLine(r)}`);
}

function cmdBench(args, flags) {
  const recipes = loadRecipes();
  const token = (args[0] || "").toLowerCase();
  // resolve token against bench id, category, type, or mapped item name
  const reverseBenchItem = {};
  for (const [k, v] of Object.entries(BENCH_ITEM_BY_REQUIREMENT_ID)) reverseBenchItem[v.toLowerCase()] = k;
  const hits = recipes.recipes.filter((r) => (r.bench || []).some((b) => {
    const fields = [b.id, b.type, ...(b.categories || []), BENCH_ITEM_BY_REQUIREMENT_ID[b.id] || ""];
    return fields.some((f) => f && f.toLowerCase().includes(token));
  }));
  if (!hits.length) {
    const known = [...new Set(recipes.recipes.flatMap((r) => (r.bench || []).map((b) => b.id).filter(Boolean)))].sort();
    return console.log(`No recipes at bench "${args[0]}". Known bench ids:\n  ${known.join(", ")}`);
  }
  if (flags.json) return console.log(JSON.stringify(hits, null, 2));
  console.log(`# bench "${args[0]}" — ${hits.length} recipe(s)`);
  for (const r of hits) console.log(`- [${r.id}] ${recipeLine(r)}`);
}

function cmdDrops(args, flags) {
  const loot = loadLoot();
  const ids = loot.blocks.map((b) => b.id);
  const { id, matches } = resolveId(args[0] || "", ids);
  if (!id) return console.log(hintMatches(matches, "blocks"));
  const b = loot.blocks.find((x) => x.id === id);
  if (flags.json) return console.log(JSON.stringify(b, null, 2));
  console.log(`# drops ${id}${b.gatheringDefinedBy ? ` (gathering inherited from ${b.gatheringDefinedBy})` : ""}`);
  for (const [mode, m] of Object.entries(b.modes)) {
    const ref = m.droplistRef ? ` [list=${m.droplistRef}]` : "";
    console.log(`- ${mode}${m.gatherType ? "/" + m.gatherType : ""}${ref}`);
    for (const d of m.drops) {
      console.log(`    ${d.item}: x${d.expected}~ (${d.chancePct == null ? "?" : d.chancePct + "%"}, range ${d.qtyMin}-${d.qtyMax})`);
    }
  }
}

function cmdSource(args, flags) {
  const recipes = loadRecipes();
  const loot = loadLoot();
  const byOut = buildByOutput(recipes.recipes, true);
  // resolve against the union of craftable + dropped ids
  const candidates = new Set([...byOut.keys(), ...Object.keys(loot.byItem)]);
  const { id, matches } = resolveId(args[0] || "", [...candidates]);
  if (!id) return console.log(hintMatches(matches, "items"));

  const craftedBy = recipes.recipes.filter((r) => r.outputs.some((o) => o.id === id));
  const droppedBy = loot.byItem[id] || [];
  if (flags.json) return console.log(JSON.stringify({ id, craftedBy, droppedBy }, null, 2));

  console.log(`# source ${id}`);
  console.log(`\n## crafted by (${craftedBy.length})`);
  for (const r of craftedBy) console.log(`- [${r.id}] ${recipeLine(r)}`);
  console.log(`\n## dropped by (${droppedBy.length})`);
  for (const s of droppedBy.slice(0, 40)) {
    const loc = s.kind === "block" ? `block ${s.id} (${s.mode})` : `droplist ${s.id}`;
    console.log(`- ${loc} — x${s.expected}~ (${s.chancePct == null ? "?" : s.chancePct + "%"})`);
  }
  if (droppedBy.length > 40) console.log(`  …(${droppedBy.length - 40} more)`);
}

// --- arg parsing + dispatch ------------------------------------------------

function parseFlags(rest) {
  const flags = {};
  const args = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--json") flags.json = true;
    else if (a === "--include-salvage") flags.includeSalvage = true;
    else if (a === "-q" || a === "--qty") flags.qty = Number(rest[++i]);
    else if (a === "-d" || a === "--depth") flags.depth = Number(rest[++i]);
    else args.push(a);
  }
  return { args, flags };
}

const COMMANDS = {
  find: cmdFind, recipe: cmdRecipe, make: cmdMake, uses: cmdUses,
  bench: cmdBench, drops: cmdDrops, source: cmdSource,
};

function usage() {
  console.log(`Hytale game-data query tool.

Usage: node tools/refs/recipes/gamedata.js <command> <id> [--json]

Commands:
  find   <pat>              Fuzzy-find any id (recipes, items, blocks, droplists)
  recipe <id>              Recipe(s) that output an item
  make   <item> [-d depth] Transitive craft tree + aggregate raw inputs
  uses   <item>            Recipes that consume an item/resource
  bench  <name>            Recipes at a bench (id, category, or Bench_* item)
  drops  <block>           Loot table for a block (all gather modes)
  source <item>            Every way to obtain an item (craft + drop)

Ids accept substrings, *globs*, or /regex/ (case-insensitive).
Data comes from docs/refs/recipes/{recipes,loot}.json — regenerate with
  node tools/refs/recipes/extract-recipes.js
  node tools/refs/recipes/extract-loot.js
`);
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "-h" || cmd === "--help") return usage();
  const fn = COMMANDS[cmd];
  if (!fn) { console.error(`Unknown command: ${cmd}\n`); return usage(); }
  const { args, flags } = parseFlags(rest);
  if (!args.length) { console.error(`${cmd} needs an id argument.\n`); return usage(); }
  fn(args, flags);
}

try {
  main();
} catch (err) {
  console.error(`gamedata: ${err.message}`);
  if (process.env.GAMEDATA_DEBUG) console.error(err.stack);
  process.exitCode = 1;
}
