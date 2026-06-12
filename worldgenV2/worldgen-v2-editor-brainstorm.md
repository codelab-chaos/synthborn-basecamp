# Worldgen V2 Editor Brainstorm

This document sketches a web-based editor/workbench for Hytale Worldgen V2. The goal is not to clone Hytale's internal node editor first. The goal is to create an LLM-friendly, versioned, testable control surface for worldgen experiments.

Related docs:

- `worldgen-v2-lab-test-loop.md` - lab server/test workflow
- `worldgen-v2-llm-accessibility.md` - current CLI tools
- `worldgen-v2-techniques.md` - worldgen design techniques
- `worldgen-v2-instance-field-guide.md` - instance setup facts

## Problem

Hytale's internal Worldgen V2 node editor is powerful, but it is not ideal for our workflow:

- visual node graphs are difficult for an LLM to inspect directly
- screenshots are useful but incomplete
- raw JSON is too large and noisy
- experimenting requires careful asset promotion, reloads, and destructive clears
- repeatability/versioning is outside the editor
- curves, imports, exports, and dependencies need better summaries
- a node editor encourages local graph manipulation when we often want high-level terrain intent

The better path is a web workbench that exposes higher-level editing surfaces, validates generated assets, and keeps the lab loop organized.

## Product Goal

Build a local Worldgen Lab Web App that can:

- browse Hytale worldgen assets
- summarize large JSON graphs
- edit safe high-level controls
- visualize and patch curves
- show import/export dependencies
- generate templates for common terrain patterns
- promote assets into a disposable lab addon
- track experiments and observations
- compare versions
- optionally command or guide the lab server reload loop

The editor should make worldgen assets easier for both humans and Codex/Overseer.

## Core Principle

Do not start with a giant freeform node-canvas editor.

Start with projections:

```text
Raw Hytale JSON
  -> summary model
  -> curves/noise/materials/props panels
  -> safe patch operations
  -> generated draft asset
  -> validate/promote/test loop
```

Node graphs can come later, and should initially be read-only or grouped by subsystem.

## Suggested Architecture

```text
Browser UI
  -> local web/backend server
    -> reads basecamp/worldgenV2
    -> reads vanilla _Assets
    -> writes experiments/generated assets
    -> validates import/export dependencies
    -> generates summaries and curve previews
    -> promotes files into lab addon
    -> optionally invokes restart/reload helpers
```

Backend responsibilities:

- filesystem access
- JSON parsing/writing
- worldgen summaries
- dependency checks
- experiment records
- promotion snapshots
- optional Hytale command/restart integration

Frontend responsibilities:

- dashboard
- asset browser
- curve/noise controls
- diff/validation display
- experiment notes
- screenshot/log viewing
- terrain preview hooks

## Data Model

### Experiment

```json
{
  "id": "WG2_HillyShardField_v001",
  "goal": "rolling hills with sparse 2x2 cobble and marble shards",
  "seed": "a",
  "status": "draft",
  "biome": "HillyShardField_v001",
  "worldStructure": "HillyShardField_v001",
  "instance": "WG2_HillyShardField_v001",
  "createdAt": "2026-06-11T00:00:00Z",
  "lastPromotedAt": null,
  "observations": [],
  "nextChange": null
}
```

### Asset Summary

```json
{
  "path": "Server/HytaleGenerator/Biomes/HillyShardField_v001.json",
  "assetName": "HillyShardField_v001",
  "kind": "Biome",
  "topLevel": ["Terrain", "MaterialProvider", "Props", "EnvironmentProvider", "TintProvider"],
  "exports": ["Synth_BaseTerrain", "Synth_TreeMask"],
  "imports": ["Base", "Water", "Bedrock"],
  "noiseKnobs": [],
  "curves": [],
  "validation": []
}
```

### Patch

```json
{
  "type": "curve_patch",
  "asset": "Biomes/HillyShardField_v001.json",
  "curveIndex": 2,
  "points": [
    [0, 1],
    [40, -1]
  ]
}
```

Patches should be recorded, not just applied, so we can explain how a version changed.

## MVP Screens

### 1. Experiment Dashboard

Shows:

- experiment name
- goal
- status: draft, validated, promoted, loaded, crashed, rejected
- linked biome/worldstructure/instance
- last screenshot
- last observation
- next suggested change

Actions:

- create experiment
- duplicate experiment as next version
- inspect
- validate
- promote
- record observation
- compare to previous version

### 2. Asset Browser

Shows:

- vanilla `_Assets/Server/HytaleGenerator`
- basecamp `worldgenV2/generated`
- experiment `source`
- promoted lab addon copy

Useful filters:

- Biomes
- WorldStructures
- Instances
- assets with curves
- assets with validation warnings
- assets with missing imports

### 3. Biome Summary Panel

Shows:

- root `Name`
- terrain provider root
- material provider root
- prop count
- environment/tint providers
- provider counts
- imports/exports
- validation results

This should be the primary LLM-readable projection.

