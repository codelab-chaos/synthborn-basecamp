# 08 — Messaging, World Access & Threading

*Sending text to players, finding worlds/players, and the threading rules that keep you from corrupting the world. Get threading wrong and you get nondeterministic crashes.*

Sources: ✅ `NPCTrading/.../TraderInteraction.java`, ✅ `HyCitizens/.../CitizensManager.java` & `SkinUtilities.java`, 📘 in-repo `LLM_NPC_ROLEPLAY.md` §2

---

## Sending messages ✅📘

Rich text via the `Message` builder, sent through a `PlayerRef`:

```java
import com.hypixel.hytale.server.core.Message;

player.sendMessage(Message.raw("Hello, traveller!").color(Color.GREEN));
```

The builder chains: `Message.raw(text).color(...).bold(...).link(...)`. (✅ `Message.raw("…").color(Color.GREEN)` is the exact call in NPCTrading; 📘 the full chain is documented in the design doc.)

HyCitizens also has a colored-message parser with placeholder substitution (`CitizenInteraction.parseColoredMessage("{GOLD}Bram: {WHITE}…")`) — handy if you want `{COLOR}` tokens in authored strings.

## Finding worlds, players, entities ✅

```java
import com.hypixel.hytale.server.core.universe.Universe;

World world = Universe.get().getWorld(worldUUID);
Store<EntityStore> store = world.getEntityStore().getStore();

PlayerRef p = Universe.get().getPlayer(username, NameMatching.EXACT_IGNORE_CASE);
Ref<EntityStore> playerRef = p.getReference();

// async load of an offline player's stored entity:
Universe.get().getPlayerStorage().load(uuid);   // CompletableFuture<EntityStore>
```

## The threading rule (the important part) ✅📘

There are two execution contexts and you must not cross them carelessly:

| Work | Where it must run | How |
|---|---|---|
| Touching the **world / entities / components** (spawn, move, set component, send via world state) | **World thread** | `world.execute(() -> { … })` |
| **Network / HTTP / LLM / disk** (anything blocking) | **Off** the world thread | `HytaleServer.SCHEDULED_EXECUTOR` or a dedicated pool, or `registerAsync` |

> 📘 "Network/LLM work runs on `HytaleServer.SCHEDULED_EXECUTOR`; anything touching the world/entities must hop back onto the world thread via `world.execute(() -> ...)`." The repo code follows this exactly.

### Canonical async-then-world pattern ✅📘

```java
CompletableFuture
    .supplyAsync(() -> blockingCall(/* HTTP/LLM */), HytaleServer.SCHEDULED_EXECUTOR)  // off-thread
    .orTimeout(8, TimeUnit.SECONDS)
    .whenComplete((result, err) -> world.execute(() -> {     // back on the world thread
        if (err != null) { sendFallback(player); return; }
        applyToWorld(result);                                // safe: world thread
    }));
```

This is the shape HyCitizens uses for skin fetches and the LLM design doc uses for model calls. Always: **async + timeout + fallback**, then re-enter `world.execute`.

## Async HTTP ✅

`java.net.http.HttpClient` is allowed and used in-repo:

```java
HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
http.sendAsync(request, HttpResponse.BodyHandlers.ofString())
    .thenApply(resp -> /* parse */);
```

Keep the client static/shared; always set timeouts; never call `.get()`/`.join()` on the world thread.

## Atomic persistence ✅

HyCitizens' `ConfigManager` (~548 lines) does **atomic JSON write/rename** for all its saves (citizens, skins, schedules). If you persist state, copy that pattern (write temp → fsync → rename) so a crash mid-write can't corrupt a save. Gson is the serializer in use.

## Quick rules

- **Default to the world thread** for anything game-facing; only leave it for blocking I/O.
- Every off-thread call gets a **timeout** and a **fallback**.
- Re-validate `Ref`s after an async hop — the entity may have despawned while you waited.
- Persist with atomic write/rename, not a naive overwrite.
