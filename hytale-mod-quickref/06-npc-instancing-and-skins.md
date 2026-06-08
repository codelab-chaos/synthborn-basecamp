# 06 — NPC Instancing & Skins (Verified Spawn Recipe)

*How to actually spawn an NPC body in the world, with a random skin — distilled from real, compiling HyCitizens code. This is the most concrete doc in the folder.*

Sources: ✅ `HyCitizens/.../CitizensManager.java` (`spawnCitizenNPCInternal` @2308, `spawnPlayerModelNPC` @2430), ✅ `SkinUtilities.java`, ✅ `SkinCustomizerUI.java:496`

**Everything here is ✅ verified** — these are the exact engine calls HyCitizens makes. They're all `com.hypixel.hytale.*` (engine), **not** `com.electro.*` (HyCitizens), so you can use them with **zero mod dependency**.

---

## The big picture

Spawning a humanoid NPC with a random appearance is ~8 engine calls:

```text
generate random skin → build model from skin → check chunk loaded
→ resolve role index → spawnEntity → attach skin component → set persistent model → leash
```

## The calls, in order ✅

### 1. Generate a random skin (one line)

```java
import com.hypixel.hytale.server.core.cosmetics.CosmeticsModule;
import com.hypixel.hytale.common.util.RandomUtil;
import com.hypixel.hytale.protocol.PlayerSkin;

PlayerSkin skin = CosmeticsModule.get().generateRandomSkin(RandomUtil.getSecureRandom());
```

