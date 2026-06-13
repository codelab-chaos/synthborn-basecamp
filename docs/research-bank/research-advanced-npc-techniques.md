# Research: Advanced NPC Techniques (beyond Behavior Trees)

*A survey of decision-making, knowledge, movement, and world-level techniques for NPC AI — when to use each and how they combine. Companion to [research-behavior-trees.md](./research-behavior-trees.md) and [research-erenshor-npcs.md](./research-erenshor-npcs.md).*

---

## The mental model

NPC AI splits into four layers. A good agent picks a technique per layer; they are **not** competitors so much as different jobs:

1. **Decision-making** — *what should I do?* (FSM, BT, Utility, GOAP, HTN)
2. **Knowledge & perception** — *what do I know?* (sensors, blackboard, memory, influence maps)
3. **Movement** — *how do I get/position there?* (pathfinding, steering, flow fields)
4. **World-level / emergent** — *how does the population behave?* (smart objects, A-Life, directors, social graphs)

Behavior trees (previous doc) live in layer 1. This doc covers the rest of layer 1 and all of layers 2–4.

---

## Layer 1: Decision-making architectures

### FSM / Hierarchical FSM (baseline)
States + transitions. Cheap and clear for genuinely state-like things (doors, turrets, simple critters). **HFSMs** nest sub-machines to tame the transition explosion. Use for small behavior sets; reach for BTs when priorities and reuse grow. (See BT doc for the FSM-vs-BT tradeoff.)

### Utility AI (a.k.a. utility theory / IAUS)
Instead of branching logic, **score every candidate action** with a math function over the current situation, then pick the highest (or weighted-random among top). Each action has one or more **considerations** (e.g., distance, hunger, threat) mapped through **response curves** (linear, quadratic, logistic) and multiplied/averaged into a final score.

