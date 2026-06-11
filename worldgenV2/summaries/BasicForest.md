# BasicForest.json

- Path: `_Assets/Server/HytaleGenerator/Biomes/Experimental/BasicForest.json`
- Asset name: `Basic`
- Root type: `[ROOT] Biome`

## Top-Level

- `Name`
- `Terrain`: DAOTerrain
- `MaterialProvider`: Solidity
- `Props`
- `EnvironmentProvider`: Constant
- `TintProvider`: DensityDelimited

## Provider Counts

- Imported: 60
- Constant: 26
- FieldFunction: 20
- SimplexNoise2D: 13
- Column: 11
- Mesh: 11
- Mesh2D: 11
- Static: 11
- Normalizer: 10
- Weighted: 10
- AmplitudeConstant: 8
- Sum: 8
- Manual: 7
- Exported: 6
- Mix: 6
- Angle: 5
- BaseHeight: 5
- CurveMapper: 5
- Scale: 5
- Inverter: 4
- Abs: 3
- AlwaysTrueCondition: 3
- DensityDelimited: 3
- Prefab: 3
- Queue: 3
- Random: 3
- SpaceAndDepth: 3
- Union: 3
- Cache: 2
- Cluster: 2
- ConstantThickness: 2
- DensityGradient: 2
- SimpleHorizontal: 2
- ColumnLinear: 1
- DAOTerrain: 1
- RangeThickness: 1
- Solidity: 1

## Exports

- `567567567675567`
- `BasicForestBase`
- `BasicForestBaseTerrain`
- `BasicForestErosion`
- `BasicForestLeafPiles`
- `BasicForestRiverMask`
- `BasicForestSticks`
- `BasicForestTerrain`
- `BasicForestTreeMask`
- `BasicForestTreeScanner`

## Imports

- `567567567675567`
- `BasicForestBase`
- `BasicForestBaseTerrain`
- `BasicForestErosion`
- `BasicForestLeafPiles`
- `BasicForestRiverMask`
- `BasicForestSticks`
- `BasicForestTerrain`
- `BasicForestTreeMask`
- `BasicForestTreeScanner`
- `Floor_Grass_Pattern`
- `Plains1_Gorges_Grasses`
- `World-River-Map`

## Noise Knobs

- Simplex 0: $.Terrain.Density.Inputs[0].Inputs[0].Inputs[3].Inputs[0].Inputs[0].Inputs[0].Inputs[0].Inputs[0].Inputs[0] scale=25 octaves=2 lacunarity=2 persistence=0.5 seed=Erosion
- Simplex 1: $.Terrain.Density.Inputs[0].Inputs[0].Inputs[4].Inputs[0].Inputs[1].Inputs[0].Inputs[0].Inputs[0].Inputs[0] scale=500 octaves=3 lacunarity=4 persistence=0.15 seed=Base
- Simplex 2: $.Terrain.Density.Inputs[0].Inputs[0].Inputs[4].Inputs[0].Inputs[1].Inputs[0].Inputs[0].Inputs[1].Inputs[0] scale=30 octaves=2 lacunarity=2 persistence=2 seed=BaseNoise
- Simplex 3: $.Props[1].Assignments.FieldFunction scale=20 octaves=2 lacunarity=2 persistence=3 seed=Bush
- Simplex 4: $.Props[2].Assignments.FieldFunction scale=20 octaves=2 lacunarity=2 persistence=3 seed=Flower
- Simplex 5: $.Props[3].Assignments.FieldFunction scale=20 octaves=2 lacunarity=2 persistence=3 seed=Flower2
- Simplex 6: $.Props[4].Assignments.FieldFunction scale=20 octaves=2 lacunarity=2 persistence=3 seed=Flower3
- Simplex 7: $.Props[5].Assignments.Delimiters[0].Assignments.Delimiters[0].Assignments.FieldFunction scale=20 octaves=2 lacunarity=2 persistence=3 seed=BushLush
- Simplex 8: $.Props[6].Assignments.Delimiters[0].Assignments.Delimiters[0].Assignments.FieldFunction scale=35 octaves=2 lacunarity=2 persistence=2 seed=Ferns
- Simplex 9: $.Props[7].Assignments.Delimiters[0].Assignments.Delimiters[0].Assignments.FieldFunction scale=20 octaves=2 lacunarity=2 persistence=3 seed=Nettle
- Simplex 10: $.Props[8].Assignments.Delimiters[0].Assignments.FieldFunction.Inputs[1].Inputs[0] scale=145 octaves=3 lacunarity=4 persistence=0.5 seed=A
- Simplex 11: $.TintProvider.Delimiters[0].Tint.Density scale=100 octaves=2 lacunarity=5 persistence=0.2 seed=Tint
- Simplex 12: $.TintProvider.Delimiters[1].Tint.Density scale=125 octaves=3 lacunarity=5 persistence=0.5 seed=Tint
- Cell: none

## Curves

- 0: $.Terrain.Density.Inputs[0].Inputs[0].Inputs[4].Inputs[0].Inputs[0].Inputs[0].Inputs[0].Inputs[1].Curve (5 points) [-10, 2], [-3, 0.95], [-1, 0.8], [0, 0.7], [10, -1]
- 1: $.Terrain.Density.Inputs[0].Inputs[0].Inputs[4].Inputs[0].Inputs[0].Inputs[1].Inputs[0].Inputs[1].Curve (2 points) [0, 0], [40, -1]
- 2: $.Terrain.Density.Inputs[0].Inputs[0].Inputs[4].Inputs[0].Inputs[1].Inputs[1].Curve (2 points) [0, 1], [25, -1]
- 3: $.Terrain.Density.Inputs[1].Curve (2 points) [0, 1], [0.1, -1]
- 4: $.Terrain.Density.Inputs[2].Curve (4 points) [-10, 1], [-5, 0], [20, 0], [30, 1]
- 5: $.Props[9].Assignments.Delimiters[0].Assignments.Delimiters[0].Assignments.Prop.Props[1].DistanceCurve (2 points) [9, 0.005], [10, 0]
- 6: $.Props[9].Assignments.Delimiters[0].Assignments.Delimiters[0].Assignments.Prop.Props[2].DistanceCurve (2 points) [9, 0.01], [10, 0]

## Materials

- Type: Solidity
- Solid: {Type:Queue}
- Empty: {Type:Queue}

## Props

- 0: (unknown)
- 1: (unknown)
- 2: (unknown)
- 3: (unknown)
- 4: (unknown)
- 5: (unknown)
- 6: (unknown)
- 7: (unknown)
- 8: (unknown)
- 9: (unknown)
- 10: (unknown)
