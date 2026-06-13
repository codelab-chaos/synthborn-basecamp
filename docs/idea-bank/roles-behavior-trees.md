Yes — this is a great fit for a **Hytale autonomous NPC society mod**: not just mobs that fight, but “SimPlayers / villagers” with roles, needs, work loops, schedules, social behaviors, and survival instincts.

Hytale’s documented NPC model already lines up with this: NPCs use **Roles**, with JSON **instruction lists** made of **sensors, actions, and motions**; the docs describe these as close to behavior trees / decision trees, and the 2019 intro describes sensors as how NPCs interpret the world, actions as what they do, and motions as how they move. ([hytale.com][1]) Erenshor is a useful inspiration because its “SimPlayers” persistently exist, progress independently, and are available as companions in a single-player MMO-like world. ([Steam Store][2])

## The core fantasy: “a village that survives without me”

I’d design this as a **survival settlement simulation** layered on top of Hytale NPC Roles.

The player spawns or recruits NPC folks. Each NPC has:

```text
Role: farmer / miner / woodcutter / crafter / tanner / defender / healer / trader
Needs: hunger, safety, rest, tools, social, morale
Inventory: carried items, equipped tools, job outputs
Home: bed / house / village anchor
Worksite: farm, mine, forest zone, workshop, tannery, guard post
Schedule: work, eat, socialize, sleep, respond to danger
Memory: known chests, known threats, last worksite, allies, grudges/friends
```

The important trick is that each NPC should not be “smart” in isolation. The **village** should be smart. The village manager tracks jobs, resources, alerts, storage, zones, and global priorities. Individual NPCs pull tasks from that system.

Think:

```text
NPC brain = behavior tree / FSM executor
Village brain = job board + resource ledger + alert system
```

That keeps performance sane and makes the behavior feel coordinated.

---

# Role ideas

## 1. Farmer

The farmer maintains food production.

Basic loop:

```text
Wake → get seeds/tools → inspect farm zone → harvest mature crops → replant → deposit food → eat/socialize/sleep
```

Useful sensors:

```text
Has seeds?
Has hoe/tool?
Is crop mature nearby?
Is farmland empty?
Is inventory full?
Is hungry?
Is hostile nearby?
Is it work hours?
```

Actions:

```text
MoveToCrop
HarvestCrop
PlantSeed
CollectDrops
DepositFood
WithdrawSeeds
EatFood
ReturnHome
Flee
```

Scenario examples:

```text
Food shortage:
  Farmers prioritize edible crops over trade crops.

Winter / bad biome / night danger:
  Farmers stop outdoor work and switch to greenhouse or storage tasks.

Raid alarm:
  Farmers flee to safe zone, defenders intercept enemies.

Player gives special seed:
  Farmer adds it to village crop plan and starts cultivating it.
```

For your wheat example, the farmer is the MVP role. It produces direct survival value and touches inventory, blocks, pathing, storage, and scheduling without needing complex combat.

---

## 2. Miner

The miner produces stone, ore, coal, gems, and tunnel infrastructure.

Basic loop:

```text
Get pickaxe → go to mine zone → mine target blocks → avoid hazards → return when full/tired/tool low → deposit ore
```

Sensors:

```text
Has pickaxe?
Pickaxe durability low?
Inventory full?
Ore visible?
Light level too low?
Hostile nearby?
Health low?
Mine zone assigned?
```

Actions:

```text
MineBlock
PlaceTorch
ReturnToSurface
DepositOre
RequestToolRepair
FleeFromHostile
CallDefender
```

Scenario examples:

```text
Deep mine expedition:
  Miner + defender + torchbearer travel together.

Ore shortage:
  Village posts “need iron” jobs; miners prioritize iron nodes.

Cave danger:
  Miner marks danger location and avoids that region until defenders clear it.
```

This role can become very powerful, but I’d keep the first version constrained: assigned mine zones only, not arbitrary infinite strip-mining.

---

## 3. Woodcutter

The woodcutter supplies logs, sticks, charcoal, and construction materials.

Basic loop:

```text
Find tree zone → chop mature trees → collect logs → optionally replant saplings → deposit logs
```

