# 07 — Inventory & Items

*Reading and modifying player/entity inventories — needed for trading, quest hand-ins, and any "give/take item" effect.*

Sources: 🌐 [Inventory & Items](https://hytale-docs.pages.dev/modding/content/inventory/), ✅ `NPCTrading/.../TradeManager.java` (the player↔NPC exchange in practice)

---

## `ItemStack` 🌐

An item instance with quantity + durability. **Most modifiers return a new instance** (immutable-style) rather than mutating.

```java
ItemStack stone   = new ItemStack("Stone");
ItemStack stack64 = new ItemStack("Stone", 64);
```

| Method | Returns |
|---|---|
| `getItemId()` | item id string (e.g. `"Resource_Iron_Ore"`) |
| `getQuantity()` | stack size |
| `getDurability()` / `getMaxDurability()` | durability |
| `isEmpty()` | true if itemId is `"Empty"` |
| `withQuantity(int)` | new stack, adjusted size |
| `withDurability(double)` | new stack, set durability |
| `withMetadata(BsonDocument)` | new stack, custom metadata |

## `ItemContainer` 🌐

Abstract slot container; slots indexed by `short`.

```java
ItemStack item = container.getItemStack((short) 0);
ItemStackSlotTransaction setTx = container.setItemStackForSlot((short) 0, new ItemStack("Stone", 32));
ItemStackTransaction     addTx = container.addItemStack(new ItemStack("Stone", 64));
```

Other methods: `getCapacity()`, `isEmpty()`, `moveItemStackFromSlot(...)`, `removeItemStack(...)`. Operations return transaction objects (inspect them for success/overflow).

## `Inventory` access 🌐

```java
Inventory inv = entity.getInventory();
ItemContainer hotbar  = inv.getHotbar();
ItemContainer storage = inv.getStorage();

ItemStack inHand = inv.getItemInHand();
inv.setActiveHotbarSlot((byte) 0);
```

Active-slot methods: `getActiveHotbarSlot()` / `setActiveHotbarSlot(byte)`, `getItemInHand()`, `getActiveUtilitySlot()` / `setActiveUtilitySlot(byte)`.

## Slot sections & capacities 🌐

| Section | Slots |
|---|---|
| Hotbar | 9 |
| Storage | 36 |
| Armor | 4 |
| Utility | 4 |
| Tools | 23 |
| Backpack | variable |

## Item events 🌐

(Register via [03-events.md](./03-events.md).)

- `DropItemEvent` — extends `CancellableEcsEvent` (cancel a drop)
- `InteractivelyPickupItemEvent` — modify a picked-up item
- `LivingEntityInventoryChangeEvent` — generic inventory change hook

## A real transaction: how NPCTrading executes a trade ✅

The verified player↔NPC exchange (`TradeManager.executeTrade(playerRef, offer)`) does:

1. verify the player has enough **input** items,
2. remove input items from the player inventory,
3. add **output** items to the player inventory,
4. send confirmation messages,
5. return `true`/`false`.

Plus helpers `canAfford(playerRef, offer)` and `getItemCount(playerRef, "Resource_Iron_Ore")`. Item ids are strings like `"Resource_Iron_Ore"` / `"Resource_Iron_Ingot"`.

> ⚠️ NPCTrading is **player↔NPC only** — there is no NPC↔NPC item movement anywhere in it. Any NPC-to-NPC exchange (e.g. for `hytale-synths`) is new work, not a reuse. (See `../hytale-synthetics.md` §22.)

## Notes

- Treat `ItemStack` as immutable: capture the return value of `withX`/`addItemStack`; don't expect in-place mutation.
- Inventory writes touch entity state → do them on the world thread ([08](./08-messaging-and-threading.md)).
- For item-consuming effects (favor hand-ins), verify-then-remove and trace partial failures (the transaction-policy concern from `../hytale-synthetics.md` §22 #3).
