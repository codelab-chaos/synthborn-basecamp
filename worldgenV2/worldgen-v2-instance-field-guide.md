# Worldgen V2 Instance Field Guide

This document is for proven setup, test, and iteration knowledge for Hytale
Worldgen V2 instances. Keep speculative design notes in
`worldgen-2-research.md`; keep this file focused on repeatable facts and
field-tested workflow.

## Current Test Case

Local trial mod:

`C:\Users\ccnef\AppData\Roaming\Hytale\UserData\Saves\worldgen-v2-trial\mods\Codelab.World-Gen-Test-01`

WSL path:

`/mnt/c/Users/ccnef/AppData/Roaming/Hytale/UserData/Saves/worldgen-v2-trial/mods/Codelab.World-Gen-Test-01`

Files observed:

```text
manifest.json
Server/HytaleGenerator/Biomes/MyBasicBiome.json
Server/HytaleGenerator/WorldStructures/MyWorldStructure.json
Server/Instances/MyInstance/instance.bson
Server/Instances/MyInstance/instance-snapshot.png
```

The screenshot confirms the custom instance generates rolling stone terrain with
regular dirt cuboid props. That matches the copied `Basic` biome structure:
stone terrain plus a cuboid prop distribution using dirt.

## Source Basic Instance

Source folder:

`/home/chadneff/git/hytale-mods/synthborn-basecamp/_Assets/Server/Instances/Basic`

Files:

```text
instance.bson
resources/BlockCounter.json
resources/BlockMapMarkers.json
resources/ChunkStorage.json
resources/InstanceData.json
resources/PrefabEditSession.json
resources/ReputationData.json
resources/SharedUserMapMarkers.json
resources/SpawnSuppressionController.json
resources/Time.json
```

The important part of `Basic/instance.bson` is:

```json
"WorldGen": {
  "Type": "HytaleGenerator",
  "WorldStructure": "Basic",
  "SeedOverride": "a"
}
```

The trial instance changed only the world structure reference:

```json
"WorldGen": {
  "Type": "HytaleGenerator",
  "WorldStructure": "MyWorldStructure",
  "SeedOverride": "a"
}
```

This is the minimal instance hook: an instance selects Worldgen V2 by setting
`WorldGen.Type` to `HytaleGenerator`, then points at a world structure asset by
name.

## Minimal Asset Chain

The working chain is:

```text
Server/Instances/MyInstance/instance.bson
  -> WorldGen.Type = HytaleGenerator
  -> WorldGen.WorldStructure = MyWorldStructure

Server/HytaleGenerator/WorldStructures/MyWorldStructure.json
  -> DefaultBiome = MyBasicBiome
  -> Framework exports Base, Water, Bedrock decimal constants
  -> Framework exports Spawns positions

Server/HytaleGenerator/Biomes/MyBasicBiome.json
  -> Terrain.Density uses BaseHeight(Base)
  -> MaterialProvider outputs Rock_Stone for solid and Empty for empty
  -> Props place dirt cuboids with a floor scanner
```

Observed source paths use `WorldStructures` plural. Some community docs refer to
`WorldStructure` singular as an asset type label, but the extracted asset folder
and the trial mod both use:

```text
Server/HytaleGenerator/WorldStructures/
```

Use the plural folder unless a future live test proves otherwise.

## How To Create A New Instance

Use a disposable creative world for experiments.

1. Create or choose a mod asset pack under the world's `mods` folder.
2. Create these folders in the mod if they do not exist:

```text
Server/HytaleGenerator/Biomes/
Server/HytaleGenerator/WorldStructures/
Server/Instances/<InstanceName>/
```

3. Copy the stock biome:

```text
_Assets/Server/HytaleGenerator/Biomes/Basic.json
  -> Server/HytaleGenerator/Biomes/<BiomeName>.json
```

4. Edit the copied biome root `Name` to match the file/asset name.

Example:

```json
"Name": "MyBasicBiome"
```

