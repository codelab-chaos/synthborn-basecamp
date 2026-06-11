# Worldgen V2 LLM Accessibility Tools

This folder contains helper tooling for reading and editing Hytale worldgen V2 assets from outside the visual node editor. The goal is to give Codex and the Overseer compact projections of large JSON graphs, especially curves, provider imports/exports, noise knobs, materials, and props.

## Tool

```bash
node worldgenV2/tools/worldgen-inspect.js --help
```

Primary commands:

- `inspect <asset.json>`: write a compact Markdown summary of a biome or world structure.
- `validate <asset.json>`: report obvious missing local imports introduced by grafting.
- `plot-curves <asset.json>`: render every `ManualCurve` as SVG.
- `patch-curve <asset.json>`: replace one curve by index.
- `generate-hybrid`: copy a base biome and graft selected top-level systems from another biome.
- `generate-worldstructure`: create a minimal `NoiseRange` world structure for a default biome.
- `generate-stitch-worldstructure`: create a `NoiseRange` world structure that routes density bands to multiple biome names.
- `apply-template`: run one JSON template file.

## Command Reference

### `inspect`

```bash
node worldgenV2/tools/worldgen-inspect.js inspect <asset.json> \
  [--out <summary.md>] \
  [--curves-dir <dir>]
```

Use this first on any unfamiliar biome or world structure. It extracts provider counts, imports, exports, noise knobs, curve points, material summaries, prop summaries, and validation notes. With `--curves-dir`, every manual curve is rendered as an SVG.

### `validate`

```bash
node worldgenV2/tools/worldgen-inspect.js validate <asset.json>
```

Use this after generating or grafting assets. It is intentionally shallow: it catches obvious missing local provider imports, especially imports introduced from a graft source that are not exported in the generated asset. It does not replace Hytale's real asset loader.

### `plot-curves`

```bash
node worldgenV2/tools/worldgen-inspect.js plot-curves <asset.json> \
  --out-dir <dir>
```

Use this when curves are the main question and a full Markdown summary is unnecessary.

### `patch-curve`

```bash
node worldgenV2/tools/worldgen-inspect.js patch-curve <asset.json> \
  --index <n> \
  --points <in:out,in:out,...> \
  --out <asset.json>
```

Use this to make one curve edit without manually walking the JSON graph. Curve indexes come from `inspect`.

### `generate-hybrid`

```bash
node worldgenV2/tools/worldgen-inspect.js generate-hybrid \
  --base <biome.json> \
  --graft <biome.json> \
  --name <BiomeName> \
  --out <biome.json> \
  [--take props,material,tint,environment]
```

Use this for controlled graft experiments. The command preserves the base graph and replaces only selected top-level systems from the graft graph. Treat output as experimental until `validate` and live Hytale loading pass.

### `generate-worldstructure`

```bash
node worldgenV2/tools/worldgen-inspect.js generate-worldstructure \
  --default-biome <BiomeName> \
  --out <worldstructure.json> \
  [--spawn-y <y>]
```

Use this to create a minimal single-biome test world structure.

### `generate-stitch-worldstructure`

```bash
node worldgenV2/tools/worldgen-inspect.js generate-stitch-worldstructure \
  --biomes <BiomeA,BiomeB,...> \
  --default-biome <BiomeName> \
  --out <worldstructure.json>
```

Use this for whole-biome stitching. It divides the `-1..1` selector range evenly across the listed biome names. The input density is still `Imported: Biome-Map`, so the active framework/world structure must provide that field.

### `apply-template`

```bash
node worldgenV2/tools/worldgen-inspect.js apply-template <template.json>
```

Use this to rerun repeatable experiments from `worldgenV2/templates`.

## Files Left For Codex

- `worldgenV2/tools/worldgen-inspect.js`: one-file Node CLI, no package install required.
- `worldgenV2/templates/forested-mountains.template.json`: conservative hybrid experiment.
- `worldgenV2/templates/forested-mountains-worldstructure.template.json`: matching minimal world structure.
- `worldgenV2/templates/basicforest-mountains-stitch.template.json`: starter whole-biome stitch template.
- `worldgenV2/summaries/`: generated Markdown/SVG projections for LLM inspection.
- `worldgenV2/generated/`: generated assets. Treat as drafts until promoted and tested in Hytale.

## BasicForest Reverse-Engineering Loop

```bash
node worldgenV2/tools/worldgen-inspect.js inspect \
  _Assets/Server/HytaleGenerator/Biomes/Experimental/BasicForest.json \
  --out worldgenV2/summaries/BasicForest.md \
  --curves-dir worldgenV2/summaries/BasicForest-curves
```

This produces:

- provider counts
- exported provider names
- imported provider names
- Simplex/Cell noise knobs
- curve point lists
- SVG curve previews
- material and prop summaries

## Forested Mountains Experiment

Generate a first hybrid biome:

```bash
node worldgenV2/tools/worldgen-inspect.js apply-template \
  worldgenV2/templates/forested-mountains.template.json
```

Generate a matching minimal world structure:

```bash
node worldgenV2/tools/worldgen-inspect.js apply-template \
  worldgenV2/templates/forested-mountains-worldstructure.template.json
```

The starter hybrid keeps `Mountains` terrain and grafts only the `BasicForest` environment provider. That is intentionally conservative. A naive prop/material/tint graft currently orphans BasicForest terrain-mask imports such as `BasicForestTerrain`, so tree/feature grafting needs a dependency-aware merge instead of a blind top-level replacement.

Check any generated asset before promoting it:

```bash
node worldgenV2/tools/worldgen-inspect.js validate \
  worldgenV2/generated/Biomes/Experimental/MountainForestAtmosphere.json
```

## Biome Stitching

Whole-biome stitching belongs in a world structure, not inside a biome file. The vanilla pattern is `Type: "NoiseRange"` with `Biomes` entries that map density ranges to biome names.

```bash
node worldgenV2/tools/worldgen-inspect.js generate-stitch-worldstructure \
  --biomes Basic,Mountains \
  --default-biome Basic \
  --out worldgenV2/generated/WorldStructures/BasicMountainsStitch.json
```

The template `basicforest-mountains-stitch.template.json` is intentionally conservative because both experimental files currently declare `Name: "Basic"`. Once we copy/rename the biome assets into the trial addon with distinct loadable names, the stitch template should use those final asset names.

## Curve Editing

List curve indexes:

```bash
node worldgenV2/tools/worldgen-inspect.js inspect path/to/Biome.json
```

Patch a curve:

```bash
node worldgenV2/tools/worldgen-inspect.js patch-curve \
  path/to/Biome.json \
  --index 0 \
  --points "-50:1,180:-1" \
  --out path/to/Biome.patched.json
```

## Notes

- These tools do not prove an asset will load in Hytale. They make the assets easier to understand and edit.
- Generated assets still need the normal worldgen test loop: copy/promote into an addon, restart or reload as required, clear generated world data, then inspect in-game.
- JSON graph shape is preserved. The tools avoid rewriting unrelated graph nodes unless a command explicitly generates or patches an asset.
