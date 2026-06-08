# 05 — NPC Roles & AI (Instruction Lists)

*How Hytale NPCs think: Roles, instruction lists, sensors/actions/motions, and how to map an FSM onto them. This is the "behavior" half; [06](./06-npc-instancing-and-skins.md) is the "body" half.*

Sources: 📘 [NPC Technical Rundown](https://hytale.com/news/2026/2/npc-technical-rundown), 🌐 [NPC & AI System](https://hytale-docs.pages.dev/modding/npc-ai/), 🌐 [NPC Framework guide](https://hytalecharts.com/news/hytale-npc-framework-behaviors-ai-modding-guide), ✅ `HyCitizens/.../Template_Citizen.json` (1,928 lines) + `RoleGenerator.java`

---

## Three layers 📘🌐

```text
Role            → the overall behavior profile of an NPC (JSON asset)
  └─ Instruction Lists  → ordered sequences the NPC follows (JSON)
       └─ Elements      → 150+ building blocks (Java), referenced from JSON
```

- **Roles** (JSON) — "the expression of their general behaviour and how they'll react to different stimuli." A Role bundles behavior logic, movement, carried items, and appearance.
- **Instruction lists** (JSON) — "not too far removed from decision trees or behaviour trees, but with some of the semantics simplified."
- **Elements** (Java, used from JSON) — the 150+ primitive types. Modders add new ones in Java.

## The evaluation model (this is the key semantics) 📘

> "Each instruction is evaluated in order and — if matched — executed. Unless specific flags are included in the instruction, we won't evaluate any further instructions in the list."

That is **fallback-selector** semantics (behavior-tree "Selector"): top-to-bottom, first match wins, stop. So **order = priority**. Put survival/threat instructions at the top, idle at the bottom. This is exactly the "guards high and left" rule from the behavior-tree research doc.

## Element categories 📘🌐

Each instruction is a **sensor** (the guard) plus the **actions/motions** to run if it matches:

| Category | Role | Examples (reported) |
|---|---|---|
| **Sensors** | Query game state → decide if this instruction fires | proximity, line-of-sight, health threshold, environmental conditions, faction awareness |
| **Actions** | Do something | attack, item interaction, communication, spawn, **state change** |
| **Motions** | Movement | pathfind, follow target, flee, patrol routes, formation/flock movement |
| **Modifiers** | Adjust an instruction | cooldown, probability weight, duration limit, priority override |

📘 The Rundown names concrete element types it ships with, e.g. `Target`, `Beacon`, `Seek`, `Attack`, `State`, `Timeout`, `Random` (from `Template_Citizen.json`).

## Supporting subsystems 🌐

The NPC-AI internals expose (read these in the decompiled `builtin.npc` package):

- **Blackboard System** — shared per-NPC AI memory (target, last-known-position, cooldowns). The decision layer reads it; sensors write it.
- **Decision Makers** — state evaluation that selects which instruction list / behavior is active.
- **Navigation** — A* pathfinding.
- **Animations** — animation state management.
- **Role** class + support objects: `CombatSupport`, `StateSupport`, `EntitySupport`, `WorldSupport`, `PositionCache`.
- **`NPCEntity`** — the component/handle for a live NPC (role management, instruction execution, movement, combat, interactions).

> ⚠️ Hytale's Role has **native** `IsMemory` / `MemoriesCategory` / `MemoriesNameOverride` params (the NPC's *in-world creature memory*). This is **separate** from any conversational/synth memory you build. Don't conflate them. (📘 in-repo `LLM_NPC_ROLEPLAY.md` §2.)

## Role JSON shape ✅

From the real `Template_Citizen.json` and how `RoleGenerator` emits roles:

```jsonc
{
  "Type": "Variant",            // Variant | Generic | Abstract
  "Reference": "Template_Citizen", // inherit/extend a base role (RoleGenerator.java:359)
  "Name": "MyRole"
  // + instruction lists of sensors → actions/motions
  // + movement, carried items, appearance, flock settings
}
```

- Roles live in a **data asset pack** at `Server/NPC/Roles/*.json`.
- `RoleGenerator` (HyCitizens, 711 lines) writes per-NPC roles that mostly just `"Reference"` the base `Template_Citizen`, overriding a few fields.
- Roles are registered through `NPCPlugin`; you resolve one to an index with `NPCPlugin.get().getIndex(roleName)` to spawn it ([06](./06-npc-instancing-and-skins.md)).

## Swapping roles at runtime ✅📘

```java
// com.hypixel.hytale.server.npc.systems.RoleChangeSystem
RoleChangeSystem.requestRoleChange(/* … */);
```

"A single entity can have its Role swapped at runtime" — this is how an NPC moves between coarse behavior modes (e.g. day-role ↔ combat-role) without re-spawning.

## Combat Action Evaluator 📘

A separate, fuzzier system for moment-to-moment combat: it **scores** available attacks against current conditions (HP low? enemy close? player sneaking?), adds randomness, and runs the highest-scoring one. More natural than instruction lists, but higher CPU cost. Use it for combat nuance, not general behavior.

## Debug visualization 📘

In-game flags to *see* what the AI is doing (essential, since debugging is otherwise log-diving):

```text
/npc debug set VisAiming
/npc debug set VisMarkedTargets
/npc debug set VisSensorRanges
/npc debug set VisLeashPosition
/npc debug set VisFlock
```

---

## Designing a behavior: the official workflow 🌐

The NPC tutorial's recommended process (maps cleanly onto an FSM):

1. **Read the design documentation** for the behavior you want.
2. **Break the behavior into distinct states** (these become top-level instruction lists).
3. **Identify existing predefined components/elements** — reuse before writing Java.
4. **Identify reusable behavior parts** (shared sub-lists).
5. **Optionally extract complex reusable parts later** (refactor once it works).

Example top-level states the tutorial starts with: `Idle`, `Sleep`, `Eat`, `Alerted`, `Combat`, `ReturnHome`.

## Worked example: an autonomous crop-farmer NPC

States, ordered by priority (top wins, per the selector semantics above):

```text
Flee / Alerted        ← highest: threat sensor fires, drop everything
ReturnHome            ← night / inventory full
DepositItems          ← near storage AND carrying harvest
RestockSeeds          ← out of seeds AND near seed chest
HarvestCrop           ← sensor: mature crop in range
FindCrop              ← motion: path to nearest mature crop
PlantSeed             ← near empty farmland AND has seeds
FindEmptyFarmland     ← motion: path to tilled-empty soil
Idle                  ← default fallthrough: wander/graze
```

Each state = one instruction (sensor guard + motion/action). Before writing any Java, check whether these already exist as elements: "find block," "path to target," "interact with storage," "detect inventory item." Only drop to a custom Java element when no built-in covers the verb.

> This is the same priority-selector + blackboard pattern documented in [`../research-behavior-trees.md`](../research-behavior-trees.md) — Hytale's instruction lists *are* a simplified behavior tree, so that research applies directly.

## Two paths to NPC behavior 🌐

- **No-code path:** author Roles + instruction lists in JSON, composing built-in elements. Start here.
- **Code path:** write new sensor/action/motion **element types** in Java when the 150+ built-ins don't cover your verb, then reference them from JSON.
