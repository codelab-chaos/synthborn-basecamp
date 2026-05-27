# Hytale Modding — LLM Knowledge Base

Single-file, token-dense, capability-indexed reference for Hytale **server-side** modding. Intended as a drop-in prompt context so an LLM can answer "how do I X in Hytale" without hallucinating.

**Last compiled:** 2026-05-26 · **Server API seen:** `2026.05.01-43e16373b46`
**Drill in:** [hytale-mod-quickref/](./hytale-mod-quickref/) (deeper, prose-form companion docs)

---

## How to read this

| Tag | Meaning |
|---|---|
| ✓ | Verified against compiling code in this repo (`HyCitizens/`, `NPCTrading/`, `mods/SynthNPCs/`) |
| 📘 | From official Hypixel post / `release.server.docs.hytale.com` Javadoc |
| 🌐 | Community docs (`hytale-docs.pages.dev`, `hytalecharts.com`) — may drift |
| ? | Observed / inferred, not source-confirmed |
| ✗ | Tried and doesn't work, or explicitly unsupported |

When ✓ and 🌐 disagree, trust ✓. If something you need isn't here, **read the decompiled source** before guessing — see [10-references.md](./hytale-mod-quickref/10-references.md).

---

## Hard rules (architecture invariants)

1. **Server-side only.** No client mods, ever — even single-player runs a local server. All gameplay code is server Java. 📘
2. **Java 25.** ✓
3. **World thread for world/entity mutation.** Wrap with `world.execute(() -> ...)`. Cross-thread mutation = nondeterministic corruption. ✓📘
4. **Off-thread for blocking I/O** (HTTP/LLM/disk). Use `HytaleServer.SCHEDULED_EXECUTOR` or `registerAsync`, then hop back via `world.execute`. ✓📘
5. **`ServerVersion` in `manifest.json` must equality-match the server build string** (not a range). Pin the Gradle dep to the same string. ✓
6. **Every `Ref<EntityStore>` access must check `ref.isValid()`** — entities despawn/unload at any time. ✓
7. **Don't drive NPC motion by writing `TransformComponent` position.** Animations/facing break. Use the native `Walk` motion controller + `BodyMotion` (Role JSON) and expose intent through a custom sensor. ✓ (SynthNPCs discovery)

---

## Capability index

The "I want to ___ → call ___" table. Source column points to a verified call site or doc.

### Plugin lifecycle & registration

| Want to... | Use | Status | Source |
|---|---|---|---|
| Define a plugin | `extends JavaPlugin` with `setup()`, `start()`, `shutdown()` | ✓ | [02](./hytale-mod-quickref/02-server-plugins.md) |
| Register at init | `setup()` | ✓ | [02](./hytale-mod-quickref/02-server-plugins.md) |
| Touch other plugins | `start()` (NOT `setup()` — they may not be ready) | ✓ | [02](./hytale-mod-quickref/02-server-plugins.md) |
| Expose plugin to others | Static `instance` + `public static MyPlugin get()` | ✓ | `HyCitizensPlugin.get()` |
| Check optional dep | `PluginManager.get().getPlugin(new PluginIdentifier(group, name)) == null` | ✓ | `NPCTrading/.../TraderInteraction.java` |
| Register a command | `getCommandRegistry().registerCommand(new MyCmd())` | ✓ | `HyCitizens` `/citizens` |
| Schedule a task | `getTaskRegistry()` | 🌐 | [02](./hytale-mod-quickref/02-server-plugins.md) |
| Log structured | `getLogger().at(Level.INFO).log("msg")` | ✓ | repo-wide |

### Events

| Want to... | Use | Status | Source |
|---|---|---|---|
| Listen to event | `getEventRegistry().register(EventClass.class, e -> {...})` | ✓ | [03](./hytale-mod-quickref/03-events.md) |
| Listen with priority | `register(EventPriority.EARLY, EventClass.class, ...)` | 🌐 | [03](./hytale-mod-quickref/03-events.md) |
| Listen across all keys | `registerGlobal(EventClass.class, ...)` | 🌐 | [03](./hytale-mod-quickref/03-events.md) |
| Listen off-thread | `registerAsync(EventClass.class, fut -> fut.thenApply(...))` | 🌐 | [03](./hytale-mod-quickref/03-events.md) |
| Cancel an event | `event.setCancelled(true)` (only if `ICancellable`) | ✓ | `PlayerChatEvent`, `CitizenInteractEvent` |

