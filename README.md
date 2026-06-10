# synthborn-basecamp

Shared **research indexes**, **offline reference docs**, and **operator tooling** for the
Synthborn Hytale mod family. Sibling mod repos (`synthborn-kyn`, `synthborn-overseer`, etc.)
build and ship their own jars; basecamp is where cross-cutting knowledge and deploy harness
live.

**Node built-ins only** for `tools/` — no `npm install` at repo root. React apps under
`apps/` are separate (`npm install` inside each app folder).

---

## English names ↔ item ids (read this first)

Hytale **ids** (`Ingredient_Fibre`, `Wood_Beech_Trunk`) are not the **English names**
players see (`Plant Fiber`, `Beech Log`). They live in separate systems — guessing from
underscores is wrong often enough to break recipes, give commands, and agent replies.

| You have | Command |
|----------|---------|
| English name → id | `node tools/labels/lookup.js name "plant fiber"` |
| Id → English | `node tools/labels/lookup.js id Ingredient_Fibre` |
| Fuzzy either way | `node tools/labels/lookup.js find copper` |

Source: `_Assets/Server/Languages/en-US/server.lang` (`items.*.name`, `resourceType.*.name`,
`npcRoles.*.name`). Full guide: [`docs/labels/README.md`](docs/labels/README.md).

Regenerate after an assets bump: `node tools/labels/extract-labels.js` → `docs/labels/labels.json`.

---

## For agents — where to look first

Use this repo as a **read-mostly knowledge base**. Mod source code lives in sibling repos;
basecamp answers “what APIs exist?”, “how do I craft X?”, and “what’s in the assets?”.

| Question | Start here | CLI / file |
|----------|------------|------------|
| **English name for an item id** (or id from English) | [`docs/labels/README.md`](docs/labels/README.md) | `node tools/labels/lookup.js find copper` |
| Find an SDK class or method | [`docs/sdk-reference/README.md`](docs/sdk-reference/README.md) | `node tools/sdk/sdk-search.js --method placeBlock` |
| Plugin / NPC / inventory APIs by topic | [`docs/sdk-reference/README.md`](docs/sdk-reference/README.md) topic router | `grep ClassName docs/sdk-reference/llms.txt` |
| Full method signatures for one class | Per-package `.md` under [`docs/sdk-reference/`](docs/sdk-reference/) | open file named after the package |
| What changed after a Server version bump | `node tools/sdk/diff-sdk-reference.js` | compare to last commit |
| Craft tree / raw inputs for an item | [`docs/recipes/README.md`](docs/recipes/README.md) | `node tools/recipes/gamedata.js make Weapon_Sword_Copper` |
| What consumes an item (backward) | same | `node tools/recipes/gamedata.js uses Ingredient_Bar_Copper` |
| Every way to obtain an item | same | `node tools/recipes/gamedata.js source Ingredient_Leather` |
| Recipes at a bench | same | `node tools/recipes/gamedata.js bench Campfire` |
| Block / mob drops | same | `node tools/recipes/gamedata.js drops Plant_Bush` |
| Fuzzy id across recipes + loot | same | `node tools/recipes/gamedata.js find Tannery` |
| Browse recipes in a UI | [`apps/recipe-browser/`](apps/recipe-browser/) | `npm run build` → Live Server at `/apps/recipe-browser/` |
| Vanilla prefab catalog (text/json) | [`docs/hytale-prefabs.md`](docs/hytale-prefabs.md), [`docs/hytale-prefabs-index.json`](docs/hytale-prefabs-index.json) | — |
| Unpacked game assets on disk | `_Assets/` (local, gitignored) | [`docs/hytale-assets-toc.md`](docs/hytale-assets-toc.md) |
| SynthUnits-oriented SDK map | sibling repo `synthborn-kyn/kyn-docs/hytale-builtin-sdk-map.md` | — |
| Deploy / validate a mod jar | below — **Operator tooling** | `node tools/deploy.js units --smoke` |

**Do not** read all of `docs/sdk-reference/*.md` or `docs/recipes/*.json` into context.
Search first (`sdk-search`, `gamedata.js`, `llms.txt`, `methods.txt`), then open the
one or two files the hit points to.

---

## Knowledge layers

