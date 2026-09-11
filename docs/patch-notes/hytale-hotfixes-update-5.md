# HOTFIXES: UPDATE 5

**Source:** <https://hytale.com/news/2026/5/hotfixes-update-5>  
**Author:** Hytale Team  
**Published:** May 27, 2026  
**Local capture:** Mon, 07 Sep 2026 16:35:49 GMT  
**Ported from:** hytale.com article HTML via `tools/refs/patch-notes/port-hytale-post.js`

# UPDATE 5: HOTFIXES

## 0.5.7

**July 22, 2026**

A security researcher privately reported a flaw in the way the client handled image files (PNGs) that a server sends to your game. On an affected client, a malicious or compromised server could send a specially crafted image that the client mishandled while loading it, and in the worst case use it to run code on the player's computer. It only affected people who connected to a server set up to abuse it, after a thorough investigation we have found no evidence it was ever used against players. The fix for this issue was shipped the same day it was reported.

While we were in there fixing this report, our team made several additional passes over the surrounding image, texture, and media loading code to further harden underlying systems and implementations.

> The researcher, **0x90**, wrote up the full technical details here: [How a PNG became a \$20,000 Hytale RCE](https://0x90.sh/threads/how-a-png-became-a-20-000-hytale-rce.57/). We awarded a \$20,000 bounty for this great find and disclosure.

We take security seriously, and reports like this one are exactly why. If you find a vulnerability in Hytale, we want to hear about it. Our Vulnerability Disclosure Program details can be found at [hytale.com/security](https://hytale.com/security).

## 0.5.6

**June 17th, 2026**

- Fixed a world crash that could occur when an entity was removed while the entity culling system was running.
- Fixed saving a Trigger Volume effect preset writing into the base game asset pack, which would break asset patching in the launcher.
- Fixed collision and repulsion settings being swapped on saved entities after updating to 0.5.5, which could cause players to get stuck inside each other.

The technical guts of the collision problem

This one was a genuine ghost in the machine. The bug had been sitting quietly in code from 2021, almost five years, and it only woke up when we fixed something completely unrelated.

**What broke.** After updating to 0.5.5, some servers saw player collision flip to hard collision, so players could get stuck inside each other or shove one another around. The same root cause could also load placed entities and props with Hard and Soft collision swapped, or the Default and Minigames repulsion fields swapped.

**The root cause.** The HitboxCollision component (and Repulsion) was saving the runtime asset index instead of the asset's name. That index is just the slot an asset lands in when the server loads its assets, not a stable identifier. The only reason this worked in the past is that assets load in a semi-deterministic order based on the file system, so the index happened to come out the same every time.

**What woke it up.** A separate fix in 0.5.5 corrected the order assets load in (an unrelated asset-inheritance bug). That shifted the asset indexes, so the numbers saved in older worlds suddenly pointed at different configs, and Hard/Soft and Default/Minigames traded places. The fun part: a five-year-old bug stayed completely invisible until we fixed a different bug that happened to disturb it.

**The fix.** Entities now save the asset's stable name instead of its index. On load, 0.5.6 reads the old saved index, maps it back to the config it originally meant, and re-saves using the name. We could do this safely because the base game ships these assets in a fixed, reproducible order, so we knew exactly what each old index referred to. From here on the index is always derived from the name, so it cannot drift again.

**For server owners.** Almost every world corrects itself with no action needed. There are two cases to watch for. First, the automatic mapping only covers the base game's collision and repulsion configs; if you ship your own custom collision or repulsion assets, entities that referenced those may not map cleanly and can load without that setting. Second, entities created during the short window when 0.5.5 was live, before 0.5.6, were saved under the new ordering and cannot be told apart from older data, so a small number may still load with a swapped setting. You will need to re-apply the entity's collision or repulsion with the entity editor tools and it will be corrected permanently. No world data is lost.

Thanks to everyone who reported this and helped us track it down.

## 0.5.5

**June 16th, 2026**

- Fixed a world crash that could occur when an entity spawned with an invalid orientation.

- Fixed a world crash that could occur when deploying a Healing Totem rapidly across portal worlds.

- Fixed a server crash that could occur when multiple players connected at the same time.

- Fixed a crash when summoning a portal device into a newly created world whose spawn area had not finished loading.

- Fixed a world crash that could occur when a spawn beacon triggered while its NPC was still loading.

- Fixed a crash that could occur when spawning NPCs using the /spawn command.

- World generation now falls back safely instead of crashing the world when a world-structure asset fails to load.

- Fixed the Sculpt tool crashing the world when flood-filling fluids at the maximum build height.

- Fixed a client crash that could occur when moving the mouse during a world transition.

- Fixed a client crash that could occur when reconnecting while the interface was being torn down.

- Fixed a client crash that could occur when editing multi-line text fields.

- Fixed a client crash caused by out-of-range block or fluid IDs while building chunk lighting.

- Fixed a client crash caused by out-of-range block IDs during audio calculations.

- Fixed inventory interface crashes that could occur when a server inventory update arrived mid-interaction.

- Fixed a client crash that could occur when near a container holding an item with zero durability.

- Hardened the server against malformed crafting and inventory packets that could be used to crash it.

- The client now recovers from a corrupted Settings.json by restoring from a backup instead of failing to start.

- Fixed excessive error logging that could occur when the server failed early in startup while plugins were still loading.

- Fixed entities sometimes losing state such as knockback and active effects when they changed during play.

- Fixed several server errors that could occur while loading certain assets.

- A single duplicate translation key no longer breaks an entire language file.

- Fixed gravity-affected blocks such as sand not falling.

- Fixed your character being rendered at the wrong angle when riding a mount block placed on its side.

- Fixed the rolling animation occasionally getting stuck playing.

- Sprint and other toggle controls no longer flip while game input is disabled, such as while a menu is open.

- Players can no longer trigger an instance teleport while dead.

- Players now get out of bed after a night skip completes.

- Emotes now cancel when you use a primary or secondary item action.

- Fixed your character always facing north after teleporting using the world map.

- Death markers now appear on the world map no matter how far away you died.

- NPC and mount interactions now check your distance to the target, preventing modified clients from interacting from impossible ranges.

- Chickens and skrills now drop produce such as eggs again.

- Eternal Corn crops now yield twice as much Corn. Farmers should now receive 2-4 instead of 1-2.

- Breaking newly-planted Aubergines and Lettuce will now return their seeds.

- Cooled Magma can now be used as an input in the Builder's Workbench.

- Fixed certain crafting recipes whose item is its own output.

- Fixed Trork Hunters without a wolf companion getting stuck in a combat loop.

- Tamed Mosshorns are now attracted by the Feed Bag.

- Fixed sand dungeon Skeleton variants not providing the correct Memories.

- Snowy Fir Leaves and the Feed Bag can now be rotated to face you when placed.

- Items picked up after being placed with the Entity tool now keep their animations when dropped again.

- Fixed several model and texture issues, including doors and the tavern chest clipping through geometry.

- Fixed the textures and display on the Clay Raw Brick half block and Ornate Stone Brick.

- Fixed stray red coloring on the Hedera's face.

- Fixed held items clipping into the bodies of remote players and NPCs.

- Fixed some shadows being missing at certain view distances.

- The Brush Sound Volume setting is now correctly applied to all builder tools.

- Fixed right-click dragging double-placing items in storage and the hotbar.

- Pick block now works with the Extrude and Line tools.

- Dragging an item or interface element no longer cancels when the window loses focus.

- Fixed CustomUI text fields capturing keybinds and becoming unusable.

- Fixed display issues in the server list and other interface panels.

- Fixed visual glitches and the favorite star in the Server Discovery menu.

- Fixed layout glitches in the Selection tool with longer translated text.

- The Paste tool now keeps your manual offset after pasting.

- Builder tools no longer show notifications when that setting is turned off.

- The Builder tool brush density can now be set as low as 0.

- The asset editor item preview now respects an item's model override.

- Removed a stray symbol from the Ruler tool's distance label and fixed it sometimes skipping the first point.

- Fixed the Menu input group displaying incorrectly in Controls settings.

- Fixed friends' names occasionally failing to load in the friends list.

- On-screen input prompts now update immediately after rebinding a key or controller button.

- Key bindings now refresh when your keyboard layout changes.

- Fixed some controller-related settings resetting between restarts.

- Screenshot, HUD toggle, and fullscreen now work even when other input is disabled, such as while a menu is open.

- The compass cardinal points (N, E, S, W) are now translatable.

- Fixed some in-game text displaying incorrectly because of quote formatting.

- The Feline eye style in the Avatar Editor now correctly displays as 'Feline' instead of 'Felin'.

- The Plain Jersey overtop now correctly displays as 'Plain Jersey' instead of 'Plain Hoodie', which was colliding with the separate Plain Hoodie cosmetic.

- If a connection is rejected for an invalid access token and your system clock is significantly off, the disconnect message now tells you how far off your clock is and asks you to sync it.

- Fixed reloading a layered asset pack sometimes reverting a customized asset back to the value it inherited from its parent.

## 0.5.4

**June 5th, 2026**

- Fixed renamed cosmetics triggering a confusing "Connection Closed" error that blocked you from joining. The client now repairs your avatar and tells you which cosmetics changed.
- Fixed chests vanishing when one was placed next to a chest that was currently open.
- Fixed tamed NPCs being despawned when several creatures of the same type were nearby.
- Fixed a crash that could occur while players were talking in voice chat.
- Fixed a crash that could occur when placing a fluid with no item in hand.
- Fixed a crash caused by animations configured with an invalid zero-length duration.
- Fixed a performance issue where character stats were recalculated every tick while wearing armour.
- Fixed the idle animation incorrectly playing on death from a fall while wearing armour, instead of the death animation.
- Fixed audio stuttering when the selected output device is unavailable; it now falls back to the system default cleanly.
- Fixed the fullscreen toggle getting stuck rapidly switching in and out of fullscreen.
- Trigger volumes now spawn correctly in prefabs in worldgen v2.
- Fixed the `/worldgen reload` command not removing existing trigger volumes when regenerating.

## 0.5.3

**May 29th, 2026**

- Sprinting is now preserved when crouch-sliding, instead of dropping back to a walk.
- Fixed the sprint input not resetting correctly when coming to a stop.
- Rolling on landing now correctly reduces fall damage.
- Fixed a deadlock that could occur when inviting a friend to a singleplayer world.
- Fixed a memory leak that could occur after leaving a world.
- Fixed a rare race condition that could result in incorrect block lighting.
- Long server descriptions can now be scrolled in the server details menu.
- Fixed the Friends list scroll getting stuck when the list is long.
- Fixed a confusing mod compatibility warning shown for mods that target a bare version.
- Fixed WorldStructure assets not reloading correctly.

## 0.5.2

**May 27th, 2026**

- Social bar will no longer get stuck in a jittering/flickering state.
- Updated javadocs to generate with SemVer.
- Fixed ambience volume slider.
- Fixed empty blocks in block filters - fixes empty masking and several scripted brushes in creative mode.
- Fixed a client crash when right-clicking non-interactable blocks with a Secondary unarmed interaction configured.
- Server addresses are now hidden by default. (if you haven't booted the client with any 0.5.x versions)
- Server and client now use protocol version for server discovery, rather than the server version.
- Fixed a bug when attempting to spawn a player or NPC in a world that contains void sections.

## 0.5.1

**May 26th, 2026**

- Fixed an issue that would cause the server to not boot on a malformed ServerVersion.
