# 04 — Entity Component System (ECS)

*How Hytale stores and processes entities. You don't need deep ECS for a basic plugin, but anything touching entities (NPCs, players, items) goes through it.*

Sources: 🌐 [ECS Overview](https://hytale-docs.pages.dev/modding/ecs/), 📘 [Server API Reference](https://release.server.docs.hytale.com/) (`com.hypixel.hytale.component`), ✅ `HyCitizens` component usage

---

## Mental model 🌐

- An **entity** is just an id; its data lives in **components**.
- A **`Store<ECS_TYPE>`** owns entities, grouped into **archetypes** (a specific set of component types) stored in **chunks** for cache-friendly iteration. ("100 Trorks are chunked together with their components for faster retrieval.")
- **Systems** (`ISystem`) run logic over entities each tick. **Resources** hold global state.
- Entities are referenced by lightweight **`Ref`** handles you must validity-check.

The store you'll touch most is the world's entity store: `world.getEntityStore().getStore()` (✅).

## `Ref` — entity handles 🌐✅

```java
Ref<EntityStore> ref = /* … */;
if (!ref.isValid()) return;            // ALWAYS check before use
Store<EntityStore> store = ref.getStore();
int index = ref.getIndex();
```

`Ref` methods: `isValid()`, `validate()`, `getStore()`, `getIndex()`. A `Ref` can go stale (entity despawned/unloaded) — treat every access defensively. (✅ the repo code checks `ref.isValid()` everywhere.)

## Components 🌐✅

Components implement `Component<ECS_TYPE> extends Cloneable` (`clone()`, `cloneSerializable()`). You **get/put** them via a `ComponentType` token, **not** by `.class`:

```java
// Read
PositionComponent pos = store.getComponent(ref, PositionComponent.getComponentType());

// Write / replace
store.putComponent(ref, PlayerSkinComponent.getComponentType(), new PlayerSkinComponent(skin));
```

Real component types seen in-repo (✅): `ModelComponent`, `PersistentModel`, `PlayerSkinComponent`, `UUIDComponent`, plus stat components via `EntityStatsModule.get().getEntityStatMapComponentType()`. Each exposes a static `getComponentType()`.

## Creating entities 🌐

Via a `Holder`, then add to the store:

```java
Holder<EntityStore> holder = EntityStore.REGISTRY.newHolder();
holder.addComponent(PositionComponent.getComponentType(), new PositionComponent(0, 64, 0));
Ref<EntityStore> entity = store.addEntity(holder, AddReason.SPAWN);
```

> For **NPCs specifically**, don't hand-assemble the holder — use `NPCPlugin.get().spawnEntity(...)`, which builds the entity from a Role + model for you. See [06-npc-instancing-and-skins.md](./06-npc-instancing-and-skins.md).

## Archetypes 🌐

An `Archetype` is a specific combination of component types:

```java
Archetype a = Archetype.of(type1, type2);
Archetype b = Archetype.add(a, anotherType);
Archetype c = Archetype.remove(b, type1);
```

You rarely build these by hand; they matter because querying is archetype-based.

## Systems 🌐

```java
public class MySystem implements ISystem<EntityStore> {
    @Override public void onSystemRegistered()   { /* init */ }
    @Override public void onSystemUnregistered() { /* teardown */ }
    // optional: getGroup(), getDependencies() for ordering
}
```

`ISystem` lifecycle: `onSystemRegistered()`, `onSystemUnregistered()`, optional `getGroup()` and `getDependencies()` (control run order relative to other systems).

## Querying 🌐

Iterate entities that have a component, chunk by chunk:

```java
store.forEachChunk(PositionComponent.getComponentType(), (archetypeChunk, commandBuffer) -> {
    // iterate entities in this chunk; use commandBuffer for deferred structural changes
});
```

Use the `commandBuffer` for add/remove during iteration (mutating the store structure mid-iteration directly is unsafe).

## Practical notes for NPC work

- You generally **read/write components on a `Ref` you got back from spawning** — position, model, skin, stats — rather than authoring systems from scratch.
- Structural changes (spawn/despawn, add/remove component) and most reads should happen on the **world thread** ([08](./08-messaging-and-threading.md)).
- The decompiled `com.hypixel.hytale.component` package is the real spec — these are the highlights. When in doubt, read it (see [10-references.md](./10-references.md)).
