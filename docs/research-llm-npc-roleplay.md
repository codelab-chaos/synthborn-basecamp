# LLM Role-Play for Hytale NPCs — Design Document

*Adding believable, conversational NPCs on top of HyCitizens + NPCTrading.*
Status: design draft · Target server build: `2026.03.26` line (Java 25) · Last updated: 2026-05-25

---

## 1. Goal

Make HyCitizens NPCs *feel alive* by letting a Large Language Model drive their
conversation and, eventually, their goals — while keeping all the deterministic
machinery (movement, schedules, combat, trading) that HyCitizens already does
well. We roll this out in three phases, each shippable on its own:

1. **Player ↔ NPC chat** — talk to an NPC, it answers in character.
2. **Cross-NPC chat** — NPCs talk to *each other* when near each other.
3. **Memory + tasks** — NPCs remember people/events and the LLM helps manage
   what they *do* (schedules, errands, trades) — not just what they say.

The guiding principle (and the one this codebase already follows): **data-driven**.
A persona is JSON config, not hardcoded Java. The LLM never invents game actions
out of thin air — it picks from capabilities HyCitizens already exposes.

---

## 2. How Hytale modding works (the parts that matter here)

From the May 2026 server-plugin model:

- **Server-side Java plugins.** All game logic runs on the Java server (even in
  singleplayer). Plugins extend `JavaPlugin` with a `setup()` / `start()` /
  `shutdown()` lifecycle. Java 25.
- **Two event surfaces.** A classic `EventRegistry` (`register`,
  `registerGlobal`, `registerAsync`) for game events like
  `PlayerConnectEvent`/`PlayerChatEvent`, and an ECS `EntityStoreRegistry` for
  per-entity systems.
- **NPC behavior is data, not code.** An NPC's behavior is a JSON **Role**
  (`Type: Variant/Generic/Abstract`) built from *instruction lists* of
  **Sensors → Actions/Motions** (150+ element types: `Target`, `Beacon`,
  `Seek`, `Attack`, `State`, `Timeout`, `Random`, …). See
  `Template_Citizen.json` for a full real example. Roles are registered through
  `NPCPlugin`; you swap an NPC's role at runtime via
  `RoleChangeSystem.requestRoleChange(...)`.
- **Chat / messages out.** `Message.raw(text).color(...).bold(...).link(...)`
  and `playerRef.sendMessage(message)`.
- **Outbound HTTP is allowed and already used.** HyCitizens already talks to the
  network with `java.net.http.HttpClient` (`SkinUtilities`, `UpdateChecker`).
  Calling an LLM endpoint is the same pattern — just keep it **off the main
  thread**.
- **Threading rule.** Network/LLM work runs on `HytaleServer.SCHEDULED_EXECUTOR`
  (or a dedicated pool); anything touching the world/entities must hop back onto
  the world thread via `world.execute(() -> ...)`. The existing interaction and
  schedule code follows exactly this discipline.

> Worth noting: `Template_Citizen.json` already has native
> `IsMemory` / `MemoriesCategory` / `MemoriesNameOverride` parameters. That is
> Hytale's *own* in-world "memory" concept (what an NPC remembers as a creature)
> and is **separate** from the LLM conversational memory we design in Phase 3.
> Don't conflate the two.

---

## 3. Where the existing mods give us a clean hook

We do **not** fork HyCitizens. NPCTrading already demonstrates the right pattern:
a *separate* plugin that attaches to HyCitizens through its public API.

The seam (from `NPCTrading/.../TraderInteraction.java`):

```java
PluginIdentifier id = new PluginIdentifier("com.electro", "HyCitizens");
if (PluginManager.get().getPlugin(id) == null) return;       // optional dependency

HyCitizensPlugin.get().getCitizensManager().addCitizenInteractListener(event -> {
    CitizenData citizen = event.getCitizen();
    PlayerRef   player  = event.getPlayer();
    // ... react to a player interacting with this NPC
});
```

Useful API surface we already have on `CitizensManager`:

| Need | Existing method |
|------|-----------------|
| React to player interacting with an NPC | `addCitizenInteractListener(...)` / `CitizenInteractEvent` |
| Find NPCs around a point (proximity chat) | `getCitizensNear(Vector3d, double)` |
| Look up a persona's config | `getCitizen(id)` / `getAllCitizens()` / `getCitizensByGroup(group)` |
| Make the NPC emote while "thinking"/talking | `triggerAnimations(citizen, type)` / `playAnimationForCitizen(...)` |
| Drive what the NPC *does* (Phase 3) | `ScheduleManager`, `RoleGenerator`, patrol/move APIs |
| Reuse rich-text + placeholder rendering | `CitizenInteraction.parseColoredMessage(...)` |

`CitizenData` is already the persona container — a big data-driven POJO with
name, model, schedule, messages, groups, combat config, etc. We extend it with a
**persona block** rather than inventing a parallel system.

**So the whole thing is a new companion plugin** — call it `HyCitizensAI` —
that:
1. lists HyCitizens as an optional dependency,
2. reads a persona config per citizen,
3. turns player/NPC chat into LLM prompts,
4. renders replies through the existing message pipeline, and
5. (Phase 3) maps LLM-proposed "tasks" back onto HyCitizens' deterministic APIs.

---

## 4. Persona data model (shared by all phases)

Keep it JSON, keep it per-citizen, keep it editable in-game later. Stored
alongside HyCitizens data (same `ConfigManager` style: atomic JSON writes).

```jsonc
// personas/<citizenId>.json
{
  "enabled": true,
  "displayName": "Bram the Blacksmith",
  "persona": "A gruff but kind-hearted dwarven smith in the village of Oakhollow. Proud of his work, suspicious of strangers, loves a good ale.",
  "speakingStyle": "Short, blunt sentences. Old-timey. Never breaks character.",
  "knowledge": [
    "Sells iron tools at the forge by the river.",
    "His apprentice Tilda went missing three days ago.",
    "Does not know anything about events outside Oakhollow."
  ],
  "guardrails": {
    "maxReplyChars": 240,
    "stayInWorld": true,            // refuse real-world / meta questions in-character
    "topicsToAvoid": ["politics", "the game's source code"]
  },
  "voice": { "color": "{GOLD}", "thinkingAnimation": "Idle_Think" },
  "llm": { "model": "claude-haiku-4-5", "temperature": 0.7 }
}
```

Design notes:
- **Model tiering matters for cost.** Casual ambient chatter → a small/cheap
  model (Haiku-class). "Important" quest NPCs → a stronger model. Make it a
  per-persona field so server owners control spend.
- `knowledge` is the cheap, deterministic grounding that keeps NPCs from
  hallucinating server lore. It's injected verbatim into the system prompt.
- Everything here is just config — no code change to add a new character.

---

## 5. Phase 1 — Player ↔ NPC chat

**Outcome:** A player walks up to Bram, types in chat, and Bram replies in
character. No memory yet (each exchange is short-lived context), no autonomy.

### 5.1 Capturing player input

Two complementary triggers:

1. **Address-by-proximity + chat event.** Register on `PlayerChatEvent`
   (prefer `registerAsync` so the LLM call never blocks the chat pipeline). On a
   message, use `getCitizensNear(player.position, ~6 blocks)` to find the closest
   AI-enabled NPC the player is facing. If found, **cancel the public chat**
   (`event.setCancelled(true)`) and route it to that NPC privately.
2. **Explicit "start talking" via interaction.** Reuse
   `addCitizenInteractListener` (the NPCTrading hook): pressing the interact key
   on an AI NPC opens a conversation "session" so subsequent chat lines go to
   that NPC even if the player drifts a little. A session times out after N
   seconds of silence.

Either way we end up with: `(persona, player, "what the player said")`.

### 5.2 Calling the LLM (off the main thread)

