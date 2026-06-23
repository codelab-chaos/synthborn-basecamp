# synthborn-basecamp

Shared **research indexes**, **offline reference docs**, and **reference tooling** for the
Synthborn Hytale mod family. Sibling mod repos (`synthborn-kyn`, `synthborn-overseer`, etc.)
build, deploy, and ship their own jars; basecamp is where cross-cutting knowledge lives.

**Node built-ins only** for `tools/` — no `npm install` at repo root. `tools/package.json`
contains npm aliases only (`cd tools && npm run verify`). React apps under `apps/` are
separate (`npm install` inside each app folder).

Agent entrypoint: [`llm.txt`](llm.txt) gives the compact routing map for this repo.

---

## English names ↔ item ids (read this first)

Hytale **ids** (`Ingredient_Fibre`, `Wood_Beech_Trunk`) are not the **English names**
players see (`Plant Fiber`, `Beech Log`). They live in separate systems — guessing from
underscores is wrong often enough to break recipes, give commands, and agent replies.

| You have | Command |
|----------|---------|
| English name → id | `node tools/refs/labels/lookup.js name "plant fiber"` |
| Id → English | `node tools/refs/labels/lookup.js id Ingredient_Fibre` |
| Fuzzy either way | `node tools/refs/labels/lookup.js find copper` |

Source: `_Assets/Server/Languages/en-US/server.lang` (`items.*.name`, `resourceType.*.name`,
`npcRoles.*.name`). Full guide: [`docs/refs/labels/README.md`](docs/refs/labels/README.md).

Regenerate after an assets bump: `node tools/refs/labels/extract-labels.js` → `docs/refs/labels/labels.json`.

---

## For agents — where to look first

Use this repo as a **read-mostly knowledge base**. Mod source code lives in sibling repos;
basecamp answers “what APIs exist?”, “how do I craft X?”, and “what’s in the assets?”.

| Question | Start here | CLI / file |
|----------|------------|------------|
| **English name for an item id** (or id from English) | [`docs/refs/labels/README.md`](docs/refs/labels/README.md) | `node tools/refs/labels/lookup.js find copper` |
| Find an SDK class or method | [`docs/refs/sdk/README.md`](docs/refs/sdk/README.md) | `node tools/refs/sdk/sdk-search.js --method placeBlock` |
| Plugin / NPC / inventory APIs by topic | [`docs/refs/sdk/README.md`](docs/refs/sdk/README.md) topic router | `grep ClassName docs/refs/sdk/llms.txt` |
| Full method signatures for one class | Per-package `.md` under [`docs/refs/sdk/`](docs/refs/sdk/) | open file named after the package |
| What changed after a Server version bump | `node tools/refs/sdk/diff-sdk-reference.js` | compare to last commit |
| Craft tree / raw inputs for an item | [`docs/refs/recipes/README.md`](docs/refs/recipes/README.md) | `node tools/refs/recipes/gamedata.js make Weapon_Sword_Copper` |
| What consumes an item (backward) | same | `node tools/refs/recipes/gamedata.js uses Ingredient_Bar_Copper` |
| Every way to obtain an item | same | `node tools/refs/recipes/gamedata.js source Ingredient_Leather` |
| Recipes at a bench | same | `node tools/refs/recipes/gamedata.js bench Campfire` |
| Block / mob drops | same | `node tools/refs/recipes/gamedata.js drops Plant_Bush` |
| Fuzzy id across recipes + loot | same | `node tools/refs/recipes/gamedata.js find Tannery` |
| Browse recipes in a UI | [`apps/recipe-kiosk/`](apps/recipe-kiosk/) or GitHub Pages `recipe-kiosk/` | `cd tools && npm run pages:build` |
| Vanilla prefab catalog (text/json) | [`docs/refs/prefabs/README.md`](docs/refs/prefabs/README.md), [`docs/refs/prefabs/prefabs-index.json`](docs/refs/prefabs/prefabs-index.json) | — |
| Unpacked game assets on disk | `_Assets/` (local, gitignored) | [`docs/refs/assets/README.md`](docs/refs/assets/README.md) |
| SynthUnits-oriented SDK map | sibling repo `synthborn-kyn/kyn-docs/hytale-builtin-sdk-map.md` | — |
| Deploy / validate a mod jar | owning mod repo | `cd ../synthborn-kyn && node tools/deploy.js restart` |

**Do not** read all of `docs/refs/sdk/*.md` or `docs/refs/recipes/*.json` into context.
Search first (`sdk-search`, `gamedata.js`, `llms.txt`, `methods.txt`), then open the
one or two files the hit points to.

Run `cd tools && npm run verify` after reorganizing docs, refs, or reference tools. It
checks syntax, generated JSON parse health, stale moved paths, local markdown links,
and read-only smoke tests.

---

## Knowledge layers