Priorities: `FIRST=-21844 < EARLY=-10922 < NORMAL=0 < LATE=10922 < LAST=21844`. Low→high dispatch.

Event catalog (🌐 — confirm in decompiled source before depending on exact spelling):
- **Lifecycle:** `BootEvent`, `ShutdownEvent`, `PluginSetupEvent`, `PrepareUniverseEvent`
- **World:** `AddWorldEvent`, `RemoveWorldEvent`, `AllWorldsLoadedEvent`, `StartWorldEvent`
- **Player:** `PlayerConnectEvent`, `PlayerDisconnectEvent`, `PlayerChatEvent`, `PlayerReadyEvent`, `AddPlayerToWorldEvent`
- **Block:** `PlaceBlockEvent`, `BreakBlockEvent`, `DamageBlockEvent`, `UseBlockEvent`
- **Entity/items:** `EntitySpawnEvent`, `EntityRemoveEvent`, `LivingEntityInventoryChangeEvent`, `DropItemEvent`, `InteractivelyPickupItemEvent`
- **Other:** `CraftRecipeEvent`, `ChangeGameModeEvent`, `DiscoverZoneEvent`

### World / players / lookup

| Want to... | Use | Status | Source |
|---|---|---|---|
| Get a world | `Universe.get().getWorld(worldUUID)` | ✓ | repo |
| Get its entity store | `world.getEntityStore().getStore()` | ✓ | repo |
| Find online player | `Universe.get().getPlayer(name, NameMatching.EXACT_IGNORE_CASE)` | ✓ | repo |
| Player → ref | `playerRef.getReference()` | ✓ | repo |
| Load offline player | `Universe.get().getPlayerStorage().load(uuid)` → `CompletableFuture<EntityStore>` | ✓ | repo |
| Resolve ref from stored UUID | `world.getEntityRef(uuid)` (null if gone) | ✓ | `HyCitizens` |
| Chunk loaded? | `world.getChunkIfLoaded(ChunkUtil.indexChunkFromBlock(x,z)) != null` | ✓ | `CitizensManager` |

### ECS (components / entities)

| Want to... | Use | Status | Source |
|---|---|---|---|
| Read component | `store.getComponent(ref, T.getComponentType())` | ✓ | repo |
| Write component | `store.putComponent(ref, T.getComponentType(), new T(...))` | ✓ | repo |
| Validity-check ref | `ref.isValid()` — **always first** | ✓ | repo |
| Despawn entity | `store.removeEntity(ref, RemoveReason.REMOVE)` (world thread) | ✓ | `CitizensManager.despawnCitizenNPC*` |
| Add raw entity | `store.addEntity(holder, AddReason.SPAWN)` | 🌐 | [04](./hytale-mod-quickref/04-ecs.md) |
| Iterate by component | `store.forEachChunk(T.getComponentType(), (chunk, cmdBuf) -> ...)` | 🌐 | [04](./hytale-mod-quickref/04-ecs.md) |
| Persist custom data on entity | Custom `Component<EntityStore>` + codec registration | ✓ | `mods/SynthNPCs/SynthIdentityComponent`, `SynthBehaviorComponent` |

Verified component types (each has static `getComponentType()`): `ModelComponent`, `PersistentModel`, `PlayerSkinComponent`, `UUIDComponent`, `TransformComponent`, plus stats via `EntityStatsModule.get().getEntityStatMapComponentType()`. ✓

### NPCs (spawn / role / despawn)

