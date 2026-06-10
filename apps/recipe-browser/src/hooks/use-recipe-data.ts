import { useEffect, useMemo, useState } from "react";
import { buildCatalog } from "../../../library/recipe-query/recipe-index";
import type { LootFile, RecipesFile } from "../../../library/recipe-query/types";

type LoadState = {
  loading: boolean;
  error: string | null;
  recipes: RecipesFile | null;
  loot: LootFile | null;
};

export function useRecipeData() {
  const [state, setState] = useState<LoadState>({
    loading: true,
    error: null,
    recipes: null,
    loot: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [recipesRes, lootRes] = await Promise.all([
          fetch("data/recipes.json"),
          fetch("data/loot.json"),
        ]);
        if (!recipesRes.ok || !lootRes.ok) {
          throw new Error("Missing data/*.json — run npm run sync-data");
        }
        const recipes = await recipesRes.json() as RecipesFile;
        const loot = await lootRes.json() as LootFile;
        if (!cancelled) {
          setState({ loading: false, error: null, recipes, loot });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            loading: false,
            error: err instanceof Error ? err.message : String(err),
            recipes: null,
            loot: null,
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const catalog = useMemo(
    () => (state.recipes ? buildCatalog(state.recipes) : null),
    [state.recipes],
  );

  return { ...state, catalog };
}