### 4. Curve Editor

Features:

- list all curves
- render curve graph
- edit point table
- add/remove points
- patch by index
- preview before/after
- save patch

Avoid freehand curve editing at first. Tables are easier to diff and easier for Codex to reason about.

### 5. Noise Knob Editor

Shows every obvious noise node:

- type
- path
- scale
- octaves
- lacunarity
- persistence
- seed

Actions:

- patch one value
- duplicate seed
- generate named knobs
- compare to previous version

### 6. Dependency View

Shows import/export graph:

```text
Imported BasicForestTerrain
  -> missing in generated asset
  -> introduced by grafted Props
```

This is critical. Blind biome grafting fails when it introduces orphaned imports.

### 7. Template Panel

First templates:

- copy biome with new name
- create minimal world structure
- create stitch world structure
- create rolling hills biome
- create sparse prop mask
- create hilly shard field
- create forested mountain experiment

The UI should expose high-level fields and generate repeatable JSON.

### 8. Lab Runner Panel

Shows:

- lab world path
- lab addon path
- promoted files
- required commands
- destructive command confirmation
- latest logs

At first it can print commands. Later it can execute them when guardrails are strong enough.

## Phased Build Plan

### Phase 0: Current CLI Baseline

Already started:

- `worldgen-inspect.js inspect`
- `validate`
- `plot-curves`
- `patch-curve`
- `generate-hybrid`
- `generate-worldstructure`
- `generate-stitch-worldstructure`
- `apply-template`

Keep this CLI even if we build a web app. The web app should call the same core logic or share its modules.

### Phase 1: Read-Only Web Workbench

Build:

- dashboard over `worldgenV2/experiments`
- asset browser
- summary rendering
- curve SVG display
- import/export validation display

No write operations yet.

Why:

- low risk
- proves the app shape
- immediately useful for Codex and human inspection

### Phase 2: Safe Patch Editing

Add:

- curve table editor
- noise knob editor
- root name/default biome edits
- save as new version
- patch log

Rules:

- never overwrite vanilla assets
- write into `worldgenV2/experiments/<id>/source`
- each save creates a patch record

### Phase 3: Template Generation

Add high-level generators:

- HillyShardField
- RollingHills
- BasicMountainsStitch
- RiverMask
- VillageFitTest

The UI should create a complete experiment folder with source assets and a starter summary.

### Phase 4: Promotion

Add:

- promote selected experiment assets to lab addon
- snapshot promoted files
- validate before promotion
- warn on destructive steps

Do not run `/worldgen reload --clear` automatically yet.

### Phase 5: Lab Command Integration

Add:

- restart lab server
- collect logs
- print or dispatch Hytale commands
- require explicit confirmation for clear/regenerate

`/worldgen reload --clear` should be guarded by:

- lab world detection
- experiment selected
- exact files promoted
- typed or button confirmation

### Phase 6: Terrain Preview

Options:

- use Terrascape's terrain rendering after Hytale generates chunks
- show screenshots collected from manual runs
- eventually render a cheap approximate preview from density samples if we can evaluate graphs outside Hytale

The first real preview should be generated terrain, not an invented approximation.

## Standalone App Approach

Standalone app means a separate local Node/TypeScript web app under basecamp or a new repo.

### Benefits

- simple ownership
- fast iteration
- no Hytale plugin lifecycle dependency
- can run when the game/server is closed
- can freely read/write basecamp files
- can start as a pure workbench around existing CLI scripts
- easier for Codex to modify without touching Terrascape gameplay rendering

### Costs

- no built-in live terrain view
- separate server/process/URL
- must duplicate any useful UI components
- promotion/reload integration must be built separately
- harder to connect to live entity/player context

### Best Use

Use standalone first if the goal is asset authoring and experiment management.

Good first deliverable:

```text
worldgenV2/web/
  backend server
  experiment dashboard
  asset summaries
  curve editor
  validation
```

This is probably the lowest-risk MVP.

## Terrascape Integration Approach

Terrascape already has:

- a Hytale plugin
- a bundled web app
- Three.js rendering
- terrain/map APIs
- world selection
- performance tooling
- server/client deployment workflow

That makes it a strong candidate for the visual side of the Worldgen Lab.

### Integration Ideas

Add a `Worldgen Lab` mode or route to Terrascape:

```text
http://127.0.0.1:5960/worldgen-lab
```

Possible panels:

- experiment list
- generated terrain viewport
- selected biome/worldstructure summary
- curve/noise editor
- promote/reload controls
- logs/observations

Terrascape could show generated terrain after the lab world is regenerated, using its existing chunk/GLB/map pipeline.

### Benefits

- real terrain visualization in the same app
- existing Three.js camera/navigation
- existing world/chunk APIs
- can compare worldgen output spatially
- can overlay planned markers, sample points, shard placements, village lots, or biome regions
- can reuse performance/log workflows
- more natural long-term home for "world view + worldgen experiment"

### Costs