| Want to... | Use | Status | Source |
|---|---|---|---|
| Resolve role index | `NPCPlugin.get().getIndex("RoleName")` (returns `Integer.MIN_VALUE` if unknown) | ✓ | `CitizensManager` |
| Spawn NPC | `NPCPlugin.get().spawnEntity(store, roleIdx, pos, rot, model, initCallback, null)` | ✓ | `CitizensManager.spawnCitizenNPCInternal` |
| Leash to position | `npcEntity.setLeashPoint(position)` | ✓ | `CitizensManager` |
| Swap role at runtime | `RoleChangeSystem.requestRoleChange(...)` | ✓📘 | `com.hypixel.hytale.server.npc.systems.RoleChangeSystem` |
| Define a role | JSON at `<asset-pack>/Server/NPC/Roles/<Name>.json` | ✓ | `HyCitizens/.../Template_Citizen.json` |
| Inherit a role | `"Reference": "Template_Citizen"` in JSON | ✓ | `RoleGenerator.java:359` |
| Walk an NPC (native) | Role JSON: `Walk` motion controller + `BodyMotion: Find`, target via custom sensor | ✓ | `mods/SynthNPCs/Synth_Base.json`, `SynthMoveTarget` sensor |
| Teleport (debug only) | Write `TransformComponent` position directly — **breaks animation/facing**, use for debug only | ✓ | `mods/SynthNPCs/mod-dev-discoveries.md` |
| Debug visualize AI | `/npc debug set VisAiming\|VisMarkedTargets\|VisSensorRanges\|VisLeashPosition\|VisFlock` | 📘 | [09](./hytale-mod-quickref/09-verified-api-cheatsheet.md) |

### Skins & models

| Want to... | Use | Status | Source |
|---|---|---|---|
| Random skin | `CosmeticsModule.get().generateRandomSkin(RandomUtil.getSecureRandom())` | ✓ | `SkinCustomizerUI.java:496` |
| Validate skin | `CosmeticsModule.get().validateSkin(skin)` (throws if invalid) | ✓ | `SkinUtilities` |
| Skin → model | `CosmeticsModule.get().createModel(skin, scale)` | ✓ | `CitizensManager` |
| Attach skin to NPC | `store.putComponent(ref, PlayerSkinComponent.getComponentType(), new PlayerSkinComponent(skin))` | ✓ | `CitizensManager` |
| Cosmetic catalogue | `CosmeticsModule.get().getRegistry().getFaces()/getHaircuts()/...` | ✓ | `SkinUtilities.buildCosmeticCatalogue()` |
| Load model asset | `ModelAsset.getAssetMap().getAsset("humanoid/villager_m")` (null if unknown) | ✓ | `CitizensManager` |
| Scaled model from asset | `Model.createScaledModel(asset, scale)` | ✓ | `CitizensManager` |
| "Player" model w/o skin | `new Model.ModelReference("Player", scale, new HashMap<>()).toModel()` | ✓ | `CitizensManager` |
| Read another player's skin | `store.getComponent(ref, PlayerSkinComponent.getComponentType()).getPlayerSkin()` | ✓ | `HyCitizens` |

`PlayerSkin` 20-arg constructor order: `bodyCharacteristic, underwear, face, eyes, ears, mouth, facialHair, haircut, eyebrows, pants, overpants, undertop, overtop, shoes, headAccessory, faceAccessory, earAccessory, skinFeature, gloves, cape`. ✓

### Inventory / items

| Want to... | Use | Status | Source |
|---|---|---|---|
| Make item | `new ItemStack("Resource_Iron_Ore", 10)` | ✓ | `NPCTrading` |
| Get entity inventory | `entity.getInventory()` | ✓ | `NPCTrading` |
| Get hotbar/storage | `inv.getHotbar()`, `inv.getStorage()` | ✓ | `NPCTrading` |
| Item in hand | `inv.getItemInHand()` | 🌐 | [07](./hytale-mod-quickref/07-inventory-and-items.md) |
| Read slot | `container.getItemStack((short) i)` | ✓ | `NPCTrading` |
| Add to container | `container.addItemStack(stack)` → `ItemStackTransaction` | ✓ | `NPCTrading` |
| Set slot | `container.setItemStackForSlot((short) i, stack)` → `ItemStackSlotTransaction` | 🌐 | [07](./hytale-mod-quickref/07-inventory-and-items.md) |
| Mutate stack | `stack.withQuantity(n)`, `.withDurability(d)`, `.withMetadata(bson)` — **returns new instance** | 🌐 | [07](./hytale-mod-quickref/07-inventory-and-items.md) |
| Player↔NPC trade | `TradeManager.executeTrade(playerRef, offer)` — verify→remove→add→message | ✓ | `NPCTrading/.../TradeManager.java` |
| NPC↔NPC item move | ✗ — no precedent in repo; new work | ✗ | `hytale-synthetics.md §22` |

