# Hytale Server SDK reference

Offline signatures from `javap -protected` over the pinned `com.hypixel.hytale:Server` jar.
Regenerate after version bumps — see [`tools/refs/sdk/README.md`](../../tools/refs/sdk/README.md).

## Start here

| File | Use when |
|------|----------|
| [`llms.txt`](llms.txt) | You know the **class** name — flat declarations by package |
| [`methods.txt`](methods.txt) | You know the **method** name — `grep placeBlock methods.txt` |
| [`methods.json`](methods.json) | Tooling / scripts need structured method lookup |
| Per-package `*.md` | You need full method signatures for one class |

## Search CLI

```bash
node tools/refs/sdk/sdk-search.js BlockPlaceUtils
node tools/refs/sdk/sdk-search.js --method placeBlock
node tools/refs/sdk/sdk-search.js --package interaction
node tools/refs/sdk/sdk-search.js --extends JavaPlugin
node tools/refs/sdk/sdk-search.js --grep CompletableFuture
```

## Version diff

After refresh, compare against the last commit:

```bash
node tools/refs/sdk/diff-sdk-reference.js
node tools/refs/sdk/diff-sdk-reference.js --against main
```

## Topic router

Jump to the packages that usually matter for mod work. Open the linked `.md` file(s) for method detail.

### Plugin lifecycle & commands

| Topic | Packages |
|-------|----------|
| Plugin entry | [`com.hypixel.hytale.server.core.plugin.md`](com.hypixel.hytale.server.core.plugin.md) |
| Commands | [`com.hypixel.hytale.server.core.command.system.md`](com.hypixel.hytale.server.core.command.system.md), [`com.hypixel.hytale.server.core.command.system.basecommands.md`](com.hypixel.hytale.server.core.command.system.basecommands.md) |

### World, universe, events

| Topic | Packages |
|-------|----------|
| Universe / players | [`com.hypixel.hytale.server.core.universe.md`](com.hypixel.hytale.server.core.universe.md) |
| World runtime | [`com.hypixel.hytale.server.core.universe.world.md`](com.hypixel.hytale.server.core.universe.world.md) |
| Entity store | [`com.hypixel.hytale.server.core.universe.world.storage.md`](com.hypixel.hytale.server.core.universe.world.storage.md) |
| World events | [`com.hypixel.hytale.server.core.universe.world.events.md`](com.hypixel.hytale.server.core.universe.world.events.md) |
| ECS primitives | [`com.hypixel.hytale.component.md`](com.hypixel.hytale.component.md) |

### Blocks, interaction, physics

| Topic | Packages |
|-------|----------|
| Place / break / harvest | [`com.hypixel.hytale.server.core.modules.interaction.md`](com.hypixel.hytale.server.core.modules.interaction.md) |
| Block module | [`com.hypixel.hytale.server.core.modules.block.md`](com.hypixel.hytale.server.core.modules.block.md) |
| Block health | [`com.hypixel.hytale.server.core.modules.blockhealth.md`](com.hypixel.hytale.server.core.modules.blockhealth.md) |
| Physics / projectiles | [`com.hypixel.hytale.server.core.modules.physics.md`](com.hypixel.hytale.server.core.modules.physics.md), [`com.hypixel.hytale.server.core.modules.projectile.md`](com.hypixel.hytale.server.core.modules.projectile.md) |

### Inventory & items

| Topic | Packages |
|-------|----------|
| ItemStack / inventory | [`com.hypixel.hytale.server.core.inventory.md`](com.hypixel.hytale.server.core.inventory.md) |
| Containers | [`com.hypixel.hytale.server.core.inventory.container.md`](com.hypixel.hytale.server.core.inventory.container.md) |
| Transactions | [`com.hypixel.hytale.server.core.inventory.transaction.md`](com.hypixel.hytale.server.core.inventory.transaction.md) |
| Dropped items | [`com.hypixel.hytale.server.core.modules.entity.item.md`](com.hypixel.hytale.server.core.modules.entity.item.md) |

### NPCs & roles

| Topic | Packages |
|-------|----------|
| NPC plugin / entities | [`com.hypixel.hytale.server.npc.md`](com.hypixel.hytale.server.npc.md) |
| Role data | [`com.hypixel.hytale.server.npc.role.md`](com.hypixel.hytale.server.npc.role.md) |
| Instructions (JSON) | [`com.hypixel.hytale.server.npc.instructions.md`](com.hypixel.hytale.server.npc.instructions.md) |
| World actions (place, scan, path) | [`com.hypixel.hytale.server.npc.corecomponents.world.md`](com.hypixel.hytale.server.npc.corecomponents.world.md) |
| Item actions (pickup, drop) | [`com.hypixel.hytale.server.npc.corecomponents.items.md`](com.hypixel.hytale.server.npc.corecomponents.items.md) |
| Movement / pathing | [`com.hypixel.hytale.server.npc.corecomponents.movement.md`](com.hypixel.hytale.server.npc.corecomponents.movement.md) |

### Built-in gameplay plugins

| Topic | Packages |
|-------|----------|
| Crafting / benches | [`com.hypixel.hytale.builtin.crafting.md`](com.hypixel.hytale.builtin.crafting.md) |
| Farming | [`com.hypixel.hytale.builtin.adventure.farming.md`](com.hypixel.hytale.builtin.adventure.farming.md) |
| Mounts | [`com.hypixel.hytale.builtin.mounts.md`](com.hypixel.hytale.builtin.mounts.md) |
| Portals / teleport | [`com.hypixel.hytale.builtin.portals.md`](com.hypixel.hytale.builtin.portals.md), [`com.hypixel.hytale.builtin.teleport.md`](com.hypixel.hytale.builtin.teleport.md) |
| Trigger volumes | [`com.hypixel.hytale.builtin.triggervolumes.md`](com.hypixel.hytale.builtin.triggervolumes.md) |

### Worldgen & generator

| Topic | Packages |
|-------|----------|
| Builtin worldgen modifiers | [`com.hypixel.hytale.builtin.worldgen.md`](com.hypixel.hytale.builtin.worldgen.md), [`com.hypixel.hytale.builtin.worldgen.modifier.md`](com.hypixel.hytale.builtin.worldgen.modifier.md) |
| HytaleGenerator plugin | [`com.hypixel.hytale.builtin.hytalegenerator.md`](com.hypixel.hytale.builtin.hytalegenerator.md) |
| Server worldgen loaders | [`com.hypixel.hytale.server.worldgen.md`](com.hypixel.hytale.server.worldgen.md) |

### Protocol & messaging

| Topic | Packages |
|-------|----------|
| Wire types | [`com.hypixel.hytale.protocol.md`](com.hypixel.hytale.protocol.md) |

## Mod-specific maps

- **SynthUnits:** [`synthborn-kyn/kyn-docs/hytale-builtin-sdk-map.md`](https://github.com/codelab-chaos/synthborn-kyn/blob/main/kyn-docs/hytale-builtin-sdk-map.md)
- **Overseer:** worldgen notes in `synthborn-overseer/worldgen-2-research.md`

## Limits

- Signatures only — no behavior, threading rules, or deprecation markers.
- Watch `./gradlew compileJava` warnings after a version bump for `[removal]` APIs.
