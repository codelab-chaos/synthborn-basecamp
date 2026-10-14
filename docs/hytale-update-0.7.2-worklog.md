# Hytale 0.7.2 worklog

Date: October 14, 2026. Scope: Basecamp refresh for the 0.6.8 -> 0.7.2 launcher patch
(Chapter I: Out of the Breach, which is Update 7), plus an API impact read for the
sibling mods. Basecamp work only; no sibling repo was modified.

## Installed inputs

- The windowsMSI launcher moved 0.6.8 -> 0.7.2. The Server jar manifest reports
  `Implementation-Version: 0.7.2`, revision `d769dc3d57881261a62858e1394f0e4de9a21eca`.
- Maven `release` and `latest` are both 0.7.2, so Gradle pins can move.
- 0.6.9, 0.7.0 and 0.7.1 were never installed locally. Maven lists all three, but the
  asset baseline between 0.6.8 and 0.7.2 is one combined jump.

## Patch notes

- Ported [Chapter I: Out of the Breach](patch-notes/hytale-chapter-i-out-of-the-breach.md)
  (October 12, 2026, 890 lines).
- The post is player-facing and has no "For Plugin Developers" section. The API picture
  below comes from the SDK diff, not the post. The earlier
  [Update 7 pre-release notes](patch-notes/hytale-pre-release-patch-notes-update-7.md) predicted
  the accessor removals correctly.
- Modder-relevant lines in the post: `/portal` replaces `/fragment` and `/leave` became
  `/portal leave`; server rule changes apply to players immediately; cubic-world chunk
  loading fixes (entities, chests and workbenches near the player, interactables and warps
  far above or below normal height); trigger blocks now fire on every creature move;
  server view distance is capped at 32 chunks; block breaking no longer waits on chunk loads.

## Assets

- `docs/refs/assets/toc/assets-toc-0.7.2.json`: 68,759 files, 3.93 GB.
- Versus 0.6.8: 9,321 added, 1,257 removed, 3,280 changed, 56,158 unchanged.
- Biggest buckets. Added: sounds (2,056), `Server/Prefabs/Orbis` (1,401), NPC models (634),
  NPC roles (421), NPC particles (416), item interactions (373). Removed: sounds (369), NPC
  roles (273), item interactions (82), `Server/Instances/Dungeons` (54), `Server/Item/Block`
  (47), `Server/HytaleGenerator/Assignments` (35), `Server/World/Instance_Dungeon_Goblin` (34).
  Changed: sound events (496), items (481), NPC roles (367).
- 223 world generation files (`Server/HytaleGenerator`, `Server/World`) were touched. Forests1
  and Plains1 assignment files are among them. Terrascape should diff these against its
  generator assumptions.
- Regenerated: labels, NPC catalog, recipes, loot, dependency trees, bench tiers, Recipe
  Kiosk data and icon atlas, prefab index, Prefab Gallery packs and previews (9,226 prefabs,
  22 voxel packs, 53 atlas pages, 0 failures).

## SDK

Current 0.7.2 reference has 1,031 packages (1,001 at 0.6.8). Diff against 0.6.8:

- 35 packages added, 5 removed, 151 classes added, 31 removed, 394 changed.
- New feature areas: `builtin.abilities` (runestone abilities, 15 trigger classes),
  `builtin.beam`, `builtin.rewards`, `builtin.adventure.goblinlab`, `server.core.modules.ui`
  (11 classes), `world.chunk.heightmap`, `world.validation`, music transition and stinger
  asset types, `builtin.buildertools.world`, `projectile.event`, `interaction.event`.
- Removed: treasure map objective classes, `WorldValidationUtil`, `BrushConfigChunkAccessor`,
  `LocateDungeonCommand`, the portal "curse" systems (now "ephemeral": `EphemeralItems`,
  `EphemeralItemDropsSystem`, `DeleteEphemeralItemsOnSpawnSystem`), `DurabilityOperator`,
  `FragileBlock`, and the column accessor family below.

### Chunk and block access rework (matters to anything that reads terrain)

Removed outright: `IWorldChunks`, `IWorldChunksAsync`, `IChunkAccessorSync`, `ChunkAccessor`,
`OverridableChunkAccessor`, `LocalCachedChunkAccessor`, `ChunkSectionReference`.

New: `accessor.BlockReader` (`getBlock`, `getFluidId`) and `accessor.SectionReader(ChunkStore)`
with `sectionAt`, `getBlock`, `getFluidId`, `getEnvironment`, `getFluidLevel`, `getRotationIndex`,
`canHoldY`, `supportsCubicSections` and `sectionCursor()`.

`World` lost `getChunkIfInMemory`, `getChunkIfLoaded`, `getChunkIfNonTicking`,
`loadChunkIfInMemory`, `getChunkAsync`, `getNonTickingChunkAsync`, and `getBlockBulkRelative`.
`drainPlayersTo` gained a `(Message, boolean)` tail and the old two-argument form is gone.
`Universe.transferPlayerAsync` changed signature.

