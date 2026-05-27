# Bare-Bones Synth — `hytale-synths` v0 Spawn MVP

*The smallest possible start: a command that spawns one NPC ("synth") with a random skin, standing in front of you. No behavior, no config, no dependency. Everything else gets tacked on later.*

Status: planning draft
Scope: **v0 — spawn only**
Dependencies: **Hytale server/engine API only** (no HyCitizens, no NPCTrading, no mods)
Last updated: 2026-05-25 (revised against the local API reference in [`hytale-mod-docs/`](./hytale-mod-docs/))
Related:
- [`hytale-mod-docs/06-npc-instancing-and-skins.md`](./hytale-mod-docs/06-npc-instancing-and-skins.md) — the full ✅-verified spawn recipe this plan is built on
- [`hytale-mod-docs/05-npc-roles-and-ai.md`](./hytale-mod-docs/05-npc-roles-and-ai.md) — what a Role/instruction list is (needed for §5)
- [`hytale-mod-docs/02-server-plugins.md`](./hytale-mod-docs/02-server-plugins.md) — plugin skeleton, `manifest.json`, command registration
- [`hytale-mod-docs/09-verified-api-cheatsheet.md`](./hytale-mod-docs/09-verified-api-cheatsheet.md) — every signature below, with import paths
- [`hytale-synthetics.md`](./hytale-synthetics.md) — the full behavior-layer plan this feeds into

---

## 1. What this is (and is not)

This is the absolute minimum viable slice of the self-contained `hytale-synths` mod: **instance an NPC body and put it in the world.** Nothing else.

- **It is** the "prove the body" spike from [`hytale-synthetics.md` §22](./hytale-synthetics.md) reduced to one deliverable: `/synth spawn` → a visible, randomly-skinned NPC.
- **It is not** the HyCitizens-dependency track ([`hytale-synthetics.md` §23](./hytale-synthetics.md)). We borrow the *instancing technique* HyCitizens uses, not HyCitizens itself.
- **It is not** a behavior framework yet. Memory, dialogue, conditions, effects, commands, reputation — all deferred. We build the empty body first, then tack the mind on.

The product goal of v0: **I can run one command and a character appears.** That is the entire bar. We iterate from there.

---

## 2. The key insight: instancing is engine API, not HyCitizens

The reason this can be bare-bones is that the hard part of "owning a body" — the part §22 worried about — is mostly **engine API that any plugin can call directly.** HyCitizens is a (very large) *consumer* of these APIs, not the owner of them.

Every call needed to spawn a randomly-skinned NPC lives under `com.hypixel.hytale.*`, not `com.electro.*` (verified in the HyCitizens source):

| Primitive | Package | Role |
|---|---|---|
| `NPCPlugin.get().spawnEntity(...)` | `com.hypixel.hytale.server.npc` | Spawns the NPC entity, returns `Pair<Ref<EntityStore>, NPCEntity>` |
| `NPCPlugin.get().getIndex(roleName)` | `com.hypixel.hytale.server.npc` | Resolves a registered Role to an index (the one thing we must register; see §5) |
| `NPCEntity` | `com.hypixel.hytale.server.npc.entities` | The spawned handle (`setLeashPoint`, etc.) |
| `CosmeticsModule.get().generateRandomSkin(rng)` | `com.hypixel.hytale.server.core.cosmetics` | **Random skin generation — one call** |
| `CosmeticsModule.get().createModel(skin, scale)` | `...core.cosmetics` | Turns a `PlayerSkin` into a renderable `Model` |
| `CosmeticsModule.get().validateSkin(skin)` | `...core.cosmetics` | Guards against an invalid skin |
| `PlayerSkinComponent` | `...core.modules.entity.player` | Attaches the skin to the entity |
| `ModelAsset.getAssetMap().getAsset(id)` | `...core.asset.type.model.config` | (Alternative path) creature/entity models instead of player skins |
| `RandomUtil.getSecureRandom()` | `com.hypixel.hytale.common.util` | RNG for the random skin |
| `ChunkUtil.indexChunkFromBlock(x, z)` | `com.hypixel.hytale.math.util` | Verify the spawn chunk is loaded |

**Conclusion:** we can replicate HyCitizens' "citizen instancing" in well under a hundred lines, with no mod dependency, because we are calling the same engine entry points it calls.

> Every signature above is ✅-verified in [`hytale-mod-docs/09-verified-api-cheatsheet.md`](./hytale-mod-docs/09-verified-api-cheatsheet.md). The full annotated recipe — including the two steps the first draft of this doc got wrong (the spawn callback and the persistent-model fix-up) — is in [`hytale-mod-docs/06`](./hytale-mod-docs/06-npc-instancing-and-skins.md). §4 below now matches it.

---

## 3. The MVP in one sentence

