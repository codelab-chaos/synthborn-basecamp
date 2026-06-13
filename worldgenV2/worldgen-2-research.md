# Worldgen 2 Research

Last updated: 2026-06-10

## Scope

This note captures what we currently know about Hytale Worldgen 2 from the official blog post, local SDK references, extracted SDK assets, and public community/GitHub docs. Treat this as a starting map for building Overseer tooling around world generation, not as a complete implementation plan.

## Sources Checked

- Official Hytale article: <https://hytale.com/news/2026/1/the-future-of-world-generation>
- Community docs/tutorial: <https://hytalemodding.dev/en/docs/official-documentation/worldgen/worldgen-tutorial/README>
- Community docs repo: <https://github.com/HytaleModding/site/tree/main/content/docs/en/official-documentation/worldgen>
- Local clone of those docs:
  - `../synthborn-basecamp/docs/external/hytale-modding-site/content/docs/en/official-documentation/worldgen/`
- Local SDK references:
  - `../synthborn-basecamp/docs/refs/sdk/com.hypixel.hytale.builtin.hytalegenerator.plugin.md`
  - `../synthborn-basecamp/docs/refs/sdk/com.hypixel.hytale.builtin.hytalegenerator.plugin.editor.md`
  - `../synthborn-basecamp/docs/refs/sdk/com.hypixel.hytale.builtin.hytalegenerator.assets.*.md`
  - `../synthborn-basecamp/docs/refs/sdk/com.hypixel.hytale.builtin.worldgen.modifier*.md`
  - `../synthborn-basecamp/docs/refs/sdk/com.hypixel.hytale.server.core.universe.world.worldgen.provider.md`
  - `../synthborn-basecamp/docs/refs/sdk/com.hypixel.hytale.server.worldgen.loader*.md`
  - `../synthborn-basecamp/docs/refs/sdk/com.hypixel.hytale.server.core.command.commands.world.worldgen.md`
  - `../synthborn-basecamp/docs/refs/sdk/com.hypixel.hytale.builtin.hytalegenerator.commands.md`
- Extracted asset examples:
  - `../synthborn-basecamp/_Assets/Server/HytaleGenerator/`
- Community Google Doc:
  - `Hytale WorldGen V2: Full Documentation and Guide` by Nylaro
  - Source URL: <https://docs.google.com/document/d/1nMQ2DDqC8vzoJtjFelu_LIafKrxjCek6TC8KG6VERbA/edit>
  - Accessed through Google Docs `export?format=txt` on 2026-06-10.

## Official Direction

The official Hytale post says V2 has been in development since 2021, will replace V1 when ready, and is the generator Hytale intends to support going forward. V2 is described as both curated and procedural: designers get high control over terrain, materials, props, zones, and biome transitions while still using procedural systems.

Confirmed from the article:

- V2 supports code mods that plug into vanilla and modded worldgen features.
- Worldgen APIs are intended to work with the node editor.
- The API direction includes multithreaded execution and read access to surrounding world context.
- Creators can edit worldgen directly in a visual node editor.
- Worldgen changes can live-reload in-game.
- Terrain, material providers, props, biomes, and zones are core authoring surfaces.
- Props use placement rules/pattern scanning. The article gives examples such as trees that only spawn above caves and bridges that search for two shores.

## Current SDK Shape

### Runtime Provider Chain

The local SDK points to this rough runtime chain:

```text
IWorldGenProvider
  -> HytaleGenerator HandleProvider
  -> IWorldGen Handle
  -> HytaleGenerator
  -> ChunkRequest / StagedChunkGenerator
  -> GeneratedChunk
```

Key classes from `com.hypixel.hytale.builtin.hytalegenerator.plugin`:

- `HytaleGenerator extends JavaPlugin`
  - `getAssetManager()`
  - `submitChunkRequest(ChunkRequest)`
  - `createStagedChunkGenerator(profile, WorldStructureAsset, SettingsAsset)`
  - `getSpawnPositions(...)`
  - `setup()`
- `HandleProvider implements IWorldGenProvider`
  - holds a `HytaleGenerator`
  - has a `worldStructureName`
  - has an optional `seedOverride`
  - returns a generator through `getGenerator()`
- `Handle implements IWorldGen`
  - exposes `generate(...)`
  - exposes spawn provider/points and timings

The platform-level provider interface is in `com.hypixel.hytale.server.core.universe.world.worldgen.provider`. It has `IWorldGenProvider.CODEC` and `getGenerator()`, with built-in providers such as flat and void worlds also present.

### Asset-Driven Generator

The extracted assets under `Server/HytaleGenerator` strongly suggest Worldgen 2 authoring is asset-first. Important folders:

- `Assignments/` - prop assignment graphs, often biome-specific.
- `Biomes/` - biome root graphs containing terrain, materials, props, runtime/environment, and tint-style logic.
- `BlockMasks/` - reusable block/material masks.
- `Density/` - density/noise/math graphs referenced by other assets.
- `Graphs/` - reusable graph examples.
- `Positions/` - point/position providers.
- `PropDistributions/` - distribution logic for props.
- `Props/` - prop graph definitions.
- `Settings/` - generator settings.
- `WorldStructures/` - high-level biome/world structure selection.

Common JSON/node graph markers:

- `Type`
- `Skip`
- `ExportAs`
- `$Title`
- `$Position`
- `$NodeId`
- `$NodeEditorMetadata`
- `Inputs`

Examples:

- `WorldStructures/Default.json` uses `Type: "NoiseRange"`, `DefaultBiome`, `Density`, and a `Framework` section with spawn positions.
- `WorldStructures/Zone1_Plains1.json` maps density ranges to biome IDs such as `Plains1_Oak`, `Plains1_River`, and `Oceans`.
- `Assignments/Plains1/Plains1_Oak_Trees.json` is a graph using `FieldFunction`, `SimplexNoise2D`, weighted assignments, prefabs, directionality, scanner logic, floor patterns, and material/block masks.
- `Biomes/Examples/Example_Prop.json` and `Example_Runtime.json` show biome root assets containing terrain density, material providers, props, and runtime/environment-style sections.

### Editor And UI Hook

The SDK references include an explicit editor package: `com.hypixel.hytale.builtin.hytalegenerator.plugin.editor`.

Important classes:

- `BiomeEditor`
  - `setupAssets(Config)`
  - `setupViewport(Config, playerRef)`
  - `createAssetFromTemplate(...)`
  - `createWorldGenProvider()`
- `BiomeEditorPage extends InteractiveCustomUIPage<BiomeEditor.Config>`
  - builds a custom UI page
  - handles data events
  - has dropdown helpers
  - has static `open(ref)`
- `AssetPackUtil`
  - `getOrCreatePack(...)`
  - `exportAsset(...)`
  - `getStorePath(...)`

This is the strongest local evidence that worldgen UI is wired through the same Custom UI / interactive page system we are already using for Overseer. The editor appears to create or modify asset-pack JSON/BSON and then configure a viewport/provider so the player can preview changes.

Follow-up SDK search against the current extracted reference strengthens that read:

- `BiomeEditorPage` is an `InteractiveCustomUIPage<BiomeEditor.Config>`, so the visible form UI is a player page collecting a config object.
- `BiomeEditor.setupAssets(config)` and `BiomeEditor.createAssetFromTemplate(...)` are public static helpers. This is likely the cleanest non-UI entry point for an Overseer worldgen bridge.
- `BiomeEditor.setupViewport(config, playerRef)` is public static, so preview setup may be callable without replaying UI events.
- `AssetPackUtil.exportAsset(assetPack, path, bsonDocument, assetClass)` suggests the editor writes BSON/JSON assets into an asset pack, rather than mutating the base asset tree directly.
- `BiomeEditor.createWorldGenProvider()` returns a HytaleGenerator `HandleProvider`, matching the server-side provider path.

Important caveat: SDK search did not show direct public Java classes for every visible node-box label in the node editor, such as `SimplexNoise2D Density` or `CurveMapper Density`. The public SDK does expose asset families (`TerrainAsset`, `MaterialProviderAsset`, `NoiseAsset`, `AssignmentsAsset`, etc.) and runtime objects, but the exact node graph shape still appears to be data/template driven. That means the first Overseer bridge should expose editor/template/asset operations rather than one Lua function per UI node box.

Community docs also say the node editor is accessible in-game from the Content Creation menu, then the asset editor dropdown. They describe opening biome assets from:

```text
/Server/HytaleGenerator/Biomes/
```

### Commands And Reload/Preview

SDK command references show two relevant command groups:

- `com.hypixel.hytale.builtin.hytalegenerator.commands`
  - `WorldGenCommand`
  - `CreateCommand`
  - `ViewportCommand`
- `com.hypixel.hytale.server.core.command.commands.world.worldgen`
  - `WorldGenCommand`
  - `WorldGenReloadCommand`
  - `WorldGenBenchmarkCommand`

Community docs mention `/viewport --radius 5` for a live-reloading preview region, and `/instances spawn <instance>` to visit an instance using a specific generator setup.

Nylaro's community guide adds these command details:

- `/world settings worldgentype set <GeneratorType>`
  - `HytaleGenerator` selects the V2/default HytaleGenerator path.
  - `Default`, `Flat`, and `Void` select V1-style/default alternatives.
- `/worldgen reload --clear`
  - described as reloading all chunks.
