# Worldgen V2 Lab Test Loop

This document describes the preferred setup for rapidly testing Hytale Worldgen V2 experiments with a tight feedback loop. It is intended to become the blueprint for future automation and Overseer tools.

For low-level instance facts, see `worldgen-v2-instance-field-guide.md`. For techniques and design patterns, see `worldgen-v2-techniques.md`.

## Goal

Create a disposable, repeatable worldgen lab where we can:

- generate candidate biome/world-structure assets outside Hytale
- promote them into a trial addon
- restart/reload/clear safely
- inspect the result in-game
- record screenshots, logs, summaries, and observations
- iterate one variable at a time

The lab should be isolated from the normal Overseer gameplay server. Worldgen experiments are destructive by nature, especially when using `/worldgen reload --clear`.

## Recommended Server Shape

Use a dedicated disposable world:

```text
worldgen-v2-lab
```

Use a dedicated trial addon/mod:

```text
Codelab.World-Gen-Lab
```

Do not mix this with the normal Synthborn Overseer mod or the normal Overseer test world. The lab can crash, clear terrain, or load broken worldgen assets without damaging active gameplay work.

Suggested Windows path:

```text
C:\Users\ccnef\AppData\Roaming\Hytale\UserData\Saves\worldgen-v2-lab\mods\Codelab.World-Gen-Lab
```

Suggested WSL path:

```text
/mnt/c/Users/ccnef/AppData/Roaming/Hytale/UserData/Saves/worldgen-v2-lab/mods/Codelab.World-Gen-Lab
```

## Asset Layout

Inside the lab addon:

```text
Server/
  HytaleGenerator/
    Biomes/
    WorldStructures/
  Instances/
```

Inside basecamp:

```text
worldgenV2/
  generated/
    Biomes/
    WorldStructures/
    Instances/
  experiments/
  summaries/
  templates/
  tools/
```

Basecamp is the source/workbench. The lab addon is the promoted runtime copy.

## Naming

One experiment should have one stable name and versioned outputs.

Examples:

```text
WG2_HillyShardField_v001
WG2_HillyShardField_v002
WG2_BasicMountainsStitch_v001
WG2_RiverMask_v001
```

Use the same stem for:

```text
Biome:          HillyShardField_v001
WorldStructure: HillyShardField_v001
Instance:       WG2_HillyShardField_v001
Experiment dir: worldgenV2/experiments/WG2_HillyShardField_v001/
```

Avoid spaces. Avoid two different biome files with the same root `Name` until asset resolution is fully proven.

## Experiment Folder

Each experiment should produce an audit trail:

```text
worldgenV2/experiments/WG2_HillyShardField_v001/
  source/
    Biomes/
    WorldStructures/
    Instances/
  promoted/
    Biomes/
    WorldStructures/
    Instances/
  screenshots/
  logs/
  summary.md
  observations.md
  result.json
```

`source/` contains generated or hand-authored drafts. `promoted/` captures exactly what was copied into the lab addon. `result.json` should be machine-readable so later tools can compare versions.

## Required World Setup

The lab world must be configured for Worldgen V2:

```text
/world settings worldgentype set HytaleGenerator
```

After asset changes, destructive regeneration uses:

```text
/worldgen reload --clear
```

This clears/regenerates terrain. Any future tool that runs it must require explicit confirmation unless the caller is already operating inside a known disposable lab world.

## Manual Test Loop

Use this loop before automating.

1. Define the experiment.

```text
name: WG2_HillyShardField_v001
seed: a
goal: rolling hills with sparse 2x2 cobble and marble shards
```

2. Generate or edit source assets in basecamp.

```bash
node worldgenV2/tools/worldgen-inspect.js inspect <biome.json> \
  --out worldgenV2/experiments/WG2_HillyShardField_v001/summary.md \
  --curves-dir worldgenV2/experiments/WG2_HillyShardField_v001/curves
```

3. Validate generated JSON.

```bash
node worldgenV2/tools/worldgen-inspect.js validate <biome.json>
```

4. Promote assets into the lab addon.

Copy only the files needed for this experiment:

```text
Biomes/<BiomeName>.json
WorldStructures/<WorldStructureName>.json
Instances/<InstanceName>/instance.bson
```

5. Restart or reload so Hytale sees the promoted assets.

