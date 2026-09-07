# Hytale 0.6.4 (Update 6) Worklog

Date: 2026-09-07

Scope: update Basecamp after Hytale 0.6.4 was installed on the Windows development box.
This is the first Basecamp pass since 0.5.7, so it covers Update 6 (0.6.1) and hotfixes
0.6.2 through 0.6.4 in one step. Sibling mod repos were reviewed but not changed.

## Installed Build Verification

- Windows install:
  `/mnt/c/Users/ccnef/AppData/Roaming/Hytale/install/release/package/game/latest`
- Launcher log: `0.5.9 (build 22) -> 0.6.4 (build 27)` applied 2026-09-07 09:20 PDT.
- Server manifest:
  - `Implementation-Version: 0.6.4`
  - `Implementation-Revision-Id: 108a26d534805e68dcf0d00638914cb0db82555b`
  - `Implementation-Patchline: release`
- Maven metadata lists `Server` 0.6.1, 0.6.2, 0.6.3, and 0.6.4. There is no 0.6.0.
- Basecamp worktree was clean before the update.

## Skipped Release: 0.5.9

- The launcher applied `0.5.7 -> 0.5.9` on 2026-08-18. Basecamp was not updated and no
  0.5.9 asset TOC was captured, so the 0.5.9 asset baseline is gone.
- Terrascape moved its Gradle pin to 0.5.9 on its own; Kyn and Overseer stayed on 0.5.7.
- Hytale did not publish 0.5.8 or 0.5.9 hotfix notes.
- The checklist now says to capture a TOC and port the notes for every patch, even when
  the rest of the update is deferred.

## Patch Notes

- Added `docs/patch-notes/` with a version index and a porter tool,
  `tools/refs/patch-notes/port-hytale-post.js` (`npm run notes:port`), so each game
  version has committed release notes. Moved the Update 5 notes into the folder.
- Ported Update 6 patch notes, the Update 6 hotfix roundup (0.6.1 to 0.6.4), and the
  Update 5 hotfix roundup (0.5.1 to 0.5.7).
- Headline modder-facing items in Update 6:
  - Network protocol moved from `hytale/2` to `hytale/3`; the protocol CRC changed and
    servers and plugins must be rebuilt before they connect.
  - `BlockAccessor` is removed; `WorldChunk` chunk accessors are deprecated in favor of
    `ChunkStore.getChunkSectionReferenceAtBlock` and `BlockOperations`.
  - `Packet.serialize(ByteBuf)` and `ByteBuf` helpers are gone; several interaction and
    sound protocol fields are now required and fail codec validation when null.
  - `PrefabUtil.paste`/`remove` boolean overloads are deprecated for `PrefabUtil.Flags`;
    `PrefabSaverSettings` support flags became `SupportMode`.
  - New `EncounterManager` JSON asset type and `/encounter add <asset>` command.
  - Renames: `CarryInteractionHints` to `CarryHudInputBindings`, `BuilderToolsPlugin.Action.ROTATE`
    to `TRANSFORM`, `EncounterAudio` collector to `EncounterMembers`, `IsUsable` block flag removed.

## Assets

- Impact plan (`npm run update:plan`, 0.5.7 baseline):
  - added: 614
  - changed: 1,827
  - removed: 67
  - unchanged: 58,254
- Captured `docs/refs/assets/toc/assets-toc-0.6.4.json` from the new `Assets.zip`:
  - files: 60,695 (was 60,148)
  - total bytes: 3,462,575,544 (was 3,414,844,375; +47,731,169)
- Incrementally synced `_Assets/` from the 0.6.4 zip (2,441 files extracted, 67 deleted).
- Largest change groups: `Server/Audio` (695), `Common/Sounds` (268), `Common/Characters`
  (261), `Server/Item` (131 outside the routed folders), `Common/Cosmetics` (114),
  `Server/HytaleGenerator` (68). New folders include `Server/EncounterManager` and
  `Server/Instances/TestScenes`. 35 NPC role files were added.
- 1,856 changed files fall outside the planner's routing rules. Audio and cosmetics are
  safe to ignore. `Server/Item/Interactions`, `Server/Item/RootInteractions`,
  `Server/Item/Block`, `Server/HytaleGenerator/Biomes`, and `Server/EncounterManager` are
  gameplay data with no Basecamp consumer yet.

## SDK Reference

- Regenerated the full SDK reference from the installed `HytaleServer.jar` (0.6.4,
  SHA-256 `7ebe0259...052b787`). The Gradle cache does not have 0.6.4 yet, so the
  planner passed the install path explicitly.
  - packages: 1,001 (was 915)
  - classes in `llms.txt`: 5,618 (was 4,923)
  - method entries: 40,972 (was 36,641)
  - SDK Explorer cards: 5,617 (was 4,921)