`BlockChunk` lost its height, environment and direct section API: `getHeight(int,int)`,
`setHeight`, `updateHeight`, `updateHeightmap`, `getEnvironmentChunk`, `getEnvironmentColumn`,
`getSectionAtIndex`, `getSectionAtBlockY`, `getBlock`, `setBlock`, ticking and physics flags.
Heights now live in the new `HeightmapColumn` component
(`getHeight`, `getCollisionHeight`, `getCeiling`, `getFloor`, `sampleGaps`), reached through
`HeightmapColumn.getComponentType()`; `BlockChunk` only keeps `setHeightmapColumn`,
`hasLegacyHeightmap` and `takeLegacyHeightmap` for upgrades. `BlockSection` dropped
`setChunkSection` and `getMaximumHitboxExtent` and gained sky-light stamps, `columnOccupancy`
and a tri-argument `forEachTicking`.

`ChunkStore` now extends the new `ChunkGrid`. **The first diff run reported these as removals but
they are not**: `getChunkReference`, `getChunkSectionReference(AtBlock)(Async)`, `getStore`,
`getWorld`, `getGenerator`, `getLoadedChunksCount` and friends were hoisted to `ChunkGrid`
and still resolve on `ChunkStore` by inheritance. The signature view lists declared methods
only; the diff tool now accounts for this (see Tooling notes).

### Other changed surface worth knowing

- ECS parenting: `Store`/`CommandBuffer` gained `addEntity(..., Ref parent)`, `setParent`,
  `getParent`, `forEachChunk(Ref, ...)`, `forEachEntityParallel(Ref, ...)`; new
  `component.system.HierarchyScope`.
- `Role`: `addVelocity(Vector3d, VelocityConfig)` removed; `processAddVelocityInstruction` and
  `processSetVelocityInstruction` take a trailing `float`. New `getMemoriesUnlockedBy`,
  `getMemoriesKillRange`, `isIgnoreDisableNPCIncomingDamage`.
- `EntityModule` gained component types for `PreventDebugScreens`, `ProjectilePassthrough`,
  `IgnoreDisableNPCIncomingDamage`, and the ability slot and rune bag inventory components.
- `ItemComponent` gained `getMergeRadius`/`setMergeRadius`.
- `WorldMapManager.updateTickingState` became `synchronized`.
- Portal commands moved from `portals.commands` to `portals.commands.fragment` plus
  `PortalCommands`.

## Terrascape read (no changes made)

A read-only cross-reference of Terrascape's 79 `com.hypixel` imports against the diff:

- The real exposure is small: `terrain/TerrainChunkReader.java` (BlockChunk, BlockSection,
  ChunkStore, `getChunkReference(Async)`, `getChunkSectionReference`, `GetChunkFlags`) and
  `terrain/TerrainSampler.java` (`chunk.getHeight(x, z)`, which is removed from `BlockChunk`
  and now belongs to `HeightmapColumn`).
- The `ChunkStore` calls likely survive through `ChunkGrid`; the `BlockChunk` height and
  section calls do not. Confirm with a compile against 0.7.2 on a clean tree. The
  Terrascape working tree currently has uncommitted README, docs and config edits.
- Not yet checked: whether Terrascape implements `IWorldGen` or the Cubic generator hook
  (grep found no direct use), and the 223 touched worldgen asset files.
- Pre-release notes flagged `IWorldGen.Cubic.generateColumn(...)` for cubic generators.

## Sibling mod status

| Repo | Gradle pin | Manifest `ServerVersion` | 0.7.2 action |
|---|---|---|---|
| `synthborn-terrascape` | 0.6.8 | `>=0.6.4` | Bump pin, fix `BlockChunk` height reads, compile with lint, smoke test |
| `synthborn-overseer` | 0.6.8 | `>=0.6.5` | Bump pin and compile; uses `SectionCursor`, check against `SectionReader` |
| `synthborn-kyn` | 0.5.7 | `>=0.5.0 <0.6.0` | Still unmigrated; needs the Update 6 and Update 7 work together |

## Tooling notes

- `diff-sdk-reference.js` could not see inherited members, so hoisting methods into a new
  superclass (`ChunkStore` -> `ChunkGrid`) looked like about 20 removals. It now judges
  removals against own plus inherited members within the same snapshot and prints
  "N member(s) moved to or from a superclass (not removed)" instead. The 0.6.8 -> 0.7.2
  diff dropped from 1,957 to 1,899 lines. `sdk:test` now runs the whole `refs/sdk/tests/`
  folder, including `diff-sdk-reference.test.js`.
- Inheritance is resolved only through ancestors present in the SDK reference. JDK parents
  and covariant overrides (changed return type) still show as add plus remove.

## Validation

- `npm run update:plan` before and `npm run update:apply` completed.
