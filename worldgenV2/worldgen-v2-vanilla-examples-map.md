# Worldgen V2 Vanilla Examples Map

This document maps the vanilla Worldgen V2 examples in `_Assets` and records
what we can learn by reading their data before we take screenshots.

Vanilla root:

```text
/home/chadneff/git/hytale-mods/synthborn-basecamp/_Assets/Server/HytaleGenerator
```

## What Exists

There are four useful categories for learning:

```text
Biomes/Basic.json
Biomes/Examples/*.json
Biomes/Experimental/*.json
Biomes/Generative/*.json
```

There are also world structure examples:

```text
WorldStructures/Basic.json
WorldStructures/Default.json
WorldStructures/Default_Flat.json
WorldStructures/Default_Void.json
WorldStructures/Dev/Interpolation.json
WorldStructures/Test_Features.json
```

## Sampler Instances

Sampler instances were generated into the trial addon:

```text
C:\Users\ccnef\AppData\Roaming\Hytale\UserData\Saves\worldgen-v2-trial\mods\Codelab.World-Gen-Test-01
```

WSL path:

```text
/mnt/c/Users/ccnef/AppData/Roaming/Hytale/UserData/Saves/worldgen-v2-trial/mods/Codelab.World-Gen-Test-01
```

Generated files:

```text
Server/HytaleGenerator/WorldStructures/Sample_<BiomeAsset>.json
Server/Instances/WG2_<Category>_<BiomeAsset>/instance.bson
Server/Instances/WG2_SAMPLER_INDEX.json
```

Each sampler world structure is a copy of vanilla `WorldStructures/Basic.json`
with only `DefaultBiome` changed to the target vanilla biome asset id. Each
sampler instance is a copy of vanilla `Server/Instances/Basic/instance.bson`
with `WorldGen.WorldStructure` changed to the matching sample structure.

This is the best first sampling method because it avoids editing one active
instance repeatedly. Use `/instances`, spawn a sampler, inspect it, capture a
screenshot, then move to the next sampler.

## Snapshot Workflow

For each sampler:

1. Spawn the instance from `/instances`.
2. Set stable lighting:

```text
/weather set Zone1_Sunny
/time stop
/time noon
```

3. If changes or reload testing are needed:

```text
/viewport --radius 5
```

4. Capture a screenshot.
5. Save it beside or under a future screenshot folder with the instance name in
   the filename.
6. Record whether the visual matches the expected density/material/prop shape.

Suggested screenshot names:

```text
WG2_Example_Example_CellNoise2D.png
WG2_Experimental_BasicForest.png
WG2_Generative_Generative_Arches.png
```

## Explicit Example Biomes

These are the most tutorial-like vanilla assets and should be sampled first.