```
_Assets/                    Local unpacked Hytale game data (gitignored, multi-GB)
    ↓ extract
docs/labels/                en-US id ↔ English name index (from server.lang)
docs/recipes/               recipes.json, loot.json, tech-tree exports
docs/sdk-reference/         ~915 packages, javap signatures from pinned Server jar
docs/hytale-prefabs*        Prefab catalog indexes
docs/hytale-mod-quickref/   Curated human onboarding (older snapshot)
    ↓ query
tools/labels/lookup.js      English ↔ id (server.lang)
tools/sdk/*                 SDK search, extract, diff
tools/recipes/gamedata.js   Recipe + loot CLI
apps/recipe-browser/        Static UI over recipes.json (optional)
```

| Layer | Regenerate when | Maintainer doc |
|-------|-----------------|----------------|
| English name index | `_Assets/Server/Languages/en-US/server.lang` changes | [`tools/labels/README.md`](tools/labels/README.md) |
| SDK reference | `Server:X.Y.Z` bump in any mod `build.gradle.kts` | [`tools/sdk/README.md`](tools/sdk/README.md) |
| Recipe + loot indexes | `_Assets` recipe/drop JSON changes | [`tools/recipes/README.md`](tools/recipes/README.md) |
| Prefab text index | `_Assets/Server/Prefabs` changes | `tools/overseer/index-hytale-prefabs.js` |
| Assets TOC | new `_Assets` drop | `node tools/assets/build-assets-toc.js` |

---

## SDK reference (search workflow)

Offline `javap -protected` over the pinned `com.hypixel.hytale:Server` jar (~4920 public
classes, ~11700 method names). Signatures only — **no behavior, threading rules, or
deprecation markers**. Watch `./gradlew compileJava` in a mod repo for `[removal]` warnings
after a version bump.

### Search (seconds)

```bash
# from synthborn-basecamp repo root
node tools/sdk/sdk-search.js BlockPlaceUtils
node tools/sdk/sdk-search.js --method placeBlock
node tools/sdk/sdk-search.js --package interaction
node tools/sdk/sdk-search.js --extends JavaPlugin
node tools/sdk/sdk-search.js --grep CompletableFuture
```

Or grep the flat indexes:

- [`docs/sdk-reference/llms.txt`](docs/sdk-reference/llms.txt) — class declarations by package
- [`docs/sdk-reference/methods.txt`](docs/sdk-reference/methods.txt) — `method → class → package → file`

Topic entry points (plugin, NPC, inventory, worldgen, …):
[`docs/sdk-reference/README.md`](docs/sdk-reference/README.md)

### Refresh (15–30 min, rare)

```bash
cd ../synthborn-kyn && ./gradlew compileJava   # pull pinned jar into Gradle cache
cd ../synthborn-basecamp
node tools/sdk/extract-sdk-reference.js --full
node tools/sdk/diff-sdk-reference.js           # summarize changes vs last commit
```

Details: [`tools/sdk/README.md`](tools/sdk/README.md)

---

## English label lookup

```bash
node tools/labels/lookup.js name "beech log"      # → Wood_Beech_Trunk
node tools/labels/lookup.js id Ingredient_Fibre   # → Plant Fiber
node tools/labels/lookup.js find anvil            # → Bench_Weapon (Blacksmith's Anvil)
node tools/labels/extract-labels.js               # refresh docs/labels/labels.json
```

Why this exists, translation key quirks, and resource-type `(type)` inputs:
[`docs/labels/README.md`](docs/labels/README.md)

---

## Recipe & loot data

Normalized indexes from `_Assets` — **query, don't grep the raw assets tree**.

```bash
node tools/recipes/gamedata.js find Copper
node tools/recipes/gamedata.js make Weapon_Sword_Copper
node tools/recipes/gamedata.js uses Ingredient_Bar_Copper
node tools/recipes/gamedata.js source Ingredient_Leather
node tools/recipes/gamedata.js bench Tannery
node tools/recipes/gamedata.js drops Plant_Bush
```

Add `--json` on any command for structured output. Regenerate indexes:

```bash
node tools/recipes/extract-recipes.js
node tools/recipes/extract-loot.js
```

Human notes on bench mechanics (`Processing[Campfire]` vs `Crafting[Workbench,…]`):
[`docs/recipes/README.md`](docs/recipes/README.md)

### Recipe browser app

Static React + Ant Design UI over the same data — find, forward/backward chains, sources,
bench filter, and an in-app **Tech tree** tab (built client-side from `recipes.json`).

```bash
cd apps/recipe-browser
npm install
npm run build
```

Live Server (repo root): `http://<host>:5500/apps/recipe-browser/` — use **`npm run build`**
(relative asset paths). See [`apps/recipe-browser/README.md`](apps/recipe-browser/README.md).

