# Research: Autonomous & Emergent NPC Behavior

*Erenshor and other games known for NPCs that feel alive. Compiled as background for Hytale mod design.*

---

## Why this matters

"Emergent" NPC behavior is the feeling that the world keeps living when you're not looking — NPCs have routines, react to you, remember you, form relationships, and produce stories nobody scripted. The trick is that almost none of it requires heavy AI. The most convincing systems are mostly **cheap, deterministic logic layered to create the *illusion* of agency**, with simulation filling the gaps the player can't observe.

Two big design levers:
1. **Believability over intelligence** — players forgive dumb AI if it's *consistent* and *reactive*. They never see the logic tree; they see "that guy remembered me."
2. **Off-screen simulation** — the world advancing while the player is away is what sells "this place exists without me."

---

## Case study: Erenshor (the headline example)

Erenshor is a **single-player "simulated MMORPG"** — a solo dev (Burgee Media) built an EverQuest-style world where every other "player" is a `SimPlayer` NPC. It's the cleanest modern example of faking a living multiplayer world with simple tech.

**What the SimPlayers do:**
- **Not LLM-driven.** Runs on logic trees + text parsers + handwritten dialogue pools. The dev explicitly rejected LLMs as too expensive for hundreds of NPCs in a $20 game with no subscription. This is the key lesson: *the magic is in the systems, not the model.*
- **Two tiers of NPCs:** ~13 fixed named characters (same for everyone, hand-authored dialogue) + 140+ procedurally generated SimPlayers with random class/personality drawing from a shared dialogue pool keyed to personality type.
- **Grouping:** They form their own parties, fill MMO roles (Main Tank, Main Assist, Healer, Crowd Control, Puller), invite you to dungeons, and whisper you for help. They can *refuse* invites if already grouped.
- **Memory:** They remember your name, past adventures together, items you gave them, and grouping history — and reference those memories in conversation. Their opinion of you changes response enthusiasm.
- **Reputation/consequences:** Attitudes shift based on your actions; rude players can get temporarily blocked.
- **Command parsing:** Respond to `/group`, `/whisper`, `/shout` with contextual keywords ("attack," "pull," "careful").
- **Off-screen progression:** When you log out, each SimPlayer generates **a minimum of 6 hours of simulated activity** — leveling, gear, auction-house trades. They level *roughly alongside you* and are deliberately **rubber-banded** to your level (take a month off and they gain a few levels, never rush to endgame). This keeps the world feeling populated by peers without it outpacing you.

**Takeaway for Hytale:** the "living server" illusion is achievable with personality archetypes + dialogue pools + a lightweight memory record per NPC + a bounded off-screen tick. No ML required.

---

## Other notable games & the techniques behind them

| Game | Signature behavior | Technique |
|---|---|---|
| **Dwarf Fortress** | Dwarves with needs, moods, grudges, art, tantrums → emergent tragedy | Deep layered need/trait simulation; relationships; no authored plot |
| **RimWorld** | Colonists with mood/relationship breakdowns; "AI Storyteller" paces events | Need-driven utility AI + a director that injects events for pacing |
| **The Sims** | Daily life from hunger/social/fun drives | **Utility AI** — objects advertise "scores," sims pick highest-need action ("Smart Objects") |
| **S.T.A.L.K.E.R.** | NPC factions migrate, fight, and die across the map without you | **A-Life** — offline/online simulation of all actors, not just those near the player |
| **Shadow of Mordor/War** | Orcs remember fights, get promoted, hold grudges, recognize you | **Nemesis System** — procedural relationship/hierarchy graph with memory of player encounters |
| **Red Dead Redemption 2** | NPCs have schedules, react to your appearance/blood/hat, remember slights | Daily routines + dense reactive event tables + short-term memory |
| **Oblivion/Skyrim** | NPCs eat, sleep, work, own goals | **Radiant AI** — goal/schedule system (famously over-ambitious, then dialed back for stability) |
| **F.E.A.R.** | Squad AI that flanks, suppresses, retreats believably | **GOAP** (Goal-Oriented Action Planning) — agents plan action sequences toward goals |
| **Kenshi** | Faction-scale war, slavery, economy churning independently | Squad/faction-level simulation + needs |
| **Watch Dogs: Legion** | Every NPC has a generated life, job, schedule, and is recruitable | Procedural identity + relationship/schedule sim per citizen |
| **Crusader Kings** | Characters scheme, marry, betray over generations | Character traits + AI goals + opinion/relationship modeling |

---

## Core technical patterns (the toolbox)

Most "emergent" NPCs are one or more of these stacked together:

1. **Behavior Trees** — hierarchical, prioritized decision tree. The industry default; readable, debuggable.
2. **Utility AI** — every possible action gets a numeric score from current needs/context; pick the best. Great for needs-based life sim (The Sims, RimWorld).
3. **GOAP** — agent has goals + a library of actions with preconditions/effects; planner chains actions to reach a goal. Produces "smart"-looking improvisation (F.E.A.R.).
4. **HTN (Hierarchical Task Networks)** — decompose high-level tasks into subtasks; good middle ground between scripting and planning.
5. **Daily schedules / routines** — time-of-day → location/activity tables. Cheap, hugely effective for "the town feels alive" (Ultima VII onward, RDR2, Stardew).
6. **Needs/drives model** — hunger, sleep, social, etc. that decay over time and motivate actions. The engine of most life sims.
7. **Memory + reputation** — per-NPC record of player interactions that gates dialogue/attitude. Cheap, and the single highest-impact feature for "it remembered me."
8. **Off-screen / abstracted simulation** — advance the world with a coarse model when the player isn't watching, then reconcile when they return (A-Life, Erenshor's 6-hour tick). Sells persistence.
9. **Director / storyteller** — a meta-system that injects events to pace the emergent chaos (RimWorld). Keeps emergence from being boring or unfair.
10. **Relationship/social graphs** — NPC-to-NPC opinions and hierarchies that change (Nemesis, Crusader Kings). Generates drama between NPCs, not just toward the player.

---

## The LLM frontier (and why it's optional)

**Stanford "Generative Agents" / Smallville (2023)** is the reference point: 25 LLM-driven agents in a Sims-like town. Architecture worth knowing because the *structure* applies even without an LLM:

- **Memory stream** — chronological log of every observation, plan, and reflection, with a retrieval model (recency + importance + relevance).
- **Reflection** — periodically synthesize higher-level insights from raw memories ("I keep helping Sam → I value Sam").
- **Planning** — decompose daily goals → time-blocked subgoals → fine-grained actions; re-plan when reality changes.

This produced behaviors like spreading a party invite by word of mouth, waiting for an occupied bathroom, and turning off a burning stove.

**Caveat for game use:** cost, latency, and unpredictability make per-NPC LLMs impractical at scale today (Erenshor's whole design is a rebuttal to it). The realistic hybrid: **deterministic systems drive 99% of behavior; an LLM is reserved for flavor dialogue or rare "interesting moment" generation, cached aggressively.** The memory→reflection→planning *shape* is the transferable idea, not necessarily the model.

---

## Practical takeaways for Hytale mods

Hytale's modding (block/entity/behavior scripting, server-authoritative worlds) is well suited to the cheap techniques above. Ranked by impact-to-effort:

1. **Per-NPC memory record** (low effort, high payoff) — store player interactions; gate greetings/prices/attitude on it. Instant "this NPC knows me."
2. **Personality archetypes + dialogue pools** (Erenshor's model) — data-driven: a JSON personality type → a pool of lines. Many NPCs, little authoring, no per-NPC scripting.
3. **Daily schedules** — time-of-day → activity/location tables per NPC type. Makes a village feel inhabited.
4. **Needs/utility layer** — simple decaying needs picking weighted actions; reuse one system for every NPC type.
5. **Off-screen tick** — when a chunk/area unloads, advance its NPCs with a coarse abstraction (Erenshor's bounded sim). Sells persistence on a server.
6. **Reputation/faction graph** — NPC and faction opinions that shift from player actions and propagate.
7. **(Optional) director** — an event-pacing layer if pure emergence feels flat.

Keep it **data-driven** (per global CLAUDE.md): define personalities, schedules, dialogue pools, and need profiles as JSON/objects, not hardcoded logic — so new NPC behaviors are content, not code.

---

## Sources

- [Simulated Players — Official Erenshor Wiki](https://erenshor.wiki.gg/wiki/Simulated_Players)
- [Erenshor is a simulated MMO built for singleplayer by a single person — PC Gamer](https://www.pcgamer.com/games/rpg/erenshor-is-a-simulated-mmo-built-for-singleplayer-by-a-single-person/)
- [Erenshor Interview: Developer Talks Making A 'Single-Player MMORPG' — Game Rant](https://gamerant.com/erenshor-single-player-mmorpg-interview/)
- [This Solo Dev Built an Entire MMO You Can Play Alone — Tech in Bengali](https://en.techinbengali.com/erenshor-single-player-mmo-burgee-media-simulated-players/)
- [10 Best Games With Organic Storytelling — Game Rant](https://gamerant.com/best-organic-storytelling-games/)
- [Generative Agents: Interactive Simulacra of Human Behavior (Stanford/Google, paper)](https://dl.acm.org/doi/fullHtml/10.1145/3586183.3606763)
- [Computational Agents Exhibit Believable Humanlike Behavior — Stanford HAI](https://hai.stanford.edu/news/computational-agents-exhibit-believable-humanlike-behavior)
- [Generative Agents in Smallville — Emergent Mind](https://www.emergentmind.com/topics/generative-agents-smallville)
