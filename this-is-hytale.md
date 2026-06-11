# This Is Hytale

## Purpose

This document is an LLM primer for understanding what Hytale is, what players usually try to do in an adventure sandbox, and how SynthUnits should emulate real player journeys.

It is not an implementation plan, balance document, or canonical game-design spec. It is context for future agents: before proposing synth behavior, first understand the player fantasy, player progression, and player-visible actions that make a behavior feel like Hytale.

Use this document when deciding:

- what synth capabilities should exist
- which capability should come next
- whether a proposed behavior feels like a real Hytale player action
- whether a task is too abstract or too implementation-shaped
- how to describe synth behavior in player-facing terms

## This Is Hytale

Hytale is an adventure sandbox where the player gathers from the world, crafts tools, improves gear, explores dangerous places, fights or avoids threats, brings resources home, and turns a rough shelter into a base, farm, workshop, village, or personal project.

The game is not only "collect materials." The adventure is the whole loop:

- notice something in the world
- prepare for it
- travel to it
- survive the trip
- interact with it through real world mechanics
- bring something useful home
- turn that into better tools, storage, safety, food, buildings, or knowledge
- go farther next time

SynthUnits should feel like companions, helpers, villagers, or apprentice players living inside that loop. They should not feel like invisible automation scripts that create items from nowhere.

For LLM context: Hytale is best understood as an adventure sandbox, not as a pure factory game. A player may optimize, but the core experience is embodied: walking through the world, seeing materials, using tools, reacting to danger, returning home, and building up a place over time.

## Why This Matters For SynthUnits

The synth journey should mirror the player journey.

A real player does not start by saying "execute an acquisition strategy." A player says or implies:

- I need an axe.
- I need sticks and stone.
- I should pick berries before night.
- I need a chest near home.
- I need a pickaxe before mining copper.
- This cave looks dangerous.
- My chest is full; I need another one.
- I want my village to have stocked supplies.

When an LLM proposes synth capabilities, stories, or behavior, it should translate internal work into those player-shaped desires. Internal concepts are allowed in code and sprint-board stories, but the synth's purpose is to emulate recognizable player behavior.

## Player Progression In Plain Terms

Most Hytale adventure progression can be read as a widening circle:

1. **Immediate survival**: gather visible nearby basics, avoid danger, get food.
2. **First tools**: craft crude tools that unlock trees, stone, ore, soil, and better gathering.
3. **First home**: make storage, return goods home, define a safe place.
4. **Resource expansion**: chop more trees, mine stone and ore, gather food, explore farther.
5. **Crafting expansion**: build benches, use stations, process materials, upgrade tools.
6. **Adventure expansion**: enter caves, hunt creatures, fight monsters, search for rare materials.
7. **Settlement expansion**: farm, cook, build, stockpile, defend, decorate, and make a place feel alive.

SynthUnits should grow through the same circles. A synth that can stock a chest with `Rubble_Stone` is earlier and more basic than a synth that can mine copper. A synth that can flee is earlier than a synth that can fight. A synth that can craft `Tool_Pickaxe_Crude` is earlier than a synth that can craft `Tool_Pickaxe_Iron`.

## Actual Player Progression: Why Crude Comes Before Iron

A player does not start a fresh adventure by making an iron axe. That sounds powerful, but it skips the actual survival chain. At the beginning, the player usually has access to visible starter materials, not processed metal, required benches, leather, fabric, or a furnace chain. The first sensible question is not "what is the strongest tool in the catalog?" It is "what can I make from what I can touch right now?"

The first correction is language: for woodcutting, the relevant tool line is `Tool_Hatchet_*`, not `Weapon_Axe_*`. A hatchet is the tree tool. An axe or battleaxe is a combat weapon line. A synth trying to chop trees should therefore care about `Tool_Hatchet_Crude`, then later `Tool_Hatchet_Copper`, `Tool_Hatchet_Iron`, and beyond when the material chain is real.

### The Starter Loop

The starter loop is concrete and reachable by hand:

1. Gather `Wood_Sticks`.
2. Gather `Rubble_Stone` or another usable rubble type.
3. Gather `Ingredient_Fibre`.
4. Craft `Tool_Hatchet_Crude` for trees.
5. Craft `Tool_Pickaxe_Crude` for stone and ore.
6. Use logs and stone to make first storage and first benches.