Slot capacities: Hotbar=9, Storage=36, Armor=4, Utility=4, Tools=23, Backpack=variable. 🌐

### Messaging / chat

| Want to... | Use | Status | Source |
|---|---|---|---|
| Send chat | `player.sendMessage(Message.raw("text").color(Color.GREEN))` | ✓ | `NPCTrading` |
| Builder chain | `.color(...).bold(...).link(...)` | 📘 | [08](./hytale-mod-quickref/08-messaging-and-threading.md) |
| Colored placeholder parser | `CitizenInteraction.parseColoredMessage("{GOLD}A {WHITE}B")` | ✓ | `HyCitizens` |

### Threading / async / persistence

| Want to... | Use | Status | Source |
|---|---|---|---|
| World mutation | `world.execute(() -> {...})` | ✓ | repo-wide |
| Off-thread blocking work | `CompletableFuture.supplyAsync(..., HytaleServer.SCHEDULED_EXECUTOR)` | ✓📘 | `HyCitizens` skin fetch |
| Async HTTP | `java.net.http.HttpClient` (allowed; shared/static; always set timeouts) | ✓ | `HyCitizens` |
| Re-enter world after async | `.whenComplete((r, err) -> world.execute(() -> {...}))` | ✓📘 | `HyCitizens` |
| Persist atomically | Write temp → fsync → rename (HyCitizens `ConfigManager`, Gson) | ✓ | `HyCitizens/ConfigManager.java` |

### External control / testing

| Want to... | Use | Status | Source |
|---|---|---|---|
| Drive server from outside game | RCON, default port `25575` | ✓ | `mods/SynthNPCs/mod-dev-discoveries.md` |
| Unit-test plain Java | JUnit 5 (`junit-bom:5.10.0`, already in build) | ✓ | repo build files |
| Test Hytale-world behavior | Manual / external harness — **don't unit-test Hytale-facing behavior** | ✓ | `mods/SynthNPCs/mod-dev-discoveries.md` |

### Known not-yet-confirmed / unsupported

| Want to... | Status | Note |
|---|---|---|
| Direct block placement from plugin | ? | No repo call site found; needs API verification |
| NPC-to-NPC inventory transfer | ✗ | No precedent in `NPCTrading` (player↔NPC only) |
| Client-side scripting | ✗ | Explicitly unsupported by design 📘 |
| Visual node-based scripting | ✗ | Roadmap only, not shipped 📘 |
| Custom UI (NoesisGUI) | ? | Promised short-term; not yet available 📘 |

---

## Top types in one line

- `Ref<EntityStore>` — opaque entity handle; **always `isValid()` first**. Methods: `isValid()`, `getStore()`, `getIndex()`, `validate()`.
- `Store<EntityStore>` — entity container, owns components by type token. From `world.getEntityStore().getStore()`.
- `World` — world handle. Key methods: `execute(Runnable)`, `getEntityStore()`, `getChunkIfLoaded(long)`, `getEntityRef(uuid)`.
- `PlayerRef` — player handle. Has `sendMessage(Message)` and `getReference()`.
- `Universe` — singleton root. `Universe.get().getWorld/getPlayer/getPlayerStorage()`.
- `NPCPlugin` — singleton. `.getIndex(name)`, `.spawnEntity(...)`.
- `CosmeticsModule` — singleton. `.generateRandomSkin`, `.createModel`, `.validateSkin`, `.getRegistry()`.
- `Vector3d` (position), `Vector3f` (rotation), `ChunkUtil` (math) — in `com.hypixel.hytale.math.*`.
- `ItemStack` — **immutable-style**; `.withX(...)` returns a new instance.
- `Message` — chat builder. `Message.raw("...").color(...).bold(...).link(...)`.
- `EventPriority` — `FIRST < EARLY < NORMAL < LATE < LAST`.
- `RemoveReason` / `AddReason` — entity lifecycle reason codes.

