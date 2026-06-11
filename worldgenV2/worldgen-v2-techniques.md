# Worldgen V2 Techniques

This document captures reusable terrain-generation techniques for Hytale Worldgen V2. It separates facts observed in local Hytale assets from transferable voxel-worldgen patterns learned from the local Minecraft worldgen repos in `/home/chadneff/git/mc-worldgen`.

## Current Confidence

We know enough to document techniques and build targeted experiments. We do not yet know enough to claim exact one-to-one translations for every Minecraft density function into Hytale nodes.

Known Hytale facts:

- An instance uses `WorldGen.Type = "HytaleGenerator"` and points at a named `WorldStructure`.
- A `WorldStructure` can be `Type: "NoiseRange"` and route density ranges to biome names.
- A biome contains provider graphs for terrain density, materials, props, environment, and tint.
- Hytale Worldgen V2 graphs expose familiar operations: noise, normalization, curve mapping, mixing, min/max, constants, imports, exports, base height, and assignments.
- Many useful systems are dependency-linked through `ExportAs` and `Imported` provider names. Blindly grafting top-level systems between biomes can orphan imports.

Useful Minecraft-derived ideas:

- Treat terrain as layered density composition.
- Use low-frequency selectors to choose regions/landforms.
- Use splines/curves to map abstract climate or region values into height, roughness, jaggedness, and features.
- Use masks to gate local details, caves, rivers, structures, and vegetation.
- Cache 2D signals when the value does not depend on Y.
- Validate structure placement by sampling a footprint grid and rejecting high height variance.

## Mental Model

Think of a worldgen graph as four layers:

1. Region selection: broad spatial identity such as continent, island, mountain belt, forest, basin, river corridor.
2. Terrain shaping: base height, roughness, jaggedness, erosion, caves, rivers, and special landforms.
3. Surface/material selection: grass, stone, sand, snow, fluids, cliffs, topsoil, strata.
4. Feature placement: trees, rocks, bushes, structures, mobs, and decorative details.

In Hytale terms, region selection usually belongs in `WorldStructure` or imported density fields. Terrain shaping belongs in `Biome.Terrain.Density`. Surface/material selection belongs in `MaterialProvider` and tint/environment providers. Feature placement belongs in `Props` and assignments.

## Technique: Biome Stitching With A WorldStructure

Use this when we want distinct biome identities side-by-side.

Pattern:

```json
{
  "Type": "NoiseRange",
  "Biomes": [
    { "Biome": "ForestBiome", "Min": -1.0, "Max": 0.0 },
    { "Biome": "MountainBiome", "Min": 0.0, "Max": 1.0 }
  ],
  "DefaultBiome": "ForestBiome",
  "Density": {
    "Type": "Imported",
    "Name": "Biome-Map"
  }
}
```

Practical notes:

- Use low-frequency noise for `Biome-Map` so regions are large enough to notice.
- Keep `DefaultTransitionDistance` and `MaxBiomeEdgeDistance` nonzero for softer boundaries.
- Avoid stitching two assets with identical internal `Name` values until we prove Hytale asset resolution uses the file path rather than only the `Name` field.
- This is the cleaner first pass for “BasicForest + Mountains” than splicing biome internals.

## Technique: Hybrid Biome By Dependency-Aware Grafting

Use this when we want one biome identity with borrowed behavior, such as forested mountains.

Safe graft order:

1. Start from the biome that owns terrain shape.
2. Copy only one subsystem at a time.
3. Inspect imports introduced by that subsystem.
4. Copy every provider needed by those imports, or replace the imported references with equivalent local signals.
5. Validate and test.

Observed failure:

- Copying BasicForest props/material/tint onto Mountains imports BasicForest-specific masks such as `BasicForestTerrain` and `BasicForestRiverMask`.
- Without those exported providers, the graph may parse but cannot behave correctly.

Better approach:

- For a first forested mountain, start from `Mountains`.
- Add a new tree-placement mask driven by slope/elevation/noise rather than copying all BasicForest props.
- Use mountain terrain exports already present in the base biome.
- Add forest props in bands: lower slopes dense, high slopes sparse, cliffs none.

## Technique: Region Selectors

Minecraft Tectonic uses low-frequency signals like continent selectors, island selectors, region selectors, and terrain splines. The transferable design is to create named 2D fields:

- `RegionSelector`: chooses broad landform families.
- `HeightMultiplier`: scales vertical drama region by region.
- `Erosion`: smooth versus rugged terrain.
- `Ridges`: mountain ridge presence.
- `Vegetation`: lush versus sparse feature density.
- `Temperature`: environment/tint/snow/rain selection.

In Hytale, create these as exported density providers and import them wherever needed.

Example Hytale-oriented naming:

```text
Synth_RegionSelector
Synth_MountainRidges
Synth_Erosion
Synth_Vegetation
Synth_Wetness
Synth_RiverMask
```

The important rule is to name shared fields deliberately. An LLM can reason about `Synth_RiverMask` much better than a random exported name.

## Technique: Curves As Knobs

Curves are one of the best control surfaces for an LLM because they compress behavior into ordered points.

Common uses:

- Convert elevation to terrain density.
- Convert ridge noise to mountain height.
- Convert wetness to river/shore material selection.
- Convert slope to cliff exposure.
- Convert biome selector to blend weights.

Useful curve shapes:

- Gate: flat zero, quick ramp, flat one.
- Band-pass: zero outside a range, one inside.
- Falloff: one near center, smoothly to zero at edge.
- Terrace: repeated steps or alternating values.
- Inversion: high input becomes low output.

Codex workflow:

```bash
node worldgenV2/tools/worldgen-inspect.js inspect path/to/Biome.json \
  --out worldgenV2/summaries/Biome.md \
  --curves-dir worldgenV2/summaries/Biome-curves
```

Then patch one curve at a time and re-test.

## Technique: Mountains

Transferable patterns from Tectonic:

- Combine base terrain with a ridge field.
- Add detail/noise-shifted ridges for less regular mountain chains.
- Use a weathering mask to soften or break up hard ridges.
- Scale height by region, not globally.
- Gate mountain effects by continent/region selector so mountains do not cover the entire world.

Hytale experiment:

- Start from vanilla `Mountains.json`.
- Identify exported mountain terrain providers.
- Add a low-frequency `MountainBeltMask`.
- Multiply ridge height by `MountainBeltMask`.
- Add a weathering curve that reduces ridge contribution on noisy patches.

## Technique: Rivers

Transferable patterns from Hybrid Beta and Underground Rivers:

- Use a river corridor selector, not random local carving.
- Gate rivers by Y/elevation so they create traversable cuts rather than full-world damage.
- Combine continent, erosion, and ridge constraints to avoid implausible placement.
- Use separate signals for river presence, river bed depth, river width, and river decoration.

Hytale experiment:

```text
RiverMask = low-frequency band-pass over ridge/region noise
RiverDepth = curve(RiverMask)
RiverBank = widened falloff around RiverMask
MaterialProvider uses RiverMask for water/shore material
Props use RiverBank for reeds, rocks, bushes
```

Underground-river idea:

- Gate by Y range.
- Gate by continent/erosion/ridge ranges.
- Subtract a tube-like density field from terrain.
- Add separate pillars/roof sharpness/noise fields for cave character.

## Technique: Caves

Transferable patterns:

- Compose multiple cave types with min/max/addition rather than one universal cave noise.
- Use Y gates for cave bands.
- Use separate cheese/noodle/spaghetti/pillar fields.
- Use a depth cutoff so surface terrain remains stable.

Hytale experiment:

- Add caves as a separate density term in `Terrain.Density`.
- Use `Min` or subtractive density patterns to carve voids.
- Gate by `BaseHeight` or Y-derived curves.
- Keep first tests conservative and visible from spawn.

## Technique: Dunes And Patterned Landforms

Tectonic dune files use shifted noise and offset fields to create directional, layered shapes.