Shared TS query code: [`apps/library/recipe-query/`](apps/library/recipe-query/)

---

## Apps

| App | Purpose | Build |
|-----|---------|-------|
| [`apps/recipe-browser/`](apps/recipe-browser/) | Recipe/item search + tech tree UI | `npm run build` in app folder |
| [`apps/prefab-gallery/`](apps/prefab-gallery/) | Voxel prefab preview gallery (Three.js) | `npm run build` in app folder; needs `_Assets` |

Apps are **self-contained static sites**. They are not co-deployed — serve each from its
own path or host. Recipe browser uses relative `assets/` and `data/` paths for subfolder
hosting (e.g. Live Server `/apps/recipe-browser/`).

---

## Workspace layout

Split out of the old `hytale-mods` monorepo. Mods are sibling repos; basecamp holds
cross-cutting tooling and docs.

```
<workspace root>/            e.g. ~/git/hytale-mods
├── synthborn-basecamp/      ← this repo
│   ├── tools/               Node CLIs (deploy, sdk, recipes, server, rcon, …)
│   ├── docs/                Shared indexes + research notes
│   ├── apps/                Optional static UIs (recipe-browser, prefab-gallery)
│   └── _Assets/             Local game extract (gitignored)
├── synthborn-rcon/          SynthRCON jar
├── synthborn-overseer/      SynthOverseer jar
├── synthborn-kyn/           SynthUnits jar
└── synthborn-terrascape/    SynthTerrascape jar
```

Mod directory names are mapped in [`tools/library/workspace.js`](tools/library/workspace.js)
(`MODULE_DIRS`). Update that file if a sibling repo is renamed.

---

## Cross-repo rules

**No build-time coupling.** Each mod is a self-contained Gradle build (`compileOnly` from
`maven.hytale.com`). None compiles against basecamp. Standalone build:
`./gradlew deploy -PmodsDir=<save>/mods`.

**Operational coupling only** — basecamp tooling reaches into sibling repos for deploy,
smoke tests, and doc generators. Deploy config (`remote-host.env`, gitignored) lives in
basecamp only; copy from [`tools/remote-host.env.example`](tools/remote-host.env.example).

| Mod repo | Basecamp touches |
|----------|------------------|
| _all four_ | `tools/deploy.js`, `tools/remote-deploy.js`, `tools/server/*`, `tools/rcon/synth-rcon.js` |
| `synthborn-kyn` | `tools/smoke/synthunits-smoke.js`, `/validate` via synth-rcon |
| `synthborn-overseer` | `tools/overseer/*` generators, verify, redeploy |
| `synthborn-terrascape` | `tools/terrascape/probe-blocks.js`, deploy `--test` |
| `synthborn-rcon` | deployed alongside every target |

Mod-local `tools/` (e.g. in `synthborn-kyn`) are independent of basecamp.

---

## Operator tooling

Deploy matrix — save names are stable per target:

| Target | Save | Jars deployed |
|--------|------|---------------|
| `overseer` | `overseer-test` | SynthRCON, SynthOverseer |
| `units` | `synthtest-02` | SynthRCON, SynthUnits |
| `terrascape` | `synth-worldview-mvp` | SynthRCON, SynthTerrascape |

```bash
node tools/deploy.js --list
node tools/deploy.js units --smoke
node tools/deploy.js overseer --restart --verify
node tools/remote-deploy.js units --restart --verify   # Mac host via remote-host.env
```

Server lifecycle: [`tools/server/README.md`](tools/server/README.md)  
RCON / validate: [`tools/rcon/README.md`](tools/rcon/README.md)

---

## Docs index

| Doc | Contents |
|-----|----------|
| [`docs/README.md`](docs/README.md) | Full docs folder guide |
| [`docs/labels/README.md`](docs/labels/README.md) | **English ↔ id lookup** (server.lang) |
| [`docs/sdk-reference/README.md`](docs/sdk-reference/README.md) | SDK topic router |
| [`docs/recipes/README.md`](docs/recipes/README.md) | Recipe/loot model + bench mechanics |
| [`docs/hytale-mod-quickref/`](docs/hytale-mod-quickref/) | Curated modding onboarding (snapshot) |
| [`docs/external/`](docs/external/) | Cloned vendor docs (`node tools/docs/clone-vendor-docs.js`) |

Mod-specific deep docs stay in each sibling repo (`kyn-docs/`, `overseer-docs/`, etc.).
