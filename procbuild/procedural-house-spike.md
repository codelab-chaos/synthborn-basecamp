# Procedural House Spike

Status: parked as an experiment.

`/os-house` was a direct slash-command spike for placing a deterministic small cottage at
the ground block the player is looking at. It lives in:

- `mods/SynthOverseer/src/main/java/com/codelabchaos/synthoverseer/commands/OsHouseCommand.java`
- `mods/SynthOverseer/src/main/java/com/codelabchaos/synthoverseer/tools/procbuild/`

## What Worked

- Player gaze picking works when the command uses `PlayerLookTracker` instead of
  `TransformComponent.getRotation()`. Body rotation can lose camera pitch.
- `BlockSelection.place(...)` gives us native placement behavior and keeps the write path
  compatible with the existing placement journal / undo tooling.
- Per-block rotation belongs in the shared `BlockPlacement` model. The useful durable
  plumbing is:

  `BlockPlacement.rotation()` -> `PrefabHelper.toBlockSelection(...)` ->
  `BlockSelection.addBlockAtWorldPos(..., rotation, ...)`

- Keeping the generator under `tools/procbuild` made the spike easy to isolate.

## What Did Not Work

- Raw block-by-block cottage generation is visually weak without a lot of hand-authored
  grammar. The first houses read as stamped boxes; roof tuning became its own project.
- Door, window, roof, stair, and fence orientation are state-sensitive. Guessing rotation
  values from block ids is fragile.
- Better visual quality will come faster from curated prefabs or prefab-derived modules
  than from hand-tuning a tiny procedural grammar.

## Decision

Keep:

- `BlockPlacement` rotation support.
- The reference prefab extractor and module catalog.
- The isolated `procbuild` package while it remains useful as a scratchpad.

Do not promote:

- `/os-house` as a supported player-facing Creator feature.
- The current raw-block cottage grammar as the basis for town building.

Next better path:

- Use internal Hytale prefabs for direct placement where possible.
- Use reference prefab packs to extract palettes, rotations, proportions, and module
  connectors.
- Build higher-level tools around curated modules: house parts, wall segments, towers,
  gatehouses, paths, and foundations.
