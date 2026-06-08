# 09 — Verified API Cheat Sheet

*Every API below is ✅ **verified** — confirmed in this repo's `HyCitizens/` or `NPCTrading/` source, which compiles against the live Hytale server API. When the unofficial web docs disagree with this page, trust this page.*

Grouped by task. Import path is given once per type.

---

## Plugin & lifecycle

```java
class MyPlugin extends JavaPlugin {            // base class
    MyPlugin(@Nonnull JavaPluginInit init) { super(init); }
    protected void setup();                     // register here
    protected void start();                     // cross-plugin work here
    protected void shutdown();                  // save/cleanup here
}
getLogger().at(Level.INFO).log("msg");
getEventRegistry(); getCommandRegistry(); getTaskRegistry();
```

## Plugin dependencies

```java
import com.hypixel.hytale.common.plugin.PluginIdentifier;
import com.hypixel.hytale.server.core.plugin.PluginManager;

PluginIdentifier id = new PluginIdentifier("com.electro", "HyCitizens");
if (PluginManager.get().getPlugin(id) == null) return;   // optional-dep guard
```

## Worlds, players, universe

```java
import com.hypixel.hytale.server.core.universe.Universe;
import com.hypixel.hytale.server.core.universe.PlayerRef;
import com.hypixel.hytale.server.core.universe.world.World;
import com.hypixel.hytale.server.core.NameMatching;

World world              = Universe.get().getWorld(worldUUID);
PlayerRef player         = Universe.get().getPlayer(name, NameMatching.EXACT_IGNORE_CASE);
Universe.get().getPlayerStorage().load(uuid);            // CompletableFuture<EntityStore>
Ref<EntityStore> pref    = player.getReference();
```

## ECS store / refs / components

```java
import com.hypixel.hytale.component.Ref;
import com.hypixel.hytale.server.core.universe.world.storage.EntityStore;

Store<EntityStore> store = world.getEntityStore().getStore();
boolean ok               = ref.isValid();                // ALWAYS check
Store<EntityStore> s     = ref.getStore();
T comp = store.getComponent(ref, T.getComponentType());
store.putComponent(ref, T.getComponentType(), new T(...));
```

Verified component types (each has static `getComponentType()`):
`ModelComponent`, `PersistentModel`, `PlayerSkinComponent`, `UUIDComponent`,
`EntityStatsModule.get().getEntityStatMapComponentType()`.

## NPC spawn (see [06](./06-npc-instancing-and-skins.md) for the full recipe)

```java
import com.hypixel.hytale.server.npc.NPCPlugin;
import com.hypixel.hytale.server.npc.entities.NPCEntity;
import com.hypixel.hytale.server.npc.systems.RoleChangeSystem;

int roleIndex = NPCPlugin.get().getIndex("RoleName");    // Integer.MIN_VALUE if missing
Pair<Ref<EntityStore>, NPCEntity> npc = NPCPlugin.get().spawnEntity(
        store, roleIndex, position /*Vector3d*/, rotation /*Vector3f*/, model,
        (npcComponent, holder, store2) -> npcComponent.setInitialModelScale(scale),  // or null
        null);
Ref<EntityStore> ref = npc.first();
NPCEntity        e   = npc.second();
e.setLeashPoint(position);
RoleChangeSystem.requestRoleChange(/* … */);             // swap role at runtime
```

## Entity removal / despawn

```java
import com.hypixel.hytale.component.RemoveReason;

// Must run on the world thread. Always re-check validity inside the lambda.
world.execute(() -> {
    if (ref.isValid()) {
        world.getEntityStore().getStore().removeEntity(ref, RemoveReason.REMOVE);
    }
});

Ref<EntityStore> r = world.getEntityRef(uuid);           // resolve a ref from a stored UUID (null if gone)
```
Verified in `HyCitizens` (`CitizensManager.despawnCitizenNPC*`, `PatrolManager`). The add-side counterpart is `store.addEntity(holder, AddReason.SPAWN)` (`com.hypixel.hytale.component.AddReason`).