| Source | Asset Id | Root Name | Terrain Density | Props | What To Learn |
| --- | --- | --- | --- | ---: | --- |
| `Biomes/Examples/Example_CellNoise2D.json` | `Example_CellNoise2D` | `Hills` | `Sum` | 0 | 2D cell noise terrain. |
| `Biomes/Examples/Example_Curve_Mapper.json` | `Example_Curve_Mapper` | `Basic` | `Sum` | 0 | BaseHeight plus curve remap. |
| `Biomes/Examples/Example_Curve_Remapping.json` | `Example_Curve_Remapping` | `Hills` | `Sum` | 0 | Curve remapping for terrain shaping. |
| `Biomes/Examples/Example_Fluid.json` | `Example_Fluid` | `Hills` | `Sum` | 1 | Fluid/material interaction plus one prop layer. |
| `Biomes/Examples/Example_Mixer.json` | `Example_Mixer` | `Hills` | `Sum` | 0 | Basic terrain mixing. |
| `Biomes/Examples/Example_Mixer_Gradient.json` | `Example_Mixer_Gradient` | `Basic` | `YSampled` | 0 | Y-sampled gradient mixing. |
| `Biomes/Examples/Example_Multi_Mixer_Curve.json` | `Example_Multi_Mixer_Curve` | `Hills` | `Max` | 0 | Multi-mixer with curved combination. |
| `Biomes/Examples/Example_Multi_Mixer_Horizontal.json` | `Example_Multi_Mixer_Horizontal` | `Hills` | `Max` | 0 | Horizontal multi-mixer behavior. |
| `Biomes/Examples/Example_Prop.json` | `Example_Prop` | `Hills` | `Sum` | 1 | Minimal prop placement. |
| `Biomes/Examples/Example_Runtime.json` | `Example_Runtime` | `Hills` | `Sum` | 3 | Runtime-gated prop layers. |
| `Biomes/Examples/Example_Twist_Crater.json` | `Example_Twist_Crater` | `Twister` | `Exported` | 0 | Exported density and twist/crater shaping. |
| `Biomes/Examples/Fake3dNoise.json` | `Fake3dNoise` | `Fake3dNoise` | `Multiplier` | 0 | Fake 3D noise construction. |
| `Biomes/Examples/Interpolation_A.json` | `Interpolation_A` | `Interpolation_A` | `Sum` | 0 | Interpolation pair A. |
| `Biomes/Examples/Interpolation_B.json` | `Interpolation_B` | `Interpolation_B` | `CurveMapper` | 0 | Interpolation pair B. |
| `Biomes/Examples/Runtime_Defect.json` | `Runtime_Defect` | `Runtime Defect` | `Offset` | 2 | Runtime and density-delimited providers. |
| `Biomes/Examples/SingleInstance_Test.json` | `SingleInstance_Test` | `SingleInstance_Test` | `Offset` | 0 | Single-instance test shape. |
| `Biomes/Examples/VectorProvider.json` | `VectorProvider` | `VectorProvider` | `Max` | 0 | Vector provider terrain behavior. |

## Baseline And Test Biomes

| Source | Asset Id | Root Name | Terrain Density | Props | What To Learn |
| --- | --- | --- | --- | ---: | --- |
| `Biomes/Basic.json` | `Basic` | `Basic` | `Sum` | 1 | Baseline: stone hills plus dirt cuboid props. |
| `Biomes/Test_Features.json` | `Test_Features` | `Basic` | `Max` | 0 | Feature test terrain. |

## Experimental Biomes

These are less tutorial-clean but useful as real examples of more complex
composition.

| Source | Asset Id | Root Name | Terrain Density | Props | What To Learn |
| --- | --- | --- | --- | ---: | --- |
| `Biomes/Experimental/Arches.json` | `Arches` | `Hills` | `Multiplier` | 0 | Terrain arches from density multiplication. |
| `Biomes/Experimental/BasicForest.json` | `BasicForest` | `Basic` | `Mix` | 11 | Dense forest prop stack and tinting. |
| `Biomes/Experimental/CursebreakerKeyartBiome.json` | `CursebreakerKeyartBiome` | `Basic` | `Mix` | 0 | Key-art style terrain mix. |
| `Biomes/Experimental/Dunes.json` | `Dunes` | `Basic` | `Mix` | 1 | Dune terrain with one prop layer. |
| `Biomes/Experimental/ForestRivers.json` | `ForestRivers` | `Hills` | `Mix` | 5 | River terrain with forest props. |
| `Biomes/Experimental/Glacial1_Mountains.json` | `Glacial1_Mountains` | `Basic` | `Mix` | 0 | Glacial mountain shaping. |
| `Biomes/Experimental/Glacial1_River.json` | `Glacial1_River` | `Hills` | `Mix` | 0 | Glacial river shaping. |
| `Biomes/Experimental/Islands_Roots.json` | `Islands_Roots` | `Basic` | `Max` | 0 | Island/root density composition. |
| `Biomes/Experimental/Mountains.json` | `Mountains` | `Basic` | `Min` | 2 | Mountain subtraction/intersection behavior. |
| `Biomes/Experimental/Plateaus.json` | `Plateaus` | `Hills` | `Mix` | 0 | Plateau shaping. |
| `Biomes/Experimental/Reefs.json` | `Reefs` | `Basic` | `Max` | 0 | Reef terrain composition. |
| `Biomes/Experimental/Rotten_Pumpkin.json` | `Rotten_Pumpkin` | `Basic` | `Max` | 0 | Novel/organic terrain shape. |
| `Biomes/Experimental/ScifiBlockLandscape.json` | `ScifiBlockLandscape` | `ScifiBlockLandscape` | `Max` | 0 | Blocky sci-fi terrain. |
| `Biomes/Experimental/Something.json` | `Something` | `Hills` | `Amplitude` | 0 | Amplitude modifier behavior. |
| `Biomes/Experimental/Taiga1_Redwood_2dCliffs.json` | `Taiga1_Redwood_2dCliffs` | `Hills` | `Multiplier` | 9 | Cliff terrain plus redwood-style props. |
| `Biomes/Experimental/Zone4.json` | `Zone4` | `Zone4` | `Min` | 17 | Large prop stack and zone-like composition. |