```java
// Pseudocode — mirrors SkinUtilities' async HttpClient usage.
CompletableFuture
    .supplyAsync(() -> llmClient.complete(buildPrompt(persona, playerText)),
                 HytaleServer.SCHEDULED_EXECUTOR)          // network thread
    .orTimeout(8, TimeUnit.SECONDS)
    .whenComplete((reply, err) -> world.execute(() -> {    // back on world thread
        if (err != null) { sendFallback(player, persona); return; }
        sendNpcLine(player, persona, sanitize(reply));
    }));
```

Prompt shape (Phase 1):

```
SYSTEM: You are {displayName}. {persona} Speaking style: {speakingStyle}.
        Facts you know: {knowledge[]}.
        Rules: stay in character; <= {maxReplyChars} chars; never mention being an AI;
        if asked something out of world, deflect in character.
USER:   ({playerName} says to you): "{playerText}"
```

### 5.3 Rendering the reply

Reuse the existing rich-text renderer so personas can color/format and we get
placeholder substitution for free:

```java
Message msg = CitizenInteraction.parseColoredMessage(
        persona.voiceColor() + persona.displayName() + ": {WHITE}" + reply);
player.sendMessage(msg);
```

Optionally call `triggerAnimations(citizen, "ON_INTERACT")` or play the
persona's `thinkingAnimation` while the request is in flight so the world reacts
instantly even though the text takes ~1s.

### 5.4 Cost, latency, and safety (Phase 1 must-haves)

- **Per-player rate limit** (e.g. 1 in-flight request + N/minute) to cap spend
  and stop chat spam.
- **Hard timeout + graceful fallback line** ("Bram grunts and keeps hammering.")
  so a slow/failed API call never hangs the player.
- **Output sanitation:** clamp to `maxReplyChars`, strip newlines/control chars
  (the message renderer expects single-line-ish), strip anything that looks like
  a command injection (`/op`, etc.) before it's ever shown.
- **Prompt-injection awareness:** treat player text as untrusted; the system
  prompt owns the rules, player text is clearly delimited as quoted input.
- **Kill switch:** a `/hyai off` admin command and a global config flag.

**Phase 1 is the whole MVP.** Everything after this is additive.

---

## 6. Phase 2 — Cross-NPC chat

**Outcome:** Two (or more) AI NPCs near each other occasionally hold a short,
in-character conversation that players can overhear. Ambient life, not infinite
loops.

### 6.1 The orchestration problem

The danger is obvious: two LLMs talking forever = runaway token cost and chat
spam. So cross-NPC chat is **budgeted, bounded, and opt-in.**

A `ConversationManager` (one ambient tick, e.g. every 10–20s, on a
`ThreadedScheduler` like `ScheduleManager` already uses):

1. Find clusters of AI NPCs standing near each other
   (`getCitizensNear` around each NPC, or reuse `getCitizensByGroup`).
2. Roll a low probability per cluster ("should a chat start now?") so it's
   sporadic, not constant.
3. If yes, open a **Conversation** with:
   - a fixed **turn budget** (e.g. 3–6 lines total),
   - participants = the clustered personas,
   - an optional **topic seed** (from a topic list, recent events, or a shared
     group memory in Phase 3).
4. Alternate turns: each NPC's prompt includes the persona + the transcript so
   far; its reply becomes the next NPC's input.
5. Render each line to **nearby players** (broadcast to players within range of
   the speaker), not globally.
6. End on budget exhaustion, NPC movement breaking the cluster, or combat.

### 6.2 Prompt shape (per turn)

```
SYSTEM: You are {displayName}. {persona}. You are chatting with {otherNames}.
        Keep it to ONE short line. Stay in character.
USER:   Conversation so far:
        Bram: "Heard anything from Tilda?"
        Mira: "Not a whisper. Three days now."
        (Your turn, as {displayName}.)
```

### 6.3 Controls (non-negotiable for cost)

- **Global concurrency cap:** at most K simultaneous NPC↔NPC conversations
  server-wide.
- **Token/spend budget per hour**, with backoff when exceeded (fall back to
  HyCitizens' existing canned `MessagesConfig` lines so NPCs still "chatter" for
  free).
