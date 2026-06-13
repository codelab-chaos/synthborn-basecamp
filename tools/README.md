# Basecamp Tools

Basecamp owns reference tooling only. Operational tooling belongs in the deployable mod repos.

Removed from basecamp ownership:

- Deployment and remote deployment.
- Server lifecycle control.
- RCON clients and command runners.
- SynthUnits smoke/live validation.

Use `../synthborn-kyn/tools/deploy.js`, `../synthborn-overseer/tools/deploy.js`, or
`../synthborn-terrascape/tools/deploy.js` for operational work.

## NPM Aliases

The tools folder has its own `package.json` for command aliases only. It has no
dependencies and does not require `npm install`.

```bash
cd tools
npm run check
npm run verify
npm run examples:list
npm run examples:sync
npm run docs:sync
npm run sdk:search -- BlockPlaceUtils
npm run recipes:gamedata -- source Ingredient_Leather
```

Use `npm run verify` before or after reference/doc reorganizations. It checks tool
syntax, JSON parse health, stale moved paths, local markdown links, and read-only
smoke tests for labels, recipes, and SDK search. Use `npm run` from `tools/` to see
the full alias list. The underlying scripts still work directly from the repo root
with `node tools/...`.

## Supported Reference Tools

These are stable basecamp tools. They generate or query shared reference material under `docs/`.