> A `/synth spawn` command creates an NPC entity with an engine-generated random skin at the player's position, and the mod keeps a reference to it.

That is v0. If that works, the project is real.

---

## 4. The minimal spawn recipe

Distilled from HyCitizens' `spawnPlayerModelNPC` (`CitizensManager.java:2430`), stripped of all config, schedules, nametags, equipment, combat, and persistence. This now matches the verified recipe in [`hytale-mod-docs/06`](./hytale-mod-docs/06-npc-instancing-and-skins.md) step-for-step. Annotated pseudocode:

```java
// Runs on the world thread: world.execute(() -> { ... })  — see hytale-mod-docs/08
void spawnSynth(World world, Vector3d position, Vector3f rotation) {
    float scale = 1.0f;

    // 1. Random skin — the engine does this for us.
    PlayerSkin skin = CosmeticsModule.get().generateRandomSkin(RandomUtil.getSecureRandom());

    // 2. Skin -> renderable model (validate first; fall back to a default if needed).
    Model model;
    try {
        CosmeticsModule.get().validateSkin(skin);
        model = CosmeticsModule.get().createModel(skin, scale);
    } catch (Exception e) {
        skin  = defaultSkin();                 // hand-written PlayerSkin (SkinUtilities.createDefaultSkin field set)
        model = CosmeticsModule.get().createModel(skin, scale);
    }
    model = withSafeAnimationSetMap(model);     // GOTCHA: avoid null AnimationSetMap NPE (see §7)

    // 3. Make sure the target chunk is loaded (player's own chunk always is).
    long chunkIndex = ChunkUtil.indexChunkFromBlock(position.x, position.z);
    if (world.getChunkIfLoaded(chunkIndex) == null) return;

    // 4. Spawn against our single bundled role (see §5).
    int roleIndex = NPCPlugin.get().getIndex("Synth_Base");
    if (roleIndex == Integer.MIN_VALUE) return;  // role not registered -> nothing to spawn
    Pair<Ref<EntityStore>, NPCEntity> npc = NPCPlugin.get().spawnEntity(
            world.getEntityStore().getStore(),
            roleIndex, position, rotation, model,
            // 4a. Set scale in the callback, or the engine overrides it with the model's
            //     default scale. Passing null here (as the first draft did) triggers that bug — GOTCHA §7.
            (npcComponent, holder, store2) -> npcComponent.setInitialModelScale(scale),
            null);
    if (npc == null) return;

    Ref<EntityStore> ref     = npc.first();
    Store<EntityStore> store = ref.getStore();

    // 5. Attach the skin so it actually renders with that appearance.
    store.putComponent(ref, PlayerSkinComponent.getComponentType(), new PlayerSkinComponent(skin));

    // 6. Re-assert the model on PersistentModel — without this a "Player"-model NPC's scale
    //    can reset to 0 (invisible). GOTCHA §7.
    PersistentModel pm = store.getComponent(ref, PersistentModel.getComponentType());
    if (pm != null) {
        pm.setModelReference(new Model.ModelReference(
                model.getModelAssetId(), scale,
                model.getRandomAttachmentIds(), model.getAnimationSetMap() == null));
    }

    // 7. Keep it from drifting and remember it.
    npc.second().setLeashPoint(position);
    registry.add(new Synth(UUID.randomUUID(), ref, skin));   // in-memory only in v0
}
```

That is the whole body — ~40 lines of real logic. The two additions over the first draft (the scale callback in 4a and the `PersistentModel` fix-up in 6) are exactly the steps that, omitted, produce a spawned-but-invisible synth.

> **Player-skin vs entity-model.** We default to **player models with random skins** because "random skin generation" is exactly what `generateRandomSkin` gives us for free. If we'd rather have creature/villager bodies, swap steps 1–2 for `ModelAsset.getAssetMap().getAsset("humanoid/villager_m")` + `Model.createScaledModel(asset, scale)` and pick the id at random from a small list. Same spawn call.

---

## 5. The one unavoidable dependency: a Role

`NPCPlugin.get().spawnEntity(...)` needs a **role index**, and `getIndex(name)` returns `Integer.MIN_VALUE` for an unregistered role. So we must register exactly **one** Role asset. This is the single piece of "Role complexity" from §22 that we cannot skip — but we reduce it from HyCitizens' per-NPC `RoleGenerator` (711 lines) to **one static bundled file.**

- Hytale loads NPC Roles from a data asset pack under `Server/NPC/Roles/` (HyCitizens uses `DataAssetPackManager.GENERATED_ROLES_PATH = <data pack>/Server/NPC/Roles`).
- HyCitizens' generated roles are thin and just `"Reference": "Template_Citizen"` (`RoleGenerator.java:359`), inheriting a bundled base role.
- **Our cut:** ship one minimal passive/idle role, `Synth_Base.json`, in our plugin resources at `src/main/resources/Server/NPC/Roles/Synth_Base.json`. Every synth spawns with this one role. No per-NPC generation.