Sensors:

```text
Tree nearby?
Sapling needed?
Axe available?
Inventory full?
Village low on wood?
Hostile nearby?
```

Actions:

```text
ChopTree
CollectWood
PlantSapling
DepositWood
CraftBasicSticks
ReturnHome
```

Scenario examples:

```text
Storm / night:
  Woodcutter stops working outside.

Construction project:
  Woodcutter prioritizes wood until builder/crafter demand is satisfied.

Deforestation rule:
  Never cut sacred trees or trees inside “decorative” zones.
```

This gives the village a sustainable material pipeline.

---

## 4. Crafter / Artisan

The crafter converts raw materials into tools, armor, building parts, and utility goods.

Basic loop:

```text
Check job board → fetch ingredients → use workstation → craft item → deposit output / deliver to requester
```

Sensors:

```text
Craft job available?
Ingredients available?
Correct workstation available?
Tool/armor requests pending?
Storage has enough materials?
```

Actions:

```text
WithdrawIngredients
CraftRecipe
DepositOutput
DeliverItem
RequestMaterials
```

Scenario examples:

```text
Miner broke pickaxe:
  Crafter makes replacement if wood + ore exist.

Raid threat rising:
  Crafter prioritizes weapons, shields, armor, arrows.

Winter prep:
  Crafter makes warm clothing, food storage, torches.
```

This role is less “world-interaction heavy” and more “economy glue.” It connects every other role.

---

## 5. Tanner / Leatherworker

The tanner turns hides into leather armor, bags, saddles, straps, waterskins, etc.

Basic loop:

```text
Collect hides → use tannery station → craft leather goods → supply defenders/workers
```

Sensors:

```text
Raw hides available?
Tannery station available?
Leather shortage?
Armor/bag request pending?
```

Actions:

```text
TanHide
CraftLeatherArmor
CraftBag
DepositLeather
DeliverGear
```

Scenario examples:

```text
Defender needs armor:
  Tanner prioritizes leather armor.

Village expands:
  Tanner crafts backpacks so workers carry more.

Hunter brings rare hide:
  Tanner crafts special item or trades with player.
```

This is a good “specialist economy” role that makes the village feel less generic.

---

## 6. Defender / Guard

The defender protects the village and escorts workers.

Basic loop:

```text
Patrol → scan for threats → intercept hostile → defend NPC/player → recover → return to post
```

Sensors:

```text
Hostile nearby?
Villager under attack?
Alarm active?
Health low?
Weapon equipped?
Post assigned?
```

Actions:

```text
PatrolRoute
EngageThreat
DefendTarget
CallReinforcements
RetreatToHealer
EscortWorker
ReturnToPost
```

Scenario examples:

```text
Night raid:
  Defenders move to walls/gates, noncombatants flee.

Miner requests escort:
  Defender follows miner into cave until danger is cleared.

Player is trusted:
  Defender assists player when attacked near village.
```

Defender is where Hytale’s existing combat-evaluator-style behavior likely helps most. Hytale’s NPC technical rundown says roles can include behavior, movement, items, and reactions, so a defender role can combine combat, patrol, and protection logic. ([hytale.com][1])

---

## 7. Hunter / Forager

The hunter gathers meat, hides, berries, herbs, and monster parts.

Basic loop:

```text
Scout zone → find animal/resource → harvest/hunt → return before danger threshold → deposit food/materials
```

Sensors:

```text
Animal nearby?
Berry/herb nearby?
Village food low?
Inventory full?
Danger too high?
Health low?
```

Actions:

```text
TrackAnimal
AttackAnimal
HarvestCarcass
GatherBerries
DepositFood
AvoidPredator
```

Scenario examples:

```text
Food crisis:
  Hunters prioritize meat and berries.

Predator spotted:
  Hunter reports location; defenders get a clear-threat task.

Rare herb found:
  Hunter brings it to healer/alchemist.
```

This bridges survival and adventure.

---

## 8. Healer / Cook

The healer/cook keeps the village alive.

Basic loop:

```text
Check injured/hungry NPCs → fetch ingredients → cook/heal → distribute food/medicine
```

