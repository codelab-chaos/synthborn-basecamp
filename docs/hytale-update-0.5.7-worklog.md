# Hytale 0.5.7 Update Worklog

Date: 2026-07-23

Scope: update the Synthborn workspace after Hytale client/server 0.5.7 was installed
on the Windows development box.

## Installed Build Verification

- Windows install:
  `/mnt/c/Users/ccnef/AppData/Roaming/Hytale/install/release/package/game/latest`
- Server manifest:
  - `Implementation-Version: 0.5.7`
  - `Implementation-Revision-Id: dd07e6a837aaf6378e82ff81d6f520f913624c08`
  - `Implementation-Patchline: release`
- Maven metadata confirmed `com.hypixel.hytale:Server:0.5.7` is published.
- The installed server jar and Gradle's resolved Maven jar have the same SHA-1:
  `4ed49627a6c704b9193a36380367acc3548319a0`.
- Basecamp, Kyn, Overseer, and Terrascape worktrees were clean before the update.

## Assets

- Captured `docs/refs/assets/toc/assets-toc-0.5.7.json` directly from the new
  `Assets.zip`:
  - files: 60,148
  - total bytes: 3,414,844,375
- Compared with 0.5.6:
  - added: 0
  - removed: 0
  - changed: 9
  - unchanged: 60,139
  - byte delta: +8,250
- The nine changed files are localization files under Russian, Brazilian Portuguese,
  Ukrainian, and Simplified Chinese, plus `CommonAssetsIndex.hashes`. No gameplay JSON,
  recipes, NPC roles, prefabs, or English labels changed.
- Incrementally synced `_Assets/` from the 0.5.7 zip.
- A full local CRC scan afterward reported 60,148 matching files and zero added,
  changed, or removed files.

## Gradle Pins And Builds

- Updated exact `compileOnly` and `testImplementation` pins from `Server:0.5.6` to
  `Server:0.5.7` in:
  - `synthborn-kyn`
  - `synthborn-overseer`
  - `synthborn-terrascape`
- Kept each manifest's `ServerVersion` range at `>=0.5.0 <0.6.0`.
- Full Gradle builds and tests passed for all three mods.
- Terrascape's `buildWeb` task also passed.
- Kyn still reports its existing deprecated `WorldChunk` cell-accessor and legacy
  `Inventory` warnings; no new 0.5.7 compilation failures appeared.

## SDK Reference

- A central-directory comparison found all 37,150 `.class` entries identical between
  the 0.5.6 and 0.5.7 server jars. Changes were limited to version/build metadata and
  `sentry-debug-meta.properties`.
- Regenerated the full SDK reference from `Server-0.5.7.jar`:
  - packages: 915
  - classes in `llms.txt`: 4,923
  - method entries: 36,641
  - SDK Explorer cards: 4,921
- `node tools/refs/sdk/diff-sdk-reference.js` reported:
  `No package/class/method signature changes detected.`
- Updated the SDK source stamp and generated index version headers to 0.5.7.
- Added class-level extraction progress reporting with percentage complete and
  remaining counts, including periodic non-interactive output.
- Corrected the extractor's SDK app-data completion message to report its actual
  package/card counters.

## Derived References And Apps

- Regenerated and compared labels, NPCs, recipes, loot, bench tiers, and both recipe
  dependency trees:
  - labels: 3,696 items, 118 resource types, 558 NPC roles, 4,279 by-name keys
  - NPC catalog: 974 roles, 0 skipped
  - recipes: 403 standalone, 1,544 embedded, 1,947 total
  - loot: 620 named drop-lists, 672 gatherable blocks, 433 distinct dropped items
  - bench tiers: 16 benches, 7 upgradable
  - dependency trees: 188 equipment targets, 1,515 all-recipe targets
- The regenerated content was unchanged from 0.5.6. Timestamp/newline-only churn was
  not retained.
- Recipe Kiosk and SDK Explorer production builds passed with their existing Webpack
  bundle-size warnings.
- `cd tools && npm run verify` passed JavaScript syntax, JSON parsing, stale-path,
  Markdown-link, and reference smoke checks.

## Release Impact Convention

- Added `cd tools && npm run update:plan` as the fast, read-only first step for future
  Hytale updates.
- The planner compares the new `Assets.zip` central directory with the automatically
  selected previous TOC and maps paths to labels, NPCs, recipes/loot, item icons, benches,
  prefab references, Recipe Kiosk, and Prefab Gallery.
- It hashes `HytaleServer.jar` before SDK work. Full signature extraction is skipped when
  SHA-256, version, and extraction mode match the existing SDK stamp.
- `npm run update:apply` performs the incremental asset sync and runs only the affected
  Basecamp pipelines. `--show-files`, `--from-toc`, `HYTALE_GAME_LATEST`, and
  `--force-sdk` cover the useful exceptions without complicating the default.
- The 0.5.7 smoke plan completed in about one second, selected no app/reference rebuilds
  for the nine localization/index changes, and skipped SDK extraction.

## Live Deployment

No live deployment or runtime gate was performed in this pass. The user confirmed the
Windows development install was patched; the remote Kyn integration host has not yet
been confirmed on 0.5.7, and Kyn's repository agreement requires operator coordination
for remote deployment and validation.

After the target server is patched and coordinated, use the combined deployment and
run the standard smoke checks:

```bash
cd ../synthborn-kyn
node tools/deploy.js --target combined restart
node tools/deploy.js --target combined status
node tools/deploy.js --target combined rcon -- synth chunk list
node tools/deploy.js --target combined rcon -- synth testhome show
node tools/deploy.js --target combined rcon -- validate spawn-basic
node tools/deploy.js --target combined rcon -- validate berry-harvest at <x,y,z>
```
