# Hytale 0.6.5 worklog

Date: September 10, 2026. Scope: Basecamp refresh and deterministic SDK extraction
optimization, preparing the next Terrascape migration step.

## Installed inputs and assets

- Windows launcher install reports Hytale Server 0.6.5.
- Server SHA-256: `51cf5991eaf78e5f77a9b1d68370fa79c3c2dd81df0a71a34746f4ceebf7c801`.
- Ported the official Update 6 hotfix roundup, including 0.6.5, and added its version row.
- Captured `docs/refs/assets/toc/assets-toc-0.6.5.json`: 60,695 files.
- Synced three changed assets, zero additions/removals: Portuguese (Brazil), Ukrainian,
  and Simplified Chinese `server.lang` files. No generated English label, recipe, NPC,
  icon, or prefab consumer changed; those datasets retain their previous provenance.

## SDK optimization and actual update

- Seeded the local signature cache using the retained Maven 0.6.4 jar. Its SHA-256
  exactly matched Basecamp's 0.6.4 source stamp.
- Batched cold extraction inspected 5,658 top-level class files. All 1,001 current
  package Markdown files matched the old per-class extractor byte-for-byte.
- Full-mode pruning removed two stale generated package files already absent from
  0.6.4: `builtin.adventure` (empty) and
  `builtin.hytalegenerator.assets.interpolationasset` (one obsolete class).
  These are historical reference cleanup, **not removals introduced by 0.6.5**.
- 0.6.4 -> 0.6.5 preflight: 5,659 selected classes; 5,651 reused, seven changed,
  one added, zero removed. Only eight classes required inspection, in one JVM batch.
- Extraction wrote five package Markdown files and left 996 untouched.
- Added public class: `com.hypixel.hytale.server.core.io.ConnectionRegistry`.
- Public signature changes: `AssetEditorPacketHandler`, `PacketHandler`,
  `SetupPacketHandler`, `GamePacketHandler`, and `AccessControlModule`.
- `KickCommand` and world-map `ImageBuilder` changed bytecode without changing the
  documented public/protected signature surface. The official server world-map memory
  leak fix is relevant to Terrascape even though the compact API diff is unchanged there.
- Rebuilt flat/search indexes and SDK Explorer data with explicit 0.6.5 provenance:
  5,617 app cards and 40,980 method entries. The class router also includes interfaces
  differently from the app parser, so its count is not interchangeable with card count.

## Implementation changes

- ZIP entry CRC-32/size comparison and normalized `javap -protected` signatures;
  no LLM or heuristic interpretation decides whether files change.
- Local disposable signature cache, invalidated by extractor or javap-version changes.
- Up to 50 classes per javap invocation, including cold-cache and forced runs.
- Read-only `--plan` / `--json` preflight, integrated with `update:plan`.
- Write package Markdown only when content differs; prune obsolete generated packages
  in full mode; rebuild cheap indexes and version metadata.
- Abort on failed/incomplete disassembly before publishing generated output.
- Pass the new source version to the app-data builder before publishing the success
  stamp; previously it could use the old stamp while building the new app data.
- Keep custom `--out` app data inside that output tree.
- Document a focused, evidence-based LLM workflow in `docs/sdk-research-workflow.md`.

## Validation

- Fixture integration tests pass for no-op reuse, read-only preflight, body-only
  edits, signature edits, visibility changes, additions, removals, cache corruption,
  and equality between incremental and clean package output.
- Full real-jar verification: all 1,001 package Markdown files plus `llms.txt` and
  `methods.txt` match a clean extraction exactly. Cold extraction took 66.77 seconds.
- `npm run verify`: passed (28 JavaScript files, 33 JSON files, stale-path scan,
  Markdown links, and three reference-query smoke tests).
- Warm read-only preflight took 2.82 seconds and scheduled zero javap batches.
- `npm run pages:build`: all static apps and `_site/` built; existing webpack
  bundle-size warnings only.
- Full extracted-asset CRC scan: all 60,695 files match 0.6.5, zero drift.

This refresh does not establish Terrascape's 0.6.5 runtime compatibility. Its owning
repository still needs the new compile pin, build, and MacBook validation. The prior
0.6.4 migration and device-authentication prerequisite remain documented there.