- `/viewport --radius <number>`
  - creates a viewport around the player.
  - inside that viewport, WorldGen reloads automatically when changes are made and saved in the
    Asset Node Editor.

Current SDK signatures worth using:

- `HytaleGenerator.get().getAssetManager()`
- `AssetManager.getWorldStructureAsset(name)`
- `AssetManager.getSettingsAsset()`
- `AssetManager.registerReloadListener(...)`
- `HandleProvider.setWorldStructureName(name)`
- `HandleProvider.setSeedOverride(seed)`
- `HandleProvider.getGenerator()`
- `Viewport(bounds, world)`, `Viewport.submitRefresh()`, `Viewport.refresh()`

These make a server-side experimental flow plausible: create/copy assets into a scratch pack, reload, create or point a provider at a named world structure/seed, then refresh a bounded viewport or spawn a preview instance.

Important local observation from `overseer-test`:

- For V2 sampling, the test world must first be put in HytaleGenerator mode with
  `/world settings worldgentype set HytaleGenerator`, then regenerated with
  `/worldgen reload --clear`. Without that, the HytaleGenerator asset stores can load templates
  while the active land sampling path still does not use them.
- Server restart loads the loose `SynthOverseerWorldgen` pack into the general AssetModule and the
  HytaleGenerator asset stores.
- `worldgen_asset_status` confirms promoted Biomes, Assignments, and WorldStructures are active in
  those stores.
- The core `/worldgen reload` log lists only the stock `Hytale:Hytale` pack, even after the loose
  pack loaded at boot.
- Therefore the `WorldGenerator` asset-pack list printed by reload is not a sufficient visibility
  check for HytaleGenerator template assets. Prefer `worldgen_asset_status`; use full server restart
  as the known-good activation path for loose generated packs until we call the editor backend
  directly.

### Terrain Density Model From Nylaro Guide

Nylaro's guide is useful because it explains the mental model behind the visible node boxes:

- Density is evaluated per coordinate `(x, y, z)`.
- Positive density means solid.
- Negative density means empty.
- Zero is generally empty, but the guide notes a special edge case where a `0.0` result may still
  be treated as solid to avoid rare missing columns when the horizontal noise reaches `-1.0`.
- Noise generators such as `SimplexNoise2D Density`, `SimplexNoise3D Density`, `CellNoise2D
  Density`, and `CellNoise3D Density` output values in a typical `-1..1` range.
- `SimplexNoise2D Density` samples only `(x, z)`, so by itself it produces vertical columns unless
  combined with a Y-sensitive density.
- `BaseHeight Density` provides the Y-sensitive term. It outputs `0` at the configured base height,
  then changes by distance above/below that level when `Distance` is enabled.
- `CurveMapper Density` plus `Manual Curve` and `Curve Point` nodes remap the base-height distance
  into terrain density.
- `Sum Density` combines the horizontal noise and vertical/base-height density. The terrain surface
  is where the combined value crosses from solid to empty.
- `Min Density` and `Max Density` combine layers by taking the lower/higher density value per
  coordinate; this is how terrain layers can be intersected or unioned.

Practical implication for Overseer: terrain graph edits should usually target small numeric
parameters on known templates:

- `SimplexNoise2D.Scale`
- `SimplexNoise2D.Seed`
- `SimplexNoise2D.Octaves`
- `SimplexNoise2D.Persistence`
- `SimplexNoise2D.Lacunarity`
- Base-height names/content fields
- curve point `In`/`Out` values

These are safer than inventing new node chains.

### Load Order, Exports, Imports, And Ghost Exports

Nylaro/A.Robot's load-order notes explain several symptoms we are seeing:

- At server start, enabled mods/assets load alphabetically, with Hytale itself always at the
  bottom.
- When two assets or exports conflict, Hytale chooses the highest item in load order that has the
  correct type.
- Assets loaded after startup, such as assets edited and reloaded live, can be placed at the top of
  load order. That order can reset when the world reloads or when the same mod is used elsewhere.
- Any node with `Export As` can be exported. The exported name can then be consumed from another
  graph through an `Imported` node.
- JSON shape for import/export is conceptually:

```json
{ "ExportAs": "Name" }
```

```json
{ "Type": "Imported", "Name": "Name" }
```

- Changing an export name does not necessarily remove the old export immediately. The guide calls
  this a "ghost export": stale exported data can remain until a server reload/restart.

Practical implication for Overseer:

- Use unique generated export names, not generic names like `Base`, `Trees`, or `Density`.
- When cloning template sets, rename all exported/imported references together.
- Avoid changing `ExportAs` names repeatedly in the same live session. Prefer create-new-id,
  promote, restart/preview, then delete old scratch assets later.
- Add future validation that scans a template set for duplicate `ExportAs` values and unresolved
  `{ "Type": "Imported", "Name": ... }` references.

