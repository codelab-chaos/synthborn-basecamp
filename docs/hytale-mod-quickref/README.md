# Hytale Mod Docs — Local Concrete Reference

*A curated, local, code-forward reference for Hytale **server-side** modding, focused on what you actually call to build plugins, NPCs, and gameplay systems. Built for the `hytale-mods` project.*

Last compiled: 2026-05-25 · Server API version seen: `2026.05.01-43e16373b46`

---

## Why this folder exists

The official, polished "full server plugin API reference" does not exist yet — Hypixel has said creator docs are incomplete and the full server source is still ~1–2 months out. So this folder **consolidates the concrete bits that do exist** into one place you can read offline, grep, and link from the design docs.

Crucially, a lot of what's here is **verified against real working code** — the `HyCitizens/` and `NPCTrading/` plugins in this same repo compile and run against the live API, so their usage is ground truth, not guesswork.

## Source-confidence legend

Every non-obvious API claim in these docs is tagged:

| Tag | Meaning | Trust |
|---|---|---|
| ✅ **Verified** | Confirmed in this repo's `HyCitizens/` or `NPCTrading/` source (compiles against the real API) | Highest |
| 📘 **Official** | From hytale.com posts or `release.server.docs.hytale.com` (the official Javadoc) | High |
| 🌐 **Community** | From unofficial docs (`hytale-docs.pages.dev`, `hytalecharts.com`); accurate but may drift | Medium |

When ✅ and 🌐 disagree, trust ✅.

## Contents

| File | What it covers |
|---|---|
| [01-modding-overview.md](./01-modding-overview.md) | The 4 modding categories, server-first model, Java 25, limitations, roadmap |
| [02-server-plugins.md](./02-server-plugins.md) | `JavaPlugin` lifecycle, `manifest.json`, singleton `get()`, registries, plugin deps |
| [03-events.md](./03-events.md) | `EventRegistry`, register/global/async, priorities, cancellable, event catalog |
| [04-ecs.md](./04-ecs.md) | `Store`, archetypes, `Ref`, components, systems, querying |
| [05-npc-roles-and-ai.md](./05-npc-roles-and-ai.md) | Roles, instruction lists, sensors/actions/motions, blackboard, FSM mapping, debug |
| [06-npc-instancing-and-skins.md](./06-npc-instancing-and-skins.md) | **The verified spawn recipe**: `NPCPlugin.spawnEntity`, random skins, models |
| [07-inventory-and-items.md](./07-inventory-and-items.md) | `ItemStack`, `ItemContainer`, `Inventory`, slot sections, item events |
| [08-messaging-and-threading.md](./08-messaging-and-threading.md) | `Message`, `sendMessage`, `world.execute`, thread rules, async HTTP |
| [09-verified-api-cheatsheet.md](./09-verified-api-cheatsheet.md) | Dense list of every API signature confirmed from the repo code, with import paths |
| [10-references.md](./10-references.md) | All external sources + **how to download/refresh these docs locally** |

## Suggested reading order

For a brand-new server plugin: **01 → 02 → 03 → 08**, then **04** when you need entities/components.

For NPC work (the project's goal): **05 → 06 → 09**, with **04** alongside.

For the `hytale-synths` plan specifically, [06](./06-npc-instancing-and-skins.md) and [09](./09-verified-api-cheatsheet.md) are the load-bearing ones — they're what [`../bare-bones-synth.md`](../bare-bones-synth.md) is built on.

## Keeping this current

These are a snapshot. The API is young and churning. See [10-references.md](./10-references.md) for commands to re-clone the decompiled source and re-mirror the official Javadoc when the full server source ships. The single best long-term move is to **read the decompiled API directly** (see [10](./10-references.md)); these docs are the curated on-ramp, not a replacement.
