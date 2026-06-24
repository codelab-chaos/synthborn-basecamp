# Hytale Trigger Volumes - Update 5 / 0.5.4 Research

This note summarizes Hytale Update 5's Trigger Volume system from the public patch notes and the local 0.5.4 SDK reference. Trigger volumes are the main new authoring primitive in this patch and look directly useful for Synthborn adventure, village, quest, and encounter tooling.

## Short Version

Update 5 added the Trigger Volume Tool: persistent 3D volumes that fire configured effects when conditions are met. The official notes describe them as invisible box/sphere/cylinder regions that can react to entities entering, exiting, ticking inside the region, or block changes inside the region. They are saved into the world, can be grouped, and can be included in prefabs.

For Synthborn, this is probably the right primitive for "make the world react" behavior:

- enter a village and start music, dialogue, or a quest beat
- cross a biome boundary and spawn an ambush
- step into a ruin and enable hidden volumes deeper inside
- break the marked block and open a door
- place a key item and trigger VFX, sound, title text, and prefab placement
- save an entire interactive encounter as a prefab

## Official Patch Findings

Confirmed from Hytale Update 5:

- Trigger volumes are persistent 3D volumes that trigger effects when conditions are met.
- They support player enter/exit, block break, and other interaction moments.
- They can be placed, resized, rotated, configured in-game, multi-selected, grouped, duplicated, and saved in prefabs.
- Official effects include sound, VFX, velocity, weather, teleportation, game mode changes, inventory changes, NPC spawning, and prefab placement.
- Effects can have delays and conditions.
- Modders can add custom events, conditions, and effects.
- Update 5 includes a `Trigger_Volume_Showcase` prefab.
- Update 6 fixed several follow-up Trigger Volume issues: world spawning, chunk data access, crash fixes, and `/worldgen reload` correctly deleting existing trigger volumes.

The pre-release notes add useful detail:

- Conditions can gate effects by permission, game mode, inventory state, cooldowns, and random chance.
- Effects are split into success effects and rejection effects.
- Conditions/effects are evaluated per event, so one volume can respond differently to different event types.
- Trigger volumes can react to tags being added/removed and blocks being placed/broken.
- Grouped volume effects/settings save and load through prefabs, pasted prefabs, and generated prefabs.
- Delayed effects can be canceled when an entity leaves the volume.

## SDK Surface

The local SDK reference has a substantial `com.hypixel.hytale.builtin.triggervolumes` surface. This is not just a client UI feature.

Important packages:

- `com.hypixel.hytale.builtin.triggervolumes.manager`
- `com.hypixel.hytale.builtin.triggervolumes.command`
- `com.hypixel.hytale.builtin.triggervolumes.component`
- `com.hypixel.hytale.builtin.triggervolumes.effect`
- `com.hypixel.hytale.builtin.triggervolumes.effect.builtin`
- `com.hypixel.hytale.builtin.triggervolumes.effect.builtin.conditions`
- `com.hypixel.hytale.builtin.triggervolumes.shape`
- `com.hypixel.hytale.builtin.triggervolumes.asset`
- `com.hypixel.hytale.builtin.triggervolumes.prefab`
- `com.hypixel.hytale.builtin.triggervolumes.system`
- `com.hypixel.hytale.builtin.triggervolumes.ui`

The core persistent data appears to be `TriggerVolumeManager`, which stores `VolumeEntry` and `GroupEntry` records. `VolumeEntry` includes:

- id and world name
- position and shape
- effects, conditions, and rejection effects
- condition timing
- target entity types
- projectile source handling
- enabled state
- keep-loaded flag
- worldgen flag
- activation delay
- cooldown and cooldown mode
- effect asset reference
- group id
- display color
- tags
- runtime activation state

Supported event types in the SDK:

- `ENTER`
- `EXIT`
- `TICK`
- `TAG_ADDED`
- `TAG_REMOVED`
- `BLOCK_PLACED`
- `BLOCK_BROKEN`

Supported shapes in the SDK:

- `BoxShape`
- `SphereShape`
- `CylinderShape`

Builtin effects found in the SDK:

- `ControlDoorsEffect`
- `DamageEntityEffect`
- `DeleteVolumeEffect`
- `DisableVolumeEffect`
- `EnableVolumeEffect`
- `EntityEffectEffect`
- `GiveItemEffect`
- `ModifyTagsEffect`
- `PastePrefabEffect`
- `PlaceBlockEffect`
- `PlaySoundEffect`
- `PlayVfxEffect`
- `ReplaceBlockTypeEffect`
- `RunRootInteractionEffect`
- `SendMessageEffect`
- `SetGameModeEffect`
- `SetMusicEffect`
- `SetVelocityEffect`
- `SetWeatherEffect`
- `ShowEventTitleEffect`
- `TeleportEffect`
- `TriggerNpcMarkersEffect`

Builtin conditions found in the SDK:

- `BlockTypeCondition`
- `CooldownCondition`
- `GameModeCondition`
- `ItemCondition`
- `PermissionCondition`
- `PlayerCountCondition`
- `RandomChanceCondition`
- `TagCondition`

The SDK also has `TriggerEffectAsset`, which can package conditions, success effects, rejection effects, condition timing, and target types. That is a strong hint that effect bundles can be data-driven assets, not only ad hoc UI state.

## Commands And UI

SDK command classes indicate a server command surface already exists:

- create, remove, info, list, view, browse, test
- enable/disable volumes
- enable/disable/list by tag
- assign/unassign effects
- assign group effects
- effect browsing/editing commands

Protocol classes also exist for the in-game tool workflow, including create, delete, duplicate, move, resize, group move, group create, ungroup, select, set color, set target types, set cooldown, set condition timing, set activation delay, set cancel delayed on exit, and set keep-loaded.