- `node tools/refs/sdk/diff-sdk-reference.js` against HEAD:
  - added packages: 87 (new areas include `builtin.adventure.wilderness`,
    `builtin.adventure.worldevents`, and the spectator, hardcore, encounter, camera
    sequence, and mod-browser surfaces)
  - added classes: 314
  - removed classes: 18
  - changed classes: 908
- Removed classes (check the mods for references):
  - `TimeInstrument in com.hypixel.hytale.builtin.hytalegenerator.engine.performanceinstruments`
  - `NoPropDistribution in com.hypixel.hytale.builtin.hytalegenerator.propdistributions`
  - `VoxelSpaceUtil in com.hypixel.hytale.builtin.hytalegenerator.voxelspace`
  - `PortalWorldCommandBase in com.hypixel.hytale.builtin.portals.commands`
  - `TimerFragmentCommand in com.hypixel.hytale.builtin.portals.commands`
  - `ValidationResult in com.hypixel.hytale.protocol.io`
  - `BlockFlags in com.hypixel.hytale.protocol`
  - `ConnectedBlockRuleSetType in com.hypixel.hytale.protocol`
  - `ChunkLoadedCommand in com.hypixel.hytale.server.core.command.commands.world.chunk`
  - `BanParser in com.hypixel.hytale.server.core.modules.accesscontrol.ban`
  - `InfiniteBan in com.hypixel.hytale.server.core.modules.accesscontrol.ban`
  - `TimedBan in com.hypixel.hytale.server.core.modules.accesscontrol.ban`
  - `HytaleWhitelistProvider in com.hypixel.hytale.server.core.modules.accesscontrol.provider`
  - `BlockAccessor in com.hypixel.hytale.server.core.universe.world.accessor`
  - `EmptyBlockAccessor in com.hypixel.hytale.server.core.universe.world.accessor`
  - `ConnectedBlockFaceTags in com.hypixel.hytale.server.core.universe.world.connectedblocks`
  - `GeneratedBlockStateChunk in com.hypixel.hytale.server.core.universe.world.worldgen`
  - `SpawnableWithModelBuilder in com.hypixel.hytale.server.npc.asset.builder`
- Full extraction took about 45 minutes on WSL against the Windows install path. The
  jar location made no measurable difference; JVM start per `javap` call dominates.

## Derived References And Apps

- Regenerated labels, NPCs, recipes, loot, bench tiers, dependency trees, item icons,
  the prefab index, gallery packs, and preview atlases:
  - labels: 3,724 items (was 3,696), 118 resource types, 574 NPC roles (was 558),
    4,323 by-name keys (was 4,279)
  - NPC catalog: 999 roles (was 974), 0 skipped
  - recipes: 403 standalone, 1,581 embedded (was 1,544), 1,984 total (was 1,947)
  - loot: 622 named drop-lists (was 620), 677 gatherable blocks (was 672), 433 distinct
    dropped items
  - bench tiers: 16 benches, 7 upgradable (unchanged)
  - dependency tree: 1,552 all-recipe targets (was 1,515)
  - Recipe Kiosk icon atlas: 1,978 icons across 2 pages, 2,536 ids in scope
  - prefab index: 7,828 entries
  - Prefab Gallery: 7,778 prefabs rendered, 0 failed, 45 preview atlas pages
- `cd tools && npm run verify` passed: JavaScript syntax (27), JSON parse (32), stale
  path scan (1,343 files), markdown links (1,063 files), reference smoke tests (3).
- `cd tools && npm run pages:build` built the landing page and all three apps into
  `_site/` (143 MB) with only the existing webpack bundle-size warnings.
- Headless Chromium smoke over the staged site (landing, Recipe Kiosk, Prefab Gallery,
  SDK Explorer): every page loaded with no console errors and no failed requests other
  than the landing favicon. Recipe Kiosk reported 1,984 recipes on Hytale 0.6.4 and
  resolved a copper search with icons; the gallery listed 7,778 prefabs with previews;
  SDK Explorer reported 5,617 cards and returned the new `BlockOperations` class.

## Sibling Mod Impact (not applied in this pass)

- All three manifests declare `ServerVersion >= 0.5.0 <0.6.0`, which excludes 0.6.x. The
  jars will not load until the range is widened.
- Gradle pins: Kyn and Overseer 0.5.7, Terrascape 0.5.9. All three must move to 0.6.4
  and rebuild; the protocol change alone requires a rebuild.
- The chunk accessor, packet API, and prefab utility changes above are the likely
  compile breaks for Kyn (chunk loader, `WorldChunk` cell accessors) and Overseer
  (prefab paste/undo). Run each repo's build and read the SDK diff before deploying.
- No live deployment or smoke test was performed. The remote Mac host has not been
  confirmed on 0.6.4.