Local recipe data confirms the important first two tools:

| Tool | Why the player makes it early | Verified starter recipe shape |
| --- | --- | --- |
| `Tool_Hatchet_Crude` | Lets the player chop trunks/logs instead of only picking up loose starter materials. | `2x Rubble(type) + 2x Ingredient_Fibre + 2x Ingredient_Stick`, available through `Fieldcraft,Tools` or `Workbench,Workbench_Tools`. |
| `Tool_Pickaxe_Crude` | Lets the player mine stone and ore, which opens the metal path. | `2x Rubble(type) + 2x Ingredient_Fibre + 2x Ingredient_Stick`, available through `Fieldcraft,Tools` or `Workbench,Workbench_Tools`. |

This is why crude tools matter. They are not "bad tools" in the design sense; they are the bridge from scavenging to world-shaping. A player with no hatchet is mostly collecting loose things. A player with a crude hatchet can turn trees into logs. A player with a crude pickaxe can begin the mining path. A synth should respect that same threshold.

### The First Bench Layer

Benches are another reason iron is not first. The verified early bench recipes include:

| Bench | Why it matters | Verified recipe shape |
| --- | --- | --- |
| `Bench_Campfire` | Early survival and cooking-style progression. | `4x Ingredient_Stick + 2x Rubble(type)`. |
| `Bench_WorkBench` | Opens workbench categories, including tool crafting paths. | `4x Wood_Trunk(type) + 3x Rock(type)`. |
| `Bench_Builders` | Supports building progression. | `6x Wood_Trunk(type) + 3x Rock(type)`. |

The player needs logs and rock before some of these benches are practical. That means the player needs the crude hatchet and crude pickaxe path before the more interesting workshop economy really opens up.

### Copper Before Iron

Copper is the first metal stepping stone we should model for the early synth journey. The local data shows:

- `Ore_Copper` processes into `Ingredient_Bar_Copper` at a furnace.
- `Tool_Hatchet_Copper` uses `Ingredient_Bar_Copper`, `Wood_Trunk(type)`, and `Ingredient_Fibre` at `Workbench,Workbench_Tools`.
- `Tool_Pickaxe_Copper` uses `Ingredient_Bar_Copper`, `Wood_Trunk(type)`, and `Ingredient_Fibre` at `Workbench,Workbench_Tools`.

That means copper is not merely "better crude." It proves a longer player chain:

1. Make or retrieve a crude pickaxe.
2. Find copper ore.
3. Mine copper ore.
4. Bring ore home.
5. Process ore into copper bars at the required station.
6. Use the workbench tool category to make copper tools.

A synth that can do this feels like a player who has graduated from foraging into early industry. It also creates the right behavior pressure: prepare before mining, return home with ore, use real stations, and keep public storage stocked.

### Why Iron Is Later

Iron requires a deeper chain. The local recipe data shows:

- `Ore_Iron` processes into `Ingredient_Bar_Iron` at a furnace.
- `Tool_Hatchet_Iron` uses `Ingredient_Bar_Iron`, `Ingredient_Leather_Light`, and `Ingredient_Fabric_Scrap_Linen` at `Workbench,Workbench_Tools`.
- `Tool_Pickaxe_Iron` uses `Ingredient_Bar_Iron`, `Ingredient_Leather_Light`, and `Ingredient_Fabric_Scrap_Linen` at `Workbench,Workbench_Tools`.
- `Tool_Shovel_Iron` uses `Ingredient_Bar_Iron`, `Ingredient_Leather_Light`, and `Ingredient_Fabric_Scrap_Linen` at `Workbench,Workbench_Tools`.

So an iron hatchet is not a starting choice because the player first needs iron ore, furnace processing, a workbench tool path, and extra non-metal ingredients. Starting with "make an iron axe" is like asking a new player to make a late answer before they have solved the early questions.

For SynthUnits, this becomes a simple planning rule:

- If the synth has no tool, start with reachable crude tools.
- If public storage already has a needed tool, use or retrieve that before crafting.
- If the task needs copper or iron, prove the ore, bar, bench, and extra ingredient chain first.
- Do not skip to iron unless the world state already contains the required materials and bench access.

### Tool Benefits

Tools are not just faster hands. They change what the player can sensibly attempt.

