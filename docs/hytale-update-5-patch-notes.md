# HYTALE PATCH NOTES - UPDATE 5

**Source:** <https://hytale.com/news/2026/5/update-5-patch-notes>  
**Author:** Hytale Team  
**Published:** May 26, 2026  
**Local capture:** Tue, 26 May 2026 12:48:28 -0700  
**Ported from:** HYTALE PATCH NOTES - UPDATE 5 \_ Hytale.mhtml

![HYTALE PATCH NOTES - UPDATE 5](https://cdn.hytale.com/d6c87c14-3f00-4128-866a-22f91324f0e4.png)

Update 5 is out! Headlining the release is the new Trigger Volume Tool for scripting encounters in-game without code, alongside controller support, Server Discovery for browsing community servers, a new Social Sidebar with a friends list and Discord integration!

The changelog also has a long list of improvements, fixes, and quality-of-life changes. A lot of those came from feedback and bug reports we've been getting from our community, which has been hugely helpful!

On Updates vs Chapters: each Update brings system improvements, tooling, and polish that keep the game evolving between bigger releases. Chapters are the bigger moments: new content, new mechanics, and where the Cursebreaker Arc lore slowly kicks in. Chapter 1 is in the works.

Lastly, a huge thank you to everyone who entered the Hytale New Worlds Modding Contest! The bar the community set was higher than we expected, and some of the entries pushed the modding tools in directions we hadn't anticipated. Check out the winners and their projects in our [retrospective post](https://hytale.com/news/2026/5/hytale-new-worlds-modding-contest-retrospective)!

Okay, now let's dive into all of Update 5's content!

# **FEATURES & HEADLINE UPDATES**

# **Trigger Volume Tool**

- **Create your own scripted encounters with the new Trigger Volume Tool!**  
  The Trigger Volume Tool allows you to place persistent 3D volumes that trigger configurable effects when conditions are met, such as when players enter or exit them, or break blocks within them. Volumes are saved to the world and can be included in prefabs, enabling scripted encounters, environmental effects, area transitions, and other interactive moments without writing any code.
  - Place, resize, rotate, and configure trigger volumes directly in-game through a dedicated UI, with visual gizmos so you can see exactly where each volume sits in the world.
  - Multi-select and group volumes to move, edit, or duplicate them in bulk. Use the keybind ‘Shift+D’ to duplicate them quickly!
  - Save trigger volumes as part of prefabs so entire interactive setups can be reused in any build.
  - Select from over 20 built-in effects, including playing sounds, VFX, velocity changes, weather, teleportation, game mode changing, inventory adjusting, NPC spawning, and prefab placement. A single volume can trigger multiple effects for richer interactions.
  - Each effect can be configured to trigger when only specific circumstances are met. Delays may also be added, allowing effects to trigger in sequence and providing fine-grained control over timing and behavior.
  - Built with mod support in mind so that modders can create their own custom effects.

## **WHAT IS IT?**

A Trigger Volume is an invisible 3D shape you place in the world. Think of this like a tripwire, but it can be a box, sphere, or cylinder of any size!

Nothing about it is visible to players during normal play. It sits there, quietly watching and waiting. When something happens inside of it (for example: a player walks in, a creature walks out, an arrow flies through, a block gets broken, etc.) it can react by running a desired effect.

A volume might play a sound, spawn an NPC, move platforms, open a door, send a message in the player's chat, give the player an item, or even change the weather. You decide!  
In addition to these effects, you can also have conditions attached - for example, rules like “only fire once”, “only fire after 5 seconds of standing in the volume”, or “only fire if the blocktype is this specific type”.

You can group volumes together. The whole set of them act as one big region or share the same logic.  
Because they are just shapes and rules, there’s no coding required! You place them, point and click to configure them in a GUI, and the server will do the rest. That said, if you want to extend it, we have modding API available for new events, conditions, and effects.

  
*The UI allows you to make scripted events or effects without needing to code anything!*

## **THE POTENTIAL OF THIS TOOL**

As you can imagine, there is *a lot* of potential with this tool. Trigger Volumes will be the building blocks behind a lot of what makes a world feel ‘alive’. Ambushes, story beats, hidden discoveries, puzzles, and safe zones can all be built on top of them.

Here's a compilation from our Level Designers of what's possible without writing a single line of code.

*[Embedded video omitted. See source article.]*

</div>

Tag us on [X/Twitter](https://x.com/Hytale) with **\#Hytale** when you build something. We want to see what you make with this!

# **Controller Support**

- **Controller support arrives in its first iteration!**
  - Plug in an Xbox, PlayStation, or Nintendo Switch controller and Hytale picks it up. Move, fight, explore, and navigate menus with a controller. The movement-stick dead zone is tunable from 5% to 95% in Settings.
  - This is just the beginning. Some advanced features may still require a keyboard and mouse, and we'll continue refining the experience based on your feedback.

## **HOW WE GOT HERE & WHERE WE’RE GOING**

Hey all! Likaos here. I am the developer who spearheaded a lot of the controller support. I'd like to take a moment to give you all some insight into how we arrived here and where we are headed.

Controller support has been one of the most-requested features from the community, and we wanted to do it right. Hytale was originally built around mouse and keyboard, top to bottom. So, we knew translating that to a controller would prove to be a difficult task.

The "ideal" plan was to wait for the UI rework that's coming, and then design controller support around it from day one: UI, menus, inventory, everything thought through for a gamepad from the start. However, that meant asking players to wait months longer to plug in their controller, and we didn't want to rush the new UI just to get there faster. So, we took a second path: build temporary controller support on top of the current UI, ship it now, and in the meantime we will design the long-term version properly.  

*In-game settings displaying the new gamepad menu.*

## ON THE DEV SIDE:

- **Defining the controls:** Pierre and MewSoul had already laid down good defaults for the gameplay side, but pretty much nothing was mapped for menus and UI. A lot of that had to be figured out from scratch.
- **Rebuilding the input system:** The old one wasn't ready for any of this. It needed multi-binding support, proper analog axis handling, and updated libraries so Xbox, PlayStation, and even Nintendo Switch controllers would all work.
- **Adapting the gameplay:** This was actually the smoother part. Making icons and hints swap dynamically depending on what you're holding, hooking a single stick into movement the way players expect, adding sensitivity options. Lots of polish, but the foundations were there.
- **The UI (the real fight):** Almost none of this existed. One thing that saved me was a rework I did a few months back on item-stack interactions (the press-vs-hold split), which gave us a way to do drag-and-drop with a gamepad.
- **Everything else was QoL grind:** where to put the binds so they feel natural, how to use the mouse wheel cleanly, how to navigate menus quickly. We could have placed a virtual cursor in there, but in Hytale a huge chunk of UI time is inventory management. A virtual cursor would have made that painful. So instead there's a grid-based navigation system with custom rules for moving between menus. It's not perfect, but compared to where it started, I'm honestly pretty happy with where it landed.

This isn't the final word on controller support. This is a way to get a controller into your hands now so you don't have to wait, and to make Hytale more accessible to more players *today*.

## WHAT’S NEXT?

With this foundation in place, the longer-term plan includes:

- Wider controller compatibility and modern input features like gyro aiming and Steam Input.
  - A UI that's genuinely designed for gamepad: clearer layouts, better flow, more accessibility options.
  - More ergonomic default bindings, plus much deeper rebinding so you can fully tailor how you play.

Thanks for being patient with us on this one. Plug a controller in, give it a try, and let us know what feels off. Your [feedback](https://hytale.com/suggestions) is going to directly shape the version that lands with the UI rework.

# **Social Sidebar**

- **Stay connected with the new Social Sidebar!**
  - You can now add friends, see who’s online, invite them to your world, and join theirs directly from the Main Menu.
  - Discord friends can be added as Hytale friends in-game, and the Social Sidebar will reflect any changes they make to their Avatar.
  - You can also favorite friends to keep them at the top of your list, and block players you'd rather not interact with.
  - Toast notifications will appear in-game when a friend sends you a request or invites you to their world. Incoming friend requests can be turned off in your social settings.
  - This feature is not available on parent-managed accounts.\\

This is just the first step. More social features are coming to improve how you join friends, invite others, and connect with the community.

> **NOTE:** This feature will be going live shortly following the release of Update 5 and will not require a restart of your game. Thanks for your patience!

*[Embedded video omitted. See source article.]*

</div>

# **Server Discovery**

- **Explore new worlds with Server Discovery!**
  - Server owners may now submit their servers via the ‘Server Profiles’ section of the [Hytale account page](https://accounts.hytale.com/). Servers that meet the [Server Owner Policies](https://hytale.com/server-policies) and pass manual review will appear in the new in-game Server Discovery page.
  - Explore featured servers that are hand-picked by the Hytale team. These are high-quality experiences highlighted for the community to enjoy.
  - Discover your next favorite server. Search by title or description, filter by tags, and see how many players have liked or favorited it.
  - Easily return to servers you’ve enjoyed by marking them as favorites or accessing your recently played list.
  - This feature is not available on parent-managed accounts.

> **NOTE:** This feature will be going live shortly following the release of Update 5 and will not require a restart of your game. Thanks for your patience!

# **Music & Audio**

- **Audio Occlusion and Diffraction have been implemented**
  - This feature uses raycasting between sound sources and the listener, muffling audio depending on what materials divide the two.
  - Sound will also now ‘bend’ around corners and through doorways instead of being muffled.
- **Over 1 hour of new music has been added!**
  - New music will now be heard throughout the Emerald Wilds, Howling Sands, and Whisperfrost Frontiers.
  - This includes new day and night exploration tracks, short form pieces, and ambient fragments.

Have a listen to one of the new tracks, 'Persevere'!

*[Embedded video omitted. See source article.]*

</div>

# **Creative Mode Placement Settings**

- **Several new Placement Settings have been added to the Creative Mode Quick Settings**
  - Selecting ‘Place Mode: Replace’ will change the block you’re looking at to match the one held.
  - Selecting ‘Place Mode: Type Replace’ will change the material of the block you’re looking at with the material of the one held, without changing the block’s shape.
  - Selecting ‘Place Mode: Extrude’ will allow you to click and drag to fill a line in with the held block.
  - Selecting ‘Place Mode: Draw’ will allow you to click and drag to draw on any plane or surface freely.
  - Selecting ‘Place Mode: Fast Place’ will place blocks faster.
  - Added an ‘Eraser’ option that will allow you to left-click and drag to break blocks more quickly. This can be active at the same time as place settings so that you can place and erase at the same time.
  - Added a ‘Free Place’ option that will allow you to place blocks in any direction at any time, so clicking and dragging will no longer lock block placement to a single plane or surface.
  - Added a ‘No Physics’ option that will allow you to place blocks ignoring their placement rules.
  - Added a ‘Highlight Block Target’ option that will highlight the block currently being looked at.

# **Item Name & Description Overrides**

- **Customize items further with per-stack name and description overrides**
  - Give individual item stacks unique names and descriptions with rich formatting, including colors, bold text, parameters, and nested messages.
  - Supports a wide range of use cases, from shop systems displaying prices to RPG systems surfacing stats, and loot systems conveying lore.

# **ADDITIONAL HEADLINE FEATURES**

- **Express yourself with new emotes!**
  - High five your friends or show off your latest gear in a dance-off. The emote wheel has been updated with new graphics and 9 new animations.
*[Embedded video omitted. See source article.]*

    </div>
- **Finding and using commands just got a whole lot easier**
  - Chat commands now feature tab-autocomplete and a suggestion UI, making it quicker than ever to find the right command.
  - Press Tab to cycle through suggestions, or Shift+Tab to browse variant options.
- **Combined the Extrude and Flood Tools into a reworked Extrude Tool**
  - In addition to extruding and shrinking blocks on the surface you’re looking at, you can also add materials to mimic the shape of that surface using different blocks.
  - Customize selections further by selecting different filters such as ‘Same Material’ or ‘Same Shape’ before extruding or shrinking.
  - Adjust the tool’s extrusion strategy for greater control of which blocks are extruded or shrunk.
  - Fill empty space with the ‘Fill mode’, replacing air whilst respecting block boundaries.
- **Get a better look at your prefabs before placing them!**
  - The prefab list now displays an interactive 3D preview of the selected prefab. You can now rotate, tilt, zoom, and pan the preview to make sure you pick the perfect prefab.
  - Creators, take note: this 3D preview functionality can also be configured for custom server UIs! Here's an example made by one of our developers who has created a mock-up Tower Defense UI.
*[Embedded video omitted. See source article.]*

    </div>
- **Player movement has been reworked to use a Hierarchical Finite State Machine!**
  - It does not provide new gameplay features (for now). This is part of a larger ongoing rework that will allow us to implement new movement features more easily in the future.
  - This new system is easier to understand, maintain, and extend compared to the one we previously had, which was difficult to maintain.
- **Simplified Chinese is now available in-game! The game can now also be translated into Dutch, Finnish, Italian, and Norwegian via [Crowdin](https://crowdin.com/project/hytale-game)**.
  - To participate in the translations, simply create a Crowdin account, then visit our project page, select the language you’d like to translate, and apply. Once approved, you’ll gain access to the project and can begin submitting translations.

# **QUICK NOTE ON LAUNCHER & DATA STORAGE CHANGES**

Game data storage has been updated. Previously all Hytale game data (e.g. worlds, mods, settings, and logs) was stored in **%HYTALE%/UserData**. A launcher update will change this behaviour to the following:

- The **Release** patchline will continue using **%HYTALE%/UserData/**
- **Non-release** patchlines will now use their own directories under **%HYTALE%/data/**
- For example, **Pre-release** files will now be found within **%HYTALE%/data/pre-release/**

Existing non-release patchlines will automatically duplicate existing worlds, mods, and game settings to the new location. Once migrated, patchlines will no longer share data.

## LAUNCHER NOW SUPPORTS OLDER VERSIONS

As with any major update, some mods may need time to catch up. If your Update 4 worlds aren't loading properly, try creating a fresh world with mods disabled to see if that's the cause.

We also now support older versions of the game via our launcher for an extended period of time, which means if your mods are not updated yet you can go back to Update 4.

> To access older updates, such as Update 4: Enable via Launcher → Settings → Patchline → v0.4

# **Avatar & Customization**

- Avatars will now perform new mouth animations when voice chat is being used.
- Added 9 new animations to the emote wheel.

# **Combat, Items & Equipment**

- The Deployable Turret has had a change of heart and will now treat its owner as an ally.
- Item entities now have hitboxes that better resemble the item dimensions.
- Capturing an NPC with a Capture Crate will now update the model icon for the crate within your inventory to reflect the NPC captured. This will only apply to NPCs captured after this update.
- Shortbows and Crossbows can no longer attack or use signature abilities when they have no durability remaining.
- Crossbows can no longer be reloaded when they have no durability remaining.
- Arrow impacts from Shortbows and Crossbows will now break blocks that only ever take a single hit to break, such as tall grass.
- All chest stack sizes have increased from 10 to 25.
- The Watering Can and Fertilizer can no longer be repaired.
- Copper, Iron, and Rusty Steel Sickles can now be salvaged at the Salvager’s Workbench.
- Scarak Spit Clump and Small Scarak Spit Clump now break in a single hit.
- The Blood Leaf Seed Bag, Storm Sapling Seed Bag, and Azure Kelp Seed Bag recipes at the Alchemist’s Workbench will no longer require a Voidheart.
- The Crystal Fertilizer Bag recipe at the Alchemist’s Workbench has had the number of Crystal Shards required lowered from 50 to 25.
- Added a number of Test_Motion_Charge NPCs.
- The icons for Bronze Pipes and Zinc blocks have been updated.
- Fish Bait (Wild) has been given an updated model.
- Improved the appearance of Burn, Freeze, and Poison status visual effects.
- Updated the particle effects for unarmed attacks.
- Updated the descriptions for Crude Repair Kits.
- Item descriptions have been added to the following items:
  - Adamantite Ingot, Cobalt Ingot, Copper Ingot, Iron Ingot, and Thorium Ingot
  - Light Leather, Medium Leather, and Heavy Leather
  - Bloodcap Spawn Bag and Blood Leaf Seed Bag
  - Zone 3 Taiga Portal
  - Small Stamina Potion, Stamina Potion, and Large Stamina Potion

# **World & Blocks**

## **Block Breaking Particles & Sounds**

- Bamboo, Dark Temple, Light Temple, Lost Civilization, Overgrown Temple, Sandswept, and Tavern Shelves now require multiple hits to break.
- Updated the block breaking particles and sound effects for a number of blocks, including:
  - Medium Scarak Egg Sack and Ancient Sack
  - Sandswept Platform, Bed, Sign, Trapdoor, and Wardrobe
  - Lost Civilization Bench, Bookshelf, Candle, Counter, Door (Medium and Large), Shelf, Torch, Sign, and Table
  - Scarak Hive Chest (Small and Large), Door (Large), Platform, Window, and Scarak Vine
  - Primordial Scarak Brazier, Chest (Small and Large), Ladder, Planter, Platform, and Window
  - Dark Temple Door (Standard and Large), and Platform
  - Light Temple Door (Standard, Medium, and Large), Shelf, Stool, Table, and Wardrobe
  - Overgrown Temple Bed, Door, Platform, Stool, and Window
  - Small Wooden Bench, Small Wooden Counter, and Wooden Shutter
  - Snowy Winter Bush, Fern, and Jungle Fern Trunk
  - Wet Dirt, Wet Dirt - Half Slab, and Wet Dirt Stairs
  - Aqua, Basalt, Calcite, Chalk, Slate, and Volcanic Gravel blocks
  - Aqua, Basalt, Calcite, Chalk, Mossy, Slate, and Volcanic Gravel Half Slab blocks
  - Aqua, Basalt, Calcite, Chalk, Ice, Marble, Mossy Stone, Quartzite, Red Sandstone, Sandstone, Shale, Slate, Stone, Volcanic, and White Sandstone Rubble
  - Statue of a Slumbering Deity

## **Other World & Block Changes**

- Improved world-gen V2 thread allocation to improve server stability during intense workloads.
- Added Gold Pipe - Large, Gold Pipe - Long, and Gold Pipe - Large Mouthpiece blocks.
- `FlammabilityConfigs` for the Fire fluid ticker can now change block states upon burning blocks.
- Goldenwood is now found more often throughout Zone 4, including within some cities and villages.
- Bamboo, Feran, and Lost Civilization Bookshelves may now be stacked on top of each other.
- Rope Blocks placed vertically can now be extended downwards by placing additional Rope Blocks beneath them.
- Royal Magic Couches can now be sat on.
- Crops will now check if there is room to grow before advancing to the next growth stage. If there isn’t sufficient space, the crops will reset to the start of the current stage in their growth cycle.
- Opening and closing doors will now break any intersecting soft blocks, such as crops, and drop their respective items.
- All Black Build, Gray Build, Gray Dark Build, Gray Light Build, White Build, and Build Lightsource blocks can no longer be broken in a single hit, but break faster when using a pickaxe.
- Crouching while placing blocks will now place them adjacent to non-solid blocks such as leaves, rather than overwriting them.
- Pressing ‘Alt’ will no longer eject players from beds.
- Trash, Small Trash Piles, and Large Trash Piles may now be broken with weapons in Adventure Mode.
- Trash, Small Trash Piles, and Large Trash Piles now all drop Trash when broken.
- Cold Grass, Dry Grass, Full Grass, Lush Grass, Sunny Grass, and Withered Grass can now be crafted at the Farmer’s Workbench.
- Updated the texture for decorative metals.

# **UI & Quality of Life**

- Added the Social Sidebar, allowing you to add friends, see who’s online and join their worlds directly from the Main Menu.
- Added the Server Discovery page, allowing you to browse, search and favorite community-run servers from in-game.
- Added controller support in its first iteration, with full menu navigation and gameplay support.
- News updates will now appear in a tile carousel on the Main Menu.
- The input system now accounts for action context when resolving input conflicts.
- Improved item container operations performance through better data structures.
- A key binding has been added to open the Asset Editor. By default, this is bound to ‘Alt+B’.
- Added ‘Ctrl+F’ search support for all server-driven custom pages.
- You can now set keybindings to use modifiers on mouse buttons.
- The movement stick dead zone settings for the gamepad may now be set between 5% and 95%.
- Added a ‘Clear Inventory’ button in Creative Mode. Pressing it twice deletes all items in the Inventory, Backpack, equipped slots, and Utility radial menu.
- Weapon tooltips will now display damage data. This initial pass is intended to enable easier comparisons between weapons rather than provide a complete breakdown. Some limitations apply for now.
- The number of collected Memories you have discovered that still need restoring will now be displayed when viewing the Inventory.
- Bug reports may now include videos to help demonstrate the issues experienced. They can currently be added using the ‘Add Screenshots’ button.
- Added a new Bug report category for localization.
- Opting to submit feedback will now open the [Hytale Feature Requests page](https://accounts.hytale.com/suggestions).
- Notifications are now displayed upon creating or deleting an asset pack.
- The asset editor now supports CJK fonts.
- Map markers can now display CJK glyphs when previewed on the map.
- Added missing translations for various validation and verification errors.
- Improved the plural handling for messages regarding mods.
- Item grids, such as the inventory, backpack, creative inventory, and workbench interfaces, will now highlight where the cursor is positioned to make it easier to locate.
- Settings that include sliders will now have their labels update more regularly when dragging the slider.
- Improved the Creative Inventory search sorting.

# **Modding & Creative Tools**

## **Sculpt & Brush Tools**

- Combined the Smooth Brush Tool behavior into the Sculpt Brush Tool. As a result, the Smooth Brush Tool has been removed. The new Sculpt Brush Tool can be found in the Basic Tools section of the Creative Inventory and has an updated UI, legend, localization and defaults that match the combined tool. Changes to this tool include:
  - Smoothing performance has improved by approximately 6x.
  - Sculpt Mode can now be set to either ‘Full3D’, ‘Heightmap’, or ‘Flat’.
  - Sampling can now be set to ‘Normal’, ‘Uniform’, ‘Gaussian’, ‘Neighbor’, or ‘Square’.
  - Erosion Strength can now be adjusted.
  - Existing, nearby blocks can now be set as the material.
  - Fluids in the area can now be set to be fixed, cleared, or ignored.
  - Non-full blocks will be treated as invalid smoothing samples and cleared from the area.
- The previous Sculpt behaviour is available as a deprecated ‘`OldSculpt`’.
- Updated the UI panel used to support creating masks with Brush Tools. Changes include:
  - Brush filters may now be accessed by clicking on an empty slot in a mask block selector.
  - Mask presets may now be saved and loaded.
  - Mask types can now be negated and inverted.
  - Masking commands, such as ‘\>Rock_Stone’ may now be used within the UI panel.
  - Mask information can now be previewed.
  - Mask presets that have been saved with the /gmask command may be used.
- Masking for fluids is now supported and a new brush filter has been added for them.
- Added scripted brush versions of kernel erosion and fluid fixing for node/scripted brush workflows.
- Brush filters will now skip over blocks they could not parse, preventing them from breaking.

## **Paste, Selection & Prefab Tools**

- Added a quick-settings panel for the Paste Tool. This includes controls for preview mode, placement, rotation, flips, offsets, and randomization.
- The Paste Tool can now flip copied selections before pasting using a keybind. This is ‘F’ by default.
- The Selection Tool now has a keybind to switch to the Paste Tool. This is ‘V’ by default.
  - If you have a Paste Tool in your inventory, it will be placed on your hotbar. If your hotbar is full, it will instead swap positions with the Selection Tool.
  - If you don’t have a Paste Tool in your inventory, it will place one in your hotbar. If your hotbar is full, the Selection Tool will instead be overwritten with a Paste Tool.
- Added a ‘/shrink’ command that shrinks the selected area to fit non-air blocks.
- Players can now preview prefabs when using the '/prefab load' command.

## **Entity Tool**

- A number of changes have been made to the Entity Tool:
  - All actions now support undo/redo.
  - A scale option has been added for NPCs in the summon menu.
  - You may now right-click to cycle between overlapping entities under your cursor.
  - When cycling between targets, there is now a highlighted entity preview.
  - You may now hold ‘Shift’ while scrolling to place entities with finer precision.
  - NPCs are now frozen immediately when spawned.
  - Frozen NPCs now automatically play their idle animations.
- The ‘Spawn Entity’ menu now includes a ‘Freeze on Spawn’ checkbox.

## **Node Editor & World-Gen**

- Added a ‘/worldgen 2 create’ command and UI for setting up a WorldGen V2 asset-pack and starter biome for editing. Asset packs created with this command will be enabled by default.
- Added node editor support for macOS and Linux.
  - Note: To launch the node editor on Linux, use the following command:

`NE="$HOME/.var/app/com.hypixel.HytaleLauncher/data/Hytale/install/release/package/game/latest/Client/NodeEditor" && flatpak run --command="$NE/NodeEditor" --socket=x11 --nosocket=wayland --cwd="$NE/" com.hypixel.HytaleLauncher`

- Added world-gen-v1 mod event hooks and asset types for modifying biome content.
- Added Prop, Positions and Prop Distribution asset file support to the Node Editor.
- Exposed the OverrideAllProps property in the Node Editor for WorldGen V2.
- Drop-down menus are now used for enum values in World-Gen V2 nodes.
- The Node Editor will now display 'Skip' options for all nodes that support them.

## **Further Modding & Creative Additions**

- Added the Trigger Volume Tool, allowing you to place 3D volumes that trigger effects.
- Added several new Placement Settings to the Creative Mode Quick Settings.
- Combined the Extrude and Flood Tools into a reworked Extrude Tool.
- Added per-stack name and description overrides for items.
- Added initial tech support to enable falling blocks.
- Added a new `FallingBlockImpact` type: `ExplodeFallingBlockImpact`. This performs an explosion when a falling block configured with it hits another solid block when falling.
- Added `ExplosionConfig` to `BlockType`. This does not make the block explosive on its own, it is used by `ExplodeFallingBlockImpact`, and will be used by other systems in future as a single data point for explosions related to the block.
- Added a `ModelParticle` array and a `SoundEventID` parameter to `ExplosionConfig`, which the Explosive System will now use to perform accompanying effects, instead of relying on ancillary systems.
- Added a new instance: Gym_Arena.
- Added a new NPC: Test_Dummy_Damage. It has 100 Health and is unaffected by knockback.
- Added a Trigger_Volume_Showcase prefab that demonstrates some of the ways the Trigger Volume Tool can be used.
- The instance NPC_Faction_Gym has been removed.
- Instances have now been grouped together into folders.
- Added a ‘Fog’ checkbox to the Creative Mode Quick Settings Menu. This can be used to hide the fog that generates towards the end of your View Distance.
- Moved the setting to increase or decrease the distance that you may place blocks to the Placement Settings section of the Creative Mode Quick Settings.
- Replaced the Environment category reset button from the Creative Mode Quick Settings with a ‘Reset to Defaults’ button.
- When the Creative Mode Quick Setting ‘No Physics’ is enabled, block updates will be suppressed during block placement and breaking. This will prevent neighboring supported blocks from collapsing.
- When the Creative Mode Quick Setting ‘Free Place’ is enabled, placing blocks will now place them adjacent to non-solid blocks such as leaves, rather than overwriting them.
- Even-sized creative brushes are now fully supported.
- Creative Brushes now have Lowest and Highest Origin modes that align the shape’s actual world-Y extremes to the target block.
- Removed the Mirror option in the Paint Brush Tool.
- Prefab rotation shortcuts now rotate clockwise and use orientation for the ‘Shift+R’ rotations.
- Players may now hold down the keys to adjust the movement speed multiplier in Creative Mode.
- Updated a number of keybindings for Creative Tools.
- Warps created by Teleporter blocks are now protected from accidental changes with the ‘/warp set’ and ‘/warp remove’ commands. This can be overridden by adding the ‘--force’ flag to the command.
- Asset packs containing instance configs will now correctly override base game or lower priority pack assets.
- Added interpolation type support for `BlockyAnimation`.
- `ProjectileComponent#getCreatorUuid` has been exposed, allowing plugins to determine the creator of a ProjectileComponent.
- Migrated custom Vector types to JOML equivalents.
- Added a `TextureComputedColor` property to item assets, calculated via a dominant weighted color average of each of the block’s textures.
- Added `PrefabBaseCheck` options to improve the placement of larger prefabs in world-gen v1 by checking additional points around its base to make sure the terrain is suitable.

## **Permissions & Commands**

- Added tab-autocomplete and a suggestion UI for chat commands.
- A permissions system overhaul has taken place, with permissions no longer being tied to gamemode. You can give friends a role based on the permissions you want them to have, instead of having to ‘/op’ them.
- Updated the permissions system to allow inheritance, thread safety, autocomplete, namespacing, and some new commands. All existing commands have been migrated into new permission groups.
- Added the /locate command which can be used to quickly find the coordinates of, or teleport to, specific biomes, zones, regions, and prefabs.
- Added the ‘/knockback’ command for debugging purposes, which can apply a knockback to yourself or an entity being aimed at.
- Added three new ‘/kit’ commands which will each replace your equipment and inventory with a preconfigured kit:
  - ‘/kit adamantite’ provides a full adamantite loadout with weapons, blocks, and food.
  - ‘/kit debug’ provides some armor used for testing purposes and some decorative flags.
  - ‘/kit iron’ provides a full iron loadout with weapons, blocks, and food.
- Updated the ‘/lighting’ command messages.

# **Audio**

- Added over an hour of new music across the Emerald Wilds, Howling Sands, and Whisperfrost Frontiers.
- Implemented a raycasting probe model for reverb and ambience detection. This is a first step towards proper occlusion, diffraction and reverb zone handling.
- Sounds may now play differently depending on whether the player is in first or third person.
  - In first person, held items with ambient loops, such as torches, now play the sound offset to their position.
  - In third person, sounds now play at the player entity position and are thus spatialized in 3D as if they were playing for a remote player.
- Overhauled music handling to utilize more flexible music containers.
- Overhauled the music system. Many file names and their locations have been changed as a result.
- Split music tracks into individual music containers with translated names, laying the groundwork for future functionality.
- Implemented support for music layers.
- Cave music within the Emerald Wilds, Howling Sands, and Whisperfrost Frontiers will now crossfade between layers and environment change instead of swapping entire tracks.
- Implemented the ability to pitch shift for audio and properly decompose audio categories so they can be better used as ducking lanes later. Modders may use this to modulate pitch of running audio by using server-set `AudioStates`.
- Players that you have blocked will now automatically be muted.
- Added an additional glass breaking sound effect to blocks such as potion bottles and the ‘Glowing Royal Magic Potion’.
- Bone blocks now have updated sounds when hit, broken, walked on, and landed on.
- Reeds now play a sound when broken.

# **Naming & Categorization**

## **Grey to Gray Standardization**

- All instances of 'Grey' in block names have been renamed to 'Gray’.
  - This affects Light Grey, Grey, and Dark Grey items.
- Ash Grey, Grey, and Purple Grey hair gradient customization options are now referred to as Ash Gray, Gray, and Purple Gray respectively.
- Dark Grey, Light Grey, and Blue Grey jean fabric customization options are now referred to as Dark Gray, Light Gray, and Blue Gray respectively.

## **Iridescent Processed Brick Renames**

- Iridescent Processed - Decorative is now referred to as Iridescent Processed Brick - Decorative.
- Iridescent Processed - Ornate is now referred to as Iridescent Processed Brick - Ornate.
- Iridescent Processed Ornate - Corner is now referred to as Iridescent Processed Brick - Ornate Corner.
- Iridescent Processed Ornate - Half Slab is now referred to as Iridescent Processed Brick - Ornate Half Slab.
- Iridescent Processed Ornate - Horizontal is now referred to as Iridescent Processed Brick - Ornate Horizontal.
- Iridescent Processed Ornate - Stairs is now referred to as Iridescent Processed Brick - Ornate Stairs.

## **Wild Wisteria Renames**

- Wisteria Tree Trunk is now referred to as Wild Wisteria Tree Trunk.
- Wisteria Roots is now referred to as Wild Wisteria Roots.
- Wisteria Branch - Corner is now referred to as Wild Wisteria Branch - Corner.
- Wisteria Branch - Long is now referred to as Wild Wisteria Branch - Long.
- Wisteria Branch - Short is now referred to as Wild Wisteria Branch - Short.

## **Instance Renames**

- The instance Movement_Gym has been renamed Gym_Movement.
- The instance NPC_Gym has been renamed Gym_NPC.

## **Other Renames**

- Aqua - Beam is now referred to as Aqua Stone - Beam.
- Aqua - Stairs is now referred to as Aqua Stone - Stairs.
- Aqua - Half Slab is now referred to as Aqua Stone - Half Slab.
- Volcanic - Stairs is now referred to as Volcanic Stone - Stairs.
- Black Build Pipe Corner is now referred to as Black Build Pipe - Corner.
- White Build Pipe Corner is now referred to as White Build Pipe - Corner.
- Snow Brick - Half Slab is now referred to as Snow - Half Slab.
- The shorter Apple Branch is now referred to as Apple Branch - Short.
- The longer Apple Branch is now referred to as Apple Branch - Long.
- The big Wet Fern is now referred to as Big Wet Fern.
- The darker Green Clay - Smooth block is now referred to as Dark Green Clay - Smooth.
- Wooden - Fence is now referred to as Wooden Fence.
- The Stone Brazier is now referred to as an Earth Brazier.
- The Common Pink Flower is now referred to as Pink Pitcher Flower.
- Lava Shellfish are now referred to as Lava Coelacanths.
- The Localization report category has been renamed Translation.

# **Backend & Performance**

- Reworked player movement to use a Hierarchical Finite State Machine.

- Improved upon back-end systems to support further localization.

- Improved upon numerous back-end systems to enhance performance.

  - Void maps in particular will experience improved performance in this update.

    # **Localization**

- Added Simplified Chinese as an in-game language, with Dutch, Finnish, Italian and Norwegian translations available via [Crowdin](https://crowdin.com/project/hytale-game).

# **Bug Fixes**

## **Avatar & Customization Fixes**

- Flat Styled & Wedge Shoes will now render correctly with socks.
- Shaped Sneakers, Punk Skirt, and Plaid Skirt will now render correctly.

## **Movement Fixes**

- Sprinting and scrolling will now work on macOS.
- Players can now correctly climb onto blocks such as the Simple Wooden Bed and the Farmer’s Workbench.
- Players will no longer be forced out of togglable input actions such as walking, crouching, or sprinting when changing elevation.
- Rolling will again be possible for the entire intended roll duration, and play the corresponding sound.
- Sliding will again be possible upon exiting rolling.
- Sprinting will now end immediately once Stamina has depleted.
- Sprinting will now scale properly with Creative Mode’s move speed setting.
- Items may now be dropped while sprinting.
- Falling through non-solid blocks that slow the player will now correctly impact velocity.
- Stepping from a block with non-default friction onto an entity with a solid hitbox will no longer cause the player to slide about.
- Travelling very short distances with Signature Abilities will no longer result in an unexpected amount of fall damage.

## **NPC Fixes**

- Fixed a crash that could occur under specific circumstances with NPC movement.
- Fixed a crash that could occur when an NPC gets untracked in an unloaded chunk.
- Fixed a crash that could occur when NPCs were spawning near walls or obstacles.
- NPCs submerged underwater will no longer be locked in place.
- NPCs will now correctly hold their configured main or off-hand item.
- NPCs will now animate correctly when strafing.
- Predators, such as Wolves, will no longer lose momentum while chasing their targets.
- Moose will no longer immediately take notice of players when they join the world.
- Broodmothers will now only spawn Lice when there are none nearby.
- Modded NPCs that use `ActionSpawn` will now use corrected aiming logic and launch NPCs far more accurately at targets.
- Entities that breathe air will no longer spawn submerged in liquid.
- Crabs and Lobsters can now breathe in water.
- Skeletons will no longer fall through the floor when emerging from coffins.
- The Bear's hitbox has been modified to include more of its head.
- Encountering Scaraks will now correctly unlock the associated Memories.

## **Combat, Entity & Item Fixes**

- Fixed a crash that could occur when an entity is removed on the same tick its combined inventory was added.
- Fixed a crash that could occur when damage sources have no associated hotbar.
- Fixed a crash that could occur during projectile physics.
- Fixed a crash that could occur with armor with `Equipped` interactions, such as some debug items.
- Items stored in the backpack will no longer lose durability if the world is configured to not have an inventory penalty on death.
- Repair Kits can now be used to repair items stored within the backpack.
- Capture Crates will no longer reset the cooldowns of captured entities.
- When crafting, items will no longer be considered valid components in their own recipe.
- Healing Totems that have been placed will now heal 5 health per second for 10 seconds.
- Block entities now use transform rotation instead of head rotation.
- Entities that cease to exist will no longer emit light.
- Broken Rail Carts no longer qualify for exemption from gravity.
- Wielding an Adamantite Hatchet will no longer prevent Torch placement.
- Blocking with spears will now display the blocking UI.
- The Fishbone Harpoon now throws the correct model.
- Winter Bauble will now be held correctly in the hand.
- The filled Watering Can will now render at the correct scale.
- Fixed the descriptions for Azure Logs, Azure Trunks, Crystalwood Logs, and Crystalwood Trunks.
- Wild Wisteria Sapling descriptions now specify they yield Goldenwood instead of Darkwood.
- Removed references to non-existent item descriptions.

## **Block Rendering Fixes**

- Rotated blocks will now render correctly.
- Multi-axis rotations will now be composed correctly.
- Ores that extrude into another chunk will now render correctly.
- Pipe Corners will now render correctly.
- Yellow Mushroom Mycelium will now render correctly once placed.
- The bottom of Grass blocks will now render correctly.
- Grass textures will now render correctly when being broken.
- Fixed an issue where UVs were not properly computed for blocks with custom models.
- Gray Build Pipe and Gray Build Pipe - Corner will now render more gray.
- Gray Clay - Smooth will no longer occasionally render as cyan.

## **Block Rotation & Rendering Fixes**

- Fixed a number of issues relating to multi-axis block rotation.
- Blocks with Variant rotations set will now flip correctly.
- Block rotation previews will now rotate correctly when using the ‘R’ hotkey.
- Creative Tool previews will now rotate and render correctly.
- Rotating blocks will now preserve UV rotation, preventing textures from rendering incorrectly.

## **Prop Fixes**

- Fixed an issue with Props that could result in inconsistent output.
- Fixed the Rotator Prop rotating individual blocks incorrectly.
- Fixed Prefab Prop filler block defect affecting hit boxes of blocks such as doors.
- Fixed Prefab Prop not placing entities.
- Fixed Queue Prop defect where it places all the child Props.

## **Lighting & Emission Fixes**

- Fixed a crash that could occur with chunk lighting.
- White Build Lightsource now emits light when placed.
- Winter Lights will no longer emit light when turned off.
- Winter Wreath will no longer emit light when turned off.

## **World & Block Fixes**

- Fixed a crash that could occur when a crafting recipe’s primary output was empty.
- Fixed a crash that could occur on the world thread when a client sent a negative ViewRadius value.
- Implemented changes to prevent a number of ways that concurrent writes could happen with reads from backups.
- Fixed an issue where reconnecting to the same server caused a ‘Player removed from world!’ error.
- Attempting to teleport via the world map without having permission to do so will no longer kick the player from the server.
- Teleporters will no longer hijack or delete Warps that were not associated with them.
- Fixed spawn-point rotation handling.
- Fixed a number of bugs that would prevent trees from transitioning into their next growth stage.
- Workbenches may now be upgraded multiple times without needing to close and reopen the UI.
- Players will now receive an error message when attempting to claim a bed that has already been claimed.
- Fixed an issue where modifications to block hitboxes could leave behind invisible collision and ghost outlines in existing worlds. This affected many Fishing Trap blocks placed prior to Update 4. Any existing invisible collision and ghost outlines can be removed by punching or interacting with them.
- The Stained Windows block (Prototype_Window_Single) has been labeled as a Developer item and will no longer appear in the Creative Inventory. This block will not be removed from worlds it has already been placed in.
- The Wall Poster and Small Wall Poster now have placement rules requiring them to be placed against solid blocks.
- The Kweebec Wardrobe placement rules now match those of other wardrobes.
- The Feran Platform placement rules now match those of other platforms.
- Lost Civilization Bed now requires six blocks of support, like other beds of that size.
- Scarecrow hitboxes have been reduced in size to prevent them from breaking when crops grow.
- Standardized the hitboxes of Orchids.
- Lanterns now require a tool or fist to break.
- Coffins that have been opened now require a tool or fist to break.
- Furnaces will no longer expel their contents and move away upon being sprayed by a Watering Can.
- Ore will no longer occasionally attempt a daring escape upwards through neighbouring blocks when freed. It now drops politely, as intended.
- Redwood blocks will now drop the correct items when broken.
- Sandylion now drops White Petals rather than Red Petals when broken.
- Shale Gravel and Marble Gravel can now be crafted at Farmer’s Workbench.
- Orange Clay Cobble - Stairs and Raw Clay Brick - Stairs can no longer be crafted at a Builder’s Workbench.
- Half slabs no longer cause an unexpected delay when placed.
- Larger prefabs will now spawn on more level ground to prevent floating structures.
- Removed a floating block from the Forgotten Temple.
- Bronze, Copper, Gold, and Zinc Pipe - Large Corner blocks will now be rotated correctly when placed.
- Winter Garland no longer incorrectly displays an interact option.
- Modern Cloth Roof Corner blocks will no longer appear inverted.
- Lighting no longer applies incorrectly to blocks with tint masks.
- Dark Temple Wardrobe has had its block breaking particles changed for better visibility.
- New Exploration worlds generated by the portal in the Crossroads will now be named correctly.

## **Entity Tool Fixes**

- Entity hitboxes now correctly match the model when rotated with the Entity Tool.
- Fixed an issue where block entities could not be pitched or rolled.
- Fixed an issue where block entities sometimes wouldn't render correctly when loaded with the Entity Tool.
- Entities that the Entity Tool interacts with will no longer despawn.
- Reloading an asset pack will no longer cause all item and block entities to be reset to 1.0 scaling.
- Changing collision hitboxes of entities with the Entity Tool no longer requires you to switch to the none option first.
- Item entities placed by the Entity Tool will show the pickup hint interaction again.
- Item entities placed with the Entity Tool can no longer be picked up by walking over them.
- Updated the Entity Tool legend to remove an incorrect hotkey.

## **Node Editor, Asset Editor & Asset Pack Fixes**

- Fixed a crash that could occur when pasting numbers into the Asset Editor.
- Fixed an exception that could occur when unregistering asset packs that do not have the NPC folder.
- Asset packs may now be deleted from the Editor UI.
- Fixed an issue with the serialization of generic nodes with the Node Editor.
- The Node Editor will no longer add incorrect metadata causing validation failures.
- Fixed an issue causing models and cubes to render incorrectly within the Asset Editor.
- Fixed an issue where ‘Missing Required Mods’ could be displayed incorrectly.

## **Command Fixes**

- Fixed an exception error that would occur with the ‘/pedit’ command if the previous world was the Creative Hub.
- The ‘/spawn’ command will now spawn entities at the correct height.
- The ‘/undo’ command will now correctly return the selection box to its previous location.
- The ‘/replace’ command will now mask non-empty blocks by default when no ‘from’ value is given.
- The ‘/submerge’ command can now unsubmerge blocks.
- The ‘/gmask load’ command will now work correctly when loading a mask preset.
- The ‘pos1/pos2’ commands will no longer incorrectly move selection boxes.

## **Paste & Selection Tool Fixes**

- The Paste Tool will now only paste one prefab if the right mouse button is held down.
- Non-solid blocks such as leaves can now be targeted again after using the Paste Tool.
- Fixed the ‘/viewport’ command for selection regions.

## **Further Modding & Creative Fixes**

- Fixed a crash that could occur when sprinting in Creative Mode with a speed multiplier of zero.
- Fixed a crash that could occur when updating versions with Creative Tools.
- Fixed a crash that could occur when hot-reloading asset packs.
- Fixed a crash that could occur when pressing specific hot keys with the Selection Tool.
- Fixed a crash that could occur with empty blocksets.
- Fixed an issue relating to the ‘missing or invalid manifest.json’ error that could occur with JAR-based plugin asset packs.
- Fixed map overflows that could be caused with Creative Tools.
- Reconnecting after going through a portal will now take players to the last world visited, instead of the Crossroads.
- Creative Hub instances will now be deleted when leaving the instance.
- Creative Worlds will now adhere to the world creation settings.
- The Fly Camera can once again only be activated in Creative Mode.
- Copying and pasting an `ItemContainer`, like a chest, will now correctly place any copied items in the pasted block instead of dropping them to the ground.
- Undoing a pasted spawn marker now properly removes any NPCs they spawned.
- Entities spawned via the Spawn Entity menu will now spawn at the specific scale value set.
- Fixed arbitrary rotation of entity selections with no blocks in them.
- Fixed rotation gimbal not working correctly with roll.
- Prefab .lpf files from zip assets will now load correctly.
- Builder Tools will now correctly be able to select the targeted material when the brush dimensions are at even values.
- Left-clicking with Builder Tools other than the Paint Tool will no longer set the selected material to Air.
- The Tint Tool’s opacity setting will now act like opacity rather than transparency.
- Changed density minimums for the Decoration Brush to be 0.
- Empty blocks, which don’t have collisions, may now be configured to affect movement.
- Fixed an issue relating to the Weighted Material Provider producing non-deterministic random output.
- Fixed an issue relating to the Density Prop bounds causing output to be cut off in some situations.
- Fixed the Rotator Density producing broken output.
- Fixed `ListPositionProvider` corruption when used as a child of `ScalerPositionProvider` or `OffsetPositionProvider`.
- Fixed `DistanceToBiomeEdgeDensity` context not being passed to gradient nodes when using the `TerrainDensity` in the biome’s `MaterialProvider`.
- Fixed an issue in WorldGen V2 preventing multiple Assigned `PropDistributions` from being chained.
- Fixed the `TriangularGrid2d` `PositionProvider` in WorldGen V2 so positions are no longer dropped at chunk boundaries, restoring expected output for Props and `PositionCellNoise` cells.
- Fixed the `PositionsPinch` and `Twist` Density nodes creating artifacts when overlapping in WorldGen V2.
- Fixed entity placement and rotation in the Prefab Prop in WorldGen V2, addressing cases where entities would fail to place or be misaligned when their Prop was rotated.
- Fixed several issues that could occur when hot-reloading assets in the `HytaleGenerator/Props`, `HytaleGenerator/PropDistributions`, `HytaleGenerator/PositionProviders`, and `HytaleGenerator/WorldStructures` folders.
- The ‘Pause Time’ checkbox in the Creative Mode Quick Settings will now be toggleable. Note that this pauses the client’s local time and does not control the world server time.
- The ‘Show Tool Notifications’ Creative Mode Quick Setting will now show notifications correctly.
- The Machinima Tool’s playback speed field will no longer immediately resnap back to 60.
- Gamemode side effects, such as adjusting lighting, will now wait until the server confirms you have permission. This prevents screen flickering from occurring when some commands are used.
- Previews will no longer render incorrectly for fluids.
- Added a fallback for model animations if none are available elsewhere.
- Fixed the hotbar container not correctly initializing with an index of 0.
- Fixed a number of community-reported issues related to lang key and UI errors.
- Fixed a number of notifications for Creative Tools.

## **UI & Display Fixes**

- Fixed a crash when changing worlds while interacting with the world map.
- Fixed a crash when selecting the ‘Return to Crossroads’ button in Creative Play.
- Fixed a crash that could be caused by an invalid change in `ActionInventory`.
- Fixed a crash that could occur when running a command without arguments.
- Fixed a crash that could occur when particular messages are received from the server.
- Fixed a crash that could occur with the Back button.
- Fixed a crash that could occur with mousewheel navigation.
- Fixed a crash that could occur when drawing progress bars.
- Fixed a crash that could occur on the Main Menu.
- Fixed a crash that could occur within the Bug Reporting interface.
- Fixed a crash that could occur with map markers.
- Fixed a memory leak in the Loading Screen UI.
- Fixed a memory leak related to certain UI elements.
- Removed per-frame allocations in interaction tick and entity UI animations to improve performance.
- Fixed an issue where the game could stutter when entering the audio menu in singleplayer.
- Fixed an issue that could result in the Backpack and its upgrades becoming permanently locked.
- Fixed an issue preventing name changes from being applied on servers.
- Fixed an issue preventing numbers from being entered into specific fields.
- Fixed an issue that could occur when reloading languages whilst ability items are held.
- Fixed double-click false positives that could occur when rapidly clicking across different buttons.
- Fixed an issue where the builder tool legend pages would sometimes not update.
- Fixed a number of inconsistencies with the Prefab load menu.
- The Bug Reporting interface will now correctly count the number of attached files.
- The top navigation bar will now display when accessing the Settings from the Main Menu.
- Fishing Traps now prompt the player to inspect them, rather than harvest them.
- Non-craftable items will no longer display their item IDs in Adventure Mode.
- The UI will no longer suggest that you can tame the corpse of a creature that has just been killed. Sorry, necromancers.
- When a player joins a portal world, the folder name will no longer be included in the message.
- Screen fade effects that occur during world transfers will now continue if the player is kicked from the server during the effect.
- The UI will now correctly pluralize months and years.
- The Stamina bar will no longer sometimes appear to empty when swapping to Creative Mode.
- NPC speakers will no longer display as ‘Unknown’ within the Voice HUD.
- The cursor-locator overlay will no longer display in parts of the Creative Inventory where no item is present.
- Compass marker names will no longer be cropped.
- Map markers now have consistent name size and offset.
- Avatars with taller or wider customization options will now fully render on the Main Menu.
- Item previews within workbenches will now render with the correct texture.
- Builder Tool tooltips will now use the correct background.
- Fixed an issue that could cause the third person camera to temporarily render at the wrong position when the player’s position was adjusted.
- Fixed some clipping issues that could occur when the language is set to Chinese.
- Grass plants will no longer render with dark shading at their base when viewed at a distance.
- Weapon VFX trails will now be positioned correctly.
- When a player dies mid-attack, their weapon will no longer continuously display trail/slash effects.

## **Audio Fixes**

- Fixed an issue where toggling voice chat could disconnect players.
- Voice chat will now play from the listener’s position if the speaker’s position is null.
- Swimming closer to or further away from others will now affect the volume of voice chat.
- Sound events will now wait for the player to exist within the world before playing.
- UI and SFX will now play at the correct volume when the audio output mode is set to Headphone Stereo.
- Volume settings will now be applied to the Selection Tool.
- The sounds that are played upon taking damage and upon dying will no longer overlap.

## **Other Fixes**

- Fixed a crash that could occur with item containers.
- Fixed a crash that could occur when types were set to be null.
- Fixed a crash that could occur with invalid player references.
- Fixed a crash that could occur if no `SettingAsset` JSON was found.
- Fixed an issue that could occur when saving backups.
- Fixed a number of additional crashes.
- Fixed a number of typographical errors.

# **Modders Warnings**

## PRE-RELEASE PART 9

- `HudManager#getCustomHud()` and `HudManager#setCustomHud(PlayerRef, CustomUIHud)` have been removed. Plugins must migrate to the keyed API (`#getCustomHud(key)`, `#addCustomHud(PlayerRef, CustomUIHud)`). Additionally:
  - `CustomUIHud#DEFAULT_KEY` has been removed.
  - The single-argument `CustomUIHud(PlayerRef)` constructor has been removed.
  - `CustomUIHud` now exposes an `#onRemove()` lifecycle hook that subclasses should override to clean up when the HUD layer is torn down.
- `BlockEntity#addForce`, `Velocity#addForce`, `MotionController#addForce`, and `Role#addForce` have all been renamed to `#addVelocity`. `Role#forceVelocity` has been renamed to `#setVelocity`. `MotionController#getForce` has been renamed to `#getExternalVelocity`.

## PRE-RELEASE PART 8

- `LivingEntity#canBreathe` has been removed. Breathing state is now tracked via the new `BreathingComponent` ECS component. Systems that read `#canBreathe` directly must migrate to `BreathingComponent`. To override NPC breathing behaviour, register a handler on the new `BreathingCheckEvent` instead.

- `SpawningContext#WorldChunk` has been removed. The field previously exposed raw chunk data directly on the context; world and chunk data are now passed through as parameters via the chunk store and chunk references. Plugins that accessed `SpawningContext#WorldChunk` must be updated to use the chunk store API.

- `ServerVersion` on plugins and asset packs is no longer a dated string (`YYYY.MM.DD-`). Packs with the old format load as wildcard with a log warning. Authors should declare a range such as `>=0.5.0` `<0.6.0` or `^0.5.0`. Note: `>=0.5.0` does not match `0.5.0-pre.3`.

## PRE-RELEASE PART 7

- `RunCommandEffect` (trigger volume effect) and `CommandInteraction` (item interaction) have been removed, along with `PermissionBypassSender` and the `bypassCommandPermissions` field on `MacroCommandBuilder` / `MacroCommandBase`.
- `DamageResistances` on `EntityEffects` and `ItemArmor` now use `ResistanceModifier` (Flat / Percent) instead of the previous Modifier enum. The old values were applied as `1 \- damageResistance`; the new enum makes the intent explicit.
- Emote assets gain a `HideItemInHand` field. If you author custom emotes that should hide the held item during play, set this on the emote asset.
- `GameplayConfig.Plugin.PortalOrigin.MaxConcurrentFragments` is a new config field (default unchanged from the previous hardcoded value). Server operators who want to raise or lower the portal-origin fragment cap can now do so without a code change.
- `MacroCommand` now supports subcommands. Existing single-action macros continue to work; if you want to compose nested commands inside a macro, the new subcommand structure is available in `MacroCommandBuilder`.
- BuilderTools now exposes a public API for modders to register custom undo actions. If your plugin performs world edits that should integrate with the builder undo stack, register through this API instead of relying on internal hooks.

## PRE-RELEASE PART 6

- `DisplayNameComponent` is now runtime-only and no longer persisted. The persisted component is now `PersistentDisplayName`. If you were setting or reading the `DisplayName` entity-component key on custom NPCs or entities (via JSON prefabs or the ECS API), update to use `PersistentDisplayName` instead. Custom prefabs that still hold a `DisplayName` key will have it promoted automatically on first load, but you should update your assets regardless.
- `InteractionContext#getOwningEntity` has been annotated `@Nullable` to reflect that the method can return null values. If your custom interaction code calls this method without a null check, add one to avoid a potential `NullPointerException`.
- `CollisionResult#getCollisionEntities` has changed from holding `Entity` objects to holding entity refs.
- `EntityContactData#assign` now takes an entity ref instead of an `Entity` object.
- `Player#notifyPickupItem` is now a static method.

## PRE-RELEASE UPDATE 5

- `SwitchActiveSlotEvent` has been renamed to `InventoryActiveSlotRequestEvent`
- `InventoryChangeEvent` has been moved from `com.hypixel.hytale.server.core.inventory` to `com.hypixel.hytale.server.core.event.events.ecs`.
- `InventoryUtils#setActiveHotbarSlot`, `#setActiveUtilitySlot`, and `#setActiveToolSlot` helper methods have been removed. Use `#setActiveSlot(byte, Ref, ComponentAccessor)` or `#setActiveSlot(byte, Holder, ComponentAccessor)` directly on the respective `ActiveSlotInventoryComponent` subtype instead.
- `ApplyEntityEffectEffect` and `RemoveEntityEffectEffect` have been merged into a single `EntityEffectEffect` class with a `Mode` enum (APPLY / REMOVE). If you were registering or referencing either of the old classes, update to use `EntityEffectEffect` with the appropriate mode.
- `EntitySpawnPage` no longer adds a `HeadRotation` component to block entities during spawn or preview. If you were reading `HeadRotation` from a block entity expecting it to be present, it will no longer be set.
- `PlaceBlockInteraction#TEMP_MAX_ADVENTURE_PLACEMENT_RANGE_SQUARED` has been removed in favor of the centralized `InteractionValidation#getPlayerInteractionDistanceSq` logic. If you were referencing this constant for distance checks, use `InteractionValidation` instead.
- `BiomeAsset#setBiomeName` and `BiomeAsset#copy` have been removed.
- `BasicWorldStructureAsset#setDefaultBiomeId` and `BasicWorldStructureAsset#copy` have been removed
- `AssetPackUtil#exportAsset` signature has changed. The method now accepts a `String` name and a `BsonDocument` asset instead of a typed asset instance. If you were calling this method with a typed asset, serialize it to `BsonDocument` first.
- `BuilderState#extendFace` has been renamed to `#extendOrShrinkFace`. The `radiusAllowed` and `blockId` parameters have been replaced with `extrudeWidth`, `extrudeLength`, and a `BlockPattern`. A boolean `shrink`, `filterMode`, `strategy`, `undoGroupSize`, and `isHoldDown` parameter have also been added. The `min` and `max` region bounds parameters have been removed.
- `BsonUtil#readFromBinaryStream(ByteBuf)` and `BsonUtil#writeToBinaryStream(ByteBuf, BsonDocument)` have been removed.
- `BsonUtil#writeNumber` and `BsonUtil#readNumber` has been moved to `MemorySegmentUtil`.

## PRE-RELEASE UPDATE 4

- `SpawnDeployableAtHitLocationInteraction` Deployer entity source changed from the spawned projectile to the player. If you were explicitly reading `DeployableComponent#getOwnerUUID()` and comparing it against a projectile UUID, you will need to update that comparison to compare against the player UUID instead.
- `LivingEntity#isEquipmentNetworkOutdated()` related logic has been removed in favor of `SyncEquipmentSystem` which will detect equipment changes automatically
- `AbstractCommand#setPermissionGroup(GameMode)` has been deprecated and marked for removal, use `AbstractCommand#setPermissionGroups(String...)` instead.
- `AssetModule#registerPack` now requires providing a `PackSource` instead of a `boolean` parameter
- `PluginBase#setup0()`, `#start0()`, `#shutdown0()` methods marked as `final`
- `PlayerMouseButtonEvent` and `PlayerMouseMotionEvent` `#getTargetEntity()` method has been renamed to `#getTargetEntityRef()` and now returns the target entity reference

## PRE-RELEASE UPDATE 3

- `InteractionManager` constructor no longer accepts a `LivingEntity` parameter
- `Operation#tick` and `Operation#simulateTick` no longer accept a `LivingEntity` parameter
- Marked `Inventory#getActiveHotbarItem()`, `getUtilityItem()`, `getActiveHotbarSlot()`, `getActiveUtilitySlot()` and `moveItem()` for removal, their equivalents are on the individual `InventoryComponent` sub-components or in the new `InventoryUtils` class
- The `Music` field on `AmbienceFX` JSON configs has been deprecated in favor of the new `MusicContainer` reference field. Legacy `Music` definitions are auto-migrated at runtime but should be transitioned to `MusicContainer` assets as this gives much more flexibility and provides many new features
- A new `MusicContainer` asset type has been added under `Server/Audio/MusicContainers/` with four subtypes: `SingleTrack`, `Random`, `Sequence`, and `Horizontal`

## PRE-RELEASE UPDATE 1 & 2

- Player no longer implements `CommandSender` and `PermissionHolder`, use `PlayerRef` instead
- `com.hypixel.hytale.math.matrix.Matrix4d` has been removed in favor of `org.joml.Matrix4d`
- Deprecated `ShutdownReason#withMessage(String)` method has been removed in favor of `ShutdownReason#withMessage(Message)`
- Renamed `CommandSender#getDisplayName()` to `CommandSender#getUsername()`
- `Universe#getPlayers()` now returns a Collection type instead of List
- `HudManager#setCustomHud` has been deprecated in favor of `HudManager#addCustomHud`/`HudManager#removeCustomHud` with string key and z-order support

# WHAT'S NEXT

With the rapid progress we've been making over the past few weeks, the foundation is getting stronger, which means more and more of us can focus on new content for the future of the game. Now that more of us are working on Chapter 1, there's a lot of exciting things coming up. We'll be sure to share more in the coming weeks and months!

Make sure to tag us on [X/Twitter](https://x.com/Hytale) with **\#Hytale** when you build something with the Trigger Volume Tool. We genuinely think this tool is going to be one of the easiest ways for new people to get into modding, anyone can learn it, and we expect to see guides and tutorials pop up quickly. Spend a day with it and you'll be making adventure maps, mini-games, and a lot more. It's going to be a lot of fun.

And if you hit issues, file them through the [feedback form](https://hytale.com/suggestions) or the in-game bug report. The next pre-release window will open soon!

To download a .ZIP of the media in this post, [click here!](https://cdn.hytale.com/3b23450f-abcc-446d-afb9-e6b9243c3988-Hytale-Update_5_Assets.zip)
