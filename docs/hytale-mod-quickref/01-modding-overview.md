# 01 — Modding Overview & Strategy

*The big picture: what Hytale modding is, what it isn't, and the constraints every plugin lives under.*

Sources: 📘 [Hytale Modding Strategy & Status](https://hytale.com/news/2025/11/hytale-modding-strategy-and-status), 📘 [NPC Technical Rundown](https://hytale.com/news/2026/2/npc-technical-rundown)

---

## The four modding categories 📘

| Category | Format | What it's for |
|---|---|---|
| **Server Plugins** | Java `.jar` | Custom logic, gameplay systems, commands, minigames, economies, new asset types. The programmatic surface. |
| **Data Assets** | JSON | Define core content: blocks, items, **NPCs**, world generation, drop tables, loot. |
| **Art Assets** | Blockbench (models/textures) + sounds | Visual/audio content. |
| **Save Files** | worlds / prefabs | Shareable worlds and prefab structures for worldgen. |

NPC behavior is split across two of these: the **logic** is data assets (JSON Roles + instruction lists), and **new behavior element types** are server-plugin Java. See [05-npc-roles-and-ai.md](./05-npc-roles-and-ai.md).

## Server-first, no client mods 📘

This is the single most important architectural fact and it shapes everything:

- **Everything runs on the Java server** — even single-player, which runs "a local server that is just for yourself."
- **No client mods.** The team explicitly says they "don't intend to support any client mods" to avoid fragmentation: "You should be able to join any modded Hytale server without downloading external mods."
- Practical consequence: **all your gameplay code is server-side Java.** There's no client-side scripting path. Things the client owns that aren't yet exposed to the server are simply unavailable (see limitations).

## Runtime facts ✅📘

- **Java 25.** (✅ confirmed — repo plugins target it; 📘 the design docs cite the `2026.03.26` server line.)
- Plugins extend `JavaPlugin` with a `setup()` / `start()` / `shutdown()` lifecycle. See [02-server-plugins.md](./02-server-plugins.md).
- Two event surfaces: a classic `EventRegistry` for game events, and an ECS `EntityStoreRegistry` for per-entity systems. See [03-events.md](./03-events.md) and [04-ecs.md](./04-ecs.md).
- **Outbound HTTP is allowed** (`java.net.http.HttpClient`) and already used in practice (HyCitizens fetches skins) — keep it off the main thread. See [08-messaging-and-threading.md](./08-messaging-and-threading.md).

## Top-level API package map 📘

From the official Javadoc (`release.server.docs.hytale.com`, version `2026.05.01`) and the decompiled mirror:

```text
com.hypixel.hytale.component      → the ECS core (Store, Ref, Archetype, systems, queries)
com.hypixel.hytale.server.core    → assets, commands, entity/player mgmt, world/universe/chunk, permissions
com.hypixel.hytale.server.npc     → NPCPlugin, NPCEntity, RoleChangeSystem  (the NPC instancing surface)
com.hypixel.hytale.builtin        → adventure (NPCs, objectives, reputation, shops, memories), worldgen,
                                     crafting, farming, deployables, mounts, weather, builder/prefab, …
com.hypixel.hytale.protocol       → packets, network, connection/auth
com.hypixel.hytale.math           → vectors, ChunkUtil
com.hypixel.hytale.common.util    → RandomUtil, misc helpers
```

The `builtin.*` packages are gold: they're Hypixel's own implementations of crafting, farming, reputation, objectives, memories, etc. — read them to see "how the engine itself does it."

## Tooling & documentation maturity (manage expectations) 📘

Hypixel is candid that this is early:

- Configuration is "directly in JSON files using text editors" — "workable, but painful."
- Debugging NPCs means "reading through pages upon pages of detailed log files."
- "Certain aspects of client behaviour are not yet exposed to the server."
- Tools are "rough, inconsistent, or painful"; docs are incomplete.

## Roadmap 📘

- **Short term:** full server **source code release (~1–2 months post-launch)**, better asset distribution, custom UI via NoesisGUI, stability fixes.
- **Long term:** visual scripting + node editors (they rejected text-based Lua), bounty programs, in-world visual linking for adventure creation.

The source-code release is the big one — it turns all the "unofficial decompiled reference" caveats in these docs into "just read the source."

## What this means for the `hytale-synths` project

1. The body layer is **engine API you call**, not magic HyCitizens owns — see [06-npc-instancing-and-skins.md](./06-npc-instancing-and-skins.md). This is what makes [`../research-bank/bare-bones-synth.md`](../research-bank/bare-bones-synth.md) feasible without a dependency.
2. NPC behavior wants to live in **JSON Roles + instruction lists**; reach for custom Java elements only when no built-in element fits.
3. Everything is server-side and single-threaded-per-world — **respect the world thread** (see [08](./08-messaging-and-threading.md)) or you'll get nondeterministic corruption.