## Generative Biomes

These are high-value examples for procedural landmarks and structures.

| Source | Asset Id | Root Name | Terrain Density | Material Provider | Props | What To Learn |
| --- | --- | --- | --- | --- | ---: | --- |
| `Biomes/Generative/Generaitve_Boulders_Sandstone.json` | `Generaitve_Boulders_Sandstone` | `Basic` | `Max` | `Solidity` | 1 | Sandstone boulder generation. |
| `Biomes/Generative/Generative_Arches.json` | `Generative_Arches` | `Basic` | `Rotator` | `Queue` | 6 | Rotated procedural arches and prop stack. |
| `Biomes/Generative/Generative_Boulders_Chalk.json` | `Generative_Boulders_Chalk` | `Basic` | `Max` | `Solidity` | 0 | Chalk boulder terrain. |
| `Biomes/Generative/Generative_Buildings.json` | `Generative_Buildings` | `Basic` | `Max` | `Queue` | 0 | Procedural building-like terrain/material queues. |
| `Biomes/Generative/Generative_Pillars_Marble_Large.json` | `Generative_Pillars_Marble_Large` | `Basic` | `SmoothMin` | `Solidity` | 0 | Large marble pillars. |
| `Biomes/Generative/Generative_Pillars_Marble_Small.json` | `Generative_Pillars_Marble_Small` | `Basic` | `SmoothMin` | `Solidity` | 0 | Small marble pillars. |
| `Biomes/Generative/Generative_Ruins.json` | `Generative_Ruins` | `Basic` | `SmoothMin` | `Queue` | 0 | Ruin-like density/material composition. |
| `Biomes/Generative/Generative_Veins.json` | `Generative_Veins` | `Basic` | `SmoothMin` | `Queue` | 0 | Vein generation. |

## First Sampling Order

Use this order to build intuition without jumping straight into the hard cases:

1. `WG2_Basic`
2. `WG2_Example_Example_Curve_Mapper`
3. `WG2_Example_Example_CellNoise2D`
4. `WG2_Example_Example_Prop`
5. `WG2_Example_Example_Runtime`
6. `WG2_Example_Example_Mixer`
7. `WG2_Example_Example_Multi_Mixer_Horizontal`
8. `WG2_Generative_Generative_Arches`
9. `WG2_Experimental_BasicForest`
10. `WG2_Experimental_Mountains`

## Open Questions

- Does `DefaultBiome` resolve by asset id only, or can it require namespace/path
  in some conflict cases?
- Do nested world-structure folders change asset id resolution? The sampler uses
  flat `WorldStructures/Sample_<BiomeAsset>.json` files to avoid that question.
- Which vanilla example assets require additional exported densities or framework
  entries beyond the copied Basic world structure?
- Which examples are visually useful at spawn with seed `a`, and which need a
  different seed, spawn position, or viewport radius?
