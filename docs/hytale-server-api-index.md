# Hytale Server API Index

This is a local map for discovering useful SDK classes under `com.hypixel.hytale.server`.

The official/reference docs are spread across `_references/`, and the SDK jar has more classes than the prose docs mention. Use this file as a human-curated starting point, then use `javap` or source examples to inspect exact method signatures.

## Generate Class Lists

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\sdk\list-hytale-server-api.ps1
powershell -ExecutionPolicy Bypass -File .\tools\sdk\list-hytale-server-api.ps1 -Package "com/hypixel/hytale/server/core/command"
powershell -ExecutionPolicy Bypass -File .\tools\sdk\list-hytale-server-api.ps1 -Package "com/hypixel/hytale/server/npc"
```

Inspect a class signature:

```powershell
$jar = Get-ChildItem "$env:USERPROFILE\.gradle\caches\modules-2\files-2.1\com.hypixel.hytale\Server" -Recurse -Filter "*.jar" | Select-Object -First 1
javap -classpath $jar.FullName -private "com.hypixel.hytale.server.core.command.system.basecommands.AbstractWorldCommand"
```

## Command System

Package:

`com.hypixel.hytale.server.core.command.system`

Important classes:

- `AbstractCommand`: root command base.
- `CommandBase`: generic synchronous command with `CommandContext`.
- `AbstractAsyncCommand`: generic async command with `CommandContext`.
- `AbstractPlayerCommand`: player-only command; gives player ref, entity store, and world.
- `AbstractWorldCommand`: world-context command; useful for console/RCON-safe commands that still need a world.
- `AbstractAsyncWorldCommand`: async world-context command.
- `CommandContext`: parsed input plus sender helpers.
- `CommandSender`: common sender interface for player/console/RCON style senders.
- `CommandRegistry`: registration point from plugins.

Local docs:

- `docs/external/hytale-modding-handbook/docs/commands.md`
- `docs/external/hytale-docs/src/content/docs/modding/plugins/commands.md`
- `docs/external/hytale-docs/src/content/docs/modding/plugins/tasks.md`

## Plugin Lifecycle

Package:

`com.hypixel.hytale.server.core.plugin`

Important classes:

- `JavaPlugin`: base class for server plugins.
- `JavaPluginInit`: constructor input for plugin initialization.

Common lifecycle methods:

- `setup()`: register components, commands, events, and custom builder/core component types.
- `start()`: runtime startup after setup.
- `shutdown()`: cleanup scheduled tasks and in-memory state.

## Universe And World

Packages:

- `com.hypixel.hytale.server.core.universe`
- `com.hypixel.hytale.server.core.universe.world`
- `com.hypixel.hytale.server.core.universe.world.storage`

Important classes:

- `Universe`: access loaded worlds.
- `World`: world execution context and world store access.
- `EntityStore`: entity component store for world entities.
- `PlayerRef`: player-facing command/runtime helper.
- `ChunkPreLoadProcessEvent`: useful for rediscovery when chunks load.

## Components And Entities

Packages:

- `com.hypixel.hytale.component`
- `com.hypixel.hytale.server.core.modules.entity.component`
- `com.hypixel.hytale.server.core.universe.world.storage`

Important classes:

- `ComponentType`
- `Ref`
- `Store`
- `TransformComponent`
- `EntityStore`

Pattern:

- Custom persistent state lives in registered entity-store components.
- Runtime code usually receives or finds a `Ref<EntityStore>`, then reads/writes components through its store.

## NPC System

Packages:

- `com.hypixel.hytale.server.npc`
- `com.hypixel.hytale.server.npc.role`
- `com.hypixel.hytale.server.npc.instructions`
- `com.hypixel.hytale.server.npc.corecomponents`
- `com.hypixel.hytale.server.npc.sensorinfo`

Important classes:

- `NPCPlugin`: register custom NPC core component builders and spawn NPC entities.
- `NPCEntity`: entity component for NPCs.
- `Role`: active NPC role data.
- `SensorBase` / `BuilderSensorBase`: custom sensors for role JSON.
- `PositionProvider`: runtime sensor payload for position-based motions.
- `Feature`: load-time feature metadata; custom sensors must call `provideFeature(...)` for body motions to validate.

Known SDK lesson:

- Runtime `InfoProvider` output is not enough. Role validation also checks builder-provided features such as `Feature.Position`.

See:

- `mods/SynthUnits/mod-dev-discoveries.md`

## NPC Role JSON Debugging

When a synth/NPC role does not register:

1. Search the server log for `[NPC|P] FAIL`.
2. Fix role validation before debugging spawn code.
3. Remember that role JSON `Type` names are registry names, not necessarily Java class names.
4. If a body motion says a target/vector feature is missing, inspect the upstream sensor builder's `provideFeature(...)` calls.

## Good Discovery Workflow

1. Search `_references/` for examples.
2. Use `tools/sdk/list-hytale-server-api.ps1` to find nearby classes.
3. Use `javap` to inspect exact constructors/methods.
4. Record reusable SDK gotchas in `mods/SynthUnits/mod-dev-discoveries.md`.