(✅ exact call used by HyCitizens' "randomize skin" button, `SkinCustomizerUI.java:496` and `CitizensUI.java:3634/3999`.)

### 2. Turn the skin into a renderable model

```java
float scale = 1.0f;
Model model;
try {
    CosmeticsModule.get().validateSkin(skin);            // throws if invalid
    model = CosmeticsModule.get().createModel(skin, scale);
} catch (Exception e) {
    skin  = SkinUtilities-style default (see §"default skin");
    model = CosmeticsModule.get().createModel(skin, scale);
}
model = withSafeAnimationSetMap(model);                   // GOTCHA — see below
```

### 3. Make sure the chunk is loaded

```java
import com.hypixel.hytale.math.util.ChunkUtil;

long chunkIndex = ChunkUtil.indexChunkFromBlock(position.x, position.z);
if (world.getChunkIfLoaded(chunkIndex) == null) return;  // unloaded → can't spawn
```

(Spawning at a player's position sidesteps this — their chunk is always loaded.)

### 4. Resolve the Role index

```java
import com.hypixel.hytale.server.npc.NPCPlugin;

int roleIndex = NPCPlugin.get().getIndex("Synth_Base");
if (roleIndex == Integer.MIN_VALUE) return;              // role not registered → nothing to spawn
```

You **must** have at least one registered Role (see [05-npc-roles-and-ai.md](./05-npc-roles-and-ai.md) for what a Role is). `getIndex` returns `Integer.MIN_VALUE` for an unknown role.

### 5. Spawn the entity

```java
import com.hypixel.hytale.server.npc.entities.NPCEntity;
import com.hypixel.hytale.component.Ref;
// world store:
Store<EntityStore> store = world.getEntityStore().getStore();

Pair<Ref<EntityStore>, NPCEntity> npc = NPCPlugin.get().spawnEntity(
        store,
        roleIndex,
        position,                 // Vector3d
        rotation,                 // Vector3f
        model,                    // the Model from step 2
        (npcComponent, holder, store2) -> npcComponent.setInitialModelScale(scale), // optional init callback (or null)
        null);                    // optional 7th arg (null in practice)

if (npc == null) return;
Ref<EntityStore> ref = npc.first();
// NPCEntity entity = npc.second();
```

- Returns a `Pair<Ref<EntityStore>, NPCEntity>` (`.first()` = the ref, `.second()` = the NPC handle).
- The callback runs at spawn to tweak the npc component (HyCitizens uses it to force the model scale so the engine doesn't override it with a random default).

### 6. Attach the skin so it renders

```java
import com.hypixel.hytale.server.core.modules.entity.player.PlayerSkinComponent;

store.putComponent(ref, PlayerSkinComponent.getComponentType(), new PlayerSkinComponent(skin));
```

### 7. Set the persistent model (for correct display/persistence)

```java
PersistentModel persistentModel = store.getComponent(ref, PersistentModel.getComponentType());
if (persistentModel != null) {
    persistentModel.setModelReference(new Model.ModelReference(
            model.getModelAssetId(),
            scale,
            model.getRandomAttachmentIds(),
            model.getAnimationSetMap() == null));
}
```

### 8. Leash so it doesn't wander off

```java
npc.second().setLeashPoint(position);
```

---

## Alternative: creature/entity models instead of player skins ✅

If you want villager/creature bodies rather than random player skins, swap steps 1–2:

```java
import com.hypixel.hytale.server.core.asset.type.model.config.ModelAsset;

ModelAsset asset = ModelAsset.getAssetMap().getAsset("humanoid/villager_m"); // pick id at random from a list
if (asset == null) return;                                 // unknown model id
Model model = withSafeAnimationSetMap(Model.createScaledModel(asset, scale));
```

Then in step 5, **don't** attach a `PlayerSkinComponent` (step 6); the model carries the appearance. For a quick "Player" model without a skin, HyCitizens uses:
`new Model.ModelReference("Player", scale, new HashMap<>()).toModel()`.

---

## Gotchas (the workarounds HyCitizens had to add) ✅

| Gotcha | Symptom | Fix |
|---|---|---|
| **Null `AnimationSetMap`** | NPE when spawning | Wrap the model: rebuild it with `Collections.emptyMap()` as its animation-set map if null (HyCitizens' `withSafeAnimationSetMap`). |
| **`"Player"` model scale resets to 0** | Invisible/zero-size NPC | After spawn, re-set the `PersistentModel` model reference with the real scale. |
| **Engine overrides scale with model default** | Wrong size | Pass the spawn `model` explicitly + set scale in the spawn callback (step 5). |
| **Unloaded chunk** | Silent no-spawn | `getChunkIfLoaded` check (step 3); retry on chunk load. |
| **Role not yet registered** | `getIndex` → `Integer.MIN_VALUE` | Register/bundle the role first; retry after asset load. |
| **Wrong thread** | World corruption / crashes | Do the whole spawn on the world thread — `world.execute(() -> …)`. See [08](./08-messaging-and-threading.md). |

## The `PlayerSkin` data model ✅

`PlayerSkin` is a plain struct with these public String fields (the 20-arg constructor takes them in this order):

```text
bodyCharacteristic, underwear, face, eyes, ears, mouth, facialHair, haircut,
eyebrows, pants, overpants, undertop, overtop, shoes, headAccessory,
faceAccessory, earAccessory, skinFeature, gloves, cape
```

A safe hand-written default (from `SkinUtilities.createDefaultSkin()`):

```java
PlayerSkin s = new PlayerSkin();
s.bodyCharacteristic = "human_male"; s.underwear = "underwear_male";
s.face = "face_a"; s.eyes = "eyes_male"; s.ears = "ears_a"; s.mouth = "mouth_a";
s.haircut = "hair_short_messy"; s.eyebrows = "eyebrows_thick";
s.pants = "pants_shorts_denim"; s.undertop = "shirt_tshirt"; s.shoes = "shoes_sneakers";
```

The full cosmetic catalogue (every part id + color/variant) is enumerable via `CosmeticsModule.get().getRegistry()` (`getBodyCharacteristics()`, `getFaces()`, `getHaircuts()`, … — see `SkinUtilities.buildCosmeticCatalogue()`). You only need this if you want to randomize/curate skins yourself instead of `generateRandomSkin`.

## Fetching a real player's skin (optional) ✅

HyCitizens fetches skins by username via async `HttpClient` from `https://api.hytl.skin/character/<name>` (falling back to PlayerDB), or reads an online player's `PlayerSkinComponent` directly:

```java
PlayerRef p = Universe.get().getPlayer(username, NameMatching.EXACT_IGNORE_CASE);
PlayerSkin s = p.getReference().getStore()
        .getComponent(p.getReference(), PlayerSkinComponent.getComponentType())
        .getPlayerSkin();
```

For random synths you don't need this — `generateRandomSkin` is the whole feature.

---

## This is what `bare-bones-synth.md` is built on

[`../bare-bones-synth.md`](../bare-bones-synth.md) is exactly this recipe, minimized to a `/synth spawn` command with one bundled `Synth_Base` role. The one open risk it flags — whether a *standalone* (non-HyCitizens) role resolves via `getIndex` — is the only step here that depends on getting Role registration right. See [05-npc-roles-and-ai.md](./05-npc-roles-and-ai.md).
