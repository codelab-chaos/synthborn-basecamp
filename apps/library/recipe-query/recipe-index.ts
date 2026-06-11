import { isSalvage } from "./format";
import type { Recipe, RecipesFile } from "./types";

function recipeRank(recipe: Recipe, outputId: string) {
  let rank = 0;
  if (recipe.id === outputId) rank -= 10;
  if (recipe.source === "embedded") rank += 1;
  rank += recipe.inputs.length / 100;
  return rank;
}

export function buildByOutput(recipes: Recipe[], includeSalvage = false) {
  const map = new Map<string, Recipe[]>();
  for (const r of recipes) {
    if (!includeSalvage && isSalvage(r)) continue;
    for (const o of r.outputs) {
      if (o.kind !== "item") continue;
      if (!map.has(o.id)) map.set(o.id, []);
      map.get(o.id)!.push(r);
    }
  }

  const chosen = new Map<string, Recipe>();
  for (const [id, list] of map) {
    list.sort((a, b) => recipeRank(a, id) - recipeRank(b, id) || a.id.localeCompare(b.id));
    chosen.set(id, list[0]);
  }
  return chosen;
}

export function buildCatalog(recipesFile: RecipesFile) {
  const recipeIds = new Set<string>();
  const outputIds = new Set<string>();
  const inputIds = new Set<string>();

  for (const r of recipesFile.recipes) {
    recipeIds.add(r.id);
    for (const o of r.outputs) outputIds.add(o.id);
    for (const i of r.inputs) {
      inputIds.add(i.kind === "resource" ? `${i.id}(type)` : i.id);
    }
  }

  return {
    recipeIds: [...recipeIds].sort(),
    outputIds: [...outputIds].sort(),
    inputIds: [...inputIds].sort(),
    byOutput: buildByOutput(recipesFile.recipes),
    allRecipes: recipesFile.recipes,
  };
}

export type RecipeCatalog = ReturnType<typeof buildCatalog>;
