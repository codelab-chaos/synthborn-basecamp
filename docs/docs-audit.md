# Internal Docs Audit

Date: 2026-06-12

Scope: internal docs under `docs/`, excluding mirrored external repos under `docs/external/`.
Generated SDK and asset indexes were reviewed as generated reference surfaces, not prose.

## Executive Summary

The docs are useful, but the folder is carrying three different eras at once:

1. Old monorepo paths such as `mods/SynthUnits`, `HyCitizens/`, `NPCTrading/`, and `_references/`.
2. Current basecamp reference tooling under `tools/refs/` and example source under `_mod-example-sourcecode/`.
3. Multiple NPC strategy tracks: HyCitizens companion plugin, self-contained `hytale-synths`, and Synthborn/Kyn-style runtime discoveries.

The strongest material is the generated reference layer and the compact LLM/quickref routing docs. The weakest material is overlapping planning prose that points at files that no longer exist or gives conflicting implementation direction without an explicit status.

## High-Priority Findings

### 1. Broken Local Links

A local markdown link scan found 35 broken links in internal markdown, excluding `docs/external/` and `docs/refs/sdk/`.

Main causes:

- `docs/bare-bones-synth.md` still links to `./hytale-mod-docs/...`; the folder is now `./hytale-mod-quickref/...`.
- `docs/concepts-getting-started.md` links to missing `./HyCitizens/`, `./NPCTrading/`, `./LLM_NPC_ROLEPLAY.md`, and `./hytale-test-automation.md`.
- `docs/hytale-synthetics.md` links to missing `./getting-started.md`, `./LLM_NPC_ROLEPLAY.md`, `./hytale-test-automation.md`, `./HyCitizens/README.md`, and `./NPCTrading/README.md`.
- `docs/refs/labels/README.md` links to `../apps/recipe-browser/` from inside `docs/refs/labels/`, which resolves to `docs/apps/recipe-browser/`; it should be `../../apps/recipe-browser/`.
- `docs/llm-hytale-modding-kb.md` links to `../mods/SynthUnits/`, which no longer exists in the split repo layout.

Status:

- Fixed `hytale-mod-docs` links to `hytale-mod-quickref`.
- Redirected `LLM_NPC_ROLEPLAY.md` references to `research-bank/research-llm-npc-roleplay.md`.
- Moved the older HyCitizens companion track to `idea-bank/hycitizens-companion-getting-started.md`.
- Marked `hytale-test-automation.md` as archived/missing where no file exists.
- Redirected verified example source claims to `_mod-example-sourcecode/`.
- Redirected SynthUnits/Kyn references to `../synthborn-kyn/` where applicable.

### 2. Docs README Was Still Monorepo-Shaped

`docs/README.md` says the shared docs depend on:

- `mods/SynthUnits`
- `mods/SynthRCON`
- root-level `tools/`
- root-level `_references/`

That does not match the current split-repo/basecamp model. Basecamp now owns shared reference docs and reference tools only; deployable mod repos own their own code, deployment, and operational workflows.

Status:

- Rewrote `docs/README.md` as the canonical docs map.
- Removed old `mods/*` framing.
- Added status/owner routing, generated-data tables, local source locations, and `idea-bank/`.
- Added `_mod-example-sourcecode/` as the current example-mod source cache.

### 3. Verified-Source Claims Were Stale

Several quickref docs say API claims are verified against `HyCitizens/`, `NPCTrading/`, or `mods/SynthUnits/` "in this repo". Those repos are no longer in basecamp.

Current reality:

- Example mod source should live in `_mod-example-sourcecode/` and be refreshed with `tools/refs/example-mods/sync-example-mod-repos.js`.
- Project implementation discoveries should live in sibling repos such as `../synthborn-kyn`, `../synthborn-overseer`, and `../synthborn-terrascape`.

Status:

- Updated quickref and LLM KB provenance to use `_mod-example-sourcecode/HyCitizens`, `_mod-example-sourcecode/NPCTrading`, and sibling Synthborn repos.
- Avoided "in this repo" for example code that now lives outside basecamp.

### 4. NPC Strategy Docs Conflicted Without a Clear Canonical Path

There are at least two incompatible directions:

- `docs/concepts-getting-started.md`: build a companion plugin on top of HyCitizens/NPCTrading.
- `docs/hytale-synthetics.md` and `docs/bare-bones-synth.md`: build a self-contained `hytale-synths` mod with no HyCitizens dependency.

`hytale-synthetics.md` does acknowledge this later, but the folder index does not tell a reader which is current, superseded, or exploratory.

Status:

- Added a "Doc Status" table to `docs/README.md`.
- Moved the older companion-plugin track to `docs/idea-bank/hycitizens-companion-getting-started.md`.
- Promoted `hytale-synthetics.md` as the active self-contained synth architecture.
- Moved `bare-bones-synth.md` to `docs/research-bank/` as the body-spawn feasibility spike that supports the active architecture.
- Added `docs/idea-bank/README.md` to distinguish archived ideas from active direction.

### 5. Large Captured `.mhtml` Files Were Poor Reference Material

Two root docs were full-page browser captures:

- `An Introduction to Making Models for Hytale _ Hytale.mhtml`
- `HYTALE PATCH NOTES - UPDATE 5 _ Hytale.mhtml`