---

## Top recipes (copy-pasteable)

### Spawn an NPC with a random skin (the canonical recipe)

```java
// All on the world thread.
world.execute(() -> {
    PlayerSkin skin = CosmeticsModule.get().generateRandomSkin(RandomUtil.getSecureRandom());
    Model model;
    try {
        CosmeticsModule.get().validateSkin(skin);
        model = CosmeticsModule.get().createModel(skin, scale);
    } catch (Exception e) { return; }
    model = withSafeAnimationSetMap(model);  // GOTCHA: rebuild with empty map if AnimationSetMap is null

    long chunk = ChunkUtil.indexChunkFromBlock(position.x, position.z);
    if (world.getChunkIfLoaded(chunk) == null) return;

    int roleIndex = NPCPlugin.get().getIndex("Synth_Base");
    if (roleIndex == Integer.MIN_VALUE) return;

    Store<EntityStore> store = world.getEntityStore().getStore();
    Pair<Ref<EntityStore>, NPCEntity> npc = NPCPlugin.get().spawnEntity(
        store, roleIndex, position, rotation, model,
        (npcC, holder, s) -> npcC.setInitialModelScale(scale),
        null);
    if (npc == null) return;
    Ref<EntityStore> ref = npc.first();

    store.putComponent(ref, PlayerSkinComponent.getComponentType(), new PlayerSkinComponent(skin));

    PersistentModel pm = store.getComponent(ref, PersistentModel.getComponentType());
    if (pm != null) pm.setModelReference(new Model.ModelReference(
        model.getModelAssetId(), scale, model.getRandomAttachmentIds(), model.getAnimationSetMap() == null));

    npc.second().setLeashPoint(position);
});
```

### Async I/O then mutate world

```java
CompletableFuture
    .supplyAsync(() -> blockingCall(), HytaleServer.SCHEDULED_EXECUTOR)
    .orTimeout(8, TimeUnit.SECONDS)
    .whenComplete((result, err) -> world.execute(() -> {
        if (err != null) { sendFallback(player); return; }
        if (!ref.isValid()) return;  // entity may have despawned
        applyToWorld(result);
    }));
```

### Walk an NPC to a target (native motion, NOT transform stepping)

```java
// 1. Role JSON declares the motion:
//    "MotionController": "Walk",  "BodyMotion": { "Type": "Find", "Target": "MOVE_TO" }
// 2. Plugin writes intent to a custom behavior component:
behaviorComp.setMoveTarget(targetPos);   // MOVE_TO
store.putComponent(ref, SynthBehaviorComponent.getComponentType(), behaviorComp);
// 3. A custom Sensor (registered as an NPC element) reads the component and
//    exposes MOVE_TO / RETURN_HOME to the instruction list.
// 4. The behavior tick CLEARS the target on arrival — it does not move the entity itself.
```

### Optional plugin dependency

```java
PluginIdentifier id = new PluginIdentifier("com.electro", "HyCitizens");
if (PluginManager.get().getPlugin(id) == null) return;  // graceful no-op
HyCitizensPlugin.get().getCitizensManager().addCitizenInteractListener(e -> { ... });
```

### Despawn an entity

```java
world.execute(() -> {
    if (ref.isValid()) {
        world.getEntityStore().getStore().removeEntity(ref, RemoveReason.REMOVE);
    }
});
```

### Plugin skeleton

```java
public class MyPlugin extends JavaPlugin {
    private static MyPlugin instance;
    public static MyPlugin get() { return instance; }

    public MyPlugin(@Nonnull JavaPluginInit init) { super(init); }

    @Override protected void setup() {
        instance = this;
        getCommandRegistry().registerCommand(new MyCommand());
        getEventRegistry().register(BootEvent.class, this::onBoot);
    }
    @Override protected void start()    { /* cross-plugin work safe here */ }
    @Override protected void shutdown() { /* persist + cleanup */ }
}
```