- **No players nearby → no conversation** (don't pay to talk to an empty room;
  optionally still run *very* rarely so the world feels alive when a player
  arrives).
- **Cheapest model tier** for ambient cross-talk by default.

### 6.4 Reuse, don't reinvent

HyCitizens already has `combatMessageTargetGroups` / `flockArray` /
group-by-path concepts and a `Beacon` messaging system inside roles. Cross-NPC
*social* grouping can piggyback on the existing **group** field
(`getCitizensByGroup`) so "the Oakhollow villagers" is just a group, and a
conversation cluster is "AI NPCs in the same group within N blocks."

---

## 7. Phase 3 — Memory + LLM-assisted tasks

This is where NPCs stop being chatbots and start being *characters with
continuity and goals*. Two distinct subsystems.

### 7.1 Memory

Three tiers, cheapest first:

1. **Working context (per session):** the last few turns of a conversation.
   Already needed for Phases 1–2; just keep it in the session object.
2. **Long-term episodic memory (persisted):** durable facts an NPC "knows"
   about players and events. Stored per-citizen as JSON (same atomic-write
   `ConfigManager` pattern HyCitizens uses for everything else):

   ```jsonc
   // memory/<citizenId>.json
   {
     "people": {
       "<playerUuid>": {
         "name": "Chad",
         "facts": ["Returned my lost hammer.", "Asked about Tilda twice."],
         "sentiment": "friendly",
         "lastSeen": 1716600000000
       }
     },
     "events": [
       { "when": 1716500000000, "text": "Tilda went missing." }
     ]
   }
   ```

3. **Summarized memory (LLM-maintained):** to keep memory small and cheap, run
   a periodic/again-on-session-end **summarization** call: feed the recent raw
   facts + existing summary → get a compact updated summary. This is the "LLM
   helps *manage* memory" piece — the model curates its own long-term notes
   under a size cap.

At prompt time, inject only: persona + static `knowledge` + the relevant
person's memory + a short world/state snapshot. Retrieval can start dumb
(by player UUID + most recent N events) and grow to embeddings later if needed.

**Persistence & lifecycle:** save on session end and on shutdown
(`HyCitizensAI.shutdown()`), load lazily on first interaction. Mirror
HyCitizens' `CitizenAddedEvent` / `CitizenRemovedEvent` so memory is created and
cleaned up with the NPC.

### 7.2 Tasks — the LLM proposes, the engine disposes

The key architectural rule: **the LLM does not execute anything.** It emits a
*structured intent* from a fixed menu of capabilities, and our Java code
validates and applies it through HyCitizens' existing, deterministic systems.
This is tool/function-calling, and it's what keeps an LLM safe in a game server.

Capability catalog (each maps to an API that already exists):

| LLM-proposable task | Mapped to existing HyCitizens capability |
|---------------------|------------------------------------------|
| "Go to the forge / a location" | `ScheduleManager` entry or `moveCitizenToPosition(...)` |
| "Follow this player/citizen for a while" | follow / `FOLLOW_CITIZEN` schedule activity |
| "Change daily routine" | add/modify `ScheduleEntry` in `ScheduleConfig` → `RoleGenerator` regenerates roles |
| "Offer / adjust a trade" | NPCTrading `TradersManager` / `TradeOffer` API |
| "Play an emote" | `playAnimationForCitizen(...)` / `triggerAnimations(...)` |
| "Remember this fact about the player" | write to episodic memory (7.1) |
| "Give a quest objective" | quest record (new lightweight data) + a memory note |

Structured output contract (validated, allow-listed, rejected if unknown):

```jsonc
{
  "say": "Aye, I'll be at the forge come morning.",
  "tasks": [
    { "type": "SET_SCHEDULE_LOCATION", "args": { "entry": "morning", "location": "forge" } },
    { "type": "REMEMBER", "args": { "player": "<uuid>", "fact": "Promised to forge a sword." } }
  ]
}
```

Flow:
1. LLM returns `say` + optional `tasks[]`.
2. `say` is rendered like Phase 1.
3. Each task is **validated against the catalog** (type known? args sane?
   location/trade exists? permission ok?). Unknown or malformed → dropped and
   logged, never executed.