Sensors:

```text
NPC injured?
NPC hungry?
Food ingredients available?
Medicine ingredients available?
Raid just happened?
```

Actions:

```text
CookMeal
HealTarget
DeliverFood
CraftBandage
RestockClinic
```

Scenario examples:

```text
After raid:
  Healer triages wounded NPCs.

Food surplus:
  Cook makes travel rations for miners/hunters.

Disease/poison:
  Healer requests herbs from foragers.
```

This makes survival feel social instead of just individual stat bars.

---

## 9. Builder / Repairer

The builder maintains village structures, walls, paths, farms, and lighting.

Basic loop:

```text
Find construction/repair job → fetch materials → place blocks → verify structure → deposit leftovers
```

Sensors:

```text
Build job available?
Repair job available?
Materials available?
Block missing/damaged?
Hostile nearby?
```

Actions:

```text
FetchMaterials
PlaceBlock
RepairWall
PlaceTorch
BuildPrefabStep
ReturnMaterials
```

Scenario examples:

```text
Raid damaged wall:
  Builder repairs it next morning.

Village expansion:
  Builder constructs new house when population grows.

Player places blueprint:
  Builder turns it into a staged construction job.
```

This is a huge “wow” role if Hytale allows enough block placement/interactions. The NPC technical post notes NPCs can place blocks, but also flags rough edges and limitations around deliberate block-breaking, so you’d want to verify the current API before promising full builder autonomy. ([hytale.com][1])

---

# Core survival behaviors shared by all roles

Every role should inherit a **SurvivorCore** behavior tree. This runs above job-specific logic.

Priority order:

```text
1. If dead/downed → wait for revive / respawn logic
2. If under attack → flee or fight depending on role
3. If health low → seek healer / retreat
4. If starving → eat / seek food
5. If exhausted → sleep/rest
6. If lost → return to home/village anchor
7. If inventory critical → deposit / restock
8. If work hours → perform role
9. If social hours → talk / trade / gather
10. Else idle / wander / emote
```

This gives every NPC believable continuity. A farmer is not “just a farm machine.” They are a villager who farms when safe, eats when hungry, sleeps at night, and runs when the village is attacked.

---

# Scenario packs you could create

## Scenario A: Founding Camp

The player starts with 3–5 NPCs and a supply chest.

Roles:

```text
1 farmer
1 woodcutter
1 miner
1 crafter
1 defender
```

Village goals:

```text
Build shelter
Plant food
Gather wood
Mine stone/coal
Craft tools
Survive first night
```

This is the best MVP scenario because every role has an obvious job and you can see the system come alive quickly.

---

## Scenario B: Winter Prep

The village knows winter or a dangerous season is coming.

NPC behavior shifts:

```text
Farmers maximize harvest.
Hunters gather meat.
Woodcutters gather fuel.
Crafters make warm gear/tools.
Builders repair walls.
Defenders patrol more often.
```

This tests global priorities and resource planning.

---

## Scenario C: Raid Defense

Hostiles attack the settlement.

Behavior shift:

```text
Defenders → gates/walls/frontline
Farmers/crafters/tanners → shelter
Healer → clinic
Builder → repairs after battle
Hunter → optional skirmisher/scout
```

This makes roles feel different under stress.

---

## Scenario D: Supply Chain Town

Create multi-step dependencies:

```text
Woodcutter → logs
Miner → ore
Crafter → tools
Farmer → food
Hunter → hides
Tanner → leather
Defender → consumes weapons/armor/food
Builder → consumes wood/stone/tools
```

The player can intervene by adding resources, assigning zones, or upgrading workstations.

---

## Scenario E: SimPlayer Adventuring Party

Inspired more directly by Erenshor: some NPCs behave like MMO party members.

Roles:

```text
Tank
Healer
Ranger
Mage
Gatherer
Scout
```

Loops:

```text
Look for quest/adventure
Invite player
Travel to dungeon
Fight mobs
Loot
Return to town
Upgrade gear
Talk about what happened
```

This would be a later layer after the survival village works.

---

# Technical design I’d use

## 1. Three-layer AI

Do not put everything in one behavior tree.