### BaseHeight ContentFields

The Nylaro guide says `BaseHeight Density` references named height fields in a world structure,
typically:

```text
Server/HytaleGenerator/WorldStructures/Default.json
```

The referenced structure has a `ContentFields` list near the end. Entries there define names such
as `Base`; the `BaseHeightName` field on the density node refers to one of those names. The guide
also says the `Distance` checkbox needs to stay enabled for the node to work as intended.

Practical implication: when cloning or creating a world-structure/biome set, verify that every
`BaseHeightName` used in density graphs has a matching `ContentFields` entry in the active
WorldStructure. A biome-only copy can be valid JSON but still visually ineffective if its density
graph expects content fields that the active WorldStructure does not provide.

### Create/Test/Modify/Test Loop

The practical Worldgen 2 loop should be iterative and evidence-driven. Start from known-good
templates, change one thing at a time, preview from a controlled location, then repeat.

```text
choose known-good template set
  -> confirm active worldgen type is HytaleGenerator
  -> if not, run world settings worldgentype set HytaleGenerator
  -> run worldgen reload --clear on disposable terrain
  -> copy/patch into scratch
  -> check JSON and references
  -> promote into a loader-visible asset pack
  -> verify promoted assets with live HytaleGenerator asset-store status
  -> restart server if newly promoted loose-pack assets are not active
  -> run viewport --radius N from an in-game player, or use the editor-backed viewport path
  -> inspect the same seed/location and record observations
  -> tweak exactly one parameter
  -> check, promote, status, preview again
  -> compare against the prior observation
```

Guidance for the loop:

- Use a stable seed and location when comparing variants.
- Treat V2 enablement as a prerequisite. Running
  `world settings worldgentype set HytaleGenerator` plus `worldgen reload --clear` is destructive:
  it regenerates/clears generated terrain and belongs on a disposable test server/save.
- Start with a biome, its assignment/prop assets, and a world structure that actually references
  the biome. A valid biome JSON file alone is not enough to see it in generation.
- Prefer small patches over full rewrites: one density value, one material provider, one assignment
  density, one prop weight, or one transition distance per iteration.
- Treat `viewport` as an in-world regenerated/live-reloaded area around the player, not a separate
  GUI window. The guide says it auto-reloads when Asset Node Editor changes are saved; our current
  generated loose-pack path may need restart or a direct editor/backend call to get that behavior.
- Use the smallest radius that shows the behavior clearly, then increase only when the visual
  change needs broader terrain context.
- Use `worldgen reload --clear` only in disposable test terrain or a throwaway server; clearing can
  regenerate existing loaded chunks and replace builds or edited terrain.
- If a promoted change is not visible, first verify the promoted asset IDs with
  `worldgen_asset_status`, then verify the active world structure references the changed
  biome/assets. Do not rely on the core `WorldGenerator` reload asset-pack list by itself.

### Instance Hook

Community docs show the instance config surface for selecting HytaleGenerator:

```json
{
  "WorldGen": {
    "Type": "HytaleGenerator",
    "WorldStructure": "Basic",
    "playerSpawn": {
      "X": 123,
      "Y": 480,
      "Z": 10000,
      "Pitch": 0,
      "Yaw": 0,
      "Roll": 0
    }
  }
}
```

This matches the SDK-side `HandleProvider` fields (`WorldStructure`, seed override, generator handle). We should verify the exact casing and asset path against a live/known-good instance before generating these ourselves.

### Asset Pack Hook

The local docs say worldgen assets must live inside an asset pack or mod asset pack, and creators should not edit base assets directly. An asset pack can be a folder or zip with a `manifest.json`. Assets created through the in-game Asset Editor currently land under the current world's `mods` folder, while reusable packs should be copied to the user `Mods` folder.

This matters for Overseer-generated worldgen:

- Generated assets should go into a named generated/scratch asset pack, not the base `_Assets` tree.
- The pack must include a manifest.
- New assets should use the expected server asset layout, especially:
  - `/Server/HytaleGenerator/Biomes/`
  - `/Server/HytaleGenerator/WorldStructure/` in the docs, though extracted SDK assets use `WorldStructures/`; this path mismatch needs validation.
  - `/Server/HytaleGenerator/Density/`
  - `/Server/HytaleGenerator/Assignments/`
  - `/Server/Instances/`
- Existing assets can be overridden by placing assets at the same path inside a loaded asset pack.

### Modifier API

The `com.hypixel.hytale.builtin.worldgen.modifier` package looks like a supported asset-driven way to patch existing worldgen content.

Key types:

- `WorldGenModifier`
  - has `id`, `priority`, `target`, and operations.
  - operations are grouped by content type.
- `Target`
  - matches a root and/or rule.