```
_Assets/                    Local unpacked Hytale game data (gitignored, multi-GB)
    ↓ extract
docs/refs/labels/                en-US id ↔ English name index (from server.lang)
docs/refs/recipes/               recipes.json, loot.json, tech-tree exports
docs/refs/sdk/         ~915 packages, javap signatures from pinned Server jar
docs/refs/prefabs/               Prefab catalog indexes
docs/hytale-mod-quickref/   Curated human onboarding (older snapshot)
    ↓ query
tools/refs/labels/lookup.js      English <-> id (server.lang)
tools/refs/sdk/*                 SDK search, extract, diff
tools/refs/recipes/gamedata.js   Recipe + loot CLI
apps/recipe-kiosk/        Static UI over recipes.json (optional)
```

| Layer | Regenerate when | Maintainer doc |
|-------|-----------------|----------------|
| English name index | `_Assets/Server/Languages/en-US/server.lang` changes | [`tools/refs/labels/README.md`](tools/refs/labels/README.md) |
| SDK reference | `Server:X.Y.Z` bump in any mod `build.gradle.kts` | [`tools/refs/sdk/README.md`](tools/refs/sdk/README.md) |
| Recipe + loot indexes | `_Assets` recipe/drop JSON changes | [`tools/refs/recipes/README.md`](tools/refs/recipes/README.md) |
| Prefab text index | `_Assets/Server/Prefabs` changes | `tools/refs/prefabs/index-hytale-prefabs.js` |
| Assets TOC | new `_Assets` drop | `node tools/refs/assets/build-assets-toc.js` |

---

## SDK reference (search workflow)

Offline `javap -protected` over the pinned `com.hypixel.hytale:Server` jar (~4920 public
classes, ~11700 method names). Signatures only — **no behavior, threading rules, or
deprecation markers**. Watch `./gradlew compileJava` in a mod repo for `[removal]` warnings
after a version bump.

### Search (seconds)

```bash
# from synthborn-basecamp repo root
node tools/refs/sdk/sdk-search.js BlockPlaceUtils
node tools/refs/sdk/sdk-search.js --method placeBlock
node tools/refs/sdk/sdk-search.js --package interaction
node tools/refs/sdk/sdk-search.js --extends JavaPlugin
node tools/refs/sdk/sdk-search.js --grep CompletableFuture
```

Or grep the flat indexes:

- [`docs/refs/sdk/llms.txt`](docs/refs/sdk/llms.txt) — class declarations by package
- [`docs/refs/sdk/methods.txt`](docs/refs/sdk/methods.txt) — `method → class → package → file`

Topic entry points (plugin, NPC, inventory, worldgen, …):
[`docs/refs/sdk/README.md`](docs/refs/sdk/README.md)

### Refresh (15–30 min, rare)

```bash
cd ../synthborn-kyn && ./gradlew compileJava   # pull pinned jar into Gradle cache
cd ../synthborn-basecamp
node tools/refs/sdk/extract-sdk-reference.js --full
node tools/refs/sdk/diff-sdk-reference.js           # summarize changes vs last commit
```

Details: [`tools/refs/sdk/README.md`](tools/refs/sdk/README.md)

---

## English label lookup

```bash
node tools/refs/labels/lookup.js name "beech log"      # → Wood_Beech_Trunk
node tools/refs/labels/lookup.js id Ingredient_Fibre   # → Plant Fiber
node tools/refs/labels/lookup.js find anvil            # → Bench_Weapon (Blacksmith's Anvil)
node tools/refs/labels/extract-labels.js               # refresh docs/refs/labels/labels.json
```

Why this exists, translation key quirks, and resource-type `(type)` inputs:
[`docs/refs/labels/README.md`](docs/refs/labels/README.md)

---

## Recipe & loot data

Normalized indexes from `_Assets` — **query, don't grep the raw assets tree**.

```bash
node tools/refs/recipes/gamedata.js find Copper
node tools/refs/recipes/gamedata.js make Weapon_Sword_Copper
node tools/refs/recipes/gamedata.js uses Ingredient_Bar_Copper
node tools/refs/recipes/gamedata.js source Ingredient_Leather
node tools/refs/recipes/gamedata.js bench Tannery
node tools/refs/recipes/gamedata.js drops Plant_Bush
```

Add `--json` on any command for structured output. Regenerate indexes:

```bash
node tools/refs/recipes/extract-recipes.js
node tools/refs/recipes/extract-loot.js
```

Human notes on bench mechanics (`Processing[Campfire]` vs `Crafting[Workbench,…]`):
[`docs/refs/recipes/README.md`](docs/refs/recipes/README.md)

### Recipe browser app

Static React + Ant Design UI over the same data — find, forward/backward chains, sources,
bench filter, and an in-app **Tech tree** tab (built client-side from `recipes.json`).

```bash
cd apps/recipe-kiosk
npm install
npm run build
```

Live Server (repo root): `http://<host>:5500/apps/recipe-kiosk/` — use **`npm run build`**
(relative asset paths). See [`apps/recipe-kiosk/README.md`](apps/recipe-kiosk/README.md).

Shared TS query code: [`apps/library/recipe-query/`](apps/library/recipe-query/)

---

## Apps