If files were created after the server started, prefer a full restart first. If Hytale already knows the assets and only values changed, live reload may be enough, but this needs case-by-case validation.

6. Ensure the world is Worldgen V2.

```text
/world settings worldgentype set HytaleGenerator
```

7. Clear/regenerate the lab world.

```text
/worldgen reload --clear
```

8. Spawn or enter the target instance.

Use `/instances` and choose the experiment instance.

9. Stabilize viewing conditions.

```text
/weather set Zone1_Sunny
/time noon
/time stop
```

If `/time stop` is not valid on the current build, use the current equivalent.

10. Inspect from fixed locations.

Use the same seed, same spawn, same travel route, and same screenshot angles when comparing versions.

11. Record observations.

Update:

```text
observations.md
result.json
screenshots/
logs/
```

12. Patch one variable and repeat.

Avoid changing terrain, material, props, and world structure routing all at once. One variable per iteration is slower up front but produces reusable knowledge.

## Feedback Record

Every experiment should record:

```json
{
  "name": "WG2_HillyShardField_v001",
  "seed": "a",
  "status": "loaded",
  "worldgenType": "HytaleGenerator",
  "biome": "HillyShardField_v001",
  "worldStructure": "HillyShardField_v001",
  "instance": "WG2_HillyShardField_v001",
  "commands": [
    "/world settings worldgentype set HytaleGenerator",
    "/worldgen reload --clear"
  ],
  "observations": [
    "hills visible within 100 blocks of spawn",
    "shards too dense",
    "marble shards readable but too tall"
  ],
  "nextChange": "reduce shard mask density by 50 percent"
}
```

## Automation Target

Eventually we want one command:

```bash
node worldgenV2/tools/worldgen-lab.js run WG2_HillyShardField_v001
```

Expected responsibilities:

- resolve experiment folder
- validate required files exist
- inspect/summarize biome and world structure assets
- copy/promote files into the lab addon
- snapshot promoted files into `experiments/<name>/promoted`
- restart or signal reload
- print exact in-game commands needed
- collect latest server/client logs after failure
- write or update `result.json`

Do not start with full autonomy. First make the tool print the steps. Then add `--apply`. Then add destructive `--reload-clear` only after guardrails exist.

## Future Overseer Tools

The Overseer should eventually get high-level worldgen lab tools, not raw broad file access.

Suggested tools:

- `worldgen_lab_create_experiment`
- `worldgen_lab_inspect_asset`
- `worldgen_lab_validate_asset`
- `worldgen_lab_promote`
- `worldgen_lab_restart`
- `worldgen_lab_reload_clear`
- `worldgen_lab_record_observation`
- `worldgen_lab_compare_versions`
- `worldgen_lab_collect_logs`

`worldgen_lab_reload_clear` must require confirmation because it destroys/regenerates world data.

## Safety Rules

- Run destructive worldgen tests only in a disposable lab world.
- Require confirmation before `/worldgen reload --clear`.
- Keep lab addon assets separate from normal gameplay assets.
- Snapshot promoted assets before testing.
- Keep versioned experiment names.
- Capture logs after crashes before restarting again.
- Prefer one changed variable per iteration.
- Treat generated assets as drafts until they load and produce the expected visual result.

## Applying This To HillyShardField

Target:

```text
rolling hills with sparse 2x2 cobble and marble shards
```

Likely asset chain:

```text
Instance WG2_HillyShardField_v001
  -> WorldStructure HillyShardField_v001
    -> DefaultBiome HillyShardField_v001
      -> Terrain: smooth rolling hills
      -> MaterialProvider: grass/dirt/stone
      -> Props: sparse shard features
```

First version should keep scope narrow:

- one biome
- one world structure
- one instance
- seed `a`
- hills visible near spawn
- shard density intentionally obvious

Then iterate:

1. terrain hill shape
2. shard placement mask
3. cobble/marble ratio
4. shard height/rotation variants
5. material polish

## Open Questions

- Does Hytale require a full restart for newly created worldgen assets, or can live reload discover new assets in all cases?
- Does asset resolution use file path, root `Name`, or both?
- What is the best Hytale-native representation for small generated shard features: prefab assignment, mesh prop, cuboid prop, or block/material provider?
- Can the lab tool safely drive Hytale commands, or should it only print commands for manual execution at first?
- Which screenshots/log files can be collected automatically from the local client/server after a failed load?