### Minimum `manifest.json`

```json
{
  "Group": "com.example",
  "Name": "MyPlugin",
  "Version": "1.0.0",
  "Main": "com.example.MyPlugin",
  "ServerVersion": "2026.03.26-89796e57b",
  "Dependencies": {},
  "DisabledByDefault": false
}
```

---

## NPC behavior model (Roles + instruction lists)

```text
Role (JSON)                — overall behavior profile
  └─ Instruction Lists     — ordered sequences (top-to-bottom, first match wins, then stop)
       └─ Elements (Java)  — 150+ primitives: Sensors, Actions, Motions, Modifiers
```

- **Semantics: fallback selector.** Order = priority. Put threat/survival at top, idle at bottom. 📘
- **Element types:** Sensors (guard), Actions (do), Motions (move), Modifiers (cooldown/probability/duration).
- **Concrete elements named in `Template_Citizen.json`:** `Target`, `Beacon`, `Seek`, `Attack`, `State`, `Timeout`, `Random`, `Walk` (motion controller), `BodyMotion` (`Find` etc.).
- **Subsystems** (in `com.hypixel.hytale.builtin.npc`): Blackboard (shared per-NPC memory), Decision Makers, Navigation (A*), Animations, support objects (`CombatSupport`, `StateSupport`, `EntitySupport`, `WorldSupport`, `PositionCache`).
- **Two paths:** no-code (compose built-in elements in JSON) — start here. Code (new sensor/action/motion element types in Java) — only when no built-in fits.
- **`IsMemory`/`MemoriesCategory`/`MemoriesNameOverride`** is the NPC's *creature memory* — DIFFERENT from any LLM/conversation memory. Don't conflate. 📘

### Designing a behavior

1. Read the design docs.
2. Break into distinct states (each becomes a top-level instruction list).
3. Identify existing predefined elements — reuse before writing Java.
4. Identify reusable sub-lists.
5. Extract complex reusable parts later (refactor once working).

Tutorial starter states: `Idle`, `Sleep`, `Eat`, `Alerted`, `Combat`, `ReturnHome`.

### Plugin tick vs Role JSON — which drives what

