# Hytale English name lookup

Hytale asset **ids** and **player-facing English names** are different systems. Modding,
recipe tools, and RCON all speak in ids (`Ingredient_Fibre`, `Weapon_Sword_Copper`). The
game UI shows localized strings (`Plant Fiber`, `Copper Sword`). Guessing ids from English
— or English from ids — fails often.

Basecamp indexes the official **en-US** strings so you can look up either direction without
opening the multi-hundred-KB lang file.

---

## Quick lookup (CLI)

```bash
# id → English
node tools/labels/lookup.js id Ingredient_Fibre
# → Ingredient_Fibre → Plant Fiber

# English → id(s)
node tools/labels/lookup.js name "plant fiber"
node tools/labels/lookup.js name "beech log"

# Fuzzy either way
node tools/labels/lookup.js find copper
node tools/labels/lookup.js Wood_Beech

# JSON for scripts
node tools/labels/lookup.js find hatchet --json
```

Regenerate after a new `_Assets` drop:

```bash
node tools/labels/extract-labels.js
```

---

## Where names live in Hytale

| What | Asset / data path | Example |
|------|-------------------|---------|
| **Item id** | `_Assets/Server/Item/Items/**/*.json` filename + registry | `Ingredient_Fibre` |
| **Translation key** | `TranslationProperties.Name` on the item JSON | `server.items.Ingredient_Fibre.name` |
| **English string** | `_Assets/Server/Languages/en-US/server.lang` | `items.Ingredient_Fibre.name = Plant Fiber` |
| **Resource type id** | Recipe `ResourceTypeId` inputs | `Wood_Trunk` → shown as `Wood_Trunk(type)` in recipe indexes |
| **Resource type label** | `server.lang` prefix `resourceType.` | `resourceType.Wood_Trunk.name = Any Tree Log` |
| **NPC role id** | NPC asset registry | `Skeleton_Burnt_Praetorian` |
| **NPC role label** | `server.lang` prefix `npcRoles.` | `npcRoles.Skeleton_Burnt_Praetorian.name = Burnt Skeleton Praetorian` |

The lang file is the **source of truth for English**. Item json only points at the key;
it does not embed the display string.

### Id shape vs English

Ids use **PascalCase segments joined by underscores**:

```
Weapon_Sword_Copper     →  Copper Sword
Ingredient_Fibre        →  Plant Fiber   (not "Ingredient Fibre")
Wood_Beech_Trunk        →  Beech Log     (not "Wood Beech Trunk")
Bench_Weapon            →  Blacksmith's Anvil
```

**Do not** rely on underscore-to-space heuristics (`humanizeId`) for player-facing text.
Recipe browser and `gamedata.js` use it only as a fallback label when no lang entry is loaded.

### Translation key ≠ item id (sometimes)

Most items: id matches the lang key (`items.<Id>.name`). **State variants** can differ —
the runtime item id may not equal the lang entry id. Example from the live catalog:

| Runtime item id | Translation key |
|-----------------|-----------------|
| `*Container_Bucket_State_Filled_Water` | `server.items.Container_Bucket_Water.name` |

When in doubt, check `synthborn-kyn/catalog/item-ids.tsv` (column `translationKey`) or grep
`TranslationProperties.Name` in the item JSON.

---

## Generated indexes

| File | Purpose |
|------|---------|
| [`labels.json`](labels.json) | `items`, `resourceTypes`, `npcRoles`, reverse `byName` index |
| [`labels.txt`](labels.txt) | Tab-separated grep: `kind \\t id \\t English` |

Counts (typical en-US drop): ~3700 items, ~120 resource types, ~560 NPC roles.

Other locales (`pt-BR`, `zh-CN`, …) live beside `en-US/server.lang` under
`_Assets/Server/Languages/`; basecamp v1 indexes **en-US only**.

---

## Related tools

| Need | Tool |
|------|------|
| English ↔ id | `node tools/labels/lookup.js` (this index) |
| Craft tree / recipes (ids) | `node tools/recipes/gamedata.js` |
| Browse recipes + humanized fallback UI | [`apps/recipe-browser/`](../apps/recipe-browser/) |
| Runtime-registered ids + translation keys | `synthborn-kyn/catalog/item-ids.tsv` |
| In-game LLM id → name substitution | `synthborn-overseer` `LabelResource` / `LabelResolver` |

### Overseer parity

Overseer bundles `en-US-labels.properties` (`<Id>=<Display Name>`) extracted from the same
`server.lang` file. Regenerate basecamp's index after asset bumps; copy or re-run the awk one-liner
in `LabelResource.java` if Overseer needs a fresh jar bundle.

---

## Agent workflow

1. Player says **"plant fiber"** → `node tools/labels/lookup.js name "plant fiber"` → `Ingredient_Fibre`
2. Asset JSON cites **`Ingredient_Fibre`** → `node tools/labels/lookup.js id Ingredient_Fibre` → confirm English
3. Recipe lists **`Wood_Trunk(type)`** → `node tools/labels/lookup.js id Wood_Trunk` → `Any Tree Log` (resource type, not a single item)
4. Fuzzy bench name **"anvil"** → `node tools/labels/lookup.js find anvil` → `Bench_Weapon`

Then pass the resolved **id** into `gamedata.js`, RCON give commands, or mod code.
