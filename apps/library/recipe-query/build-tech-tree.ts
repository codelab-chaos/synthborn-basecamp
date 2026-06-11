import { BENCH_ITEM_BY_REQUIREMENT_ID } from "./bench-map";
import { inputKey } from "./format";
import { buildByOutput } from "./recipe-index";
import type { Recipe, TechTreeChild, TechTreeNode } from "./types";

const FREE_BENCH_IDS = new Set(["", "Fieldcraft", "TODO"]);

export type BuildTechTreeOptions = {
  includeBenchDeps?: boolean;
  includeSalvage?: boolean;
  maxDepth?: number;
};

function benchDependencyIds(bench?: Recipe["bench"]) {
  if (!Array.isArray(bench) || bench.length === 0) return [];
  if (bench.some((entry) => FREE_BENCH_IDS.has(entry.id || ""))) return [];

  const ids: string[] = [];
  for (const entry of bench) {
    const benchItemId = entry.id ? BENCH_ITEM_BY_REQUIREMENT_ID[entry.id] : undefined;
    if (benchItemId && !ids.includes(benchItemId)) ids.push(benchItemId);
  }
  return ids;
}

function buildNode(
  itemId: string,
  recipeByOutput: Map<string, Recipe>,
  opts: Required<BuildTechTreeOptions>,
  stack: string[] = [],
): TechTreeNode {
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

  const children: TechTreeChild[] = recipe.inputs.map((input) => ({
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

function addLeafTotals(node: TechTreeNode, multiplier: number, totals: Map<string, number>) {
  if (node.leaf || node.resource || node.cycle || node.depthLimit) {
    totals.set(node.id, (totals.get(node.id) || 0) + multiplier);
    return;
  }
  for (const child of node.children || []) {
    addLeafTotals(child.dependency, multiplier * child.quantity, totals);
  }
}

export function summarizeLeaves(tree: TechTreeNode) {
  const totals = new Map<string, number>();
  addLeafTotals(tree, 1, totals);
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, quantity]) => ({ id, quantity }));
}

export function buildTechTree(
  itemId: string,
  recipes: Recipe[],
  options: BuildTechTreeOptions = {},
) {
  const opts: Required<BuildTechTreeOptions> = {
    includeBenchDeps: options.includeBenchDeps ?? true,
    includeSalvage: options.includeSalvage ?? false,
    maxDepth: options.maxDepth ?? 10,
  };
  const recipeByOutput = buildByOutput(recipes, opts.includeSalvage);
  if (!recipeByOutput.has(itemId)) return null;

  const tree = buildNode(itemId, recipeByOutput, opts);
  return { id: itemId, tree, leaves: summarizeLeaves(tree) };
}
