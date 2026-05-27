# Hytale Survival Progression Reference

This note captures the progression assumptions SynthNPCs should use when choosing tools, recipes, and next tasks. It exists because raw recipe lookup is not enough: a recipe index can tell us that an item exists, but it does not tell us whether that item belongs to starter survival progression, a later workbench tier, combat gear, or salvage.

Source data:

- `_Assets/Server/Item/**`
- `docs/recipes/recipes.txt`
- `docs/recipes/recipes.json`
- runtime catalog dumps under `mods/SynthNPCs/catalog/`

## Key Rule

Use the player's survival progression, not item-name guesses.

For woodcutting, the first relevant item is a **tool hatchet**, not a weapon axe.

- `Tool_Hatchet_*` = woodcutting tool line.
- `Weapon_Axe_*` = combat weapon line.
- `Weapon_Battleaxe_*` = combat weapon line.

Do not use `Weapon_Axe_Crude` as the prerequisite for chopping trees. It is a crude combat axe and requires `Ingredient_Tree_Sap`, which incorrectly pulls sap into the first gatherer bootstrap path.

## Starting Fieldcraft Tier

When a player first joins a world, starter survival crafting is represented by recipes that can be made through:

- `Crafting[Fieldcraft,Tools]`
- sometimes `Crafting[Fieldcraft,Tools] or Crafting[Workbench,...]`

Starter ingredients come from simple world gathering:

- `Ingredient_Stick` from pile of sticks / `Wood_Sticks`
- `Rubble` / `Rubble_*` from stone rubble
- `Ingredient_Fibre` from fiber plants such as flax

Important starter tools:

| Purpose | Correct item id | Recipe | Bench |
|---|---|---|---|
| Chop trees | `Tool_Hatchet_Crude` | `2x Rubble(type) + 2x Ingredient_Fibre + 2x Ingredient_Stick` | `Fieldcraft,Tools` or `Workbench,Workbench_Tools` |
| Mine stone/ore | `Tool_Pickaxe_Crude` | `2x Rubble(type) + 2x Ingredient_Fibre + 2x Ingredient_Stick` | `Fieldcraft,Tools` or `Workbench,Workbench_Tools` |
| Early hammer | `Tool_Hammer_Crude` | `2x Rubble(type) + 3x Ingredient_Fibre + 3x Ingredient_Stick` | `Workbench,Workbench_Tools` |

Not every crude tool is available from initial fieldcraft. For example, `Tool_Hammer_Crude` needs a workbench tool category, while `Tool_Hatchet_Crude` and `Tool_Pickaxe_Crude` are available through fieldcraft.

## First Bench Layer

After starter gathering and basic tools, the player can craft simple benches.

| Bench | Recipe | Bench requirement |
|---|---|---|
| `Bench_Campfire` | `4x Ingredient_Stick + 2x Rubble(type)` | `Fieldcraft,Tools` or `Workbench,Workbench_Survival` |
| `Bench_WorkBench` | `4x Wood_Trunk(type) + 3x Rock(type)` | `Fieldcraft,Tools` |
| `Bench_Builders` | `6x Wood_Trunk(type) + 3x Rock(type)` | `Fieldcraft,Tools` or `Workbench,Workbench_Crafting` |

The workbench opens additional tool/crafting categories such as:

- `Workbench_Tools`
- `Workbench_Crafting`
- `Workbench_Survival`
- `Workbench_Tinkering`

## Later Material Tiers

Tool progression then moves through metal tiers. These require benches and processed bars:

- `Tool_Hatchet_Copper`
- `Tool_Hatchet_Iron`
- `Tool_Hatchet_Cobalt`
- `Tool_Hatchet_Mithril`
- `Tool_Hatchet_Thorium`
- `Tool_Hatchet_Adamantite`

The same broad pattern exists for pickaxes.

For planning, this means:

1. Prefer the lowest tool tier that can perform the job.
2. Prefer already-owned tools or public storage tools before crafting.
3. If crafting, satisfy the correct bench and material tier first.
4. Never choose combat weapons just because their names contain "axe".

## SynthNPCs Planning Implications

For the storage bootstrap path, the corrected flow is:

```text
Goal: bootstrap first storage
  -> EnsureItem(Tool_Hatchet_Crude, 1)
       -> query synth inventory
       -> query public storage
       -> craft from fieldcraft materials
            -> EnsureResource(Rubble, 2)
            -> EnsureItem(Ingredient_Fibre, 2)
            -> EnsureItem(Ingredient_Stick, 2)
  -> use hatchet to chop real tree trunks
  -> collect real wood trunk drops/items
  -> craft Furniture_Crude_Chest_Small from Wood_Trunk(type)
  -> place chest near home
  -> mark chest as public storage
  -> deposit real items through container APIs
```

Tree sap is not required for this first woodcutting loop. `Ingredient_Tree_Sap` appears in recipes such as `Weapon_Axe_Crude` and furniture/torch-like items, but it should not block starter hatchet crafting.

## Open Questions

- Which exact Hytale API path most closely matches player fieldcraft crafting?
- Which item/container section should synths use for tool equip state?
- Does chopping trunks produce direct inventory items, dropped item entities, or both for NPC actors?
- Which bench categories are available without placing/using an actual bench, and which require a real placed bench interaction?