| App | Purpose | Build |
|-----|---------|-------|
| [`apps/recipe-kiosk/`](apps/recipe-kiosk/) | Recipe/item search + tech tree UI | `npm run build` in app folder |
| [`apps/prefab-gallery/`](apps/prefab-gallery/) | Voxel prefab preview gallery (Three.js) | `npm run build` in app folder; needs `_Assets` |

Apps are **self-contained static sites**. They are not co-deployed — serve each from its
own path or host. Recipe browser uses relative `assets/` and `data/` paths for subfolder
hosting (e.g. Live Server `/apps/recipe-kiosk/`).

---

## Workspace layout

Split out of the old `hytale-mods` monorepo. Mods are sibling repos; basecamp holds
cross-cutting tooling and docs.

```
<workspace root>/            e.g. ~/git/hytale-mods
├── synthborn-basecamp/      ← this repo
│   ├── tools/               Reference CLIs over Hytale SDK and asset data
│   ├── docs/                Shared indexes + research notes
│   ├── apps/                Optional static UIs (recipe-kiosk, prefab-gallery)
│   └── _Assets/             Local game extract (gitignored)
├── synthborn-rcon/          SynthRCON jar
├── synthborn-overseer/      SynthOverseer jar
├── synthborn-kyn/           SynthUnits jar
└── synthborn-terrascape/    SynthTerrascape jar
```

Mod directory names are mapped in [`tools/lib/workspace.js`](tools/lib/workspace.js)
(`MODULE_DIRS`). Update that file if a sibling repo is renamed.

---

## Cross-repo rules

**No build-time coupling.** Each mod is a self-contained Gradle build (`compileOnly` from
`maven.hytale.com`). None compiles against basecamp. Standalone build:
`./gradlew deploy -PmodsDir=<save>/mods`.

**Operational ownership moved to each mod repo.** Kyn, Overseer, and Terrascape own their
deployment, server lifecycle, RCON, smoke-test, and repo-local `remote-host.env` tooling.
Basecamp is no longer an operational control plane.

| Mod repo | Basecamp touches |
|----------|------------------|
| `synthborn-kyn` | shared docs only |
| `synthborn-overseer` | optional source for the builder-command reference doc |
| `synthborn-terrascape` | shared docs only; Terrascape-specific probes live in that repo |
| `synthborn-rcon` | built/deployed by each owning mod's deploy script |

Mod-local `tools/deploy.js` scripts are independent of basecamp.

---

## Tool Layout

Basecamp tools are deliberately non-operational:

| Path | Status | Purpose |
|------|--------|---------|
| [`tools/refs/sdk/`](tools/refs/sdk/) | supported | Hytale Server jar -> searchable SDK reference |
| [`tools/refs/recipes/`](tools/refs/recipes/) | supported | recipe, loot, bench-tier, and dependency indexes |
| [`tools/refs/labels/`](tools/refs/labels/) | supported | en-US display name <-> asset id index |
| [`tools/refs/npcs/`](tools/refs/npcs/) | supported | NPC role metadata extracted from Hytale assets |
| [`tools/refs/prefabs/`](tools/refs/prefabs/) | supported | prefab and prefab-module indexes extracted from Hytale data |
| [`tools/refs/builder-commands/`](tools/refs/builder-commands/) | supported | builder-command catalog renderer |
| [`tools/refs/assets/`](tools/refs/assets/) | supported | asset TOC snapshots for version diffs |
| [`tools/refs/reference-docs/`](tools/refs/reference-docs/) | supported | JSON-driven clone/update of external docs |
| [`tools/refs/example-mods/`](tools/refs/example-mods/) | supported | JSON-driven clone/copy of example Hytale mod repos |
| [`tools/lib/`](tools/lib/) | supported | workspace path helpers for reference tools |

Server lifecycle, RCON, smoke tests, and deployment live in the owning mod repos.

---

## Docs index

| Doc | Contents |
|-----|----------|
| [`docs/README.md`](docs/README.md) | Full docs folder guide |
| [`docs/refs/labels/README.md`](docs/refs/labels/README.md) | **English ↔ id lookup** (server.lang) |
| [`docs/refs/sdk/README.md`](docs/refs/sdk/README.md) | SDK topic router |
| [`docs/refs/recipes/README.md`](docs/refs/recipes/README.md) | Recipe/loot model + bench mechanics |
| [`docs/hytale-mod-quickref/`](docs/hytale-mod-quickref/) | Curated modding onboarding (snapshot) |
| [`docs/external/`](docs/external/) | Cloned reference docs (`node tools/refs/reference-docs/sync-reference-repos.js --kind docs`) |
| `_mod-example-sourcecode/` | Local example Hytale mod repo cache (`node tools/refs/example-mods/sync-example-mod-repos.js`) |
| `../_references/example-sourcecode-mods/` | Legacy source snapshots used to seed `_mod-example-sourcecode/` when no clone URL is known |

Mod-specific deep docs stay in each sibling repo (`kyn-docs/`, `overseer-docs/`, etc.).