That means we likely have three possible integration paths:

- call official commands through the console/RCON layer
- use SDK APIs directly from Java for a cleaner typed tool surface
- write/read TriggerEffectAsset or prefab-linked trigger data where assets are easier to author safely

The Java API route is probably best long term. Console commands are useful for early experiments, but typed Java tools will be easier for Overseer to call reliably.

## Prefabs And Worldgen

The patch notes and SDK both point at prefab integration:

- trigger volumes can be saved as part of prefabs
- pasted prefabs remap trigger volume links/groups
- generated prefabs can include grouped trigger volume effects/settings
- SDK has `TriggerVolumePrefabContributor`, `TriggerVolumePasteHandler`, `TriggerVolumePrefabPasteRemapSystem`, `TriggerVolumeWorldGenHandler`, and `TriggerVolumeGroupWorldGenHandler`

This matters because our village and adventure systems should not just place blocks. A "bandit camp" prefab can include:

- visible structures
- invisible encounter volumes
- grouped logic volumes
- effect assets
- NPC marker triggers
- quest checkpoint tags
- one-shot reward/ambush volumes

That makes prefabs the right container for reusable interactive places.

## Block Physics / Falling Blocks

The block physics hunch is also real. Update 5 added "initial tech support to enable falling blocks" plus:

- `FallingBlockImpact`
- `ExplodeFallingBlockImpact`
- `ExplosionConfig` on `BlockType`
- creative-mode `No Physics`, which suppresses block updates during placement/breaking so neighboring supported blocks do not collapse

The SDK includes:

- `com.hypixel.hytale.builtin.blockphysics.BlockPhysicsPlugin`
- `BlockPhysicsSystems`
- `BlockPhysicsUtil`
- `PrefabBufferValidator`
- `WorldValidationUtil`
- `com.hypixel.hytale.server.core.blocktype.component.BlockPhysics`
- `PhysicsDropType`

This is worth tracking, but it is less immediately "Overseer authoring surface" than Trigger Volumes. It affects how generated structures behave, how prefabs validate, and whether creative placement should intentionally suppress physics while building.

## What This Enables For Overseer

Trigger volumes are a better fit than free-form scripts for many "adventure world" requests because they are declarative, visible to tools, saved with the world/prefab, and inspectable after the fact.

Good Overseer workflows:

- "Add a welcome trigger at this village entrance."
- "Make this ruin play a title card and spawn two guards when entered."
- "Make this shrine give a reward once, but only if the player has the moon key."
- "Make this bridge collapse when the marked block is broken."
- "Save this encounter as a reusable prefab."
- "Show me all active triggers near me."
- "Disable every trigger tagged `quest:goblin_cave`."

Likely first Synthborn tools:

- `list_trigger_volumes(radius?)`
- `inspect_trigger_volume(id)`
- `create_trigger_volume(name, shape, position, size, tags, color)`
- `set_trigger_volume_effects(id, effects, conditions?)`
- `enable_trigger_volume(id)` / `disable_trigger_volume(id)`
- `delete_trigger_volume(id)`
- `assign_trigger_effect_asset(id, asset_id)`
- `create_trigger_effect_asset(id, conditions, effects, rejection_effects?)`
- `preview_trigger_volumes(radius?)`

Safety expectations:

- default all created volumes to visible-to-admin preview metadata and clear names/tags
- require confirmation for effects that teleport, damage, change game mode, delete/disable volumes, paste prefabs, or issue commands
- always provide list/inspect/delete before broad creation
- prefer tags for ownership: `synthborn:<feature>`, `quest:<name>`, `village:<id>`

## Suggested Authoring Model

For us, a trigger volume should be treated as:

```text
volume = where and when
conditions = whether this event is allowed
effects = what happens if allowed
rejection effects = optional feedback when blocked
tags = ownership, quest state, grouping, and later cleanup
```

Example encounter:

```text
name: moon_shrine_entry
shape: box
event: ENTER
conditions:
  - item condition: player has moon_key
  - cooldown: once per player
effects:
  - play_vfx: shrine_glow
  - play_sound: shrine_awaken
  - show_event_title: "The Shrine Wakes"
  - modify_tag: quest.moon_shrine.entered=true
  - enable_volume: moon_shrine_reward
rejection_effects:
  - send_message: "The shrine is silent."
```

Example village ambience:

```text
name: village_crossing_01
shape: cylinder
event: ENTER
conditions:
  - cooldown: 120 seconds per player
effects:
  - set_music: village_theme
  - send_message: "You enter Honeyvegetable."
```

## Open Questions

- What is the exact serialized JSON shape for `TriggerEffectAsset` in asset files?
- Are trigger volumes stored directly in world save data, prefab entity data, or both depending on origin?
- Can we safely create volumes through public Java APIs without emulating the UI packet flow?
- Are builtin command names stable enough for a temporary console/RCON bridge?
- What target entity types are supported beyond players, NPCs, projectiles, and item entities?
- How much of "NPC spawning" is direct spawning versus triggering NPC markers?

## Sources

- Hytale official Update 5 patch notes, May 26, 2026: `https://hytale.com/news/2026/5/update-5-patch-notes`
- Hytale official pre-release Update 5 patch notes, April 2026: `https://hytale.com/news/2026/4/hytale-pre-release-patch-notes-update-5`
- Hytale official pre-release Update 6 patch notes, May 2026: `https://hytale.com/news/2026/5/pre-release-patch-notes-update-6`
- Local SDK reference: `docs/sdk/com.hypixel.hytale.builtin.triggervolumes.*.md`
- Local SDK reference: `docs/sdk/com.hypixel.hytale.builtin.blockphysics.md`
- Local archived patch note copy: `docs/HYTALE PATCH NOTES - UPDATE 5 _ Hytale.mhtml`
