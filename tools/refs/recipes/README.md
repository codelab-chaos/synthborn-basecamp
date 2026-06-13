# Recipe / Game-Data Tools

Helpers for working with Hytale recipe **and loot** data from `_Assets`.

## Query (start here)

`gamedata.js` is the fast multi-criteria search over the generated indexes — use it
instead of grepping the giant `docs/refs/recipes/*.md` files or fanning out file reads:

```powershell
node tools/refs/recipes/gamedata.js bench Campfire          # what cooks at a fire pit
node tools/refs/recipes/gamedata.js make Weapon_Sword_Copper # transitive craft tree + raw inputs
node tools/refs/recipes/gamedata.js source Ingredient_Hide_Light # every way to obtain it (craft + drop)
node tools/refs/recipes/gamedata.js drops Plant_Bush         # resolved loot table (expected + chance)
node tools/refs/recipes/gamedata.js uses Ingredient_Bar_Copper
node tools/refs/recipes/gamedata.js find Tannery             # fuzzy id search
```

Commands: `find | recipe | make | uses | bench | drops | source`. Ids accept
substrings, `*globs*`, or `/regex/` (case-insensitive). Add `--json` for machine output.
It reads `docs/refs/recipes/recipes.json` + `docs/refs/recipes/loot.json` — regenerate those with
the two extractors below if `_Assets` changed.

## Extract Recipes

Regenerate the normalized recipe index from asset JSON:

```powershell
node tools/refs/recipes/extract-recipes.js
```

Outputs:

- `docs/refs/recipes/recipes.txt`
- `docs/refs/recipes/recipes.json`

## Extract Loot

Regenerate the normalized drop/loot index from `_Assets/Server/Drops/` (named
drop-lists) and `_Assets/Server/Item/Items/` (block `BlockType.Gathering`):

```powershell
node tools/refs/recipes/extract-loot.js
```

Outputs (resolved drop-lists + expected count + chance, with a reverse `byItem` index):

- `docs/refs/recipes/loot.txt`
- `docs/refs/recipes/loot.json`

## Extract Bench Tiers

Regenerate the bench upgrade-ladder index from `_Assets/Server/Item/Items/Bench/*.json`
(`BlockType.Bench.TierLevels`):

```powershell
node tools/refs/recipes/extract-bench-tiers.js
```

Outputs (per bench: each tier's craft-speed bonus + the material/time cost to reach the next tier,
plus the bench's crafting `categories`):

- `docs/refs/recipes/bench-tiers.txt`
- `docs/refs/recipes/bench-tiers.json`

7 benches are upgradable (`Bench_WorkBench`, `Bench_Weapon`, `Bench_Armour`, `Bench_Alchemy`,
`Bench_Farming`, `Bench_Furnace`, `Bench_Tannery`). **Note:** which *recipes* a tier unlocks is NOT in
the recipe assets (no per-recipe tier field) — it is the runtime SDK check
`CraftingRecipe.isRestrictedByBenchTierLevel`. This index captures the upgrade ladder + cost; the bench
`categories` are the static link between a bench and the recipe categories it crafts.

## Build Tech Trees

Regenerate craft dependency trees for equipment outputs, currently `Tool_*`, `Weapon_*`, and `Armor_*`:

```powershell
node tools/refs/recipes/build-dependency-tree.js
```

Outputs:

- `docs/refs/recipes/equipment-tech-tree.md`
- `docs/refs/recipes/equipment-tech-tree.json`

Regenerate the full craftable tech tree, including benches, furniture, food, tools, weapons, armor, ingredients, and other craftable outputs:

```powershell
node tools/refs/recipes/build-dependency-tree.js --all
```

Outputs:

- `docs/refs/recipes/crafting-tech-tree.md`
- `docs/refs/recipes/crafting-tech-tree.json`

Useful focused examples:

```powershell
node tools/refs/recipes/build-dependency-tree.js --item Tool_Hatchet_Iron
node tools/refs/recipes/build-dependency-tree.js --prefix Tool_Hatchet_ --prefix Tool_Pickaxe_
node tools/refs/recipes/build-dependency-tree.js --all --basename crafting-tech-tree
node tools/refs/recipes/build-dependency-tree.js --include-salvage
```

By default the dependency generator prefers non-salvage crafting and processing recipes. It treats salvage-bench recipes as raw/unresolved leaves unless `--include-salvage` is passed.

Required craft benches are included as dependency branches when a bench requirement maps to a craftable `Bench_*` item. For example, `Farmingbench` maps to `Bench_Farming`, whose recipe is `6x Wood_Trunk(type) + 20x Ingredient_Fibre` at `Bench_WorkBench`.
