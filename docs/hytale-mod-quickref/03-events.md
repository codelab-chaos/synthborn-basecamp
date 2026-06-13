# 03 — Events

*Reacting to game occurrences: the event registry, sync/async, priorities, cancellation, and the event catalog.*

Sources: 🌐 [Event System](https://hytale-docs.pages.dev/modding/plugins/events/), ✅ `_mod-example-sourcecode/HyCitizens` event usage, 📘 `research-bank/research-llm-npc-roleplay.md` §2

---

## Architecture 🌐

A global `EventBus` with two registries — `SyncEventBusRegistry` and `AsyncEventBusRegistry` — wrapped per-plugin by `EventRegistry` (so listeners are cleaned up with the plugin). Access via `getEventRegistry()`.

- **Sync** events implement `IEvent<KeyType>` — handlers run immediately, in priority order.
- **Async** events implement `IAsyncEvent<KeyType>` — handlers chain via `CompletableFuture`.
- **Cancellable** events implement `ICancellable` → `boolean isCancelled()` / `void setCancelled(boolean)`.

## Registration forms 🌐✅

```java
// Basic
getEventRegistry().register(BootEvent.class, this::onBoot);

// With priority
getEventRegistry().register(EventPriority.EARLY, PlayerConnectEvent.class, event -> { /* … */ });

// Keyed (e.g. a specific world)
getEventRegistry().register(WorldEvent.class, "world_name", event -> { /* … */ });

// Global listener (all keys)
getEventRegistry().registerGlobal(EntitySpawnEvent.class, event -> { /* … */ });

// Async — never blocks the game loop. Ideal for network/LLM/HTTP work.
getEventRegistry().registerAsync(PlayerChatEvent.class, future -> future.thenApply(event -> {
    // transform / inspect off the main thread
    return event;
}));
```

> **Rule of thumb:** anything that does I/O (HTTP, LLM, disk) belongs on `registerAsync` (or hops to a background executor), then re-enters the world thread to mutate state. See [08-messaging-and-threading.md](./08-messaging-and-threading.md).

## Priorities 🌐

Handlers dispatch low→high:

| Priority | Value |
|---|---|
| `FIRST` | -21844 |
| `EARLY` | -10922 |
| `NORMAL` | 0 |
| `LATE` | 10922 |
| `LAST` | 21844 |

Register cancellation/veto logic `EARLY`/`FIRST`; register reactions that assume the final state `LATE`/`LAST`.

## Cancelling 🌐✅

For `ICancellable` events:

```java
getEventRegistry().register(PlayerChatEvent.class, event -> {
    if (isNearAiNpc(event)) {
        event.setCancelled(true);          // suppress public chat, route privately
        routeToNpc(event);
    }
});
```

(✅ This is exactly the pattern in-repo for routing chat to an NPC; `CitizenInteractEvent` is also cancellable.)

## Event catalog 🌐

Concrete event classes reported by the docs (not exhaustive — read the decompiled `*Event` classes for the full set):

**Server lifecycle:** `BootEvent`, `ShutdownEvent`, `PluginSetupEvent`, `PrepareUniverseEvent`

**World:** `AddWorldEvent`, `RemoveWorldEvent`, `AllWorldsLoadedEvent`, `StartWorldEvent`

**Player:** `PlayerConnectEvent`, `PlayerDisconnectEvent`, `PlayerChatEvent`, `PlayerReadyEvent`, `AddPlayerToWorldEvent`

**Block:** `PlaceBlockEvent`, `BreakBlockEvent`, `DamageBlockEvent`, `UseBlockEvent`

**Entity / items:** `EntitySpawnEvent`, `EntityRemoveEvent`, `LivingEntityInventoryChangeEvent`, `DropItemEvent`, `InteractivelyPickupItemEvent`

**Other:** `CraftRecipeEvent`, `ChangeGameModeEvent`, `DiscoverZoneEvent`

> ⚠️ Event names are 🌐 community-reported and may differ slightly from the running build. Confirm against the decompiled source (see [10-references.md](./10-references.md)) before relying on an exact class name.

## The two event surfaces 📘

Don't confuse them:

- **`EventRegistry`** (this doc) — discrete game events like chat, connect, block-break. Pub/sub.
- **`EntityStoreRegistry` / ECS systems** — per-entity, per-tick logic over components. See [04-ecs.md](./04-ecs.md).

Use events for "something happened"; use ECS systems for "do this to these entities every tick."