- `EventHandler`
  - loads modifiers from a path.
  - handles `ModifyEvent<T>`.
- `ModifyEvent<T>`
  - exposes seed, content type, source file context, entries, and loader.
- Operations:
  - `AddOp`
  - `RemoveOp`
  - `LogOp`
- Content:
  - `FileContent`
  - typed codec support for block/fluid IDs and ranges.

This may be the safest first modding path for Overseer-created worldgen changes: generate additive/removal modifiers rather than rewriting full biome graphs.

## What Is Confirmed Vs Inferred

Confirmed by local SDK/assets:

- HytaleGenerator has a Java plugin runtime and a provider implementation.
- Worldgen assets are organized under `Server/HytaleGenerator`.
- Extracted examples are JSON graph assets with node-editor metadata.
- There are SDK classes for a Biome Editor custom UI page.
- The Biome Editor has public helpers for asset setup, template creation, viewport setup, and provider creation.
- Asset export is exposed through `AssetPackUtil.exportAsset(...)`.
- There are worldgen reload, benchmark, create, and viewport commands.
- There is a `worldgen.modifier` system for add/remove/log operations over generated content.
- Asset classes expose codecs/builders for major generated asset families such as world structures, terrains, material providers, noise generators, assignments, props, scanners, tints, and environments.

Confirmed by official/community docs:

- V2 is node-editor driven.
- Creator-facing edits are intended to live-reload in-game.
- Biomes, terrain, material providers, props, and zones are primary concepts.
- Instance config can point at `WorldGen.Type = HytaleGenerator` with a named `WorldStructure`.
- `/world settings worldgentype set HytaleGenerator` selects the V2 generator path.
- `/viewport --radius <number>` creates a player-centered preview area and is intended to
  auto-refresh when Asset Node Editor saves changes.
- Load order and exported/imported node names matter; duplicate or stale exports can affect which
  graph is actually used.

Inferred and needs validation:

- `HandleProvider.worldStructureName` is the runtime field behind `WorldStructure` in instance configs.
- The editor page can be opened or reused directly by a mod without hidden permission/context requirements.
- The editor's public helper methods can be called safely from SynthOverseer on the server thread/player context.
- The node editor's visible boxes map cleanly enough to generated JSON fragments that we can produce them without opening the UI.
- Generated JSON with correct codecs and node metadata can be accepted without manually opening the node editor.
- The modifier API is stable enough for first-class Overseer authoring.
- The same viewport auto-refresh behavior applies to our direct Java-generated loose pack files,
  rather than only assets saved through the Asset Node Editor/backend.
- The active default world structure includes the content fields that our cloned biome/density
  graphs expect.

## Public GitHub / Example Status

There are public docs in `HytaleModding/site`, but I did not find many working worldgen plugin repos with real generator assets. The useful public material is mostly documentation and tutorials:

- `HytaleModding/site` contains worldgen technical docs for density, assignments, props, positions, material providers, and block masks.
- The docs link a downloadable example asset pack, but that is hosted on Drive rather than GitHub.
- Search results also show unpacked SDK/server references, but those are mostly mirrors of class/method surfaces, not clean authoring examples.

For practical implementation, the best examples currently appear to be the local extracted `_Assets/Server/HytaleGenerator` tree rather than public GitHub repositories.

## Local Docs Inventory

The local clone has more useful detail than the public tutorial page alone. It contains these Worldgen 2.0 topic files:

- Pack/tutorial:
  - `pack-tutorial/asset-packs.mdx`
  - `worldgen-tutorial/README.mdx`
  - `worldgen-tutorial/density-generation-concepts.mdx`
  - `worldgen-tutorial/materials-generation-concepts.mdx`
  - `worldgen-tutorial/prop-generation-concepts.mdx`
  - `worldgen-tutorial/optimization-wip.mdx`
- Technical HytaleGenerator docs:
  - `assignments.mdx`
  - `block-mask.mdx`
  - `curves.mdx`
  - `density.mdx`
  - `material.mdx`
  - `material-providers.mdx`
  - `patterns.mdx`
  - `positions-provider.mdx`
  - `prop-distributions.mdx`
  - `props.mdx`
  - `scanners.mdx`
  - `vector-provider.mdx`
  - `world-structure.mdx`

The technical docs give a useful node vocabulary for training/retrieval. Examples:

- Assignment nodes: `Constant`, `FieldFunction`, `Sandwich`, `Weighted`, `Imported`.
- Density nodes: `Constant`, `SimplexNoise2D`, `SimplexNoise3D`, `WhiteNoise`, `PositionsCellNoise`, `Distance`, shape nodes, `CurveMapper`, `Mix`, `MultiMix`, `YSampled`, `Cache`, `DistanceToBiomeEdge`, `BaseHeight`, `Imported`, `Exported`.
- Material providers: `Constant`, `Transparent`, `Solidity`, `Queue`, `SimpleHorizontal`, `Striped`, `Weighted`, `FieldFunction`, `SpaceAndDepth`, `Condition`, `Layer`, `Imported`.
- Patterns: `BlockType`, `BlockSet`, `Offset`, `Rotator`, `Floor`, `Ceiling`, `Wall`, `Surface`, `Gap`, `Cuboid`, boolean combinators, `FieldFunction`, `Imported`.
- Positions: grids, jitter, clusters, list, anchor/bound, field function, occurrence, offset, base height, union, cache, imported.
- Props: `Cuboid`, `Manual`, `Locator`, `Orienter`, `Queue`, `Mask`, rotators, density selectors, `Prefab`, `Union`, `Offset`, `Weighted`, `PondFiller`, `Imported`.
- Scanners: `Origin`, `Linear`, `Random`, `Radial`, `Queue`, `Imported`.
- Vector providers: constants, setters, math, random, normalization, projections, density gradient, cache, exported/imported.
- World structure fields: `DefaultBiome`, `Density`, `Biomes`, `DefaultTransitionDistance`, `MaxBiomeEdgeDistance`, `SpawnPositions`, `Framework`.

Nylaro's Google Doc adds beginner-friendly operational vocabulary:

- Commands: `/world settings worldgentype set <GeneratorType>`, `/worldgen reload --clear`,
  `/viewport --radius <number>`.
- Density fundamentals: positive solid, negative empty, `SimplexNoise2D` for `(x,z)` noise,
  `BaseHeight` for Y distance, `CurveMapper`/`Manual Curve`/`Curve Point` to remap height into
  density, `Sum` to combine layers, `Min`/`Max` to intersect/union layers.
- Export/import fundamentals: `ExportAs` publishes a node by name; `Imported` consumes an exported
  node by name; duplicate names resolve by load order; renamed exports can leave stale "ghost"
  exports until reload/restart.

This local doc tree should become the first retrieval source for a future `worldgen.docs(topic)` tool.

## Performance Notes From Local Docs

The optimization page changes how we should think about Overseer-generated worldgen. The generator prints performance reports to logs after configurable sample-size intervals. The docs recommend comparing reports with at least 500 sampled chunks and using the same seed/location when comparing asset changes.

Important stage-cost notes:

- `BiomeStage` is affected by the world structure's biome-map density.
- `BiomeDistanceStage` is affected by `DefaultTransitionDistance` and `MaxBiomeEdgeDistance`.
- `TerrainStage` is affected by biome transition distances, each biome's terrain density, and each biome's material provider.
- `PropStage #` is affected by prop runtimes with the matching index in each biome.
- `TintStage` and `EnvironmentStage` are affected by tint/environment providers.
- Prop output size is currently called out as a major contributor to output-size cost.

Optimization rules worth encoding into Overseer guidance:

- Keep `DefaultTransitionDistance` and `MaxBiomeEdgeDistance` no larger than needed.
- Prefer `Mix` for switching expensive density fields on/off, because unused branches do not need to be calculated the same way as broad `Sum`/`Min`/`Max` compositions.
- Use `YSampled` where full vertical density precision is not visible.
- Use `Cache` nodes where repeated coordinate or position queries make it worthwhile.
- Consider `SingleInstance` on exported density/vector providers when multiple imports should share the same underlying node tree.
- In generated land previews, record seed, player/location, sample count, and changed asset IDs so performance comparisons are meaningful.

## Suggested Overseer Starting Point

### Implemented Slice: Read-Only Template Discovery

First slice implemented in SynthOverseer:

- `worldgen_asset_list`
  - lists HytaleGenerator JSON assets from either an extracted `_Assets` tree or the shipped `Assets.zip`.
  - supports kinds such as `biomes`, `world_structures`, `density`, `assignments`, `props`, `prop_distributions`, `positions`, `settings`, `graphs`, and `block_masks`.
- `worldgen_asset_read`
  - reads one bounded template asset as JSON text.
  - Java owns path resolution and file access; paths are normalized under `Server/HytaleGenerator`.

Worldgen is intentionally no longer exposed through Lua. Lua remains for live game/server scripts;
worldgen should move through direct Java template tools. This read-only slice is intentionally
small. The next slice should add scratch-pack write operations only after verifying the asset
source path on the remote server and confirming the editor/template backend can save generated
assets where HytaleGenerator reload will see them.

First read-only tools:

- `worldgen_asset_list(root?, type?)`
  - list known assets under `Server/HytaleGenerator`.
- `worldgen_asset_read(path_or_id)`
  - return sanitized JSON for a generator asset.
- `worldgen_asset_schema(type)`
  - summarize available SDK asset types and required fields from local examples.