## Skins & cosmetics

```java
import com.hypixel.hytale.server.core.cosmetics.CosmeticsModule;
import com.hypixel.hytale.common.util.RandomUtil;
import com.hypixel.hytale.protocol.PlayerSkin;
import com.hypixel.hytale.server.core.modules.entity.player.PlayerSkinComponent;

PlayerSkin skin = CosmeticsModule.get().generateRandomSkin(RandomUtil.getSecureRandom());
CosmeticsModule.get().validateSkin(skin);                // throws if invalid
Model model     = CosmeticsModule.get().createModel(skin, scale);
store.putComponent(ref, PlayerSkinComponent.getComponentType(), new PlayerSkinComponent(skin));
var registry    = CosmeticsModule.get().getRegistry();   // getFaces(), getHaircuts(), …
```

`PlayerSkin` fields (20-arg ctor order): `bodyCharacteristic, underwear, face, eyes, ears, mouth, facialHair, haircut, eyebrows, pants, overpants, undertop, overtop, shoes, headAccessory, faceAccessory, earAccessory, skinFeature, gloves, cape`.

## Models

```java
import com.hypixel.hytale.server.core.asset.type.model.config.ModelAsset;

ModelAsset asset = ModelAsset.getAssetMap().getAsset("humanoid/villager_m");  // null if unknown
Model m1 = Model.createScaledModel(asset, scale);
Model m2 = new Model.ModelReference("Player", scale, new HashMap<>()).toModel();
// Model.ModelReference(assetId, scale, randomAttachmentIds, boolean) — also exists
```

## Chunks & math

```java
import com.hypixel.hytale.math.util.ChunkUtil;
import com.hypixel.hytale.math.vector.Vector3d;
import com.hypixel.hytale.math.vector.Vector3f;

long chunkIndex = ChunkUtil.indexChunkFromBlock(x, z);
boolean loaded  = world.getChunkIfLoaded(chunkIndex) != null;
```

## Messaging

```java
import com.hypixel.hytale.server.core.Message;

player.sendMessage(Message.raw("text").color(Color.GREEN));   // .bold(...).link(...)
```

## Threading

```java
world.execute(() -> { /* world/entity mutation — world thread */ });
CompletableFuture.supplyAsync(() -> blockingIO(), HytaleServer.SCHEDULED_EXECUTOR)
    .orTimeout(8, TimeUnit.SECONDS)
    .whenComplete((r, err) -> world.execute(() -> { /* re-enter world thread */ }));
```

## Async HTTP

```java
import java.net.http.HttpClient;   // java.net.http.* is allowed
HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
http.sendAsync(request, HttpResponse.BodyHandlers.ofString()).thenApply(resp -> /* parse */);
```

## Inventory / items (see [07](./07-inventory-and-items.md))

```java
Inventory inv          = entity.getInventory();
ItemContainer hotbar   = inv.getHotbar();        // .getStorage(), getItemInHand()
ItemStack stack        = new ItemStack("Resource_Iron_Ore", 10);
container.getItemStack((short) 0);
container.addItemStack(stack);
```

## Roles on disk

```text
<data asset pack>/Server/NPC/Roles/<RoleName>.json
  { "Type": "Variant" | "Generic" | "Abstract", "Reference": "Template_Citizen", "Name": "…" }
```
Registered through `NPCPlugin`; resolve with `NPCPlugin.get().getIndex(name)`.

## NPC debug commands (in-game)

```text
/npc debug set VisAiming | VisMarkedTargets | VisSensorRanges | VisLeashPosition | VisFlock
```

---

### Confidence note

Signatures are transcribed from real call sites. Generic argument details (exact `Pair`/`Store` type params, overload variants) may have small variations across server builds — the decompiled source ([10](./10-references.md)) is the final authority. Everything here matched the repo as of API `2026.05.01`.
