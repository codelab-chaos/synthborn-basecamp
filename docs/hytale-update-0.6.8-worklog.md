# Hytale 0.6.8 worklog

Date: October 5, 2026. Scope: Basecamp refresh for the 0.6.5 -> 0.6.8 launcher patch,
plus the compatibility read for the sibling mods.

## Installed inputs

- The windowsMSI launcher applied 0.6.5 (build 28) -> 0.6.8 (build 31) at
  2026-10-05 01:01 PDT. 0.6.6 and 0.6.7 were never installed locally.
- Server SHA-256: `dcd2956cc65b950084650eadd56b889cf51f7610c127c3daac1f74dc471fec97`.
- Maven `release` and `latest` are both 0.6.8, so the Gradle pin can move.

## Patch notes

- Re-ported the Update 6 hotfix post. It now includes 0.6.6 (Sep 14, 2026): an Intel
  integrated graphics crash fix plus join, port-forwarding, and connection cleanup. None
  of it is modder-facing.
- The post has no 0.6.7 or 0.6.8 sections yet. Re-port it when they appear.
- Ported the Update 7 pre-release notes (Parts 1 through 5) as a forward-looking
  reference: [`hytale-pre-release-patch-notes-update-7.md`](patch-notes/hytale-pre-release-patch-notes-update-7.md).

## Assets

- Captured `docs/refs/assets/toc/assets-toc-0.6.8.json`: 60,695 files.
- Zero additions or removals. Four changed: `CommonAssetsIndex.hashes` and the
  pt-BR, uk-UA, and zh-CN `server.lang` files. No English label, recipe, NPC, icon, or
  prefab consumer changed, so those datasets keep their previous provenance.

## SDK

- The local signature cache was cold, so all 5,660 classes were inspected in batches
  (about 80 seconds). Two package Markdown files were written and 1,000 were untouched.
- Added package `com.hypixel.hytale.startup` with `InstallDirGuard.check(OptionSet)`.
- `Options.ALLOW_INSTALL_DIR` (`--allow-install-dir`) and
  `ShutdownReason.INVALID_INSTALL_DIR` were added to `com.hypixel.hytale.server.core`.
- No removed packages, classes, or signatures. The signature view omits deprecation
  annotations, so compiling each mod with deprecation/removal lint is still the check.
- Indexes: 5,620 classes, 40,981 methods; SDK Explorer data 5,618 cards.

### Install-directory guard (new startup behavior)

Read from `javap -c` on the exact 0.6.8 jar. At boot, the server takes its working
directory, resolves the real path, and walks up its ancestors. If any ancestor sits
directly inside a folder named `install` (case-insensitive) and contains `env.dat`, the
server prints "The server will not boot inside the install path" and exits with
`INVALID_INSTALL_DIR`. The check is skipped for `--allow-install-dir`, `--singleplayer`,
or `--bare` without `--bootstrap`.

The jar location does not matter, only the working directory. All three deploy scripts
`cd` into `UserData/Saves/<save>` before launching `install/.../HytaleServer.jar`, so
they are not affected. Any ad hoc launch from inside the install tree now needs a
different working directory.

## Sibling mod status at time of patch

| Repo | Branch | Gradle pin | Manifest `ServerVersion` | 0.6.8 action |
|---|---|---|---|---|
| `synthborn-terrascape` | `main` | 0.6.5 | `>=0.6.4` | Bump pin, compile with lint, smoke test |
| `synthborn-overseer` | `update-six` | 0.6.5 | `>=0.6.5` | 0.6.5 migration is staged but uncommitted; bump pin on top |
| `synthborn-kyn` | `main` | 0.5.7 | `>=0.5.0 <0.6.0` | Never migrated to Update 6; the manifest cap refuses to load on any 0.6.x server |

Outcome (end of October 5): Overseer committed the 0.6.5 migration and the 0.6.8 pin on
`update-six`; Terrascape's 0.6.8 pin landed on `feat/voxel-toggle`; Kyn is deferred.

Kyn needs the full Update 6 migration. The Overseer 0.6.5 report lists the removed APIs
that hit Overseer (`PendingTeleport.queueTeleport`, `WorldChunk.getEntityChunk`,
`EntityChunk.getEntityReferences`, legacy entity movement, hotbar resync) and is the
starting map for Kyn.

## Update 7 preview: what will break next

From the pre-release "For Plugin Developers" section. Not in 0.6.8, but each mod should
avoid writing new code against these:

- The column accessor surface is deleted: `IWorldChunks`, `IWorldChunksAsync`,
  `IChunkAccessorSync`, `ChunkAccessor`, `OverridableChunkAccessor`,
  `LocalCachedChunkAccessor`, and the block accessors on `World`, `WorldChunk`, and
  `BlockChunk`. Block reads go through `ChunkStore.getChunkSectionReferenceAtBlock`
  and the new `BlockReader` / `SectionReader`.
- `WorldChunk.getBlockComponentEntity` is gone; use `BlockModule.getBlockEntity`.
- `TargetUtil.getTargetBlockAvoidLocations` takes `Collection<Int3OpenHashSet>`.
- `UpdateBossBar` and `EncounterBossBarState.setTracked` take a trailing `hardMode`.
- Cubic world generators must implement `IWorldGen.Cubic.generateColumn(...)`, which
  matters to Terrascape.
- NPC `Deflection` (target leading) now defaults to `false`, which matters to Kyn roles.

## Validation

- `npm run update:plan` before and `npm run update:apply` completed.
- `npm run verify` passed: 28 JavaScript files, 34 JSON files, stale-path scan,
  1,066 Markdown files' links, and three reference-query smoke tests.
- `npm run sdk:test` passed (incremental SDK fixture tests).

## Mod migration and MacBook validation

The MacBook launcher was updated to 0.6.8 the same night (server revision
`d2feeb3997f2efc9b4fe23282a3ece38f0618047`, `version` reports `HytaleServer v0.6.8 (release)`).

### Overseer (`update-six`)

- Committed the previously staged 0.6.5 migration, then bumped the pin to 0.6.8.
- `./gradlew build`: 303 tests, zero failures, one opt-in test skipped. Only the two
  known `ISpawnProvider.getSpawnPoints()` deprecation warnings.
- Deployed to `overseer-test`: booted in 4.9 s, RCON health ok, all tools registered.
- Found and fixed a leftover from the 0.6.5 migration: the generated
  `SynthOverseerWorldgen` asset pack manifest still declared `>=0.5.0 <0.6.0`, which
  logs a SEVERE outdated-pack warning on every boot. It now declares `>=0.6.5`, and
  promotion rewrites a stale manifest. The deployed save keeps the old manifest until
  its next worldgen promote.
- `os health` returned "incomplete upstream response" from OpenRouter, the same
  provider-side result recorded during the 0.6.5 validation; not a 0.6.8 regression.

### Terrascape (`main`, uncommitted pin bump)

- `./gradlew build fatJar`: 326 tests, zero failures, zero warnings.
- Deployed to `synth-worldview-mvp`: booted in 5.3 s, RCON health ok.
- `npm run runtime:smoke` against the MacBook: six checks passed (RCON health, status,
  link metadata, public worlds, anonymous and invalid-bearer console rejection).
  Authenticated console checks skipped without a map token.
- Terrain GLBs: (0,0) 468,252 bytes and (-1,-1) 182,040 bytes from disk cache, identical
  to the 0.6.5 sizes. Freshly generated on 0.6.8: (37,-23) 662,432 bytes and (-29,41)
  178,704 bytes. All passed glTF magic and declared-length checks.
- Worlds, players, mobs, time, and NPC index (1,019 roles) returned HTTP 200 / `ok:true`.

### Pre-existing log noise (not 0.6.8 regressions)

- `[SERR] Reallocate: 131072 to 1179648` appears 5 to 7 times per boot in every log back
  to 0.5.6.
- Terrascape's `com.codelabchaos_Terrascape` and `com.codelabchaos_SynthTerrascape`
  data folders log "Skipping pack ... missing or invalid manifest.json" since 0.5.6.

### Not yet validated

In-game checks with a connected client: Overseer teleport, hotbar resync, sonar, mob
movement, placement/undo; Terrascape live player/mob feeds and the browser suite.
Kyn remains on 0.5.7 and cannot load on 0.6.x until it is migrated.

## Follow-up work found during validation

- Overseer: `SectionCursor` caches section components per scan; `/os-bench` measured it 2 to
  2.5x faster than per-read section resolution on 0.6.8 (13 to 54 ns per voxel) with
  identical block checksums. Deploys now run `caffeinate -i -w <pid>` beside remote servers.
- Terrascape (`feat/voxel-toggle`): map tiles load before voxels and stitch into 8x8-chunk
  region planes (a radius-32 map draws as 81 planes instead of 4,225 meshes); a Voxels
  toggle shows the flat map alone; the jar is named with the plain version
  (`Terrascape-0.1.1.jar`), see [Publishing to CurseForge](publishing-curseforge.md).
- The MacBook dropped off the LAN mid-session because macOS rotated its private Wi-Fi
  address; it now uses a fixed address. It did not sleep.