First write tools:

- `worldgen_create_from_template(kind, template_id, new_id, params)`
  - call or mirror `BiomeEditor.createAssetFromTemplate(...)` where practical.
  - this most closely matches what the UI appears to do.
- `worldgen_modifier_create(...)`
  - create additive/removal/log modifier assets, because this is narrower than editing full biome graphs.
- `worldgen_asset_copy_template(template_path, new_id, patch)`
  - copy known-good examples and apply structured patches.
- `worldgen_template_check(json, expected_type)`
  - parse JSON, validate obvious required fields, and optionally call SDK codecs if we can wire them safely.

First run/preview tools:

- `worldgen_reload()`
  - wrapper around the server reload command/API.
- `worldgen_viewport(radius)`
  - wrapper around HytaleGenerator viewport preview or `BiomeEditor.setupViewport(...)`.
- `worldgen_instance_spawn(instance_id)`
  - spawn or join an instance configured with HytaleGenerator.

## Speculation: Template-Driven Worldgen Authoring

The cleaner model is Java/data-driven orchestration for Worldgen 2.0. HytaleGenerator assets are
already templates; Overseer should call high-level template tools, and those tools should create,
patch, validate, reload, and preview worldgen assets.

In that model, the LLM does not write arbitrary generator JSON by default. Instead it calls direct
template tools like:

```text
worldgen_template_clone_set(template_set="Plains1_Oak", new_id="Synthborn_GreenHills")
worldgen_template_patch(path="WorldStructures/Synthborn_GreenHills", patch={...})
worldgen_template_check_set(paths=[...])
worldgen_reload()
worldgen_preview(radius=10)
```

That gives Overseer a tool-backed workflow while keeping validation and file layout inside Java-side
tools. Java remains the guardrail around SDK formats.

### Speculation: Template Tools As A Node-Editor Substitute

The screenshot-style node editor is useful for humans because it makes graph wiring visible. For
the Overseer, the same work is probably better represented as parameterized template operations
over named templates:

```json
{
  "template": "Biomes/Basic",
  "target": "Biomes/Synthborn_Basic",
  "patches": [
    { "op": "set", "path": "/Terrain/Density/Inputs/0/Scale", "value": 500 },
    { "op": "set", "path": "/MaterialProvider/Solid/Queue/0/Material/Solid", "value": "Rock_Stone" }
  ]
}
```

That is not an implementation proposal yet; it is the shape that seems right. The bridge would
translate small structured patch requests into known-good graph JSON/BSON copied from templates.
We should not expose raw arbitrary graph authoring first; we should expose a small set of graph
macros that correspond to examples we have already validated in the live server.

Repeated variation should also be data-driven. Instead of manually placing boxes in a UI graph, the
Overseer can request generated biome variants:

```json
{
  "base_template": "Biomes/Basic",
  "target_prefix": "Biomes/Synthborn_Hills_",
  "variants": [
    { "seed": "A", "base_height": 50, "hill_scale": 500, "material": "Rock_Stone" }
  ]
}
```

The stronger technical bet is: use the same backend surface the UI uses (`BiomeEditor`
setup/template/export/viewport), but present it as compact template operations rather than UI node
manipulation or Lua scripts. That gives us experiment speed without asking the model to invent
brittle asset JSON from scratch.

Possible template tool functions:

- `worldgen_asset_list(kind, prefix)`
  - list known generator assets, such as biomes, world structures, props, positions, assignments, material providers, and density graphs.
- `worldgen_asset_read(path_or_id)`
  - return a decoded/sanitized asset table.
- `worldgen_template_clone(template, new_id)`
  - clone a known-good asset from `_Assets` or the active pack.
- `worldgen_template_patch(id, patch)`
  - apply a structured patch rather than raw string replacement.
- `worldgen_modifier_create(id, target, operations)`
  - create WorldGenModifier assets for add/remove/log operations.
- `worldgen_template_check(id_or_table)`
  - run local structural checks and, if possible, SDK codec validation.
- `worldgen_template_save(id, table)`
  - save only after validation passes.
- `worldgen_reload()`
  - reload worldgen assets.
- `worldgen_preview(radius)`
  - open or refresh a preview viewport.
- `worldgen_instance_spawn(instance_id, world_structure, seed)`
  - test a named world structure in a controlled instance.

### Generating Different Lands

The first useful "land generator" should probably be template-plus-parameter based. The Overseer could choose from a small vocabulary of land archetypes, then fill parameters:

- `green_hills`
  - base terrain template: plains or forest biome.
  - parameters: hill amplitude, tree density, grass material mix, flower density, river frequency.
- `broken_highlands`
  - base terrain template: gorges/deeproot/volcanic-style assets.
  - parameters: cliff frequency, cave exposure, stone material bands, bridge/ruin prop frequency.
