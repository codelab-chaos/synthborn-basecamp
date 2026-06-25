# Hytale 0.5.6 Update Worklog

Date: 2026-06-24

Scope: update Synthborn repos after Hytale client/server 0.5.6 was installed.

## Pre-work Completed By User

- Remote Hytale servers were stopped before patching.
- Hytale update was installed on the Windows development box.
- Hytale update was installed on the `macbookserver.org` remote server.

## Repo Update Notes

- Basecamp checklist used: `docs/hytale-version-update-checklist.md`.
- Maven metadata confirmed `com.hypixel.hytale:Server:0.5.6` is published.
- Local Windows install visible from WSL:
  `/mnt/c/Users/ccnef/AppData/Roaming/Hytale/install/release/package/game/latest`.
- Local server jar manifest confirmed:
  - `Implementation-Version: 0.5.6`
  - `Implementation-Revision-Id: 5ea7c2639aeec92d630569c2bd176051665d263c`
- Initial dependency scan found all four deployable repos still pinned to `Server:0.5.4`:
  - `synthborn-overseer`
  - `synthborn-kyn`
  - `synthborn-rcon`
  - `synthborn-terrascape`
- All four sibling repos were clean before edits.
- Basecamp had only `docs/refs/assets/toc/assets-toc-0.5.4.json` before the 0.5.6 asset capture.
- Updated Gradle pins in all four deployable repos from `Server:0.5.4` to `Server:0.5.6`.
- Fixed `tools/refs/assets/build-assets-toc.js` so zip TOC parsing handles this `unzip`
  date format (`1980-01-01`) instead of only `01-01-1980`.
- Captured `docs/refs/assets/toc/assets-toc-0.5.6.json` from the local Windows
  `Assets.zip`:
  - file count: 60,148
  - total bytes: 3,414,836,125
  - compared to `assets-toc-0.5.4.json`: 0 added, 0 removed, 62 changed, 60,086 same
- Verified all four deployable repos compile and test against `Server:0.5.6`:
  - `synthborn-kyn`: `sh gradlew build` passed; compile warnings remain for deprecated
    `WorldChunk` cell accessors and legacy `Inventory` access.
  - `synthborn-rcon`: `sh gradlew build` passed cleanly.
  - `synthborn-overseer`: `sh gradlew build` passed; one compile warning remains for
    deprecated `Inventory.setActiveHotbarSlot`.
  - `synthborn-terrascape`: `sh gradlew build` passed; one compile warning remains for
    deprecated `WorldChunk.getRotationIndex`.
- Resolved Gradle cache jar:
  `~/.gradle/caches/modules-2/files-2.1/com.hypixel.hytale/Server/0.5.6/fcc489d8a1ccf5364acb05301b0b3df57873843d/Server-0.5.6.jar`.
- Refreshed full basecamp SDK reference from `Server-0.5.6.jar`:
  - package files: 915
  - `llms.txt` classes: 4,923
  - method index entries: 36,641
  - SDK Explorer cards: 4,921
- `node tools/refs/sdk/diff-sdk-reference.js` found 6 signature-change groups versus
  `HEAD` / 0.5.4:
  - `HytaleGenerator.createStagedChunkGenerator(...)` now returns `ChunkGenerator`
    instead of `StagedChunkGenerator`.
  - `PortalSpawnFinder.computeSpawnTransform(...)` now returns
    `CompletableFuture<Transform>` instead of `Transform`.
  - `EventBusRegistry` added `deadRegistration(String)`.
  - `ItemStack` added `cleanCopy()`.
  - `HitboxCollision` moved from `setHitboxCollisionConfigIndex(int)` toward string/config
    accessors plus `isMigrated()`.
  - `Repulsion` moved from `setRepulsionConfigIndex(int)` toward string/config accessors
    plus `isMigrated()`.
- Checked existing `_Assets/` against the 62 changed TOC entries; all 62 matched the old
  `0.5.4` CRCs and none matched `0.5.6`, so `_Assets/` needed refresh before derived
  labels/recipes/NPC refs.
- Refreshed local `_Assets/` from the 0.5.6 `Assets.zip`; re-check confirmed all 62
  changed TOC entries now match the 0.5.6 CRCs.
- Regenerated derived asset references from refreshed `_Assets/`:
  - labels: 3,696 items, 118 resource types, 558 NPC roles, 4,279 by-name keys
  - recipes: 403 standalone recipes, 1,544 embedded recipes, 1,947 total
  - loot: 620 named drop-lists, 672 gatherable blocks, 433 distinct dropped items
  - bench tiers: 16 benches, 7 upgradable
  - NPC catalog: 974 NPC roles, 0 skipped
  - dependency trees: 188 equipment targets, 1,515 all-recipe targets