- **Strength:** graceful handling of many competing soft factors; behavior degrades smoothly instead of snapping. This is *the* technique for life-sim "what do I feel like doing" decisions (The Sims, RimWorld colonists, F.E.A.R.'s target/cover selection).
- **The Sims "Smart Objects":** objects *advertise* utility ("fridge advertises +hunger"); the sim just picks the best advertised action. Decentralized and trivially extensible — add an object, get new behavior, no agent code changed. Extremely mod-friendly and data-driven.
- **IAUS (Infinite Axis Utility System, Dave Mark):** the well-documented formalization — actions × weighted considerations × response curves, with a compensation factor so many considerations don't over-penalize.
- **Weakness:** tuning curves is an art; hard to guarantee a specific scripted outcome; debugging "why did it score that highest?" needs good tooling.

```json
// Data-driven utility action (illustrative)
{
  "action": "eat",
  "considerations": [
    { "input": "hunger",        "curve": "logistic",  "weight": 1.0 },
    { "input": "food_distance", "curve": "inverse",   "weight": 0.6 },
    { "input": "in_combat",     "curve": "boolean_kill" }
  ]
}
```

### GOAP (Goal-Oriented Action Planning)
Agent has a set of **goals** (desired world states) and a library of **actions**, each with **preconditions** and **effects** (like STRIPS planning). A planner (usually A* over world-state) chains actions at runtime to reach the goal. *Goal: enemy_dead. Actions: reload (pre: has_ammo), shoot (pre: weapon_loaded, enemy_visible), move_to_cover…* → planner assembles "move → reload → shoot."

- **Strength:** agents **improvise** sequences you didn't explicitly author; add a new action and it's automatically considered in all relevant plans (decoupled, scalable). Made famous by **F.E.A.R.** for squad combat that looks tactical.
- **Weakness:** runtime planning cost; can be hard to predict/direct; needs careful action/precondition design or plans get weird. Re-planning on world change must be handled.

### HTN (Hierarchical Task Networks)
Top-down planning: decompose a high-level **task** ("defend base") into subtasks via **methods** (each with conditions), down to primitive actions. Sits between scripting and GOAP.

- **Strength:** designers express domain knowledge as decompositions (more controllable than GOAP's free-form search) while still planning. Used in *Killzone*, *Transformers*, *Horizon Zero Dawn*-style hierarchies.
- **Weakness:** authoring the task hierarchy is work; less emergent than GOAP by design (that's often a feature).

### Quick comparison

| Technique | Best at | Authoring style | Emergence | Predictability |
|---|---|---|---|---|
| FSM/HFSM | small state-like behavior | transitions | low | high |
| Behavior Tree | prioritized reactive action | tree of nodes | low–med | high |
| Utility AI | many soft competing factors | curves + weights | medium | medium |
| GOAP | improvised goal-directed plans | actions + pre/eff | high | low–med |
| HTN | structured goal-directed plans | task decompositions | medium | medium–high |

---

## Layer 2: Knowledge & perception

Decision-making is only as good as what the agent *knows*. Often the biggest believability wins live here, not in the planner.

- **Sensors / perception systems** — model sight (cones, line-of-sight, range), hearing (noise events with radius), and proximity as explicit senses that write to memory. Crucially, model **what the NPC does *not* know** — RDR2/stealth games feel smart because NPCs investigate *last known position* rather than magically knowing yours.
- **Blackboard / world state** — per-agent (and shared/global) key-value memory the decision layer reads. (Detailed in the BT doc.) The seam between perception (writes) and decision (reads).
- **Memory models** — short-term (current threat), long-term (player reputation, past interactions — Erenshor's "remembers your name and what you gave it"), and **decay** (forget last-known-position after N seconds). A small per-NPC memory record is the single highest-impact believability feature.
- **Influence maps / spatial reasoning** — overlay grids that accumulate values (enemy presence, danger, desirability, scent). Agents query the map for "safest path," "best ambush tile," "where's the action." Powers tactical positioning, flocking-to-objectives, and territory control cheaply.
- **Sensory event bus** — gunshots, smells, corpses as world events other NPCs subscribe to → emergent "they heard that and came running."

---

## Layer 3: Movement

- **Pathfinding** — A* / navmesh for "route from A to B." Hierarchical pathfinding for large worlds; flow fields for many units to one goal (RTS, crowds).
- **Steering behaviors** (Reynolds) — local, continuous forces: seek, flee, arrive, wander, pursue, separation/alignment/cohesion (boids/flocking), obstacle avoidance. Layer on top of pathfinding for natural, non-robotic motion and crowds.
- **Why it matters for believability** — even great decisions look broken with stiff movement (snapping, clipping, conga-lining). Smooth arrival/avoidance sells "alive" as much as the brain does.

---

## Layer 4: World-level / emergent behavior

This is where "the world feels alive without me" comes from — the focus of the Erenshor doc, generalized.

- **Smart objects / affordances** — push behavior *into the environment*. Objects advertise interactions ("chair: sit," "forge: craft"); NPCs query nearby objects for what they can do. New content = new behavior, zero agent code. The most mod-friendly, data-driven pattern there is — ideal for a block-based world like Hytale.
- **A-Life style simulation (S.T.A.L.K.E.R.)** — simulate *all* actors, with a cheap **offline model** for those far from the player and a detailed **online model** nearby, reconciling on hand-off. This is the rigorous version of Erenshor's "6 hours of off-screen activity." Sells genuine persistence on a server.
- **Director / AI storyteller** — a meta-system that watches the simulation and *injects* events to control pacing/difficulty/drama (RimWorld's storytellers, L4D's director). Tames raw emergence so it stays fun and fair.
- **Social / relationship graphs** — NPC↔NPC opinions, factions, hierarchies that evolve from events (Crusader Kings drama; Shadow of Mordor's **Nemesis system** — orcs remember the player, get promoted, hold grudges, recognize past fights). Generates stories *between* NPCs, not just toward the player.
- **Needs/drives + schedules** — decaying needs (hunger/sleep/social) feeding a utility layer, plus time-of-day routines, are the cheap backbone of a "living town." (Covered in the Erenshor doc's takeaways.)

---

## Learning & generative (the frontier)

- **Reinforcement learning** — agents learn policies via reward. Powerful for movement/combat skill, but **hard to direct, expensive to train, and unpredictable** — rarely used for shipped narrative NPCs; more common for physics/locomotion and bots. Use surgically, not as the whole brain.
- **LLM-driven agents** — Stanford's **Generative Agents / Smallville**: a **memory stream → reflection → planning** loop produces believable autonomous behavior. The *architecture* is transferable even without an LLM (it's basically a structured memory + utility/planning layer). For games today: cost/latency/unpredictability keep it as **flavor on top of deterministic systems**, not the core loop. Full discussion + the Erenshor cost rebuttal in [research-erenshor-npcs.md](./research-erenshor-npcs.md).

---

## Choosing a stack (decision guide)

Pick per layer; don't force one technique to do everything. Most shipped AI is a **hybrid**:

- **Moment-to-moment action:** Behavior Tree (reactive, authorable) — the default core.
- **Which goal/behavior to pursue:** Utility AI layer scoring options, *or* GOAP/HTN if the agent must plan novel sequences. Common combo: **utility selects a goal → a BT executes it**, or **GOAP plans → BT executes each action**.
- **Knowledge:** sensors + blackboard + a small decaying memory record. Add influence maps if positioning matters.
- **Movement:** navmesh/A* + steering for polish.
- **Living world:** smart objects + needs/schedules + an off-screen tick; add a director if emergence needs pacing; add a social/reputation graph for inter-NPC drama.

> Rule of thumb: **start with a reactive BT + blackboard + smart objects.** Add a utility layer when "if/else priority" stops capturing nuanced choices. Add GOAP/HTN only when agents genuinely need to *plan*. Add LLM/RL last, as targeted flavor.

---

## Recommended stack for Hytale NPC mods

Ordered by impact-to-effort, all **data-driven** (behavior/needs/objects as JSON content, generic systems in code — per project convention and exactly how Erenshor scales ~150 NPCs):

1. **Data-driven Behavior Trees + blackboard** — the authorable core (see BT doc). Trees and per-NPC params as assets.
2. **Per-NPC memory record + reputation** — cheapest believability; "it remembered me."
3. **Smart objects / affordances** — blocks/entities advertise interactions; perfect fit for a voxel world and modders adding content.
4. **Needs + schedules** — one utility/need system reused across all NPC types for a living settlement.
5. **Perception with imperfect knowledge** — sight/hearing → blackboard → last-known-position investigation.
6. **Off-screen tick (A-Life-lite)** — coarse simulation for unloaded chunks; reconcile on load.
7. **Utility layer for goal selection** — when priority Selectors get too coarse.
8. **Social/faction graph** — inter-NPC drama and propagating reputation.
9. **(Optional) director** — event pacing if pure emergence feels flat.
10. **(Optional) LLM flavor dialogue** — cached, deterministic-gated, never the core loop.

---

## See also

- [research-behavior-trees.md](./research-behavior-trees.md) — the deep dive on layer-1 BTs (design, maintenance, testing).
- [research-erenshor-npcs.md](./research-erenshor-npcs.md) — the living-world illusion and emergent-NPC game case studies.