- `wetlands`
  - base terrain template: shore/river/ocean blend.
  - parameters: water height, mud/grass mix, reeds/trees, shallow pool frequency.
- `ancient_forest`
  - base terrain template: forest/taiga/boreal assets.
  - parameters: canopy density, old tree prefab weights, moss/leaf ground cover, clearings.
- `void_test_lab`
  - base terrain template: void/flat world.
  - parameters: platform size, block palette, prefab test pads, spawn positions.

The template tools could then run a repeatable sequence from a land spec:

```json
{
  "archetype": "ancient_forest",
  "id": "Synthborn_AncientForest_01",
  "seed": "elderwood-a",
  "tree_density": 0.82,
  "clearing_frequency": 0.15,
  "water": "low_streams",
  "danger": "peaceful"
}
```

Under the hood, `generate_land` should expand into deterministic operations:

1. Pick templates for world structure, biome, density, assignments, and props.
2. Clone templates into a generated asset pack namespace.
3. Patch numeric ranges, prefab weights, material IDs, seeds, and spawn positions.
4. Save generated assets.
5. Validate all referenced asset IDs exist.
6. Reload and open a preview.

This is much more realistic than asking the Overseer to invent full node graphs at first. Once we have enough examples and validation, the Overseer can graduate from parameterized generation to graph composition.

### Training The Overseer Into A Worldgen 2.0 Expert

Yes, we can train the Overseer toward being a Worldgen 2.0 expert, but it should be done as a tool-backed expert, not a memory-only expert. The right pattern is retrieval plus examples plus validators.

Useful training assets:

- A compact worldgen API/reference document generated from SDK references.
- A catalog of known-good assets from `_Assets/Server/HytaleGenerator`.
- A set of named archetype recipes, each with input parameters and generated files.
- A troubleshooting guide for common validation failures.
- A before/after library of generated land specs and screenshots.
- A glossary of node types: density functions, material providers, prop distributions, scanners, positions, assignments, and world structures.

The Overseer should be able to ask its own tools for docs:

```text
worldgen_template_docs(topic="PropDistribution")
worldgen_asset_read(path="Assignments/Plains1/Plains1_Oak_Trees")
worldgen_template_schema(type="WorldStructure")
```

Then it can follow a tool-backed loop:

1. Read relevant docs and examples.
2. Draft a land specification.
3. Generate or patch assets through template tools.
4. Validate references and JSON shape.
5. Preview the land.
6. Summarize what changed and what to inspect in-game.

This gives us a feedback loop: every successful generated land becomes a new example the Overseer can retrieve later. Every failed validation becomes a rule or test.

### Safety Modes

The template bridge could expose worldgen work in modes:

- `read_only`
  - list/read/docs/schema only.
- `scratch_pack`
  - write generated assets only into a temporary/generated pack namespace.
- `preview`
  - write, reload, and spawn preview instances, but do not alter live/default instances.
- `commit`
  - promote generated assets into a named project pack.
- `yolo`
  - allow broad edits, direct patches, and live reloads after logging a full diff.

For now, `scratch_pack` plus `preview` is probably the right default. It gives the Overseer freedom to experiment without corrupting base assets.

### Main Risk

The main risk is pretending that Worldgen 2.0 is just JSON generation. The extracted files are node graphs backed by SDK codecs, asset maps, references, and editor metadata. A naive text patch can easily create valid JSON that is invalid worldgen.

The bridge should therefore prefer:

- template cloning over blank generation.
- structured patching over raw text editing.
- SDK codec validation where possible.
- reference checks before save.
- preview instances before promotion.

## Open Questions

- Where exactly are instance assets stored in our current project/server layout?
- Can our plugin call the HytaleGenerator create/viewport/reload logic directly, or should we route through commands?
- Can we access SDK codecs at runtime to validate generated asset JSON before saving it?
- Does the node editor require `$NodeEditorMetadata`, or are runtime fields enough?
- How does live reload behave with assets produced by a running server plugin?
- Are worldgen modifier assets loaded from normal asset packs, mod data, or a dedicated modifier path?
- What is the minimum valid worldgen asset pack we can generate and visit?

## Next Experiments

1. Locate a live `Server/Instances` asset in the current server/mod pack and confirm `WorldGen.Type = HytaleGenerator`.
2. Run or inspect `/worldgen reload`, `/viewport --radius 10`, and any HytaleGenerator create commands on `macbook-server`.
3. Build a tiny copied-template asset pack from local `_Assets` examples.
4. Try a non-destructive modifier asset first, ideally `LogOp`, to confirm load paths and targets.
5. Add read-only Overseer tools to list/read worldgen assets before adding write tools.
6. Add a validator that checks JSON shape locally, then investigate SDK codec validation.
