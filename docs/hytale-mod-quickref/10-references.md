# 10 — References & How to Download/Refresh These Docs

*Every external source behind this folder, what each is good for, and concrete commands to pull fresh copies locally.*

---

## The sources, ranked by usefulness

### Tier 1 — read the actual API

| Source | What it is | Best for |
|---|---|---|
| **`_mod-example-sourcecode/HyCitizens` + `_mod-example-sourcecode/NPCTrading`** | Real plugin source synced by `tools/refs/example-mods/sync-example-mod-repos.js` | The most concrete example API surface — *how working code calls the engine*. The ✅ tags in these docs are anchored here or in sibling Synthborn repos. |
| [Hytale-Server-Unpacked](https://github.com/Ranork/Hytale-Server-Unpacked) | Decompiled server source, "shared as a reference only, to allow reading of public methods" | Looking up real signatures, `builtin.*` implementations (crafting, farming, reputation, npc). Unofficial. |
| [release.server.docs.hytale.com](https://release.server.docs.hytale.com/) | Official Javadoc (version `2026.05.01-43e16373b46`) | Authoritative package/class/method index. Has Tree view, full index, search. |

### Tier 2 — official narrative docs

| Source | Best for |
|---|---|
| [NPC Technical Rundown](https://hytale.com/news/2026/2/npc-technical-rundown) | Roles, instruction lists, sensors/actions/motions, combat evaluator, debug flags |
| [Modding Strategy & Status](https://hytale.com/news/2025/11/hytale-modding-strategy-and-status) | The 4 categories, server-first model, limitations, roadmap |
| [Hytale Server Manual](https://support.hytale.com/hc/en-us/articles/45326769420827-Hytale-Server-Manual) | Hosting/auth/platform APIs (server *operators*, not plugin authors) |

### Tier 3 — community docs (accurate but may drift) 🌐

| Source | Best for |
|---|---|
| [hytale-docs.pages.dev](https://hytale-docs.pages.dev/) | The most fetchable structured reference: [plugins](https://hytale-docs.pages.dev/modding/plugins/plugin-system/), [events](https://hytale-docs.pages.dev/modding/plugins/events/), [ECS](https://hytale-docs.pages.dev/modding/ecs/), [NPC AI](https://hytale-docs.pages.dev/modding/npc-ai/), [inventory](https://hytale-docs.pages.dev/modding/content/inventory/) |
| [hytalemodding.dev/docs](https://hytalemodding.dev/docs) | Official NPC tutorial series is hosted here (Quick Start, Server Plugins, ECS, NPC Inner Workings). ⚠️ Cloudflare-protected — blocks automated fetch; open in a browser. |
| [NPC Builder](https://npc.hytalemodding.dev/) | Visual builder for NPC roles/instruction lists |
| [hytalecharts.com NPC framework guide](https://hytalecharts.com/news/hytale-npc-framework-behaviors-ai-modding-guide) | Plain-language element-category breakdown |
| [Inventory & Items (unofficial)](https://hytale-docs.pages.dev/modding/content/inventory/) | ItemStack/ItemContainer/Inventory API |

### Background (transferable design, not Hytale API)

- [Erenshor Simulated Players wiki](https://erenshor.wiki.gg/wiki/Simulated_Players) — living-NPC design without LLMs
- [Stanford Generative Agents](https://dl.acm.org/doi/fullHtml/10.1145/3586183.3606763) — memory→reflection→planning architecture
- Research bank: [`../research-bank/research-behavior-trees.md`](../research-bank/research-behavior-trees.md), [`../research-bank/research-advanced-npc-techniques.md`](../research-bank/research-advanced-npc-techniques.md), [`../research-bank/research-erenshor-npcs.md`](../research-bank/research-erenshor-npcs.md)

---

## How to download / refresh locally

### 1. Decompiled API source (best single download)

```powershell
# Clone the decompiled reference next to this repo (NOT inside it — keep it out of version control).
cd C:\Users\ccnef\git
git clone https://github.com/Ranork/Hytale-Server-Unpacked.git
# Then browse/grep com/hypixel/hytale for real signatures, e.g.:
#   Select-String -Path .\Hytale-Server-Unpacked\com\hypixel\hytale\server\npc\*.java -Pattern "spawnEntity"
```

This is the highest-leverage refresh: it's the actual public method surface. Re-pull it when the official source release lands (roadmap: ~1–2 months post-launch).

### 2. Mirror the official Javadoc for offline reading

```powershell
# wget (install via: winget install JernejSimoncic.Wget) — mirror the Javadoc site:
wget --mirror --convert-links --adjust-extension --page-requisites --no-parent `
     -P C:\Users\ccnef\hytale-javadoc https://release.server.docs.hytale.com/
# or HTTrack (winget install HTTrack.WinHTTrack) for a friendlier offline copy.
```

(Javadoc is static HTML, so a mirror works well. The community sites use bot protection and won't mirror cleanly.)

### 3. Save the official posts as PDF/markdown

The two hytale.com posts are stable narrative references — print-to-PDF from a browser, or their content is already distilled into [01-modding-overview.md](./01-modding-overview.md) and [05-npc-roles-and-ai.md](./05-npc-roles-and-ai.md).

### 4. Re-generate these curated docs

These files were synthesized by fetching the sources above and cross-checking against the repo source. To refresh: re-fetch the Tier-1/2 links, re-grep the repo plugins, and update the ✅ sections from any changed call sites. The ✅ (verified-in-repo) material is the part worth trusting longest.

---

## Maintenance reality check 📘

Hypixel says creator docs are incomplete and the full server source is still pending. So:

- **No single official "full plugin API reference" exists yet.** The Javadoc + decompiled source are the closest.
- Treat community docs as a fast on-ramp, the decompiled source as truth.
- The 🌐-tagged details in this folder are the ones most likely to drift; the ✅-tagged details are anchored to compiling code.

When the official source release ships, the right move is to delete the guesswork and **read the source directly** — these docs become the curated index into it, not a substitute.