```jsonc
// src/main/resources/Server/NPC/Roles/Synth_Base.json  (sketch — exact schema confirmed during the spike)
{
  "Type": "Variant",
  "Reference": "Template_Citizen",   // or a built-in base; the spike decides what's available standalone
  "Name": "Synth_Base"
  // intentionally no sensors/actions/motions beyond "exist and idle"
}
```

One nuance from [`hytale-mod-docs/05`](./hytale-mod-docs/05-npc-roles-and-ai.md): a Role's behavior *is* its instruction lists (sensors → actions/motions), evaluated as a fallback selector. A role with **zero** instructions may spawn an inert body or may be rejected as invalid — "idle" is not guaranteed to be free. So `Synth_Base` should either `Reference` a base that already provides an idle/wander instruction, or include one minimal idle instruction. The spike settles which.

The **first job of the spike (§9)** is to confirm what a minimal standalone role needs — whether we can `Reference` a built-in engine root role, or must bundle a self-contained one. Until a role resolves via `getIndex` (returns `Integer.MIN_VALUE` when unknown), nothing spawns, so this is the critical-path unknown.

---

## 6. What we cut vs. HyCitizens

Everything that is configuration, not instancing, is gone in v0:

| HyCitizens feature | v0 synth |
|---|---|
| Per-NPC `RoleGenerator` (dynamic roles) | One static `Synth_Base` role |
| Schedules / patrols / combat / attitude | ❌ none |
| Nametags, map markers, hologram NPCs | ❌ none |
| Equipment, armor, item-in-hand | ❌ none |
| Skin-by-username / live-skin HTTP fetch | ❌ none — random generation only |
| In-game config UI (HyUI) | ❌ none — one command |
| Per-NPC scale/rotation/model config | ❌ defaults (scale 1.0, face player) |
| Persistence across restart | ⚠️ **deferred** — v0 is in-memory only (see §8) |
| First-interaction tracking, canned messages | ❌ none — that is the *behavior* layer, later |

What we **keep** is only what an instance needs: an id, a world position, a random skin, and a live `Ref<EntityStore>`/`NPCEntity` handle we hold onto.

---

## 7. Known gotchas (carried over from the real spawn path)

These are bugs HyCitizens already hit and worked around; replicating the technique means replicating the guards:

1. **Null `AnimationSetMap` → NPE.** HyCitizens wraps every spawn model in `withSafeAnimationSetMap(...)` (rebuilds the `Model` with an empty animation-set map if it's null). Copy that helper.
2. **Scale override → invisible/zero-size synth.** If you don't set the scale in the spawn callback (step 4a), the engine overrides it with the model asset's default; and for `"Player"`-model NPCs the scale can reset to 0 unless you re-assert it on `PersistentModel` (step 6). These two were missing from this doc's first draft — they're why a synth can spawn yet not be visible.
3. **Threading.** Entity/world mutation must run on the world thread. Do the whole spawn inside `world.execute(() -> ...)` (see [`hytale-mod-docs/08`](./hytale-mod-docs/08-messaging-and-threading.md)). Random-skin generation is pure and can run anywhere, but keep it simple and do it all on-thread for v0.
4. **Chunk must be loaded.** `getChunkIfLoaded` returns null for unloaded chunks; spawning at the commanding player's position sidesteps this since their chunk is loaded.
5. **Invalid skin.** `generateRandomSkin` should be valid, but `createModel` can still throw; guard with `validateSkin` and a hand-written `defaultSkin()` fallback (see `SkinUtilities.createDefaultSkin()` for the exact field set, mirrored in [`hytale-mod-docs/06`](./hytale-mod-docs/06-npc-instancing-and-skins.md)).
6. **`getIndex` timing.** Roles must be registered/loaded before the first spawn; if `getIndex` returns `Integer.MIN_VALUE`, retry after load rather than failing hard.
7. **Stale `Ref`s.** The `Ref<EntityStore>` we stash in the registry can go invalid when the entity unloads/despawns. Always `ref.isValid()` before touching it again (see [`hytale-mod-docs/04`](./hytale-mod-docs/04-ecs.md)). This bites the moment we add `/synth clear` or persistence.

> The full gotcha table with symptoms and fixes lives in [`hytale-mod-docs/06`](./hytale-mod-docs/06-npc-instancing-and-skins.md#gotchas-the-workarounds-hycitizens-had-to-add).

---

## 8. State model (v0)

Deliberately trivial and **in-memory**:

```java
record Synth(UUID id, Ref<EntityStore> ref, PlayerSkin skin) {}
// SynthRegistry: Map<UUID, Synth> held by the plugin. Lost on restart.
```

Because the stored `Ref` can go stale (gotcha §7.7), treat the registry's `ref` as a *cache*, not a guarantee — re-validate with `ref.isValid()` on read and prune dead entries.

**v0 does not persist.** Spawned synths vanish on server restart. This is an accepted limitation, not an oversight — persistence is the very next iteration (§10), and keeping it out of v0 means the first milestone is purely "does the spawn call work." Call this out to anyone testing so a missing-after-restart synth isn't filed as a bug.

---

## 9. The feasibility spike (build this first)

One sitting, one goal: **prove the spawn call.**

1. Stand up an empty plugin: `extends JavaPlugin` with the `JavaPluginInit` constructor, a `manifest.json` (`Group`/`Name`/`Version`/`Main`, no dependencies), and the `setup()`/`start()`/`shutdown()` hooks. (See [`hytale-mod-docs/02`](./hytale-mod-docs/02-server-plugins.md).)
2. Bundle `Server/NPC/Roles/Synth_Base.json`; confirm `NPCPlugin.get().getIndex("Synth_Base")` resolves to a real index at runtime. **(Riskiest step — see §5.)**
3. Register `/synth spawn` via `getCommandRegistry().registerCommand(...)` (implement the `Command` interface). In the handler, resolve the sender's world + position + rotation and call `spawnSynth` inside `world.execute(...)`.
4. Look at it. Is there a character standing there with a random appearance? Use the engine's debug overlays to confirm it's a real NPC, e.g. `/npc debug set VisLeashPosition` (full list in [`hytale-mod-docs/05`](./hytale-mod-docs/05-npc-roles-and-ai.md)).

If yes, the entire bare-bones premise holds and everything after is incremental. If `getIndex` won't resolve a standalone role, that is the one finding that changes the plan (and would push us toward the HyCitizens-dependency track in [`hytale-synthetics.md` §23](./hytale-synthetics.md)) — which is exactly why it is step 2.

---

## 10. Iteration path (after v0 spawns)

Each step is small and independently testable. Stop adding until the previous one feels solid.

1. **`/synth clear` / despawn** — remove spawned synths (need this immediately for testing).
2. **Persistence** — write `{id, world, position, skin}` to a JSON file with atomic write/rename (the `ConfigManager` pattern in [`hytale-mod-docs/08`](./hytale-mod-docs/08-messaging-and-threading.md)); respawn on `start()`. Don't store the `Ref` — it's runtime-only; re-acquire it by re-spawning. (This is the first "real body" milestone.)
3. **`/synth spawn <n>`** — spawn several at once; confirms the registry and perf.
4. **Anchor / face player** — minimal presence polish (rotate toward nearby players).
5. **Interaction hook** — detect "player interacted with a synth," normalize to a `SynthEvent`. This is the seam where the [`hytale-synthetics.md`](./hytale-synthetics.md) behavior layer (memory, dialogue, conditions, effects) tacks on.
6. **Automation** — spawn synths from data / on triggers instead of by command (the "we can eventually automate" goal).

Steps 1–4 finish the *body*. Step 5 is the bridge to the *mind*. Step 6 is where "synth creation" becomes programmatic.

---

## 11. v0 acceptance criteria

- With **only** this plugin installed (no HyCitizens), `/synth spawn` makes a visible NPC appear at the player.
- The NPC has a **randomly generated skin** (different across spawns).
- The mod holds a live reference to each spawned synth in an in-memory registry.
- No Hytale imports leak outside the one spawner/engine class (keep the §22 "one seam" discipline from day one, even at this size).
- Restart-loss of synths is documented and expected (until persistence lands in §10.2).

---

## 12. Suggested skeleton

```text
com.example.hytalesynths
  HytaleSynthsPlugin.java        // extends JavaPlugin; setup() registers the command, start()/shutdown()
  SynthSpawner.java              // the ONLY class importing com.hypixel.hytale.server.npc / cosmetics
  SynthRegistry.java             // in-memory Map<UUID, Synth>
  Synth.java                     // record(id, ref, skin)
  commands/SynthCommand.java     // implements Command; /synth spawn  (+ /synth clear next)
resources/
  manifest.json                  // Group / Name / Version / Main  (see hytale-mod-docs/02)
  Server/NPC/Roles/Synth_Base.json   // the one bundled role
```

Keep `SynthSpawner` as the single engine seam (the only place `com.hypixel.hytale.*` is imported). When the behavior layer arrives, that class becomes the `EngineDriver` implementation from [`hytale-synthetics.md` §10.1](./hytale-synthetics.md) — so this skeleton grows into that plan without a rewrite. The verified API every line above calls is catalogued in [`hytale-mod-docs/09`](./hytale-mod-docs/09-verified-api-cheatsheet.md).

---

## 13. Mantra

> Spawn one character with a random face. Hold onto it. Ship that. Everything else — persistence, memory, dialogue, automation — is something you tack onto a body that already exists.
