# HOTFIXES: UPDATE 6

**Source:** <https://hytale.com/news/2026/8/hotfixes-update-6>  
**Author:** Hytale Team  
**Published:** August 27, 2026  
**Local capture:** Thu, 10 Sep 2026 19:39:05 GMT
**Ported from:** hytale.com article HTML via `tools/refs/patch-notes/port-hytale-post.js`

# UPDATE 6: HOTFIXES

# 0.6.5

**Sep 10, 2026**

#### Stability Fixes

- Fixed a client memory leak that accumulated when joining worlds or switching instances.
- Fixed a server memory leak where unloaded worlds could stay in memory after their world maps were generated.
- Fixed a crash when leaving a world with a machinima scene loaded.

#### UI & Quality of Life Fixes

- Social features now recover after connection timeouts at startup, instead of leaving the friends list and invitations unavailable.
- Fixed the social sidebar failing to appear or open when social features become available partway through a session.

#### Item & Visual Fixes

- Lifting a block no longer triggers its block-breaking effects, such as explosions.
- Timed visual effects no longer expire while a singleplayer world is paused.
- Held items now keep their movement animations when their appearance changes.

#### Creative Tool Fixes

- Trigger volumes signalled by NPCs now fire their effects once instead of twice.
- Trigger volumes configured to target a projectile’s shooter now correctly find the shooter instead of targeting the projectile itself.

#### Server & Security Fixes

- Server bans now apply to asset editor connections. Kicking or banning a player also closes their active editor connections.

#### Modder-Facing Fixes

- Asset validation no longer risks deleting instance asset folders when unloading a validation world.
- Generated schemas for `Float2ObjectMap` fields now accept scientific-notation keys and correctly reject non-numeric keys.

# 0.6.4

**Sep 7, 2026**

#### Joining & Connecting Fixes

- Improved automatic port forwarding. Router discovery no longer gives up early when other devices on your network are slow to answer, so fewer players should see the "automatic port forwarding is unavailable" message.
- Fixed a case where two PCs on the same network could remove each other's port forward when either opened or joined a world.
- Hosts now keep their connection to the network alive while a world is open. This should help with cases where friends could not rejoin after a disconnect until the host restarted the game.

#### World & Block Fixes

- Entities with block models saved in Update 5 worlds now keep the correct position and scale when the world is upgraded to Update 6.

> Note: This does NOT repair entities that were already upgraded with the wrong position and scale.

#### Creative Tool Fixes

- Rotating a multi-axis block selection with the builder tools now rotates entities with block models correctly.
- Builder tool keys no longer stay bound after you leave a world. The tool you had equipped on exit used to keep its keys in the next world you joined.
- Fixed a crash when you drag an item with no icon onto the entity tool. Items with no icon now show the unknown item icon instead of an empty slot.

#### Audio Fixes

- Ambient world loops stop the moment you leave a world, instead of playing on over the main menu.

#### Stability Fixes

- Fixed a crash when the server sends a fluid update before it has sent every block type. Blocks and fluids after the gap now also get their inventory preview models.
- Fixed a server error when a projectile with an explosion that damages no blocks detonated.
- Fixed a server error when a respawn confirmation arrived after the player had already left.

#### Modder-Facing Fixes

- Fixed the Anchor PropDistribution dropping random parts of props in an 8x8 grid pattern when world generation runs on more than one thread.
- An `ItemGrid` in a custom UI page no longer needs `DefaultItemIcon`. Items whose icon cannot be resolved fall back to the unknown item icon. Set `DefaultItemIcon` to override that placeholder.
- A `ClientTool` now receives `OnActiveStateChange(false)` when the world is torn down while it is active, before the tool is disposed.

# 0.6.3

**Aug 31, 2026**

#### Rendering Fixes

- NPCs cast shadows again. Their shadows also respect the shape of the texture, so transparent parts no longer cast.

#### UI & Quality of Life Fixes

- Further fixes to social avatar profile loading and caching.
- Opening the notification list is faster when you have a lot of pending friend requests.

# 0.6.2

**Aug 27, 2026**

#### Mod Browser Fixes

- Installing a mod now works when you already placed the same file in your Mods folder by hand. If a different file with that name blocks the install, the mod page names the file instead of asking you to check your connection.

#### Stability Fixes

- Fixed a crash on join in worlds with enough mods to overflow the entity texture atlas. Affected NPCs will appear without a texture instead of taking the game down.
- Fixed a crash when you drop the last item of a stack after placing items one at a time.
- Memories collected in your last play session are no longer lost when you exit the game or stop the server.
- Worlds and servers with a view radius above 32 in `config.json` start again. The radius is capped at 32 chunks.

#### UI & Quality of Life Fixes

- Social avatars now load reliably for large friends lists, instead of staying on the default portrait.

# 0.6.1

**Aug 27, 2026**

#### Mod Browser Fixes

- Added functionality when installing a world from the mod browser, press CREATE WORLD, and the new world appears in your world list.
- A world mod makes as many worlds as you want, and each one is a separate copy to play. Removing the mod keeps every world you already made from it.
- Creating a world from a mod asks for confirmation first, because a world can carry mods that run code on your computer.

#### Joining & Connecting Fixes

- Multiplayer sessions now take a direct network path when one is available, instead of running through a VPN adapter or a relay. Latency should improve if you have Hamachi, Radmin, or Teredo installed.
- Joining a host whose router hands out a new port for every destination now works more often, and at a lower ping.
- The Online Play screen now says in plain words whether friends can join, and what to do if they cannot. This replaces the old NAT type label.
- Added a Copy Network Report button to the Online Play screen. It copies a diagnostic report you can paste when you ask for help.

#### Stability Fixes

- Fixed a crash on launch on older NVIDIA graphics cards, including the GeForce 400 to 700 series and their laptop variants.