The current trial file is named `MyBasicBiome.json` but its `Name` says
`MyBasicBoime`. The instance still has a visual snapshot, so this typo may not
block generation. Still, treat mismatched `Name` values as a bug until proven
irrelevant.

5. Copy the stock world structure:

```text
_Assets/Server/HytaleGenerator/WorldStructures/Basic.json
  -> Server/HytaleGenerator/WorldStructures/<WorldStructureName>.json
```

6. Edit the copied world structure:

```json
"DefaultBiome": "<BiomeName>"
```

7. Copy the stock Basic instance:

```text
_Assets/Server/Instances/Basic/instance.bson
  -> Server/Instances/<InstanceName>/instance.bson
```

8. Edit the instance:

```json
"WorldGen": {
  "Type": "HytaleGenerator",
  "WorldStructure": "<WorldStructureName>",
  "SeedOverride": "a"
}
```

9. In game, run `/instances`, choose the mod instance, and spawn it.

## Required World Setup

For direct world testing, the active world must use Worldgen V2:

```text
/world settings worldgentype set HytaleGenerator
/worldgen reload --clear
```

`/worldgen reload --clear` destroys/regenerates terrain. Use only on disposable
test worlds or after an explicit confirmation.

Patch 5 prerelease notes from the StrawberryGS guide say this setup can be
created with:

```text
/worldgen2 create
```

Treat that as version-dependent. For the 0.5.4 style workflow, the manual
`world settings worldgentype set HytaleGenerator` plus copied instance/assets
path is confirmed by the trial mod structure.

## Preview And Iteration Loop

The repeatable loop:

1. Spawn into the custom instance.
2. Set stable viewing conditions:

```text
/weather set Zone1_Sunny
/time stop
/time noon
```

Patchline 5 may use `/time pause` instead of `/time stop`.

3. Start a viewport near the area being inspected:

```text
/viewport --radius 5
```

The viewport is an in-world live-reload region around the player. It is not a UI
window. Changes saved in the Asset Node Editor should regenerate inside that
radius.

4. Open the Asset Node Editor from Creative Tools (`B`) and open:

```text
Server/HytaleGenerator/Biomes/<BiomeName>.json
```

5. Make one small change.
6. Save.
7. Observe the viewport.
8. If the viewport does not update, try:

```text
/worldgen reload --clear
```

9. If a previously working file stops behaving, restart with a fresh copied
world or restore a known-good file. Community notes warn that chunk corruption
or stale generated state can make valid files appear broken.

## Save Discipline

When a biome or world structure produces a known-good visual result, copy it to
a versioned backup outside the active `mods` folder, or save it under a new name
and update the world structure reference.

Avoid leaving many variant files in the same active asset folder with the same
root `Name`, same `ExportAs`, or same imported names. Load order and ghost
exports can hide what the generator is actually using.

## Load Order And Export Names

From the Nylaro guide:

- Hytale loads enabled mods in alphabetic order, with Hytale itself at the
  bottom.
- If two assets/exports conflict by name, the asset higher in load order wins.
- Reloaded assets can temporarily sit at the top of load order.
- Changing an `ExportAs` name can leave a stale "ghost export" until reload or
  restart.

Practical rule: use unique names for every generated biome, world structure,
export, and import in experiments. Do not use generic export names like
`Base`, `Trees`, or `Density` except where the structure explicitly expects
framework constants such as `Base`.

## Basic Terrain Language

The Basic biome terrain is:

```text
Terrain
  DAOTerrain
    Density
      Sum
        SimplexNoise2D
        CurveMapper
          Manual curve
            point In 0 Out 1
            point In 50 Out -1
          BaseHeight(Base, Distance true)
```

Rules confirmed by guide and matching JSON:

- Density is evaluated at `(x, y, z)`.
- Positive density creates solid terrain.
- Negative or zero density generally creates air.
- `SimplexNoise2D` samples only `(x, z)`, so it adds horizontal variation.
- `BaseHeight` supplies the Y-aware distance term.
- `BaseHeightName: "Base"` refers to the `Framework` decimal constant named
  `Base` in the active world structure.
