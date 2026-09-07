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

PENDING_SDK

## Derived References And Apps

PENDING_DERIVED

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
