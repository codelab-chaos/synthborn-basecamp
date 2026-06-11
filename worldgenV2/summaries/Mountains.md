# Mountains.json

- Path: `_Assets/Server/HytaleGenerator/Biomes/Experimental/Mountains.json`
- Asset name: `Basic`
- Root type: `Biome`

## Top-Level

- `Name`
- `Terrain`: DAOTerrain
- `MaterialProvider`: Solidity
- `Props`
- `EnvironmentProvider`: DensityDelimited
- `TintProvider`: DensityDelimited

## Provider Counts

- Constant: 15
- CurveMapper: 12
- Manual: 12
- BaseHeight: 10
- SimplexNoise2D: 9
- Normalizer: 8
- Sum: 7
- Imported: 6
- Cache: 5
- ConstantThickness: 5
- Queue: 5
- YOverride: 5
- FieldFunction: 4
- SimpleHorizontal: 4
- SpaceAndDepth: 4
- Mesh: 3
- Mesh2D: 3
- Mix: 3
- Angle: 2
- DensityDelimited: 2
- DensityGradient: 2
- Min: 2
- Multiplier: 2
- Pow: 2
- DAOTerrain: 1
- Distance2Div: 1
- Manhattan: 1
- Max: 1
- PositionsCellNoise: 1
- SmoothMax: 1
- Solidity: 1

## Exports

- `Plains1_Mountains_Base_Terrain`
- `Plains1_Mountains_Terrain`
- `Plains1_Oak_Sunny_Patches`

## Imports

- `Plains1_Caves_Terrain`
- `Plains1_Mountains_Base_Terrain`
- `Plains1_Mountains_Grasses`
- `Plains1_Mountains_Terrain`
- `Plains1_Mountains_Trees`

## Noise Knobs

- Simplex 0: $.Terrain.Density.Inputs[0].Inputs[0].Inputs[0].Inputs[0].Inputs[0].Inputs[0].Inputs[0].Inputs[0] scale=20 octaves=1 lacunarity=4 persistence=0.1 seed=A
- Simplex 1: $.Terrain.Density.Inputs[0].Inputs[0].Inputs[0].Inputs[0].Inputs[1].Inputs[0].Inputs[0].Inputs[0].Inputs[0] scale=15 octaves=2 lacunarity=1.2 persistence=0.3 seed=A
- Simplex 2: $.Terrain.Density.Inputs[0].Inputs[0].Inputs[0].Inputs[0].Inputs[1].Inputs[1].Inputs[0].Inputs[0].Inputs[0].Inputs[1].Inputs[0].Inputs[0] scale=700 octaves=1 lacunarity=9 persistence=0.2 seed=A
- Simplex 3: $.Terrain.Density.Inputs[0].Inputs[0].Inputs[0].Inputs[1].Inputs[0].Inputs[0].Inputs[0].Inputs[0].Inputs[0].Inputs[0].Inputs[0].Inputs[0] scale=500 octaves=3 lacunarity=2 persistence=0.5 seed=U
- Simplex 4: $.MaterialProvider.Solid.Queue[1].Material.Layers[0].Material.Delimiters[0].Material.Queue[0].Material.Layers[0].Material.FieldFunction.Inputs[1] scale=250 octaves=1 lacunarity=2 persistence=0.5 seed=A
- Simplex 5: $.MaterialProvider.Solid.Queue[1].Material.Layers[0].Material.Delimiters[0].Material.Queue[1].Layers[0].Material.Queue[0].FieldFunction scale=70 octaves=2 lacunarity=7 persistence=0.1 seed=A
- Simplex 6: $.MaterialProvider.Solid.Queue[2].Material.Layers[0].Material.Queue[0].FieldFunction.Inputs[0] scale=90 octaves=2 lacunarity=5 persistence=0.3 seed=A
- Simplex 7: $.TintProvider.Density scale=100 octaves=2 lacunarity=5 persistence=0.2 seed=tints
- Simplex 8: $.$NodeEditorMetadata.$FloatingNodes[1] scale=12 octaves=2 lacunarity=1.2 persistence=0.3 seed=A
- Cell: none

## Curves

- 0: $.Terrain.Density.Inputs[0].Inputs[0].Inputs[0].Inputs[0].Inputs[1].Inputs[1].Inputs[0].Inputs[0].Curve (11 points) [1, 0.5], [0.8, -1], [0.6, 0.5], [0.4, -1], [0.2, 0.5], [0, -1], [-0.2, 0.5], [-0.4, -1], [-0.6, 0.5], [-0.8, -1], [-1, 0.5]
- 1: $.Terrain.Density.Inputs[0].Inputs[0].Inputs[0].Inputs[0].Inputs[1].Inputs[1].Inputs[0].Inputs[0].Inputs[0].Inputs[0].Curve (2 points) [-50, 1], [180, -1]
- 2: $.Terrain.Density.Inputs[0].Inputs[0].Inputs[0].Inputs[0].Inputs[2].Inputs[0].Inputs[0].Curve (4 points) [0.4, 0], [0.3, 1], [-0.3, 1], [-0.4, 0]
- 3: $.Terrain.Density.Inputs[0].Inputs[0].Inputs[0].Inputs[0].Inputs[2].Inputs[0].Inputs[1].Inputs[1].Curve (2 points) [80, 0], [100, 45]
- 4: $.Terrain.Density.Inputs[0].Inputs[0].Inputs[0].Inputs[1].Inputs[0].Inputs[1].Curve (2 points) [-30, 1], [200, -1]
- 5: $.Terrain.Density.Inputs[0].Inputs[0].Inputs[0].Inputs[1].Inputs[1].Curve (2 points) [0, 1], [0.1, -1]
- 6: $.Terrain.Density.Inputs[0].Inputs[0].Inputs[0].Inputs[1].Inputs[2].Curve (4 points) [-60, 1], [-50, 0], [200, 0], [210, 1]
- 7: $.Terrain.Density.Inputs[0].Inputs[1].Curve (2 points) [0, 1], [0.1, -1]
- 8: $.Terrain.Density.Inputs[0].Inputs[2].Curve (4 points) [-30, 1], [-20, 0], [200, 0], [210, 1]
- 9: $.MaterialProvider.Solid.Queue[1].Material.Layers[0].Material.Delimiters[0].Material.Queue[0].Material.Layers[0].Material.FieldFunction.Inputs[0].Curve (2 points) [60, -1], [120, 1]
- 10: $.MaterialProvider.Solid.Queue[2].Material.Layers[0].Material.Queue[0].FieldFunction.Inputs[1].Curve (2 points) [10, 1], [120, -1]
- 11: $.EnvironmentProvider.Density.Curve (2 points) [-20, 1], [-25, 0]

## Materials

- Type: Solidity
- Solid: {Type:Queue}
- Empty: {Type:Queue}

## Props

- 0: (unknown)
- 1: (unknown)
