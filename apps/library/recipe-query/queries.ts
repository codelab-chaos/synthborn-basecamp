import { BENCH_ITEM_BY_REQUIREMENT_ID } from "./bench-map";
import { benchText, inputKey, recipeLine } from "./format";
import { makeMatcher, resolveId } from "./matcher";
import { buildByOutput, type RecipeCatalog } from "./recipe-index";
import type {
  FindResult,
  LootFile,
  MakeResult,
  MakeTreeLine,
  Recipe,
  RecipesFile,
} from "./types";

export function cmdFind(pattern: string, recipes: RecipesFile, loot: LootFile): FindResult {
  const m = makeMatcher(pattern);
  const sect = (set: Set<string>) => [...set].filter((s) => m.test(s)).sort();

  const recipeIds = new Set(recipes.recipes.map((r) => r.id));
  const outputIds = new Set<string>();
  const inputIds = new Set<string>();
  for (const r of recipes.recipes) {
    for (const o of r.outputs) outputIds.add(o.id);
    for (const i of r.inputs) inputIds.add(inputKey(i));
  }

  return {
    recipes: sect(recipeIds),
    outputs: sect(outputIds),
    inputs: sect(inputIds),
    blocks: sect(new Set(loot.blocks.map((b) => b.id))),
    droplists: sect(new Set(loot.droplists.map((d) => d.id))),
    droppedItems: sect(new Set(Object.keys(loot.byItem))),
  };
}

export function recipesForOutput(id: string, recipes: Recipe[]) {
  return recipes.filter((r) => r.outputs.some((o) => o.id === id));
}

export function recipesUsingInput(token: string, recipes: Recipe[]) {
  const allInputs = new Set<string>();
  for (const r of recipes) {
    for (const i of r.inputs) allInputs.add(inputKey(i));
  }
  const { id, matches } = resolveId(token, [...allInputs]);
  const targetId = id || token;
  const consumers = recipes.filter((r) =>
    r.inputs.some((i) => inputKey(i) === targetId || i.id.toLowerCase() === token.toLowerCase()));
  return { targetId, id, matches, consumers };
}

export function recipesAtBench(token: string, recipes: Recipe[]) {
  const lower = token.toLowerCase();
  const hits = recipes.filter((r) => (r.bench || []).some((b) => {
    const fields = [b.id, b.type, ...(b.categories || []), BENCH_ITEM_BY_REQUIREMENT_ID[b.id || ""] || ""];
    return fields.some((f) => f && f.toLowerCase().includes(lower));
  }));
  const known = [...new Set(recipes.flatMap((r) => (r.bench || []).map((b) => b.id).filter(Boolean)))].sort();
  return { hits, known };
}

export function sourceForItem(id: string, recipes: Recipe[], loot: LootFile, includeSalvage = true) {
  const craftedBy = recipes.filter((r) => r.outputs.some((o) => o.id === id));
  const droppedBy = loot.byItem[id] || [];
  const byOut = buildByOutput(recipes, includeSalvage);
  const canMake = byOut.has(id);
  return { id, craftedBy, droppedBy, canMake, chosenRecipe: byOut.get(id) };
}

function buildMakeTree(
  itemId: string,
  byOut: Map<string, Recipe>,
  depth: number,
  maxDepth: number,
  stack: string[],
  lines: MakeTreeLine[],
): { raw: Record<string, number> } {
  if (stack.includes(itemId)) {
    lines.push({ depth, text: `${itemId} (cycle)`, kind: "cycle" });
    return { raw: {} };
  }
  if (depth > maxDepth) {
    lines.push({ depth, text: `${itemId} (depth limit)`, kind: "limit" });
    return { raw: {} };
  }

  const r = byOut.get(itemId);
  if (!r) {
    lines.push({ depth, text: `${itemId} (raw/gathered)`, kind: "raw" });
    return { raw: { [itemId]: 1 } };
  }

  const parts: string[] = [];
  if (r.id !== itemId) parts.push(`recipe=${r.id}`);
  parts.push(`bench=${benchText(r.bench)}`);
  if (r.timeSeconds != null) parts.push(`${r.timeSeconds}s`);
  if (r.knowledgeRequired) parts.push("knowledge");
  lines.push({ depth, text: `${itemId} (${parts.join("; ")})`, kind: "node" });

  const raw: Record<string, number> = {};
  for (const inp of r.inputs) {
    const key = inputKey(inp);
    lines.push({ depth: depth + 1, text: `needs ${inp.quantity}x ${key}`, kind: "need" });
    if (inp.kind === "item") {
      const sub = buildMakeTree(inp.id, byOut, depth + 2, maxDepth, [...stack, itemId], lines);
      for (const [k, v] of Object.entries(sub.raw)) {
        raw[k] = (raw[k] || 0) + v * inp.quantity;
      }
    } else {
      raw[key] = (raw[key] || 0) + inp.quantity;
    }
  }

  for (const b of r.bench || []) {
    const benchItem = b.id ? BENCH_ITEM_BY_REQUIREMENT_ID[b.id] : undefined;
    if (benchItem && benchItem !== itemId) {
      raw[`(bench) ${benchItem}`] = 1;
    }
  }

  return { raw };
}

export function makeItem(
  token: string,
  catalog: RecipeCatalog,
  maxDepth = 12,
  includeSalvage = false,
): { result: MakeResult | null; matches: string[] } {
  const byOut = buildByOutput(catalog.allRecipes, includeSalvage);
  const { id, matches } = resolveId(token, [...byOut.keys()]);
  if (!id) return { result: null, matches };

  const lines: MakeTreeLine[] = [];
  const { raw } = buildMakeTree(id, byOut, 0, maxDepth, [], lines);
  return { result: { id, lines, raw }, matches: [id] };
}

export function dropsForBlock(token: string, loot: LootFile) {
  const { id, matches } = resolveId(token, loot.blocks.map((b) => b.id));
  if (!id) return { block: null, matches };
  return { block: loot.blocks.find((b) => b.id === id) || null, matches };
}

export function formatRecipeSummary(r: Recipe) {
  return {
    id: r.id,
    line: recipeLine(r),
    source: r.source,
    sourceFile: r.sourceFile,
    inputs: r.inputs,
    outputs: r.outputs,
    bench: r.bench,
    timeSeconds: r.timeSeconds,
    knowledgeRequired: r.knowledgeRequired,
  };
}