4. Valid tasks are applied on the **world thread** through the existing managers
   (e.g. mutate `ScheduleConfig`, call `saveCitizen`, let `RoleGenerator` +
   `ScheduleManager` do their normal thing on the next tick).

Because all execution flows back through `ScheduleManager`/`RoleGenerator`/
`TradersManager`, an LLM "task" is indistinguishable from a human admin editing
the NPC in the UI — same validation, same persistence, same safety.

### 7.3 Tasks make cross-NPC chat meaningful

Once memory + tasks exist, Phase 2 conversations can have *consequences*: Bram
and Mira "agree" Mira will search for Tilda → that becomes a `SET_SCHEDULE`
task → Mira actually starts walking a search patrol. That's the payoff of doing
the phases in order.

---

## 8. Cross-cutting concerns (all phases)

- **Cost is the #1 risk.** Per-persona model tiers, per-player and global rate
  limits, hourly token budgets, "no players nearby = no spend," and canned-line
  fallbacks when the budget is hit. Make all of these server-config values.
- **Latency:** always async + timeout + instant fallback. Use thinking
  animations so the *world* responds in 0ms even if text takes ~1s.
- **Moderation/abuse:** untrusted player input, output sanitation, optional
  content filter, admin kill switch, and audit logging of prompts/replies for
  server owners.
- **Provider-agnostic LLM client:** wrap the HTTP call behind one interface so a
  server owner can point it at a hosted API or a self-hosted local model. API
  keys come from server config / env, never the persona files.
- **Stay data-driven:** personas, knowledge, capability catalog, topic lists,
  and budgets are all config/JSON. Adding a character or a new task type is a
  data change first, code change only when a genuinely new capability is needed.
- **Graceful degradation:** if HyCitizens isn't present, the plugin no-ops
  (same optional-dependency guard NPCTrading uses). If the LLM is unreachable,
  NPCs fall back to HyCitizens' existing `MessagesConfig` canned dialogue — they
  still talk, just not generatively.

---

## 9. Milestones

| Phase | Ships | New pieces | Reuses |
|-------|-------|-----------|--------|
| **1 — Player chat** | Talk to an NPC, in-character reply | `HyCitizensAI` plugin, persona JSON, async LLM client, chat/interaction capture, rate limit + fallback | `addCitizenInteractListener`, `getCitizensNear`, `parseColoredMessage`, `HttpClient` pattern |
| **2 — Cross-NPC chat** | Bounded ambient NPC↔NPC conversations players overhear | `ConversationManager`, turn budgets, global concurrency + spend caps | group system, `ThreadedScheduler`, proximity APIs |
| **3 — Memory + tasks** | Persistent memory + LLM-proposed actions | episodic/summarized memory store, validated capability catalog (tool-calling), quest records | `ScheduleManager`, `RoleGenerator`, `TradersManager`, `ConfigManager` persistence, add/remove events |

Each phase is independently useful and independently shippable. Phase 1 alone is
a compelling product; Phases 2 and 3 deepen it without rewriting it.

---

## Sources / further reading

- [NPC Technical Rundown — hytale.com](https://hytale.com/news/2026/2/npc-technical-rundown) — roles, sensors/actions/motions, combat action evaluator
- [Hytale Server API Reference (events, messages, plugins)](https://hytalecharts.com/news/hytale-server-api-reference-events-messages-plugin-development-guide)
- [Hytale Modding API: Plugin Development Guide (2026)](https://hytalecharts.com/news/hytale-modding-api-server-plugin-development-guide)
- [Hytale Modding Documentation (community gitbook)](https://britakee-studios.gitbook.io/hytale-modding-documentation)
- In-repo references: `HyCitizens/.../Template_Citizen.json` (role/instruction example), `NPCTrading/.../TraderInteraction.java` (companion-plugin integration pattern), `HyCitizens/.../SkinUtilities.java` (async `HttpClient` pattern).
</content>
</invoke>