Transferable pattern:

- Base dune mask chooses the region.
- Offset X/Z fields perturb the sample position.
- A curve maps the combined signal into height.
- A region spline gates the final effect.

Hytale experiment:

- Build `DuneRegionMask`.
- Build `DuneStripeNoise`.
- Curve-map stripe noise into gentle height offsets.
- Use material provider to switch surface to sand inside the mask.

## Technique: Vegetation And Feature Density

Hybrid Beta uses configured/placed features with count distributions and filters. Hytale props/assignments can use the same design ideas:

- Use different masks for trees, bushes, flowers, leaf piles, and fallen branches.
- Use slope and water-depth filters where available.
- Use elevation bands for tree species changes.
- Use clamped-normal or weighted random selection for natural variation.
- Keep feature density independent from terrain height unless a deliberate visual relationship is wanted.

Hytale forested mountain approach:

```text
TreeMask = VegetationNoise * lower_slope_band * not_cliff_mask
RockMask = ridge_or_cliff_mask * sparse_noise
FlowerMask = low_slope_open_area_mask * small_noise
```

## Technique: Structure Placement Validation

The improved village placement repo uses a grid spawn condition:

- sample a radius
- check heightmap-relative variance
- reject placement if too many sampled points are outside an allowed height range

This maps directly to Synthborn’s village planner.

Recommended village resolver:

```text
input: center, radius, building_count, density, min_spacing, max_slope, footprint sizes
sample: height grid + obstruction grid
score: flatness, openness, distance, path connectivity, scenic value
output: labeled lots, path anchors, lightpost anchors, rejected candidates
```

For “redo that village but bigger,” store:

- original center
- radius
- seed
- density
- lot labels
- marker registry id
- undo id

Then rerun with adjusted params and the same center/seed unless the user asks for a new location.

## Technique: Named Intermediate Providers

Minecraft datapacks often split complex graphs into many small named files. Hytale graph assets can do a similar thing through `ExportAs` and `Imported`.

For LLM accessibility, prefer named intermediate exports:

```text
Synth_BaseTerrain
Synth_MountainMask
Synth_RiverMask
Synth_CliffMask
Synth_TreeMask
Synth_SurfaceWetness
```

Avoid random names and avoid giant anonymous subgraphs when a value is conceptually reusable.

## Technique: Small Test Worlds

Every technique should have a tiny test instance:

- one biome
- one world structure
- one obvious knob
- spawn near the visible result
- preview screenshot
- summary markdown from `worldgen-inspect`

Suggested experiments:

1. `WG2_Technique_CurveHill`: one curve controls hill height.
2. `WG2_Technique_RidgeMountains`: ridge mask creates mountain belts.
3. `WG2_Technique_BiomeStitch`: world structure blends two biome names.
4. `WG2_Technique_RiverMask`: visible river corridor with bank materials.
5. `WG2_Technique_VillageFit`: planner rejects/accepts lots by terrain sample.

## Translation Table

| Minecraft concept | Hytale V2 concept | Confidence |
| --- | --- | --- |
| density function | density provider graph | High |
| spline | `CurveMapper` / manual curve | Medium-high |
| noise router | named exported/imported providers | Medium |
| climate parameters | region/biome selector densities | Medium |
| biome source | `WorldStructure` biome routing | Medium |
| placed feature | `Props` / assignments | Medium |
| structure spawn condition | placement resolver / future worldgen structure rules | Medium |
| surface rules | `MaterialProvider` / tint / environment providers | Medium |
| aquifer/river carving | fluid/material + density masks | Low-medium |

## Immediate Recommendations

- Build summaries for every vanilla Hytale experimental biome.
- Add an import/export dependency graph to `worldgen-inspect`.
- Add a curve catalog view that groups curves by nearby provider type.
- Create one known-good copied biome with a distinct `Name`.
- Prove a two-biome `NoiseRange` stitch with distinct names.
- Only after that, attempt dependency-aware forested mountain grafting.