| Tool line | Player-visible benefit | Synth behavior implication |
| --- | --- | --- |
| `Tool_Hatchet_*` | Turns trees into logs/trunks for storage, benches, building, and fuel-like progression. | A synth can chop supported trees and bring logs home. |
| `Tool_Pickaxe_*` | Opens stone, ore, caves, and metal progression. | A synth can mine the ore tier its tool can handle and return drops to storage. |
| `Tool_Shovel_*` | Supports terrain, soil, sand, digging, and farming-adjacent work. | A synth should eventually reshape ground or prepare farm/build sites, but the crude/copper shovel recipe path still needs confirmation. |

Higher material tiers should generally mean better reach into progression: more reliable mining, better resource access, longer trips before replacing tools, and safer preparation for caves or hostile territory. Exact speed, durability, and tier-gate numbers should come from runtime tests or item data before we state them as facts.

### Farming, Food, Health, And Fullness

Farming matters because it turns survival from chance into a supply chain. A player who only scavenges wild food is limited by what happens to be nearby. A player who grows crops, stores food, and prepares healing supplies can travel farther, recover from mistakes, and keep returning to adventure instead of constantly restarting the basic food search.

Verified local data supports the pieces of that loop:

- `Plant_Fruit_Berries_Red` exists as a gatherable food-adjacent resource.
- `Food_Salad_Berry` uses `Plant_Fruit_Berries_Red` and lettuce at a cooking bench.
- Many food ids exist, including bread, pies, kebabs, cooked meat, cooked fish, salads, and cooked vegetables.
- Health crops exist as `Plant_Crop_Health1`, `Plant_Crop_Health2`, and `Plant_Crop_Health3`.
- Health potions exist, and recipes connect berries and health crops to `Potion_Health_Lesser`, `Potion_Health`, `Potion_Health_Small`, and `Potion_Health_Greater`.
- The official NPC food guide shows NPCs can be given food-like items, equip them in a hotbar slot, play an eat animation, and put the item away.

What we should say confidently:

- Farming can support adventurers by creating renewable food and healing ingredients.
- Berries and health crops are useful early targets because they connect to food and health-potion recipes.
- A village or base with stocked food and healing supplies lets players take longer trips and recover between fights.

What still needs direct confirmation:

- The exact player hunger, satiety, or "fullness" stat name and mechanic. The docs we have confirm default stats such as Health, Stamina, Mana, Oxygen, Signature Energy, and Ammo, but they do not yet confirm a default Hunger or Fullness stat.
- The exact effect of eating each food item on player health, fullness, buffs, or stamina.

So for LLM context, it is fair to talk about farming as keeping adventurers supplied, fed, and ready to heal. It is not yet fair to invent a specific hidden "Fullness" stat unless we find it in the SDK, data, or runtime behavior.

### What The Health Bar Means

The health bar is the player-visible expression of the Health stat: current health compared against maximum health. Hytale exposes Health as a default entity stat through `DefaultEntityStatTypes.getHealth()`, and the stats API can add, subtract, reset, or maximize that value.

Damage reduces health. The player death guide shows a `DeathComponent` is added when a player dies, and that component carries death damage information such as the damage amount and source. In player terms:

- high health means the player can risk more damage
- low health means retreat, heal, eat if food restores health, or avoid combat
- zero health means death handling begins

For SynthUnits, health should become a basic survival signal before combat gets clever. A synth does not need a heroic combat brain to feel alive; it needs to notice danger, preserve itself, recover when possible, and avoid continuing a gathering task while it is being hurt.

### The Synth Journey We Should Emulate

The synth version of the early Hytale journey should read like a real player learning the world:

1. Gather `Wood_Sticks`, `Rubble_Stone`, `Ingredient_Fibre`, and nearby berries.
2. Craft `Tool_Hatchet_Crude` and `Tool_Pickaxe_Crude` from real materials.
3. Chop logs/trunks from supported trees.
4. Make and place first public storage.
5. Stock useful starter resources and food.
6. Make or use early benches.
7. Mine copper ore, process it into copper bars, and make copper tools.
8. Use copper progression to reach iron ore and iron tools.
9. Grow or gather food and health ingredients so longer expeditions become possible.
10. Flee, heal, or return home when the health situation becomes risky.

That is the core player progression arc. It is also the right shape for SynthUnit behavior: not abstract goals floating in code, but visible adventure steps a player would recognize.

