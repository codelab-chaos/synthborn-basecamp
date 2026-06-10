# Repository Docs

This root `docs/` folder is intentionally shared across the current prototype workspace.

Right now multiple mods, plus shared tooling and reference material, depend on the same research notes:

- `mods/SynthUnits`
- `mods/SynthRCON`
- root-level `tools/`
- root-level `_references/`
- root-level `_Assets/` (local unpacked Hytale assets; see [`hytale-assets-toc.md`](hytale-assets-toc.md))
- [`hytale-survival-progression.md`](hytale-survival-progression.md), which records starter survival/tool progression so NPC planning does not confuse combat gear, tools, benches, and later tiers

## Quick References

- [`labels/README.md`](labels/README.md) - **English display names ↔ Hytale ids** (`server.lang`). CLI: `node tools/labels/lookup.js find copper`. Regenerate: `node tools/labels/extract-labels.js`.
- [`sdk-reference/README.md`](sdk-reference/README.md) - topic router + search workflow for the SDK reference.
- [`sdk-reference/llms.txt`](sdk-reference/llms.txt) / [`methods.txt`](sdk-reference/methods.txt) - grep indexes for classes and methods. CLI: `node tools/sdk/sdk-search.js --method placeBlock`. Regenerate: `node tools/sdk/extract-sdk-reference.js --full` (see [`tools/sdk/README.md`](../tools/sdk/README.md)).
- [`apps/prefab-gallery/index.html`](../apps/prefab-gallery/index.html) - static visual browser for vanilla `_Assets/Server/Prefabs` plus creator prefab mods. Each prefab ships as compact hue-only voxel JSON rendered client-side with Three.js card previews plus lightweight top/front projections. Material chips use sampled colors from vanilla asset metadata, not texture files.
- [`apps/recipe-browser/`](../apps/recipe-browser/) - recipe/item search (forward craft chains, backward uses, sources, bench filter) plus an in-app **Tech tree** tab built live from `recipes.json`. `npm run build` in that folder.
- [`hytale-prefabs.md`](hytale-prefabs.md) - text/index view of the vanilla prefab catalog, useful for counts, categories, dimensions, and dominant block ids.
- [`hytale-prefabs-index.json`](hytale-prefabs-index.json) - machine-readable prefab index consumed by search and tooling.

Regenerate the visual gallery from the repository root:

```powershell
cd apps\prefab-gallery
npm install
npm run build
```

Or data only (no npm install required):

```powershell
node apps\prefab-gallery\scripts\build-prefab-gallery.js _Assets\Server\Prefabs
```

New community docs are mirrored under `docs/external/hytale-modding-site/content/docs/en` (clone with `node tools/docs/clone-vendor-docs.js`). For SynthUnits, start with the official/custom NPC role docs, `guides/npc-workings`, `guides/plugin/Interactable-NPCs.mdx`, ECS notes, server event references, and plugin guides for spawning/persistent data.

Keeping broad Hytale notes, patch notes, API references, and cross-mod research here avoids duplicating the same material inside each mod while the project is still in MVP/prototype mode.

Once the mod boundaries settle, this can be reorganized into clearer per-mod docs plus a smaller shared knowledge base.
