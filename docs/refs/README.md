# Reference Data

This folder holds committed generated or extracted Hytale reference data. Use these
indexes for discovery, search, and agent context; do not hand-edit generated outputs.

| Area | Path | Best entry point | Regenerate |
|---|---|---|---|
| SDK/API signatures | [`sdk/`](sdk/) | `cd tools && npm run sdk:search -- --method placeBlock` | `cd tools && npm run sdk:extract` |
| Recipes and loot | [`recipes/`](recipes/) | `cd tools && npm run recipes:gamedata -- source Ingredient_Leather` | `cd tools && npm run recipes:extract && npm run recipes:loot` |
| English labels | [`labels/`](labels/) | `cd tools && npm run labels:lookup -- find copper` | `cd tools && npm run labels:extract` |
| Prefab catalog | [`prefabs/`](prefabs/) | [`prefabs/README.md`](prefabs/README.md) | `cd tools && npm run prefabs:index` |
| Asset tree notes and TOC snapshots | [`assets/`](assets/) | [`assets/README.md`](assets/README.md) | `cd tools && npm run assets:toc` |

Root docs are for prose, architecture, research, and planning. Generated data belongs
here unless a specific tool requires a different location.