Together they dominated internal-doc text scans, created false-positive grep hits, and were not pleasant for agents or humans to read.

Status:

- Ported once to markdown:
  - `docs/hytale-making-models-introduction.md`
  - `docs/hytale-update-5-patch-notes.md`
- Deleted the `.mhtml` captures.
- The markdown ports keep source URLs and remote `cdn.hytale.com` image/download references from the original posts.

## Medium-Priority Findings

### Generated Docs Need Clear Freshness Metadata

Good generated docs already identify their generator:

- `docs/refs/prefabs/README.md`
- `docs/procbuild/reference-prefab-modules.md`
- recipe and loot text files
- `docs/synthoverseer-builder-commands.md`
- `docs/console-commands.md`

But freshness varies. Some are generated from May 28 data while the repo is now being reorganized on June 12.

Recommended cleanup:

- Keep generated docs, but add a generated-data table in `docs/README.md` with:
  - file/folder
  - generator command
  - source data
  - last generated timestamp
  - owner repo if not basecamp
- Do not hand-edit generated docs except generator headers.

### Some Research Docs Are Useful But Unrouted

The NPC research docs are substantive, but there are many:

- `docs/research-bank/research-erenshor-npcs.md`
- `docs/research-bank/research-behavior-trees.md`
- `docs/research-bank/research-advanced-npc-techniques.md`
- `docs/research-bank/research-llm-npc-roleplay.md`
- `docs/research-bank/bare-bones-synth.md`
- `docs/idea-bank/more-ai-npc-behavior-talk.md`
- `docs/idea-bank/objects-code-theorycrafting.md`
- `docs/idea-bank/roles-behavior-trees.md`
- `docs/idea-bank/hycitizens-companion-getting-started.md`
- `docs/hytale-synthetics.md`

Status:

- Created `docs/research-bank/` for durable NPC, behavior-tree, LLM, and body-spawn research.
- Kept brainstorm and older strategy tracks in `docs/idea-bank/`.
- Renamed the typo file to `docs/idea-bank/roles-behavior-trees.md`.
- Promoted `docs/hytale-synthetics.md` as the active NPC architecture doc.
- Added `docs/research-bank/README.md` and updated `docs/README.md` routing.

### Operational Docs Are Mostly Aligned, But Need Ownership Labels

`docs/hytale-version-update-checklist.md` now points deployment commands at repo-local `tools/deploy.js`, which matches decentralized ownership. It still mentions RCON and smoke tests, but framed as actions from owning repos rather than basecamp-owned helpers.

Recommended cleanup:

- Keep this doc in basecamp because it coordinates cross-repo SDK/assets updates.
- Add an ownership note at top: basecamp coordinates reference refresh; each deployable repo owns build/deploy/RCON validation.
- Consider adding combined-target expectations for Kyn/Overseer/Terrascape once those repo-local scripts are stable.

## Usefulness Evaluation

| Area | Usefulness | Main Issue | Recommendation |
|---|---:|---|---|
| `docs/README.md` | High | Rewritten as canonical docs map | Keep current as the first docs router. |
| `docs/llm-hytale-modding-kb.md` | High | Some verified-source paths stale | Keep, fix provenance and sibling repo links. |
| `docs/hytale-mod-quickref/` | High | Strong content, stale provenance and old refresh workflow | Keep, fix source paths and update refresh instructions. |
| `docs/refs/sdk/` | High | Huge generated surface | Keep generated; route users through `sdk-search`, `llms.txt`, `methods.txt`. |
| `docs/refs/recipes/` | High | Huge generated surface with some `TODO` bench labels | Keep; note generator limitations. |
| `docs/refs/labels/` | High | One broken app link | Keep; fix link. |
| `docs/hytale-version-update-checklist.md` | High | Needs explicit decentralized ownership wording | Keep and update. |
| `docs/hytale-synthetics.md` | Medium-High | Promoted active NPC architecture | Keep at docs root as the current architecture. |
| `docs/idea-bank/hycitizens-companion-getting-started.md` | Medium | Older HyCitizens companion track | Keep as archived/alternative context. |
| `docs/research-bank/bare-bones-synth.md` | Medium-High | Good body-spawn feasibility spike | Keep as background/supporting spike for `hytale-synthetics.md`. |
| [`docs/research-bank/`](research-bank/) | High | Durable NPC research now routed | Keep durable research out of root docs. |
| [`docs/idea-bank/`](idea-bank/) | Medium | Brainstorms and older planning material | Keep out of active docs flow unless promoted. |
| `.mhtml` captures | Done | Ported to markdown and deleted | Keep markdown ports; do not re-add browser snapshots. |
| `docs/procbuild/` | Medium | Terrascape/procbuild-oriented history | Keep if still useful; label owner and status. |

## Proposed Cleanup Order

1. Done: fix broken links and stale folder names.
2. Done: rewrite `docs/README.md` as the authoritative map with status/owner columns.
3. Done: update quickref provenance from old in-repo examples to `_mod-example-sourcecode/`.
4. Done: mark NPC strategy docs as active, durable research, archived, or idea bank.
5. Done: port `.mhtml` captures to markdown and delete browser snapshots.
6. Add a generated-data index so generated docs are auditable without reading them.
