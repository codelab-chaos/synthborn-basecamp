# SDK research for Synthborn agents

Use Basecamp to find a small, versioned answer, then validate it in the owning mod.
Start with `llm.txt`; do not load the full SDK, app JSON, or class-signature cache.

## Automation boundary

SDK Markdown is produced exclusively by local scripts, fixed templates, ZIP fingerprints,
and JDK tools. There are no model calls, prompts, generated explanations, or LLM judgments
in extraction, change detection, or Markdown rendering. Reviewed research notes are
separate from this pipeline. Identical signatures render identical package Markdown;
index generation timestamps are provenance metadata, not API-change inputs.

## Fast release workflow

1. Run `cd tools && npm run update:plan`. It reports asset consumers and the
   number of new/changed/removed class files before any disassembly.
2. Run `npm run update:apply`. Class fingerprints and normalized signatures are
   compared deterministically; only changed package Markdown is written. Unchanged
   classes reuse the local cache; cold runs batch 50 classes per JVM.
3. Read `npm run sdk:diff` and the release worklog. Bytecode changes are not
   necessarily public API changes. Baseline cleanup is not a new-release removal.
4. Search the owning mod for the affected types/members, compile against the exact
   new jar with deprecation/removal lint, then run focused runtime checks.

For machine-readable preflight, use
`npm run sdk:extract -- --jar <installed-jar> --json`. The package script includes
`--full`; that means the established reference scope, not a forced cold extraction.

## Find the smallest useful reference

| Task | First lookup | Evidence to inspect next |
| --- | --- | --- |
| Read terrain | `npm run sdk:search -- --method getChunkSectionReference --limit 8` | `BlockChunk`, `BlockSection`, `FluidSection`; Terrascape's `TerrainChunkReader` and its tests |
| Read NPC health | `npm run sdk:search -- DefaultEntityStatTypes --limit 5` | `EntityStatMap`; Terrascape's `EntityFields` and its runtime validation report |
| Query NPCs | `npm run sdk:search -- NPCEntity --limit 5` | Component queries and the owning mod's NPC scanner/systems |
| Schedule world work | `npm run sdk:search -- --method execute --limit 10` | `World` and the actual call-site thread; never infer thread safety from a signature |
| Paste prefabs | `npm run sdk:search -- PrefabUtil --limit 5` | Current flag overloads and Overseer's paste/undo implementation; compile to check migration status |
| Investigate a removal | `npm run sdk:diff` | Official release notes, current jar, and affected owning-mod call sites |

Commands above run from `tools/`. Follow the returned package/file link and read
only the relevant class section. A sibling implementation is evidence of usage,
not automatically proof it is current or correct; check its dependency pin and tests.

## What each source proves

- **Installed jar / exact Maven version:** the authoritative binary being targeted.
- **Generated signatures and indexes:** declared public/protected signatures for
  selected top-level types. They omit nested-type coverage in many places, excluded
  packages, Javadoc, annotation metadata, and method behavior.
- **Official [Hytale documentation](https://docs.hytale.com/):** API explanations,
  creator documentation, and asset reference. Check version/patchline before applying
  rolling online documentation to a pinned local jar.
- **`javap -v` for a specific class:** class-file details, including annotations and
  deprecation metadata absent from our compact signature view.
- **Implementation inspection:** resolves behavior questions left unanswered by docs,
  such as world-thread waits, load flags, ownership, and failure paths.
- **Compilation and runtime tests:** validate actual usage. Clean signatures alone
  do not prove source compatibility, thread safety, or correct in-game behavior.

## Highest-value next improvements

Keep deterministic generated facts separate from reviewed guidance. Prefer a structured,
versioned API catalog as the source for Markdown, search, and release diffs, with explicit
deprecation/removal metadata and public nested types. Add short task guides only for
repeated Synthborn operations, each with exact-version provenance and a tested example.
Link to official explanations instead of generating speculative descriptions for every
method. These are follow-up improvements; the incremental extractor does not yet provide
annotation-aware API diffs or comprehensive nested-type coverage.
