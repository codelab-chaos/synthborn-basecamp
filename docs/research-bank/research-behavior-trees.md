# Research: Behavior Trees — Deep Dive

*Design, structure, maintenance, and testing of behavior trees (BTs) for NPC AI. Companion to [research-erenshor-npcs.md](./research-erenshor-npcs.md) (Erenshor's SimPlayers run on logic/behavior trees) and [research-advanced-npc-techniques.md](./research-advanced-npc-techniques.md).*

---

## TL;DR

A behavior tree is a **tree of decision/action nodes that is re-evaluated every game tick**, flowing control from the root down to exactly one (or a few) active leaf actions. It became the industry default for game AI (Halo 2 onward) because it scales far better than finite state machines: behavior is **composed** from small reusable nodes instead of an exploding web of state transitions.

The whole system rests on three ideas:
1. Every node, when **ticked**, returns one of `SUCCESS`, `FAILURE`, or `RUNNING`.
2. **Composite** nodes route ticks to children based on those return values.
3. The `RUNNING` status is what lets actions span many frames and lets the tree stay **reactive**.

---

## Why behavior trees (vs FSMs)

**Finite State Machines** model behavior as states + transitions. Problem: transitions are O(states²). Add a "flee" state and you must wire transitions to/from *every* other state. They become spaghetti fast.

**Behavior trees** invert this. Instead of "where can I go from here," each node just answers "did I succeed?" and the **tree structure** encodes priority and sequencing. Adding behavior = adding a subtree, not rewiring transitions. Benefits:

- **Composability** — small nodes combine into complex behavior.
- **Reusability** — a subtree ("find cover and shoot") drops into many trees.
- **Readability** — the tree *is* the priority/flow, top-to-bottom, left-to-right.
- **Reactivity** — re-ticking from the root each frame means higher-priority behavior preempts lower-priority automatically.

FSMs aren't dead — they're great for small, truly state-like things (a door: open/closed/opening). BTs win for agents with many prioritized behaviors. (Hierarchical FSMs are a middle ground; see the techniques doc.)

---

## Core concept: the tick

Each frame (or on a fixed AI cadence), the engine **ticks the root**. The tick propagates down per node rules until it reaches the active leaf. Every ticked node returns a status:

| Status | Meaning |
|---|---|
| `SUCCESS` | The node finished its job. |
| `FAILURE` | The node could not do its job. |
| `RUNNING` | Still working; tick me again next frame. |

A node's parent uses the child's status to decide what to do next. That's the entire protocol.

**Tick cadence matters.** You rarely tick at full frame rate for every NPC — you tick on a budget (e.g., every 100–250ms, or round-robin across the population). Distant/unloaded NPCs tick rarely or not at all (ties into off-screen simulation; see the Erenshor doc's 6-hour tick).

---

## Node taxonomy

Three families: **composites** (multiple children, control flow), **decorators** (one child, modify it), **leaves** (no children, do the actual work).

### Composites (control flow)

**Sequence** — "AND / do all in order." Ticks children left→right.
- Child returns `FAILURE` → Sequence returns `FAILURE` immediately (short-circuit).
- Child returns `RUNNING` → Sequence returns `RUNNING` (remembers position).
- All children `SUCCESS` → Sequence returns `SUCCESS`.
- Use for: ordered steps. *Walk to door → open door → walk through.*

**Selector / Fallback** — "OR / try until one works." Ticks children left→right.
- Child returns `SUCCESS` → Selector returns `SUCCESS` immediately.
- Child returns `RUNNING` → Selector returns `RUNNING`.
- All children `FAILURE` → Selector returns `FAILURE`.
- Use for: prioritized alternatives. *Try attack → else flee → else idle.*

**Parallel** — ticks all children "at once," succeeds/fails on a policy (e.g., "succeed when N succeed," "fail when any fails"). Use sparingly — for running an action while monitoring a condition. *Shoot WHILE tracking target.*

> Mnemonic: **Selector = priority list, Sequence = recipe.** Most trees are Selectors of Sequences.

### Decorators (modify one child)

- **Inverter** — flips `SUCCESS`↔`FAILURE`.
- **Succeeder / AlwaysSuccess** — forces `SUCCESS` (swallow failure).
- **Repeater** — re-tick child N times or forever.
- **Retry** — re-tick on failure up to N times.
- **Cooldown** — return `FAILURE` until a timer elapses (rate-limit an action).
- **Timeout** — force `FAILURE` if child runs too long.
- **Condition / Guard** — only allow the child to run if a predicate holds (often blackboard-based). This is how you gate subtrees.

### Leaves (do the work)

- **Action** — does something in the world: move, attack, play animation, set a blackboard value. Returns `RUNNING` while in progress.
- **Condition** — pure query, no side effects: "is enemy visible?", "hp < 30%?". Returns `SUCCESS`/`FAILURE`.

Keep leaves **small and single-purpose** — that's what makes them testable and reusable.

---

## The `RUNNING` status (the killer feature)

`RUNNING` is why BTs beat naive scripting. It lets a single action ("walk to point") persist across hundreds of frames while the tree keeps re-evaluating. Two design choices flow from it:

**Memory (stateful) vs reactive composites.** A plain Sequence "remembers" which child was `RUNNING` and resumes there next tick — efficient, but it won't notice if an earlier condition stopped being true. A **reactive Sequence/Selector** re-ticks from the *first* child every frame, so a higher-priority condition can preempt the running action mid-stride. Reactivity is what makes an NPC drop everything to flee when a threat appears.

**Rule of thumb:** put **guards/conditions high and left** in reactive composites so they're re-checked every tick. "Am I on fire? → flee" sits above "patrol" so it always wins.

---

## The blackboard

NPCs need shared memory the tree can read/write: current target, last known position, home, hp thresholds, cooldowns, etc. That's the **blackboard** — a key/value store scoped per agent (sometimes with shared/global tiers).

- Conditions read it ("target != null"), actions write it ("set target = nearest enemy").
- It decouples nodes: a "perception" subtree writes `target`; a "combat" subtree reads it. They don't know about each other.
- **Discipline matters** — an undocumented blackboard becomes "global variable soup." Treat keys as a typed schema (see Maintaining).

---

## Common patterns

```
Root: Selector (priority)
├─ Sequence "survive"          ← highest priority
│  ├─ Condition: hp < 25%
│  ├─ Cooldown(10s)
│  └─ Action: drink potion / flee
├─ Sequence "fight"
│  ├─ Condition: enemy visible
│  ├─ Action: face target
│  └─ Selector
│     ├─ Sequence: Condition in-range → Action: melee
│     └─ Action: move toward target   ← RUNNING while walking
├─ Sequence "investigate"
│  ├─ Condition: heard noise (blackboard: lastNoisePos set)
│  └─ Action: move to lastNoisePos
└─ Action: patrol / idle       ← default fallthrough
```

Reusable idioms:
- **Guarded subtree** — `Condition` as first child of a Sequence acts as an entry gate.
- **Priority interrupt** — high-left placement in a reactive Selector.
- **Cooldown'd ability** — `Cooldown` decorator over an attack action.
- **Fallback chain** — Selector ending in a guaranteed-success default (idle), so the tree never returns `FAILURE` to the root.
- **Perception → blackboard → reaction** — separate the "sense" subtree (writes) from "act" subtrees (read).

---

## Approach: how to design a tree

1. **List behaviors in priority order**, most urgent first. That order *is* your top-level Selector.
2. **Decompose each behavior into steps** → a Sequence under that Selector branch.
3. **Identify entry conditions** for each behavior → guard conditions as first children.
4. **Push perception out** into its own subtree that writes the blackboard; keep decision subtrees reading from it.
5. **Default branch last** — always have an idle/patrol fallback so the root never fails.
6. **Keep it shallow** — deep trees are hard to read and debug. Extract repeated structure into named subtrees.
7. **One responsibility per leaf** — if an action does two things, split it.

Design top-down (priorities), implement bottom-up (small tested leaves first).

---

## Data-driven trees (for Hytale modding)

Per the project's data-driven preference, **define trees as data, not code.** Code provides a *library of generic leaf/composite types*; the actual NPC behavior is content (JSON/asset) that designers and modders edit without recompiling. This is exactly how Erenshor gets ~150 distinct SimPlayers from shared logic + per-NPC data.

```json
{
  "tree": "guard_v3",
  "root": {
    "type": "selector",
    "reactive": true,
    "children": [
      { "type": "sequence", "name": "flee_when_hurt", "children": [
        { "type": "condition", "key": "hp_pct", "op": "<", "value": 0.25 },
        { "type": "action", "id": "flee_to", "params": { "target": "home" } }
      ]},
      { "type": "sequence", "name": "engage", "children": [
        { "type": "condition", "key": "target", "op": "exists" },
        { "type": "action", "id": "attack", "params": { "ability": "$weapon" } }
      ]},
      { "type": "action", "id": "patrol", "params": { "route": "$patrol_route" } }
    ]
  }
}
```

Then a per-NPC config supplies the variables (`$weapon`, `$patrol_route`, hp thresholds, personality). Many NPCs, one tree, no new code. Bonus: trees become **diffable, version-controllable, and hot-reloadable**.

---

## Maintaining behavior trees

What keeps a BT codebase healthy as it grows:

- **Subtree reuse / templates** — name and extract common structures ("approach-and-melee," "retreat-and-heal"). Reference by id; don't copy-paste.
- **Typed blackboard schema** — declare keys, types, who writes them, who reads them. Prevents the "global soup" failure mode. Validate on load.
- **Shallow + named** — prefer named subtrees over deeply nested anonymous composites. A reader should grasp the top level at a glance.
- **No hidden coupling** — leaves communicate only via the blackboard, never by reaching into each other.
- **Pure conditions** — conditions must have *no side effects*, or re-ticking (reactivity) corrupts state. Side effects belong in actions.
- **Version your trees** — `guard_v3`. Migrations are easier when behaviors are versioned assets.
- **Document the priority intent** — a one-line comment per top-level branch ("// survival > combat > investigate > idle") saves future-you.
- **Lint for anti-patterns** — Selectors that can't fail, Sequences with a condition not first, unreachable branches, unused blackboard keys.

---

## Testing behavior trees

BTs are unusually testable *if* leaves are pure/small and the tick is deterministic. Layers of testing:

**1. Unit-test leaves.** Each action/condition is a small function over (blackboard, world stub). Test in isolation with a mock blackboard and a fake world. Conditions especially: feed inputs, assert `SUCCESS`/`FAILURE`. This catches the majority of bugs cheaply.

**2. Unit-test composites with stub children.** Feed a Sequence/Selector children that return scripted statuses (a child that returns `FAILURE`, then `RUNNING`, then `SUCCESS`) and assert the composite's status and which child it ticked. This verifies control-flow logic independent of game content.

**3. Deterministic tick tests (the key technique).** Make the tick **deterministic**: fixed time step, seeded RNG, mocked clock/world. Then you can drive a whole tree through a scripted scenario and assert behavior frame by frame:
   - Set blackboard `hp_pct=0.2` → tick → assert active leaf is `flee_to`.
   - Set `hp_pct=0.9, target=enemy` → tick → assert active leaf is `attack`.
   - Inject a high-priority threat mid-action → tick → assert the running action was preempted (validates reactivity).

**4. Scenario / golden tests.** Record a sequence of (inputs → expected active-leaf trace) as a fixture; replay on every change. Catches regressions when someone reorders a Selector. Erenshor-style command parsing (`/pull`, `/careful`) is perfect for this: input string → expected action.

**5. Simulation / soak testing.** Run many NPCs in a headless sim for long durations and assert invariants: no NPC stuck `RUNNING` forever, no tree returning `FAILURE` to root, no blackboard key read-before-write, CPU per tick under budget. Great for finding deadlocks and starvation.

**6. Fuzzing.** Randomize blackboard/world inputs and assert the tree never crashes and always resolves to a valid leaf. Cheap way to find unguarded branches.

**7. Visual debugging / instrumentation (manual but essential).** Use a live tree visualizer that highlights the ticked path and shows each node's last status + blackboard values. Log tick traces for replay. This is how you debug "why did it do *that*?" in a running game.

> **Make the tick deterministic first.** Every testing layer above depends on it. If RNG, time, and world access aren't injectable, BTs are nearly untestable; if they are, BTs are some of the most testable AI you can write.

---

## Tooling (reference)

- **Visual editors**: Unreal Engine's built-in Behavior Tree + Blackboard editor (with live debugger); Behavior Designer (Unity); Groot (the editor for BehaviorTree.CPP).
- **Libraries**: BehaviorTree.CPP (C++, with Groot visualization + logging); py_trees (Python, good for prototyping/testing patterns); behaviortree.js; many engine-native systems.
- **Debug overlays**: most ship a runtime view of the active path — invaluable.

For Hytale modding you'll likely consume the engine's behavior/scripting system; the patterns here (data-driven trees, deterministic ticks, blackboard discipline) transfer regardless of the host.

---

## Pitfalls & anti-patterns

- **Side-effecting conditions** — break reactivity; conditions must be pure.
- **Blackboard soup** — undocumented shared keys; the #1 maintenance killer.
- **Deep anonymous nesting** — unreadable; extract named subtrees.
- **Over-using Parallel** — usually a sign two behaviors should be sequenced or split.
- **Memory composites where you needed reactivity** — NPC keeps doing the old thing because the Sequence resumed mid-run instead of re-checking guards.
- **No default branch** — root returns `FAILURE`, NPC freezes.
- **Ticking everything every frame** — performance cliff with many NPCs; use a budget/round-robin and LOD by distance.
- **Encoding global plans in one mega-tree** — for goal-driven, re-planning behavior, BTs get awkward. That's where GOAP/HTN/utility come in → see the next doc.

---

## When BTs are *not* the right tool

BTs are great for **prioritized, reactive, designer-authored behavior**. They struggle when:
- The agent must **plan a novel sequence** toward a goal (use **GOAP/HTN**).
- Decisions are **continuous trade-offs** among many weighted factors (use **Utility AI**).
- You need **emergent world-level** behavior across many agents (use **A-Life / smart objects / directors**).

Most shipped AI is a **hybrid** — e.g., a BT for moment-to-moment action with a utility or GOAP layer choosing *which* subtree/goal to pursue. That's the subject of the companion document.

---

## See also

- [research-erenshor-npcs.md](./research-erenshor-npcs.md) — the living-world illusion; Erenshor's SimPlayers on logic/behavior trees.
- [research-advanced-npc-techniques.md](./research-advanced-npc-techniques.md) — GOAP, HTN, Utility AI, perception, and hybrids that go beyond BTs.
