# Hytale Game Data — recipes & loot

This folder holds **generated** indexes of the vanilla tech tree and loot tables, derived
from `_Assets/`. Don't read the big `*.md`/`*.json` files by hand — **query them**:

```powershell
node tools/recipes/gamedata.js <command> <id> [--json]
#   find | recipe | make | uses | bench | drops | source
```

Examples:

| Goal | Command |
|------|---------|
| What cooks at a fire pit? | `gamedata.js bench Campfire` |
| What does the furnace process? | `gamedata.js bench Furnace` |
| What does the tannery do? | `gamedata.js bench Tannery` |
| Full chain to craft X | `gamedata.js make Weapon_Sword_Copper` |
| Every way to get an item | `gamedata.js source Ingredient_Hide_Light` |
| A block's drops (expected + %) | `gamedata.js drops Plant_Bush` |
| What consumes an item | `gamedata.js uses Ingredient_Bar_Copper` |
| Fuzzy id search | `gamedata.js find Tannery` |

## Generated files

| File | Source | Regenerate |
|------|--------|------------|
| `recipes.json` / `.txt` | `_Assets/.../Recipes` + embedded item `Recipe` | `node tools/recipes/extract-recipes.js` |
| `loot.json` / `.txt` | `_Assets/Server/Drops` + block `BlockType.Gathering` | `node tools/recipes/extract-loot.js` |
| `crafting-tech-tree.*`, `equipment-tech-tree.*` | `recipes.json` | `node tools/recipes/build-dependency-tree.js [--all]` |

Regenerate the two extractors whenever `_Assets` changes; the query tool and tech trees read their output.

## The two bench mechanics (key general knowledge)

Hytale recipes name a `BenchRequirement` of one of two kinds — this is the single most
useful thing to know when wiring a synth to a station:

- **`Processing[<Bench>]`** — a *processing* station with input/fuel/output containers and a
  time/duration. Items go in, the bench runs, items come out. This is one code path for
  several stations:
  - `Processing[Furnace]` → `Bench_Furnace` — smelt ore → bar (and a few cook/dry recipes)
  - `Processing[Campfire]` → `Bench_Campfire` — **fire-pit cooking**: grill fish, cook meat/veg
  - `Processing[Tannery]` → `Bench_Tannery` — **tanning**: hide → leather
  - `Processing[Salvagebench]` → `Bench_Salvage` — break gear back into materials
  The synth already drives this path for copper smelting (`SynthProcessingBenches.processOne`);
  fire-pit cooking and tanning are the *same* machinery with a different block + recipe filter.

- **`Crafting[<Bench>,<Category>]`** — a *recipe-grid* station (player crafting UI). Inputs are
  consumed and the output is produced immediately (no containers/fuel). Examples:
  - `Crafting[Cookingbench,Baked|Prepared|Ingredients]` → `Bench_Cooking` — pies, kebabs, salads…
  - `Crafting[Workbench,...]`, `Crafting[Weapon_Bench,...]`, `Crafting[Farmingbench,...]`, etc.
  - `Crafting[Fieldcraft,...]` is **free** (no placed bench) — e.g. a fire pit itself is
    `4x Ingredient_Stick + 2x Rubble` at Fieldcraft.

So "cook in a fire pit" = `Processing[Campfire]`; "cook in a furnace" = `Processing[Furnace]`;
"bake at a cooking bench" = `Crafting[Cookingbench,...]`; "tan" = `Processing[Tannery]`.

## Loot model (how `drops` numbers are computed)

Drop trees use four container types. `extract-loot.js` resolves them to an **expected count**
(mean per resolution) and **chance %** (P at least one):

- `Single` — one item, `Quantity` or `QuantityMin/Max`.
- `Multiple` — each child rolls **independently**; a child `Weight` is a percent chance (`/100`).
- `Choice` — pick child(ren) **weighted** by `Weight`; `RollsMin/Max` sets how many picks.
- `Droplist` — reference into the named registry under `_Assets/Server/Drops` (recurses).

Block gather config lives at `BlockType.Gathering.{Soft|Breaking|Hard}` and is inherited via
`Parent`. NPC/mob loot is in the named registry as `Drop_<Creature>` lists.