- `CurveMapper` remaps the BaseHeight distance through `Manual` curve points.
- `Sum` adds the noise and height terms, producing the final terrain cutoff.

The Basic world structure defines:

```json
{
  "Type": "DecimalConstants",
  "Entries": [
    { "Name": "Base", "Value": 100 },
    { "Name": "Water", "Value": 100 },
    { "Name": "Bedrock", "Value": 0 }
  ]
}
```

If a biome uses `BaseHeightName: "Base"` and the world structure does not export
`Base`, terrain behavior is suspect.

## Basic Material Language

The Basic biome material provider is:

```text
MaterialProvider
  Solidity
    Solid
      Queue
        Constant Material Solid = Rock_Stone
    Empty
      Queue
        Constant Material Solid = Empty
```

Practical rule: preserve the `Empty` material branch when editing from Basic.
It is marked `REQUIRED` in the copied asset.

## Basic Prop Language

The Basic biome prop distribution creates the visible dirt cuboids:

```text
Props[0]
  Runtime 0
  Constant PropDistribution
    Positions
      Scaler Scale X=25 Y=10 Z=25
        Jitter2d Magnitude=0.7
          TriangularGrid2d
    Prop
      Locator PlacementCap=1
        Cuboid Bounds [-2,0,-2] to [3,3,3]
        Material Soil_Dirt
        Pattern Floor
        Scanner Linear Y descending Range 100..200
```

Visual result in `instance-snapshot.png`: repeated dirt cuboids scattered across
stone hills. This provides a good first experiment surface because changes to
material, scale, bounds, or scanner range should be obvious.

## Safe First Experiments

Use one change at a time.

Terrain:

- Change `SimplexNoise2D.Scale` from `150` to a smaller value to make terrain
  variation tighter.
- Change `SimplexNoise2D.Octaves` from `1` to `2` or `3` for more detail.
- Change world structure `Base` from `100` to `120` to lift the terrain band.

Materials:

- Change solid terrain `Rock_Stone` to another known block.
- Change the cuboid prop material `Soil_Dirt` to a loud block to prove prop
  editing.

Props:

- Change cuboid bounds to make props taller or smaller.
- Change `Scaler.Scale.X/Z` to adjust spacing between prop attempts.
- Change `Jitter2d.Magnitude` to reduce or increase grid randomness.

After each working change, save a copy.

## Known Sharp Edges

- `WorldStructures` folder is plural in local assets and in the trial mod.
- The current trial biome root `Name` has a typo: `MyBasicBoime`.
- `manifest.json` in the trial mod has `"IncludesAssetPack": false` even
  though the mod contains assets. Do not assume that flag must be true until a
  live load test proves it.
- `/worldgen reload --clear` is destructive.
- Viewport radius values are in generated area radius around the player; small
  radius values such as `2` or `5` can be hard to notice in a large landscape.
- Asset editor/template nodes may behave differently by patchline. StrawberryGS
  notes say Patch 5 prerelease users should delete the template portion created
  by `/worldgen2 create` before editing, or changes may fail to load.

## Experiment Journal Format

Append timeless discoveries here or in a sibling dated lab note using this
format:

```text
Date:
Patchline:
World/save:
Mod:
Instance:
Changed file:
Change:
Command sequence:
Observed result:
Kept as known-good? yes/no
Open question:
```

## Primary References Checked

- Local Basic instance:
  `_Assets/Server/Instances/Basic/instance.bson`
- Local Basic generator assets:
  `_Assets/Server/HytaleGenerator/Biomes/Basic.json`
  `_Assets/Server/HytaleGenerator/WorldStructures/Basic.json`
- Trial mod:
  `worldgen-v2-trial/mods/Codelab.World-Gen-Test-01`
- Local community docs clone:
  `docs/external/hytale-modding-site/content/docs/en/official-documentation/worldgen/`
- Nylaro Google Doc export:
  `Hytale WorldGen V2`
- StrawberryGS Google Doc export:
  `The Very Basics - patch 4 / World Gen v2 How To`