## The Hytale Adventure Loop

### 1. Wake Up And Get Oriented

A player starts with basic needs and a nearby world full of visible opportunities: sticks, rubble, plants, trees, berries, terrain, ruins, caves, water, creatures, and threats.

Early goals:

- gather `Wood_Sticks`
- gather `Rubble_Stone`
- gather `Ingredient_Fibre`
- gather food such as `Plant_Fruit_Berries_Red`
- craft first crude tools
- mark a home location
- make first storage

Synth implication: early synths should understand the same visible starter materials a player cares about.

### 2. Make Tools To Touch More Of The World

Tools are a permission layer for the world. A hatchet makes trees useful. A pickaxe makes stone and ore useful. A shovel opens soil, sand, clay, farming, and terrain work.

Early concrete tool goals:

- craft `Tool_Hatchet_Crude`
- craft `Tool_Pickaxe_Crude`
- verify the recipe path for `Tool_Shovel_Crude`, then use it for terrain and farming-adjacent work

Later concrete tool goals:

- craft `Tool_Hatchet_Copper`, `Tool_Pickaxe_Copper`
- craft `Tool_Hatchet_Iron`, `Tool_Pickaxe_Iron`, `Tool_Shovel_Iron`
- verify the craft path for `Tool_Shovel_Copper` before treating it as a player-craftable copper step
- continue into rarer tool tiers when materials and benches are proven

Synth implication: capabilities should name the specific tool and the materials needed to make it.

### 3. Bring The World Home

The player does not only collect. The player returns, stores, sorts, and turns resources into a base.

Home goals:

- place `Furniture_Crude_Chest_Small`
- stock public chests with `Ingredient_Stick`
- stock public chests with `Rubble_Stone`
- stock public chests with `Ingredient_Fibre`
- stock public chests with berries
- stock public chests with same-type logs from supported trees
- keep tools available for future trips

Synth implication: storage behavior should be visible and simple. A full chest means try another chest or block visibly.

### 4. Go Underground Or Farther Out

Once a player has tools and storage, the adventure expands. Mining, caves, rare resources, tougher enemies, and longer expeditions become meaningful.

Mining goals:

- craft or retrieve the needed pickaxe
- find stone and ore deposits
- mine copper ore
- bring ore home
- process materials if a bench or station is required
- upgrade tools and gear

Synth implication: mining is not just "get copper." It includes preparing the right tool, finding the ore, surviving the location, collecting the drops, and returning them to storage.

### 5. Fight, Hunt, Or Avoid Danger

Hytale adventure includes danger. Some players seek fights; some avoid them until prepared.

Combat and hunting goals:

- flee when outmatched
- equip better weapons and armor
- hunt hostile monsters for safety, drops, or progression
- hunt creatures for food, materials, or settlement needs
- protect a base or village later

Synth implication: every synth needs a basic survival response before combat behavior. First flee, then later defend, hunt, guard, or patrol.

### 6. Farm, Cook, And Sustain

Food and renewable production change the rhythm from pure scavenging to settlement life.

Farming goals:

- gather wild food such as berries
- plant crops
- water or tend crops if the game requires it
- harvest crops
- store food
- cook or prepare better meals

Synth implication: farming synths should begin with specific crop or food capabilities, not a broad "farm" label.

### 7. Build A Place Worth Returning To

Base and village building are long-running player projects. They give purpose to resources and make the world feel owned.

Building goals:

- gather logs, stone, fiber, and later refined materials
- place storage and benches
- build walls, paths, rooms, farms, workshops, and decorative spaces
- maintain shared supplies
- expand from home to base to village

Synth implication: synths should make a place feel lived in by gathering, stocking, building, reacting to problems, and using real containers and real blocks.

## Player Types And Play Styles

### Survival Starter

Wants immediate help with basics: sticks, rubble, fiber, berries, crude tools, and first storage.

Synths should help with:

- gathering starter materials
- making `Tool_Hatchet_Crude`
- making `Furniture_Crude_Chest_Small`
- stocking first public storage

### Crafter And Upgrader

Wants better tools, better benches, and smoother material chains.

Synths should help with:

- crafting specific crude, copper, and iron tools
- keeping required materials stocked
- using required benches or stations
- surfacing why a craft is blocked

### Miner And Prospector