- Synced refreshed `recipes.json` and `loot.json` into `apps/recipe-kiosk/data/`.
- Verified basecamp reference health with `cd tools && npm run verify`; passed.
- Built static apps affected by regenerated data:
  - `apps/recipe-kiosk`: `npm run build` passed with existing Webpack size warnings.
  - `apps/sdk-explorer`: `npm run build` passed with existing Webpack size warnings.
- Re-ran basecamp verifier after app builds; passed.
- First remote combined deploy attempt rebuilt all four mods and copied several jars, but stopped
  before restart because Kyn/Overseer combined deploy configs expected `SynthTerrascape` while
  the Terrascape repo builds `Terrascape-0.1.0.jar` and logs `Terrascape started`.
- Fixed combined deploy config drift in `synthborn-kyn` and `synthborn-overseer`, and corrected
  the jar name in the version-update checklist.

## Remote Deploy And Smoke

- Deployed the combined target from `synthborn-kyn` with:
  `node tools/deploy.js --target combined deploy --restart`.
- The first combined deploy after the config fix completed successfully:
  - RCON health returned `{"ok":true,"service":"SynthRCON"}`.
  - Startup logs showed `SynthUnits setup complete`.
  - Startup logs showed `SynthOverseer setup complete`.
  - Startup logs showed `Terrascape started`.
- Re-established/confirmed the integration smoke anchors:
  - `synth testhome setspawn` set the saved test home to
    `149.50, 123.00, 113.50 world=default player=world-spawn`.
  - `synth chunk load 4 3 2` placed loader `#1`.
  - `synth chunk list` reported `chunks=25 kept=25 loaded=25`.
- `validate spawn-basic` passed before the later live-suite probe:
  `PASS checks=6 failures=0`.
- The checklist entry for `gatherer-basic` was stale for the current Kyn validator:
  - `validate gatherer-basic` returned `Unknown validation scenario`.
  - `validate gathering-basics` also returned `Unknown validation scenario`.
  - `validate list mechanics` showed current registered mechanics and did not include either
    stale scenario name.
- Tried the current confirmed `gatherer-live-suite` as a replacement smoke. It is not a good
  quick update smoke through RCON right now:
  - `hatchet-bootstrap-arena-start` passed.
  - The suite exceeded SynthRCON's command timeout and the RCON bridge returned HTTP 500 for
    command execution until the server was restarted.
  - Restarted the combined target with
    `node tools/deploy.js --target combined restart --skip-running-check`.
  - Ran `validate hatchet-bootstrap-arena-cleanup`; cleanup passed with
    `checks=1 failures=0`.
- Post-restart health and quick smoke:
  - `node tools/deploy.js --target combined status` reported the target `UP` and RCON health
    returned `{"ok":true,"service":"SynthRCON"}`.
  - `synth testhome show` still reported
    `149.50, 123.00, 113.50 world=default player=world-spawn`.
  - `synth chunk list` still reported loader `#1` with `chunks=25 kept=25 loaded=25`.
  - `validate spawn-basic` passed: `PASS checks=6 failures=0`.
  - `validate berry-harvest at 149.50,123.00,113.50` passed:
    `PASS checks=20 failures=0`.

## Remaining Follow-up

- Consider fixing Kyn's validation help text: it still advertises `gatherer-basic`,
  `gathering-basics`, `hatchet-crafting`, and some other legacy names that are not registered
  scenarios in the current `RuntimeValidationRunner`.
- Use quick registered mechanics such as `spawn-basic` and `berry-harvest` for version-update
  smoke checks. Treat the confirmed arena live suites as deeper validation, not as deploy smoke,
  unless the RCON timeout/driver path is adjusted.

## Process Improvement Added After The 0.5.6 Run

- Added `tools/refs/assets/sync-assets.js` so future Hytale updates do not need a full
  `_Assets/` overwrite extract.
- The new helper compares the new `Assets.zip` central-directory TOC against either:
  - a previous committed TOC passed with `--from-toc` for the fast release path, or
  - a fresh CRC scan of local `_Assets/` when `--from-toc` is omitted.
- It extracts only added/changed files and deletes files removed from the new zip, with
  `--dry-run` available before touching the local tree.
- Added `npm run assets:sync` in `tools/package.json`.
- Updated `docs/hytale-version-update-checklist.md` and `docs/refs/assets/README.md` to use
  the incremental sync path.
- Dry-run validation:
  - Comparing current `Assets.zip` to `assets-toc-0.5.6.json` planned
    `0` added, `0` changed, `0` removed.
  - Comparing current `Assets.zip` to `assets-toc-0.5.4.json` planned
    `62` changed files, matching the manual 0.5.6 asset refresh delta.