- **Role JSON drives:** movement, animation, sensor evaluation, instruction selection, anything visible/physical.
- **Plugin tick drives:** writing *intent* to components (move target, role assignment, carried-resource counts), cleaning up state on arrival, coarse decisions a sensor can't easily express.
- **Wrong pattern (don't):** plugin tick that walks the entity by incrementing `TransformComponent.position`. Looks like teleport-spam, no facing/animation. (SynthNPCs spike confirmed this.)

---

## Pitfalls (the workarounds you'd otherwise rediscover)

| Pitfall | Symptom | Fix | Source |
|---|---|---|---|
| Null `AnimationSetMap` on model | NPE when spawning | Wrap model with `Collections.emptyMap()` as animation-set map if null | `HyCitizens.withSafeAnimationSetMap` |
| `"Player"` model scale resets to 0 | Invisible/zero-size NPC | After spawn, re-set `PersistentModel` reference with the real scale | `CitizensManager` |
| Engine overrides scale | Wrong size | Pass `model` explicitly + set scale in the spawn callback | `CitizensManager` |
| Unloaded chunk | Silent no-spawn | Check `getChunkIfLoaded` before spawn; retry on chunk load | `CitizensManager` |
| Role not registered | `getIndex` → `Integer.MIN_VALUE` | Bundle the role asset first; retry after asset load | repo |
| Wrong thread | Corruption / crash | Wrap in `world.execute(...)` | [08](./hytale-mod-quickref/08-messaging-and-threading.md) |
| Stale `Ref` after async hop | NPE or silent miss | Re-check `ref.isValid()` after every async boundary | repo-wide |
| `ServerVersion: "*"` or omitted | `SEVERE … targeting different server version` (fatal soon) | Pin to exact server build; bump Gradle dep + manifest together | `SynthNPCs` |
| Mutating store mid-`forEachChunk` | Undefined behavior | Use the `commandBuffer` arg for deferred add/remove | 🌐 [04](./hytale-mod-quickref/04-ecs.md) |
| `.get()`/`.join()` on world thread | Hangs world | All blocking I/O off-thread; return via `whenComplete` + `world.execute` | repo-wide |
| Mutating `ItemStack` in place | No-op | `withX(...)` returns a new instance — capture it | [07](./hytale-mod-quickref/07-inventory-and-items.md) |
| Touching other plugins from `setup()` | Sees null/empty | Do cross-plugin work in `start()` | [02](./hytale-mod-quickref/02-server-plugins.md) |
| Driving motion by writing `TransformComponent` | Teleport-spam, no facing/anim | Native `Walk` motion + intent component + sensor | `mods/SynthNPCs/mod-dev-discoveries.md` |
| Command name hides instant vs walked | User confusion | Distinct verbs: `teleporthere` (instant), `walk` (visible) | `mods/SynthNPCs/mod-dev-discoveries.md` |
| Over-testing Hytale-facing behavior | Slow iteration | Unit-test pure Java only; runtime/manual for world behavior | `mods/SynthNPCs/mod-dev-discoveries.md` |

---

## Package map (where things live)

```text
com.hypixel.hytale.component      → ECS core (Store, Ref, Archetype, ISystem, ComponentType)
com.hypixel.hytale.server.core    → assets, commands, entity/player mgmt, world/universe/chunk, permissions, Message
com.hypixel.hytale.server.npc     → NPCPlugin, NPCEntity, RoleChangeSystem
com.hypixel.hytale.builtin        → adventure (NPCs, objectives, reputation, shops, memories), worldgen, crafting,
                                    farming, deployables, mounts, weather, builder/prefab, ...
com.hypixel.hytale.protocol       → packets, network, connection/auth, PlayerSkin
com.hypixel.hytale.math           → Vector3d, Vector3f, ChunkUtil
com.hypixel.hytale.common.util    → RandomUtil, misc
com.hypixel.hytale.common.plugin  → PluginIdentifier
```

The `builtin.*` packages are Hypixel's own implementations — read them to see "how the engine does it."

---

## Tooling reality check 📘

- Config = JSON in a text editor — "workable but painful."
- NPC debugging = reading log files. Use the `/npc debug set Vis*` visualizers.
- Some client behavior isn't exposed to the server yet.
- Full server source release is ~1–2 months post-launch — when that ships, **read the source first**, treat docs as the on-ramp.

---

## Drill-in pointers (this repo)

- **Deeper prose docs** (same numbering as the capability sections): [hytale-mod-quickref/](./hytale-mod-quickref/) — `01`-overview, `02`-plugins, `03`-events, `04`-ecs, `05`-roles/AI, `06`-spawn recipe, `07`-inventory, `08`-threading, `09`-API cheatsheet, `10`-references.
- **Verified call sites** in `_references/sample-mods/` (HyCitizens, NPCTrading) — ground truth for "does this API exist".
- **API handbooks (raw decompiled / Javadoc mirror):** `_references/hytale-api-handbooks/`.
- **Project work using this KB:** [SynthNPCs/](../mods/SynthNPCs/) — see `sprint-board.md`, `capabilities.md`, and especially `mod-dev-discoveries.md` for sharp-edge field notes.

---

## What's NOT in this file (and where to get it)

- Full `Template_Citizen.json` (1928 lines of real instruction-list examples) — read it in `_references/sample-mods/HyCitizens/...`.
- Every `*Event` class — read decompiled `com.hypixel.hytale.*Event`.
- Worldgen / farming / crafting / deployables / mounts / weather / builder — `com.hypixel.hytale.builtin.*` package; not yet curated here.
- Block placement, NPC-to-NPC transfers, custom UI — open API questions (see "Known not-yet-confirmed" above).
- Full `PlayerSkin` cosmetic catalogue — enumerate at runtime via `CosmeticsModule.get().getRegistry()`.

When in doubt about a signature, **grep `_references/sample-mods/` first**, then the decompiled source. If neither has it, it's unverified — say so rather than guess.
