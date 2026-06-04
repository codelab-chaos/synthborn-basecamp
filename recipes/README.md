# Recipe Tools

Helpers for working with Hytale item recipe data from `_Assets`.

## Extract Recipes

Regenerate the normalized recipe index from asset JSON:

```powershell
node tools/recipes/extract-recipes.js
```

Outputs:

- `docs/recipes/recipes.txt`
- `docs/recipes/recipes.json`

## Build Tech Trees

Regenerate craft dependency trees for equipment outputs, currently `Tool_*`, `Weapon_*`, and `Armor_*`:

```powershell
node tools/recipes/build-dependency-tree.js
```

Outputs:

- `docs/recipes/equipment-tech-tree.md`
- `docs/recipes/equipment-tech-tree.json`

Regenerate the full craftable tech tree, including benches, furniture, food, tools, weapons, armor, ingredients, and other craftable outputs:

```powershell
node tools/recipes/build-dependency-tree.js --all
```

Outputs:

- `docs/recipes/crafting-tech-tree.md`
- `docs/recipes/crafting-tech-tree.json`

Useful focused examples:

```powershell
node tools/recipes/build-dependency-tree.js --item Tool_Hatchet_Iron
node tools/recipes/build-dependency-tree.js --prefix Tool_Hatchet_ --prefix Tool_Pickaxe_
node tools/recipes/build-dependency-tree.js --all --basename crafting-tech-tree
node tools/recipes/build-dependency-tree.js --include-salvage
```

By default the dependency generator prefers non-salvage crafting and processing recipes. It treats salvage-bench recipes as raw/unresolved leaves unless `--include-salvage` is passed.

Required craft benches are included as dependency branches when a bench requirement maps to a craftable `Bench_*` item. For example, `Farmingbench` maps to `Bench_Farming`, whose recipe is `6x Wood_Trunk(type) + 20x Ingredient_Fibre` at `Bench_WorkBench`.