Wants stone, ore, rare materials, and underground progress.

Synths should help with:

- making or retrieving `Tool_Pickaxe_Crude`
- mining copper ore
- returning ore to storage
- later identifying rarer materials and tool tiers

### Monster Hunter

Wants dangerous fights, useful drops, and safer territory.

Synths should help with:

- fleeing when weak
- later tracking hostile threats
- later gearing up
- later guarding a route, camp, or base

### Creature Hunter And Naturalist

Wants food, materials, creature behavior, and ecology.

Synths should help with:

- identifying useful creatures
- hunting or avoiding creatures based on need and risk
- bringing creature drops home
- later supporting farms or pens if those systems exist

### Farmer And Cook

Wants renewable food and better meals.

Synths should help with:

- gathering berries
- stocking food in public storage
- later planting, tending, harvesting, and cooking specific foods

### Explorer And Scout

Wants to see new biomes, ruins, caves, resources, and landmarks.

Synths should help with:

- surviving travel
- marking useful locations
- reporting visible resources
- later escorting or scouting within loaded-world limits

### Builder And Decorator

Wants materials, storage, construction, and place-making.

Synths should help with:

- stocking logs, stone, fiber, and crafted blocks
- placing specific blocks when commanded
- keeping public storage organized enough to build from

### Village Steward

Wants a settlement that feels alive.

Synths should help with:

- shared public storage
- basic jobs such as gatherer, farmer, miner, builder, and defender
- visible daily behavior
- simple reactions to blocked work

## Progression Lens For SynthUnits

When deciding what to build next, prefer player progression over internal elegance.

Ask these questions:

- What would a player be trying to accomplish at this stage?
- What exact item, block, creature, place, or danger is involved?
- What must the synth visibly do in the world?
- What real Hytale state proves the synth did it?
- Would a player recognize the action without reading our code?

Good capability language:

- "A synth can gather `Rubble_Stone`."
- "A synth can craft `Tool_Pickaxe_Crude`."
- "A synth can stock `Ingredient_Fibre` in a public chest."
- "A synth can mine copper ore with the required pickaxe."

Weak capability language:

- "A synth can hold a goal."
- "A synth can execute a task stack."
- "A synth can use an acquisition strategy."
- "A synth can process resource categories."

Those internal systems matter, but they belong in `sprint-board.md` or architecture notes. The capability exists when a player or beholder can point at the synth and say what it did in the Hytale world.

## LLM Translation Rule

When reading or writing SynthUnit docs, translate abstract prompts into concrete Hytale behaviors.

Examples:

| Abstract prompt | Better Hytale interpretation |
| --- | --- |
| "Make goals work" | "A synth asked for `Tool_Hatchet_Crude` gathers `Wood_Sticks`, `Rubble_Stone`, and `Ingredient_Fibre`, then crafts it." |
| "Improve gathering" | "A synth can gather `Plant_Fruit_Berries_Red` and stock it in a public chest." |
| "Add mining" | "A synth can craft or retrieve `Tool_Pickaxe_Crude`, find copper ore, mine it, and bring the drops home." |
| "Add survival" | "A synth runs away from a threat before returning to work." |
| "Add storage logic" | "A synth tries another public chest when the current chest is full." |
| "Add crafting progression" | "A synth uses a real required bench before crafting copper or iron tools." |

If the better interpretation names no concrete item, block, creature, place, or visible action, it probably belongs in `sprint-board.md`, not `capabilities.md`.

## SynthUnit Design Principles

- Real world first: synths use real blocks, items, drops, containers, benches, and movement.
- Concrete before broad: prove `Tool_Pickaxe_Crude` before claiming "tools."
- Visible before clever: a player should understand what the synth is trying to do.
- Simple reactions first: chest full means try another chest, target gone means find another target, danger means flee.
- Player progression first: capabilities should follow what a player naturally tries to do next.
- No virtual shortcuts: no fake resources, fake storage, or free item creation.

## Nearby Reference Docs

- `capabilities.md` tracks the yes/no list of concrete SynthUnit capabilities.
- `sprint-board.md` owns stories, acceptance criteria, progress, and implementation details.
- `synths.md` describes what SynthUnits can actually do today.
- `../../docs/hytale-survival-progression.md` tracks concrete survival progression, tool ids, recipes, and material assumptions.
