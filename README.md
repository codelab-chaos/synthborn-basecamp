# synthborn-basecamp

Welcome to Synthborn Basecamp.

This repo is the warm, rugged stop before you head into the Hytale modding woods.
It is stocked with maps, field guides, reference tools, generated indexes, and
static apps for mod creators working across the Synthborn family. The deployable
mods live in sibling repos. Basecamp is where you get oriented, look up the facts,
and refill your pack before heading back out.

## First-Day Briefing

Use Basecamp when you need shared Hytale knowledge: what API exists, what an item
id means, how something is crafted or obtained, which vanilla prefabs are
available, or where a Synthborn research thread lives.

Head to the sibling mod repos when the work is operational. Deployment, RCON,
server lifecycle, smoke tests, and mod-specific implementation belong with the
mods that ship those jars.

The author's long-form Synthborn origin story is preserved at the bottom:
[What is the Synthborn series?](#what-is-the-synthborn-series)

## Camp Map

- [First-Day Briefing](#first-day-briefing)
- [Trail Board](#trail-board)
- [What Basecamp Provides](#what-basecamp-provides)
- [App Booth](#app-booth)
- [Camp Facilities](#camp-facilities)
- [Field Apps](#field-apps)
- [Common Trailheads](#common-trailheads)
- [Supply Runs](#supply-runs)
- [Guide Library](#guide-library)
- [License](#license)
- [What is the Synthborn series?](#what-is-the-synthborn-series)

## Trail Board

If you are new here, start with the trail board:

- Basecamp is a shared reference camp for Synthborn mod work, not a deployable
  mod.
- `_Assets/` and the pinned Hytale Server jar feed the generated docs, indexes,
  and app data.
- The browser apps make the biggest references easier to inspect: recipes,
  prefabs, and SDK signatures.
- Agents should begin with [`llm.txt`](llm.txt), use the CLIs, and avoid loading
  huge generated files wholesale.
- Basecamp keeps both curated docs and generated data. The curated docs explain
  how to work; the generated indexes answer concrete lookup questions.
- Mirrored external docs and example mod source caches exist for local research,
  but the owning external projects and sibling mod repos remain the sources of
  truth for their own code.
- Operational paths lead back to `../synthborn-kyn/`, `../synthborn-overseer/`,
  and `../synthborn-terrascape/`.

## What Basecamp Provides

| Need | Basecamp provides | Where to start |
|------|-------------------|----------------|
| Hytale mod creator onboarding | Curated server-side modding guide, compact agent KB, official-post ports, and practical API notes. | [`docs/hytale-mod-quickref/`](docs/hytale-mod-quickref/), [`docs/llm-hytale-modding-kb.md`](docs/llm-hytale-modding-kb.md) |
| SDK/API discovery | Generated Hytale Server signatures, package routers, method indexes, search CLI, and SDK Explorer app data. | [`docs/sdk/README.md`](docs/sdk/README.md), `cd tools && npm run sdk:search -- --method placeBlock` |
| Asset-derived lookups | English labels, recipes, loot, bench tiers, tech trees, NPC role metadata, prefab indexes, and asset TOC snapshots. | [`docs/refs/README.md`](docs/refs/README.md) |
| Building and encounter references | Prefab catalog, prefab module analysis, BuilderTools command catalog, console command dump, and Trigger Volume research. | [`docs/refs/prefabs/README.md`](docs/refs/prefabs/README.md), [`docs/synthoverseer-builder-commands.md`](docs/synthoverseer-builder-commands.md), [`docs/hytale-trigger-volumes-update-5-research.md`](docs/hytale-trigger-volumes-update-5-research.md) |
| Synthborn architecture research | Active synth/NPC architecture, durable NPC/LLM/behavior-tree research, archived idea bank, and worldgen studies. | [`docs/hytale-synthetics.md`](docs/hytale-synthetics.md), [`docs/research-bank/README.md`](docs/research-bank/README.md), [`worldgenV2/`](worldgenV2/) |
| Browser inspection | Static apps for recipes, prefabs, SDK cards, and the Basecamp landing page. | [Field Apps](#field-apps) |
| Local reference sources | Optional `_Assets/`, example mod source cache, mirrored external docs, and legacy reference seeds. | [`docs/README.md`](docs/README.md#local-reference-sources) |

## App Booth

The App Booth is the public-facing static site for Basecamp. Every push or merge
to `main` builds all three browser apps in GitHub Actions and deploys the assembled
`_site/` artifact to GitHub Pages. Once Pages is enabled for
`codelab-chaos/synthborn-basecamp`, these are the booth entrances:

| | |
|---|---|
| **[Basecamp Landing](https://codelab-chaos.github.io/synthborn-basecamp/)**<br>Front door for the published Basecamp site: app tiles, docs links, and the first camp map.<br>Source: [`scripts/build-basecamp-index-json.js`](scripts/build-basecamp-index-json.js), [`apps/basecamp/`](apps/basecamp/) | **[Recipe Kiosk](https://codelab-chaos.github.io/synthborn-basecamp/apps/recipe-kiosk/)**<br>Recipe, item, loot-source, craft-tree, reverse-use, and bench-route browser.<br>Source: [`apps/recipe-kiosk/`](apps/recipe-kiosk/) |
| **[Prefab Gallery](https://codelab-chaos.github.io/synthborn-basecamp/apps/prefab-gallery/)**<br>Visual browser for vanilla Hytale prefab previews, metadata, packed voxel data, and preview atlases.<br>Source: [`apps/prefab-gallery/`](apps/prefab-gallery/) | **[SDK Explorer](https://codelab-chaos.github.io/synthborn-basecamp/apps/sdk-explorer/)**<br>Wildcard-search browser over generated Hytale Server SDK markdown cards.<br>Source: [`apps/sdk-explorer/`](apps/sdk-explorer/) |

Build and verify the same static-site artifact locally from the repo root:

```bash
cd tools
npm run pages:build
npm run verify
```

Optional item icons for Recipe Kiosk require local `_Assets/`:

```bash
cd tools
npm run pages:build:icons
```

## Camp Facilities

| Area | Why it exists | Start here |
|------|---------------|------------|
| [`llm.txt`](llm.txt) | Compact route card for agents so context stays focused. | Read before asking an agent to navigate Basecamp. |
| [`docs/`](docs/) | Human-facing docs, generated reference indexes, research, and update checklists. | [`docs/README.md`](docs/README.md) |
| [`docs/sdk/`](docs/sdk/) | Generated Hytale Server API signatures from the pinned Server jar. | [`docs/sdk/README.md`](docs/sdk/README.md), [`docs/sdk/llms.txt`](docs/sdk/llms.txt), [`docs/sdk/methods.txt`](docs/sdk/methods.txt) |
| [`docs/refs/`](docs/refs/) | Asset-derived reference data: labels, recipes, loot, prefabs, and asset snapshots. | [`docs/refs/README.md`](docs/refs/README.md) |
| [`docs/research-bank/`](docs/research-bank/) | Durable NPC, behavior-tree, LLM, and settlement-layout research. | [`docs/research-bank/README.md`](docs/research-bank/README.md) |
| [`docs/idea-bank/`](docs/idea-bank/) | Archived brainstorms and older strategy tracks that are useful context but not canonical. | [`docs/idea-bank/README.md`](docs/idea-bank/README.md) |
| `docs/external/` | Optional, gitignored mirror of external Hytale docs for offline/local reference. | `cd tools && npm run docs:list` |
| [`docs/procbuild/`](docs/procbuild/) | Procedural building and prefab-module references for settlement/building work. | [`docs/procbuild/reference-prefab-modules.md`](docs/procbuild/reference-prefab-modules.md) |
| [`tools/`](tools/) | Node reference CLIs for querying and regenerating docs and app data. | [`tools/README.md`](tools/README.md) |
| [`apps/`](apps/) | Static browser apps over the generated indexes. | [Field Apps](#field-apps) |
| [`scripts/`](scripts/) | Build helpers for GitHub Pages and the Basecamp landing index. | [`scripts/build-github-pages.js`](scripts/build-github-pages.js) |
| `_Assets/` | Local unpacked Hytale game data used as extraction input. It is large and gitignored. | [`docs/refs/assets/README.md`](docs/refs/assets/README.md) |
| `_mod-example-sourcecode/` | Local cache of example Hytale mod repos used for reference checks. It is gitignored. | `cd tools && npm run examples:list` |
| [`worldgenV2/`](worldgenV2/) | Worldgen research and tooling outside the main docs/reference path. | Open only when working on worldgen. |

Generated outputs should be regenerated by tools, not hand-edited.

## Field Apps

These apps are the camp tables where the big reference packs get spread out and
made usable. The buildable browser apps keep their source and output under their
own folders. Install their dependencies inside the app folder, not at the repo
root.

| App | Why it exists | Data it uses | Build |
|-----|---------------|--------------|-------|
| [`apps/basecamp/`](apps/basecamp/) | Landing page for the published Basecamp site: app tiles, docs links, and the first camp map. | Generated `apps/basecamp/basecamp-index.json` | `cd tools && npm run pages:build` |
| [`apps/recipe-kiosk/`](apps/recipe-kiosk/) | Search items, recipes, loot sources, craft trees, reverse uses, and bench routes without grepping raw asset JSON. | [`docs/refs/recipes/`](docs/refs/recipes/) plus optional icon atlas from `_Assets/` | `cd apps/recipe-kiosk && npm install && npm run build` |
| [`apps/prefab-gallery/`](apps/prefab-gallery/) | Browse vanilla Hytale prefabs visually so builders and agents can inspect structures without opening thousands of prefab files. | `_Assets/Server/Prefabs` -> `manifest.json`, packed voxel data, and preview atlases | `cd apps/prefab-gallery && npm install && npm run build` |
| [`apps/sdk-explorer/`](apps/sdk-explorer/) | Wildcard-search generated SDK markdown cards in a browser when CLI search is not enough. | [`docs/sdk/`](docs/sdk/) -> generated `apps/sdk-explorer/data/sdk-reference.json` | `cd apps/sdk-explorer && npm install && npm run build` |
| [`apps/library/`](apps/library/) | Shared app shell, Ant Design theme, item icon helpers, and recipe query modules used by the static apps. | App source and generated recipe data | Consumed through local TypeScript and webpack aliases; do not serve directly |

For one command that rebuilds the published static surface, use
`cd tools && npm run pages:build`. The command stages the deployable site under
`_site/`; GitHub Actions runs it automatically for `main`.

## Common Trailheads

| Need | Start here | Fast path |
|------|------------|-----------|
| Find an English item name from an id, or an id from a player-facing name. | [`docs/refs/labels/README.md`](docs/refs/labels/README.md) | `cd tools && npm run labels:lookup -- find copper` |
| Query craft chains, raw inputs, reverse uses, benches, loot, or sources. | [`docs/refs/recipes/README.md`](docs/refs/recipes/README.md) | `cd tools && npm run recipes:gamedata -- source Ingredient_Leather` |
| Find SDK classes, methods, packages, inheritance, or text hits. | [`docs/sdk/README.md`](docs/sdk/README.md) | `cd tools && npm run sdk:search -- --method placeBlock` |
| Browse vanilla prefab metadata. | [`docs/refs/prefabs/README.md`](docs/refs/prefabs/README.md) | [`docs/refs/prefabs/prefabs-index.json`](docs/refs/prefabs/prefabs-index.json) |
| Browse prefab module analysis for reusable building motifs. | [`docs/procbuild/reference-prefab-modules.md`](docs/procbuild/reference-prefab-modules.md) | `cd tools && npm run prefabs:modules` |
| Inspect NPC role metadata from assets. | [`docs/npcs/npcs-en.json`](docs/npcs/npcs-en.json) | `cd tools && npm run npcs:extract` |
| Find BuilderTools commands that Overseer can safely dispatch. | [`docs/synthoverseer-builder-commands.md`](docs/synthoverseer-builder-commands.md) | `cd tools && npm run builder:catalog` |
| Look up the captured server console command surface. | [`docs/console-commands.md`](docs/console-commands.md) | Refresh from `../synthborn-overseer` after command changes. |
| Study trigger-volume encounter tooling. | [`docs/hytale-trigger-volumes-update-5-research.md`](docs/hytale-trigger-volumes-update-5-research.md) | Search `triggervolumes` in [`docs/sdk/`](docs/sdk/). |
| Study live map/web-server patterns. | [`docs/easywebmap-technical-notes.md`](docs/easywebmap-technical-notes.md) | Use as reference for Terrascape-like map tooling. |
| Work on Worldgen V2 research or editor ideas. | [`worldgenV2/`](worldgenV2/) | [`worldgenV2/worldgen-2-research.md`](worldgenV2/worldgen-2-research.md) |
| Sync mirrored docs or example mod repos. | [`tools/refs/reference-docs/README.md`](tools/refs/reference-docs/README.md), [`tools/refs/example-mods/README.md`](tools/refs/example-mods/README.md) | `cd tools && npm run docs:list && npm run examples:list` |
| Route an agent through the repo. | [`llm.txt`](llm.txt) | Search first, then open only the few files the search result points to. |
| Update Basecamp after a Hytale version bump. | [`docs/hytale-version-update-checklist.md`](docs/hytale-version-update-checklist.md) | Refresh SDK, labels, recipes, loot, prefabs, and app data as needed. |
| Verify docs and reference health. | [`tools/README.md`](tools/README.md) | `cd tools && npm run verify` |

Hytale ids and English display names are separate systems. Do not infer
`Ingredient_Fibre` from "Plant Fiber" by string munging; use the label lookup.

## Supply Runs

Basecamp has two dependency shapes:

- `tools/` uses Node built-ins only. `tools/package.json` provides aliases; no
  `npm install` is needed there.
- `apps/recipe-kiosk/`, `apps/prefab-gallery/`, and `apps/sdk-explorer/` are
  normal frontend projects. Run `npm install` inside the app you are building.
- `apps/basecamp/` is generated static landing-page data, while `apps/library/`
  contains shared source consumed by the browser apps.

Regenerate reference data when its upstream input changes:

| Area | Upstream change | Command |
|------|-----------------|---------|
| English labels | `_Assets/Server/Languages/en-US/server.lang` changes | `cd tools && npm run labels:extract` |
| Recipes and loot | `_Assets` recipe, item, block, or drop JSON changes | `cd tools && npm run recipes:extract && npm run recipes:loot` |
| Bench tiers | Bench item assets change | `cd tools && npm run recipes:benches` |
| Recipe tech trees | `docs/refs/recipes/recipes.json` changes | `cd tools && npm run recipes:deps -- --all` |
| NPC role metadata | `_Assets/Server/NPC` or language role labels change | `cd tools && npm run npcs:extract` |
| SDK reference | Pinned Hytale `Server:X.Y.Z` changes in a mod repo | `cd tools && npm run sdk:extract && npm run sdk:diff` |
| SDK Explorer data | `docs/sdk/` changes | `cd tools && npm run sdk:app-data` |
| Prefab catalog | `_Assets/Server/Prefabs` changes | `cd tools && npm run prefabs:index` |
| Prefab module analysis | Reference prefab packs change | `cd tools && npm run prefabs:modules` |
| Asset snapshots | New local `_Assets` drop | `cd tools && npm run assets:toc` |
| Builder command catalog | SynthOverseer builder-command JSON changes | `cd tools && npm run builder:catalog` |
| Mirrored external docs | External reference docs should be refreshed | `cd tools && npm run docs:sync` |
| Example mod source cache | Example repo list or sources change | `cd tools && npm run examples:sync` |
| Basecamp landing index | Landing-page config should be rebuilt from repo docs/apps | `cd tools && npm run index:json` |
| Static Pages apps | App source or generated app data changes | `cd tools && npm run pages:build` |

Run `cd tools && npm run verify` after README edits, docs moves, reference refreshes,
or app path changes. It checks JavaScript syntax, JSON parse health, stale moved
paths, local markdown links, and read-only smoke tests.

## Guide Library

| Doc | Why read it |
|-----|-------------|
| [`docs/README.md`](docs/README.md) | Full docs map, generated-data table, and Pages publishing notes. |
| [`tools/README.md`](tools/README.md) | Complete reference-tool catalog and command aliases. |
| [`docs/refs/README.md`](docs/refs/README.md) | Reference data index for labels, recipes, prefabs, and asset snapshots. |
| [`docs/sdk/README.md`](docs/sdk/README.md) | SDK topic router and search workflow. |
| [`docs/refs/labels/README.md`](docs/refs/labels/README.md) | English display name and Hytale id lookup details. |
| [`docs/refs/recipes/README.md`](docs/refs/recipes/README.md) | Recipe, loot, source, and bench mechanics. |
| [`docs/refs/prefabs/README.md`](docs/refs/prefabs/README.md) | Vanilla prefab catalog notes. |
| [`docs/hytale-mod-quickref/`](docs/hytale-mod-quickref/) | Curated server-side Hytale modding guide. |
| [`docs/llm-hytale-modding-kb.md`](docs/llm-hytale-modding-kb.md) | Compact API and workflow router for agents. |
| [`docs/hytale-version-update-checklist.md`](docs/hytale-version-update-checklist.md) | Checklist for asset and SDK bumps. |
| [`docs/hytale-synthetics.md`](docs/hytale-synthetics.md) | Active synth/NPC architecture track. |
| [`docs/research-bank/README.md`](docs/research-bank/README.md) | Durable NPC, behavior, AI, and world-layout research. |
| [`docs/idea-bank/README.md`](docs/idea-bank/README.md) | Archived brainstorms and older strategy notes. |
| [`docs/hytale-trigger-volumes-update-5-research.md`](docs/hytale-trigger-volumes-update-5-research.md) | Trigger Volume research for encounters, quests, and prefab-linked effects. |
| [`docs/easywebmap-technical-notes.md`](docs/easywebmap-technical-notes.md) | Live web-map reference notes from EasyWebMap. |
| [`docs/synthoverseer-builder-commands.md`](docs/synthoverseer-builder-commands.md) | Curated BuilderTools command catalog for Overseer. |
| [`docs/console-commands.md`](docs/console-commands.md) | Captured Hytale/SynthOverseer console command surface. |
| [`docs/procbuild/reference-prefab-modules.md`](docs/procbuild/reference-prefab-modules.md) | Prefab module analysis for procedural building work. |
| [`docs/publishing-curseforge.md`](docs/publishing-curseforge.md) | Shared CurseForge publishing and moderation reference. |
| [`worldgenV2/`](worldgenV2/) | Worldgen V2 research, techniques, examples, and editor/lab notes. |

## License

Synthborn Basecamp is available under the [MIT License](LICENSE).

The final section below preserves the author's first-person, long-form Synthborn
explanation.

---

## What is the Synthborn series? 

(This is direct From the author, in long form, every word mine as a human. It's a strange world we live in having to write this disclaimer. I'll provide an AI sum-up though! because TLDR. yay!)

Synthborn is a series of [Hytale mods/addons](docs/hytale-mod-quickref/01-modding-overview.md). I have been watching Hytale grow and fall to rise again and since early release have been playing around with each update. I have been working with [behavior tree](docs/research-bank/research-behavior-trees.md) driven [NPCs](docs/hytale-mod-quickref/05-npc-roles-and-ai.md) with my own simulation world, but, was replicating what many games already provide. I had written Minecraft addons in the past (forge) and although fabric seems nice I had been watching the Hytale mod community fall into a rhythm as the excitement of early release slowed down. After implementing an [ECS](docs/hytale-mod-quickref/04-ecs.md) and a "grow system", I started to desire an existing sandbox. 

So I created [basecamp](#camp-facilities) as a hub for all things Hytale mod, systems, [sdk](docs/sdk/README.md), [tools](tools/README.md), [docs](docs/README.md), [web apps](#field-apps). This allowed me to have a resource for me and my [agents](llm.txt) to consume and add to. I originally had it orchestrate the deployments to the remote servers for validation, but, ownership needed to be in each mods repo. So basecamp continues to grow as needs arise, and we have an update process that refreshes the [sdk signatures](docs/sdk/README.md) and other shared reference data. The sibling mod repos own compilation, deployment, and validation. Working with agents having a cache of resources locally seems to be the fastest cached access so basecamp serves that primary purpose, which is also mostly automated. ... anyway back to Synthborn.

I started a tinkering `(which means fixating)` on behavior tree driven NPC in simulations for player like NPCs behavior. I was fascinated by Skyrim's NPC interactions along with [Erenshor](docs/research-bank/research-erenshor-npcs.md). That was the initial drive to use Hytale as my sandbox. I did some  tests to see if I could have a mob simulate a player and the [Kyn](docs/hytale-synthetics.md) were born (code name [SynthUnits](docs/research-bank/bare-bones-synth.md)). I then was thinking I wanted a way to watch the Kyn as they go about their "day2day" and [Terrascape](worldgenV2/worldgen-v2-editor-brainstorm.md#terrascape-integration-approach) was born.  Then realized that in order to have an [LLM](docs/research-bank/research-llm-npc-roleplay.md) piped in through Hytale I have to test that out, and figured I'd make it an AI admin system, and called it [Overseer](docs/synthoverseer-builder-commands.md). Codename inspired the name `Synthborn` as this 3 part series of mods.

This is what happens when a principal software engineer with 30 years of experience and deep AI experience has time on his hands and focuses all that creative energy at hytale mods. I'm pretty stoked as I've been wanting to see something like this work and grow organically. I've wanted my own little sandbox to play in and Hytale provides the framework and great community, not to mention potential. I've been enjoying the journey. 

**Synthborn Series:**

I'm planning to release these from bottom up. The Kyn has the most complexity and moving parts, it will be last to release. Although I work on all three in tandem Overseer has the bigger impact and terrascape has least complexity.

- Kyn: Imagine joining a server that has a thriving village of players role playing on the server 24 hours a day. They would have skills, affinities, history, even lore, community, differing factions, quests. I love that idea and think it's achievable using a mix of core behavior instincts, predictability and [memory logs](docs/research-bank/research-llm-npc-roleplay.md). Adding an LLM into the mix means we get emulated personalities, deep individual history, more organic decisions not to mention community oriented survival. Yet, imagine the word of mouth scenarios along with collective teaching, learning, documenting, finding new ways to thrive. As I write this it's very alpha, but, very cool to see it climb the [tech tree](docs/refs/recipes/crafting-tech-tree.md), and desire to build homes next to each other. 

- Overseer: Imagine an AI agent running inside your server as an admin. THEN! let's give that admin some tools to make [console slash commands](docs/console-commands.md). THEN! let's give it tools to "see" and signal in the world. THEN! let's give them the ability to get the players surroundings every chat using those same tools. THEN! let's add some tools for it to place [prefabs](docs/refs/prefabs/README.md). THEN! wait, NOW we need a robust [undo stack](docs/synthoverseer-builder-commands.md), THEN! a tool for AI to use. THEN! it needs a name. Let's call it The Overseer. Now.. imagine giving it the ability to write it's own scripts in LUA, just like the coding agents we have today. Imagine your Overseer creating scripts that are highly customized for your server scenarios, or combining overseer solutions in a collective library?. It's very cool to see in motion. I'm excited to see folks feedback and criticisms. 

- Terrascape: Imagine wanting to see your Kyn village grow over time in real time, but, you don't have time to be logged into a server 24/7 to achieve that. Let's also imagine that a flat map not being good enough for fidelity and tracking purposes. Terrascape was born. 

Now, imagine all three being on the same server working in tandem. You can see yourself making Overseer prompts from Terrascape that direct it to provide the Kyn some guidance or spawn a quest, or generate a wise wizard wandering into town or a band of bandits seeking revenge on the village leader. 

Randomly generated quests become stale and boring over time. I can see the Overseer generating a series of quests that further the lore of the Kyn with a dark mystery or a life lesson or even a touching story for both your server players and Kyn. ...or on demand just by prompting for it, even using your own [custom prefabs](docs/refs/prefabs/README.md) and configurations. 