Use this structure:

```text
Layer 1: Survival Core
  hunger, safety, health, sleep, flee, return home

Layer 2: Role Brain
  farmer, miner, woodcutter, crafter, tanner, defender

Layer 3: Scenario/Settlement Brain
  village job board, raids, shortages, construction projects, economy
```

The NPC asks:

```text
Am I safe/alive/fed?
If yes, what does my role want?
If no, survival core overrides role.
```

The village asks:

```text
What do we need most?
Food? Tools? Defense? Repairs? Housing?
```

Then it posts jobs.

---

## 2. Job-board architecture

Instead of each NPC scanning the whole world, create a central **Job Board**.

Example jobs:

```json
{
  "id": "job_harvest_wheat_102",
  "type": "HarvestCrop",
  "roleTags": ["farmer"],
  "target": { "x": 120, "y": 64, "z": 88 },
  "itemNeeded": null,
  "priority": 60,
  "expiresAt": 123456,
  "reservedBy": null
}
```

NPCs query jobs they can perform:

```text
Farmer asks: “best farmer job near me?”
Miner asks: “best mining job in assigned mine?”
Defender asks: “highest active threat?”
Crafter asks: “highest craft request with ingredients available?”
```

This avoids N farmers all scanning the same field every tick.

---

## 3. Zones matter a lot

Define explicit zones:

```text
VillageCenter
FarmZone_North
MineZone_East
ForestZone_West
Storage_Barn
Workshop_Blacksmith
Tannery
Clinic
GuardPost_Gate
Shelter_Bunker
```

Each role operates inside known zones. This is much more reliable than “go find something anywhere.”

For Hytale, this likely maps cleanly to data-driven NPC role configuration because the documented system is based around roles and reusable instruction elements. The Hytale docs also emphasize building NPCs from reusable sensors/actions/motions/components/templates. ([hytale.com][3])

---

## 4. Behavior tree shape

A good general role tree:

```text
Root
├─ Emergency
│  ├─ If under attack → flee/fight
│  ├─ If health low → seek healer
│  └─ If starving → eat
├─ Schedule
│  ├─ If sleep time → sleep
│  ├─ If meal time → eat/socialize
│  └─ If work time → role work
├─ RoleWork
│  ├─ Find/claim job
│  ├─ Prepare tools/items
│  ├─ Travel to target
│  ├─ Perform work
│  └─ Deposit outputs
└─ Idle
   ├─ Socialize
   ├─ Wander
   └─ Emote
```

Role-specific branches plug into `RoleWork`.

---

## 5. FSM underneath behavior tree

You can still implement an FSM internally for each job.

Example farmer job FSM:

```text
CLAIM_JOB
  → if job available: PREPARE
  → else: IDLE

PREPARE
  → if missing seeds/tool: RESTOCK
  → else: TRAVEL

TRAVEL
  → if reached target: EXECUTE
  → if path failed: FAIL_JOB

EXECUTE
  → harvest/plant
  → VERIFY

VERIFY
  → if success: COMPLETE
  → else: RETRY or FAIL

COMPLETE
  → deposit if inventory full
  → return to CLAIM_JOB
```

So the **behavior tree chooses what broad behavior should run**, while the **FSM executes the selected task reliably**.

That hybrid is usually better than pure FSM or pure BT.

---

# Example role data

A role could look like this conceptually:

```json
{
  "roleId": "settlement.farmer",
  "inherits": ["survival.core", "worker.common"],
  "allowedJobs": [
    "HarvestCrop",
    "PlantCrop",
    "WaterCrop",
    "DepositFood",
    "WithdrawSeeds"
  ],
  "preferredZones": ["Farm"],
  "toolPreferences": ["hoe", "basket"],
  "workHours": {
    "start": 6,
    "end": 18
  },
  "needs": {
    "hungerRate": 1.0,
    "restRate": 1.0,
    "dangerTolerance": 0.25
  }
}
```

A defender:

```json
{
  "roleId": "settlement.defender",
  "inherits": ["survival.core", "combat.common"],
  "allowedJobs": [
    "Patrol",
    "DefendVillager",
    "EngageThreat",
    "EscortWorker",
    "GuardGate"
  ],
  "preferredZones": ["Village", "Gate", "Wall", "MineEntrance"],
  "toolPreferences": ["sword", "shield", "bow"],
  "workHours": {
    "start": 0,
    "end": 24
  },
  "needs": {
    "hungerRate": 1.2,
    "restRate": 1.1,
    "dangerTolerance": 0.85
  }
}
```

---

# Social interactions

This is where the Erenshor inspiration can shine.

Give NPCs lightweight social state:

```text
friendship
trust
fear
respect
annoyance
recentEvents
sharedFaction
```

Then add interactions:

```text
GreetNearbyVillager
AskForHelp
TradeItem
ComplainAboutShortage
ThankPlayer
WarnAboutThreat
InviteToAdventure
CelebrateHarvest
MournDeadVillager
```

Examples:

```text
Farmer to woodcutter:
  “We need more fence posts before the boars get into the wheat again.”

Miner to defender:
  “I saw something moving near the lower tunnel.”

Crafter to player:
  “Bring me iron and I can make better tools for the whole camp.”
```

Technically, these can be triggered by events, not generated constantly.

```text
Event: FoodShortage
  Farmer comments about crops.
  Hunter offers to forage.
  Cook asks for ingredients.

Event: RaidSurvived
  Defender boasts.
  Healer checks wounded.
  Builder complains about wall damage.
```

---

# LLM use, if you add it later

I would **not** let an LLM control moment-to-moment NPC actions.

Use the deterministic AI for:

```text
movement
combat
harvesting
crafting
depositing
pathing
survival
```

Use an LLM for:

```text
dialogue flavor
quest text
rumors
personality variation
summarizing village state
explaining why an NPC is doing something
```

Example:

```text
Deterministic system:
  Farmer is hungry, village wheat stock is low, farm has 12 mature crops.

LLM dialogue:
  “I’d better harvest the north field before sundown. We’re nearly out of bread.”
```

This keeps the world consistent and prevents “LLM hallucinated behavior” from breaking the sim.

---

# Suggested MVP build order

## MVP 1: One role, one zone, one storage

Start with farmer only.

```text
Farmer
Farm zone
Storage chest
Seeds
Wheat
Eat/sleep optional
```

Behaviors:

```text
Find mature wheat
Harvest
Find empty farmland
Plant seed
Deposit wheat
Withdraw seeds
Idle
```

## MVP 2: Add survival core

```text
Hunger
Sleep
Flee from hostile
Return home
```

## MVP 3: Add woodcutter + crafter

Now you have economy:

```text
Woodcutter gets logs.
Crafter makes tools.
Farmer consumes/requires tools.
```

## MVP 4: Add defender + raid event

Now the village reacts to danger.

## MVP 5: Add job board and resource ledger

At this point, stop hardcoding role loops and let the settlement post tasks.

## MVP 6: Add social interactions

NPCs talk about actual state:

```text
low food
broken tools
recent raid
new player-built house
successful harvest
missing worker
```

---

# The design north star

The strongest version of this mod is not “NPCs that do tasks.”

It is:

```text
A settlement where every NPC has a job, needs, relationships, and a daily routine;
where resources flow between roles;
where threats disrupt routines;
where the player can help, exploit, protect, or expand the society.
```

For Hytale specifically, I’d make the **Role + instruction list system** the foundation, custom Java elements for missing sensors/actions, and a server-side **SettlementManager** for the shared job board/resource ledger. Hytale’s docs indicate that sensors/actions/motions are Java element types, while instruction lists are JSON, and that modders are expected to be able to add more Java elements — so this “data-driven roles + custom primitives” approach is the best fit. ([hytale.com][1])

[1]: https://hytale.com/news/2026/2/npc-technical-rundown?utm_source=chatgpt.com "NPC Technical Rundown"
[2]: https://store.steampowered.com/app/2382520/Erenshor/?utm_source=chatgpt.com "Erenshor on Steam"
[3]: https://hytale.com/news/2019/4/an-introduction-to-building-npc-behaviors?utm_source=chatgpt.com "An introduction to building NPC behaviors"