| Tool | Path | Why it exists | Terse instructions |
|------|------|---------------|--------------------|
| Basecamp verifier | `verify.js` | Catches drift across reference tools and docs after moves, generated-data refreshes, or README edits. | `cd tools && npm run verify`; read-only health check. |
| SDK search | `refs/sdk/sdk-search.js` | Finds SDK classes, methods, inheritance, packages, or text without loading all generated SDK docs. | `node tools/refs/sdk/sdk-search.js BlockPlaceUtils`; use `--method`, `--package`, `--extends`, `--implements`, or `--grep`. |
| SDK extractor | `refs/sdk/extract-sdk-reference.js` | Rebuilds `docs/refs/sdk/` from the pinned Hytale Server jar so API research matches the current mod compile target. | Run `cd ../synthborn-kyn && ./gradlew compileJava`, return here, then `node tools/refs/sdk/extract-sdk-reference.js --full`. |
| SDK diff | `refs/sdk/diff-sdk-reference.js` | Summarizes package, class, and method signature changes after an SDK refresh. | `node tools/refs/sdk/diff-sdk-reference.js`; add `--against main` or `--against /path/to/old-sdk-reference`. |
| SDK LLM index builder | `refs/sdk/build-sdk-llms-txt.js` | Rebuilds the compact `llms.txt` package/class router from existing SDK markdown. | `node tools/refs/sdk/build-sdk-llms-txt.js`; add `--out docs/refs/sdk` for an explicit output dir. |
| SDK method index builder | `refs/sdk/build-sdk-method-index.js` | Rebuilds `methods.json` and `methods.txt` for method-name lookups. | `node tools/refs/sdk/build-sdk-method-index.js`; run after editing SDK markdown generation. |
| SDK package parser | `refs/sdk/library/parse-sdk-package.js` | Shared parser for SDK markdown indexes. | Library only; do not run directly. |
| SDK class lister | `refs/sdk/list-hytale-server-api.js` | Lists top-level classes in a package from the Hytale Server jar for quick discovery. | `node tools/refs/sdk/list-hytale-server-api.js --package com/hypixel/hytale/server/npc`; add `--first` or `--jar`. |
| Label extractor | `refs/labels/extract-labels.js` | Converts `_Assets/Server/Languages/en-US/server.lang` into English-name indexes for item ids, resource types, and NPC roles. | `node tools/refs/labels/extract-labels.js`; add `--assets /path/to/_Assets` or `--out docs/refs/labels`. |
| Label lookup | `refs/labels/lookup.js` | Resolves English names to Hytale ids and ids back to player-facing names. | `node tools/refs/labels/lookup.js find copper`; subcommands: `id`, `name`, `find`; add `--json` for machine output. |
| NPC role extractor | `refs/npcs/extract-npcs.js` | Extracts Hytale NPC role metadata into a reusable JSON catalog. | `node tools/refs/npcs/extract-npcs.js`; add `--assets /path/to/_Assets` or `--out docs/npcs/npcs-en.json`. |
| Prefab indexer | `refs/prefabs/index-hytale-prefabs.js` | Builds searchable metadata for Hytale `.prefab.json` assets without loading full prefabs into runtime docs. | `node tools/refs/prefabs/index-hytale-prefabs.js`; add `--root`, `--md-out`, `--json-out`, or `--plugin-json-out`. |
| Prefab module extractor | `refs/prefabs/extract-prefab-modules.js` | Indexes reusable module shape, palette, rotation, and inferred role data from reference prefab packs. | `node tools/refs/prefabs/extract-prefab-modules.js`; add `--root`, `--json-out`, or `--md-out`. |
| Builder command doc renderer | `refs/builder-commands/build-builder-catalog-doc.js` | Renders a builder-command catalog JSON file into a readable command reference. | `node tools/refs/builder-commands/build-builder-catalog-doc.js`; add `--catalog <file>` and `--out <file>` for non-default catalogs. |
| Recipe extractor | `refs/recipes/extract-recipes.js` | Builds normalized crafting and salvage indexes from `_Assets` recipe and item JSON. | `node tools/refs/recipes/extract-recipes.js`; add `--assets`, `--out`, or `--verbose`. |
| Loot extractor | `refs/recipes/extract-loot.js` | Builds normalized drop indexes from named droplists and block gather configs. | `node tools/refs/recipes/extract-loot.js`; add `--assets`, `--out`, or `--verbose`. |
| Bench tier extractor | `refs/recipes/extract-bench-tiers.js` | Captures bench upgrade ladders, costs, and categories from bench item assets. | `node tools/refs/recipes/extract-bench-tiers.js`; add `--assets`, `--out`, or `--verbose`. |
| Dependency tree builder | `refs/recipes/build-dependency-tree.js` | Computes transitive craft trees and raw inputs from generated recipe indexes. | `node tools/refs/recipes/build-dependency-tree.js`; use `--item`, `--prefix`, `--all`, or `--include-salvage`. |
| Game-data query | `refs/recipes/gamedata.js` | Fast CLI over recipe and loot indexes for planning and agent lookup. | `node tools/refs/recipes/gamedata.js source Ingredient_Leather`; commands: `find`, `recipe`, `make`, `uses`, `bench`, `drops`, `source`; add `--json`. |
| Assets TOC builder | `refs/assets/build-assets-toc.js` | Creates versioned asset table-of-contents snapshots so Hytale asset changes diff cleanly. | `node tools/refs/assets/build-assets-toc.js`; add `--dir _Assets`, `--zip /path/Assets.zip`, `--version`, `--out`, or `--game`. |
| Reference docs sync | `refs/reference-docs/sync-reference-repos.js` | Clones or updates external Hytale docs from `reference-repos.json`. | `node tools/refs/reference-docs/sync-reference-repos.js --list`; use `--kind docs`, `--only <id>`, or `--force`. |
| Example mod repo sync | `refs/example-mods/sync-example-mod-repos.js` | Clones or copies example Hytale mod source repos into `_mod-example-sourcecode/` from `example-mod-repos.json`. | `node tools/refs/example-mods/sync-example-mod-repos.js --list`; use `--only <id>` or `--force`. |
| Workspace helper | `lib/workspace.js` | Centralizes sibling repo paths and mod directory names for reference tooling. | Library only; update `MODULE_DIRS` if a sibling repo is renamed. |

Terrascape-specific probes moved to `../synthborn-terrascape/tools/`.

## Generated Data

| Path | What it is | Instructions |
|------|------------|--------------|
| `../docs/refs/assets/toc/*.json` | Asset TOC snapshots generated by `build-assets-toc.js`. | Commit new snapshots when the game asset version changes. |
| `_mod-example-sourcecode/` | Local example mod source cache managed by `sync-example-mod-repos.js`. | Do not commit; VS Code Git/file watchers are configured to ignore it. |

For deeper workflow notes, see `refs/sdk/README.md`, `refs/recipes/README.md`,
and `refs/labels/README.md`.