- tighter coupling to a Hytale server/plugin
- more risk to Terrascape's current purpose as a viewer
- write/destructive operations inside a live plugin need strong guardrails
- harder to use when Hytale is not running
- asset authoring filesystem access may not belong in the plugin server
- UI complexity could bloat the terrain viewer

### Best Use

Use Terrascape for preview, inspection, overlays, and live feedback after the standalone authoring model is proven.

Do not make Terrascape the only editor until the asset workflow is stable.

## Hybrid Approach

The strongest long-term approach is split responsibility:

```text
Worldgen Lab backend / standalone app
  -> owns assets, experiments, validation, promotion

Terrascape
  -> owns 3D terrain preview, overlays, screenshots, world inspection
```

Integration points:

- Worldgen Lab writes experiment metadata.
- Terrascape reads experiment metadata and shows overlays.
- Terrascape exposes terrain screenshots or camera bookmarks.
- Worldgen Lab links to Terrascape preview URLs.
- Both use the same experiment id.

Example:

```text
Worldgen Lab:
  create WG2_HillyShardField_v003
  promote assets
  record expected inspection points

Terrascape:
  open /worldgen-lab/WG2_HillyShardField_v003
  show generated terrain
  overlay sample points/shard masks/village lots
  capture screenshot
```

This keeps authoring and destructive operations separate from visualization.

## Solo Versus Terrascape Contrast

| Question | Standalone Worldgen Lab | Terrascape Integration |
| --- | --- | --- |
| Fastest MVP | Yes | Medium |
| Needs Hytale running | No, for authoring | Yes, for useful preview |
| Best at asset editing | Yes | Possible but not ideal first |
| Best at terrain preview | No | Yes |
| Lowest risk to existing tools | Yes | No |
| Best long-term visual workflow | Medium | Yes |
| Best for destructive safeguards | Easier to isolate | Needs careful plugin guards |
| Best for Codex edits | Simple web/backend code | More existing context to respect |
| Best for operator experience | Good | Excellent if integrated well |

Recommended path:

1. Build standalone authoring/workbench first.
2. Keep the backend API clean.
3. Add a Terrascape preview route later.
4. Share experiment metadata between both.
5. Only add destructive server commands after the lab world detection and confirmation flow is proven.

## LLM-Friendly Design Rules

- Prefer named controls over anonymous graph nodes.
- Store summaries beside assets.
- Store patch logs.
- Make every generated asset diffable.
- Make every experiment versioned.
- Show import/export warnings before save/promote.
- Group graph nodes by subsystem: terrain, material, props, tint, environment.
- Make curves editable as tables and previews.
- Avoid one giant all-powerful node canvas until core workflows are proven.

## Example: Hilly Shard Field UI

High-level form:

```text
Name: HillyShardField_v001
Seed: a

Terrain:
  hill scale: 500
  hill height: 0.35
  roughness: 0.12
  base height: 100

Shards:
  cobble density: sparse
  marble density: rare
  footprint: 2x2
  min height: 3
  max height: 7
  avoid steep slopes: true
```

Generated assets:

```text
Biomes/HillyShardField_v001.json
WorldStructures/HillyShardField_v001.json
Instances/WG2_HillyShardField_v001/instance.bson
```

Generated summaries:

```text
experiments/WG2_HillyShardField_v001/summary.md
experiments/WG2_HillyShardField_v001/result.json
```

## Backend API Sketch

```text
GET  /api/worldgen/experiments
POST /api/worldgen/experiments
GET  /api/worldgen/experiments/:id
POST /api/worldgen/experiments/:id/inspect
POST /api/worldgen/experiments/:id/validate
POST /api/worldgen/experiments/:id/patch
POST /api/worldgen/experiments/:id/promote
POST /api/worldgen/experiments/:id/observe
GET  /api/worldgen/assets
GET  /api/worldgen/assets/summary?path=...
GET  /api/worldgen/assets/curves?path=...
```

Dangerous endpoints should require additional confirmation:

```text
POST /api/worldgen/lab/reload-clear
POST /api/worldgen/lab/restart
```

## Open Questions

- Should the first web app live in `synthborn-basecamp/worldgenV2/web` or a separate repo?
- Can the existing `worldgen-inspect.js` be split into reusable modules for the backend?
- How much filesystem write access should a Terrascape-hosted editor have?
- Can Terrascape preview generated-but-not-yet-promoted assets, or only generated terrain after Hytale loads them?
- What is the safest command bridge for `/worldgen reload --clear`?
- Can we collect screenshots automatically from Terrascape rather than relying on manual captures?
- Should Overseer call this web backend directly as tools, or should it stay one layer removed through curated worldgen lab tools?

## Recommended Next Step

Build a read-only standalone MVP:

```text
worldgenV2/web
  experiment list
  asset browser
  biome summary
  curve previews
  validation display
```

Then connect Terrascape only for preview links and screenshots. Once this is stable, decide whether the editor should remain standalone, move into Terrascape, or keep the hybrid split.

