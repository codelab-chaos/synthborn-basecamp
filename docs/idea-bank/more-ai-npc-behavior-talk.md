You’re circling around something very powerful here: a hybrid AI architecture where NPCs use:

* **Behavior Trees (BTs)** for structured decision-making
* **FSMs** for immediate action states
* **Utility/Need systems** for motivation
* **Spatial memory** for persistence
* **LLM layers** for social reasoning/dialogue
* **Role templates** for scalable emergent societies

That’s basically the direction games like *Skyrim*, *RimWorld*, *Dwarf Fortress*, *Kenshi*, *The Sims*, and especially *Erenshor*-style “living MMO” NPCs are hinting at.

And Hytale is unusually suited for this because its NPC systems are explicitly data-driven and role-based. ([Hytale][1])

---

# The Core Idea

Think of an NPC as:

```text
ROLE
  -> defines profession/personality/goals

NEEDS
  -> hunger, safety, warmth, social, fatigue

MEMORY
  -> spatial + social + event memory

BEHAVIOR TREE
  -> long-term planning and task selection

FSM
  -> immediate action execution

LLM
  -> interpretation, dialogue, creativity
```

This gives you:

* believable daily routines
* emergent societies
* dynamic survival gameplay
* “stories” without scripting

---

# Skyrim vs Erenshor vs Hytale

| Game/System                 | Strength                            | Weakness                      |
| --------------------------- | ----------------------------------- | ----------------------------- |
| The Elder Scrolls V: Skyrim | Schedules + factions + sandbox AI   | Mostly fake routines          |
| RimWorld                    | Need-driven emergent stories        | Weak social realism           |
| Dwarf Fortress              | Deep simulation and history         | Opaque AI                     |
| Kenshi                      | Autonomous survival behaviors       | Limited personality           |
| The Sims                    | Utility AI and social loops         | Limited world persistence     |
| Erenshor                    | Simulated MMO-style NPC adventurers | Less environmental simulation |
| Hytale                      | Data-driven moddable NPC framework  | Still evolving                |

Hytale’s role system is especially promising because roles appear to encapsulate:

* movement
* combat
* reactions
* interactions
* instruction lists
* state transitions ([Hytale][1])

That maps perfectly to modular AI.

---

# Suggested AI Architecture

## Layer 1 — Needs / Utility System

This is the “why”.

Example needs:

```ts
enum NeedType {
  Hunger,
  Safety,
  Shelter,
  Warmth,
  Energy,
  Social,
  Duty,
  Curiosity,
  Wealth,
  Territory
}
```

Needs decay over time.

Example:

```ts
if (hunger > 80)
  increaseUtility("find_food")
```

This creates natural survival behavior.

---

# Layer 2 — Role Definition

Role defines:

* allowed jobs
* preferred tasks
* skills
* schedules
* combat style
* personality modifiers

Example:

```json
{
  "role": "farmer",
  "dailySchedule": {
    "morning": "tend_crops",
    "evening": "haul_food",
    "night": "sleep"
  },
  "preferredTools": ["hoe", "bucket"],
  "fears": ["zombies"],
  "socialAffinity": ["villagers"]
}
```

---

# Layer 3 — Behavior Tree

The BT decides *what to do next*.

Example high-level farmer tree:

```text
Selector
 ├── DefendSelf
 ├── EatIfHungry
 ├── SleepIfTired
 ├── HarvestNearbyCrops
 ├── PlantSeeds
 ├── FetchWater
 ├── Socialize
 └── Wander
```

This is extremely scalable.

---

# Layer 4 — FSM (Immediate Execution)

BT chooses:

> “Harvest Wheat”

FSM executes:

```text
MOVE_TO_FIELD
→ ALIGN_TO_CROP
→ SWING_TOOL
→ PICKUP_ITEM
→ STORE_ITEM
```

FSMs are ideal for:

* animations
* pathing
* interrupts
* combat states

---

# Layer 5 — Memory

This is where your idea gets interesting.

You want:

## Spatial Memory

```ts
memory.remember({
  type: "resource",
  location: vec3,
  resource: "wheat",
  timestamp: now
})
```

Now NPCs can:

* revisit berry patches
* remember mines
* remember danger zones
* remember villages
* remember campfires

This creates “experienced” NPCs.

---

## Social Memory

```ts
memory.remember({
  npc: "guard_23",
  interaction: "helped_me",
  sentiment: +10
})
```

This enables:

* friendships
* rivalries
* trust
* fear
* faction loyalty

---

## Event Memory

```ts
"The village was attacked here."
"This chest had food."
"Player stole from me."
```

Now worlds become persistent socially.

---

# Role Ideas

Here’s where it gets really fun.

# Survival Roles

## Farmer

* plants crops
* irrigates
* stores food
* trades

## Hunter

* tracks animals
* butchers prey
* avoids predators

## Woodcutter

* harvests trees
* replants saplings
* delivers lumber

## Miner

* remembers ore veins
* avoids cave danger
* requests torches

## Builder

* gathers materials
* places structures
* repairs buildings

## Crafter

* converts raw goods
* manages workstations
* fulfills village needs

---

# Social Roles

## Merchant

* travels settlements
* buys/sells dynamically
* tracks profitable routes

## Innkeeper

* provides food/rooms
* spreads rumors
* becomes social hub

## Bard

* increases morale
* spreads stories
* remembers heroic events

## Priest/Shaman

* heals
* manages rituals
* influences faction behavior

---

# Combat Roles

## Guard

* patrols
* investigates threats
* escorts villagers

## Scout

* explores map
* reports enemy camps
* remembers terrain

## Bandit

* ambushes
* steals
* retreats to hideouts

## Commander

* coordinates squads
* assigns tactics
* prioritizes targets

---

# Advanced Emergent Scenarios

Now we get into Erenshor territory.

---

# Scenario: Village Survival

A village:

* notices low food reserves
* assigns farmers
* hunters seek meat
* builders repair walls
* guards increase patrols

No scripted quest required.

---

# Scenario: Dynamic Settlement Growth

Builders:

* place roads
* add farms near water
* create storage near crafting

Village physically evolves.

---

# Scenario: NPC Adventuring Parties

Inspired by Erenshor:

```text
Tank
Healer
Ranger
Crafter
Scout
```

Party:

* prepares supplies
* enters dungeon
* retreats if injured
* remembers dungeon danger

Over time:

* becomes stronger
* gains reputation
* forms rivalries

---

# Scenario: Reputation Web

NPCs share memories:

```text
"Player helped during raid."
"Merchant was robbed."
"Bandits seen north."
```

This creates:

* rumor systems
* dynamic politics
* faction reactions

---

# Scenario: Ecosystem Simulation

Predators:

* hunt herbivores

Hunters:

* overhunt wolves

Now:

* deer population rises
* crops get eaten
* farmers complain

This is the kind of chain reaction that makes worlds feel alive.

---

# The Big Design Secret

Do NOT make NPCs “smart”.

Make them:

* reactive
* memory-driven
* need-driven
* interruptible
* socially influenced

That creates believable intelligence.

---

# Recommended Architecture For You

Given your interests in:

* local AI
* companions
* memory systems
* FSMs
* modularity
* data-driven design

I would strongly recommend:

```text
Need System
    ↓
Utility Scores
    ↓
Behavior Tree
    ↓
Task Selection
    ↓
FSM Execution
    ↓
Animation/Movement
```

Then layer:

* memory
* dialogue
* relationships
* schedules
* role templates

on top.

---

# Best Technical Pattern

For Hytale specifically:

## Data-Driven JSON Roles

```json
{
  "role": "builder",
  "behaviors": [
    "repair",
    "haul",
    "build",
    "gather"
  ],
  "priorities": {
    "repair": 90,
    "sleep": 70
  }
}
```

## Modular Behavior Nodes

```ts
class FindNearestFoodNode {}
class HarvestCropNode {}
class DepositInventoryNode {}
class FleeDangerNode {}
```

Then compose trees from reusable nodes.

This becomes massively scalable.

---

# One Of The Most Important Ideas

Separate:

* **GOAL SELECTION**
  from
* **ACTION EXECUTION**

This is where many AI systems fail.

BT decides:

> “I need food.”

FSM handles:

> “Walk to berry bush.”
> “Play pick animation.”
> “Collect berries.”

This separation keeps the system stable.

---

# Long-Term Potential

Your approach could evolve into:

* living settlements
* persistent economies
* AI companions
* evolving factions
* procedural quests
* dynamic stories
* autonomous adventurers

Essentially:

> “Dwarf Fortress + Skyrim + RimWorld + Erenshor inside Hytale.”

And Hytale’s moddable role/data systems appear intentionally designed to support this direction. ([Hytale][1])

[1]: https://hytale.com/news/2026/2/npc-technical-rundown?utm_source=chatgpt.com "NPC Technical Rundown"
