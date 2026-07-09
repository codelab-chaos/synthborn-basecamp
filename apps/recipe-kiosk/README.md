# Recipe Kiosk

React 19 + Ant Design 6 data browser for Hytale recipes, items, and craft chains.
Self-contained static app — tables and trees; optional item icon atlas from local `_Assets`.

## Data

Reads `docs/refs/recipes/recipes.json` and `loot.json` (synced into disposable `data/`
static output at build time).
Tech tree tab builds dependency graphs **client-side** from the same recipe index — no
separate `crafting-tech-tree.json` load.

## Commands

From `apps/recipe-kiosk`:

```bash
npm install
npm run sync-data    # copy docs/refs/recipes/*.json → data/
npm run build-icons  # optional: pack item PNGs from _Assets → data/icons-atlas/
npm run build        # sync + webpack production build
npm run dev          # sync + dev server :8880
npm run serve        # static server :8879 (after build)
```

### Item icon atlas (optional)

Requires local `_Assets` (ULA — derived assets for local tooling only).

```bash
npm run build-icons              # recipe + loot item ids (~1.8k icons)
npm run build-icons -- --all-items   # every resolvable item PNG (~3.6k)
```

Writes `data/icons-atlas/atlas-*.webp` plus `manifest.json`:

```json
{
  "items": {
    "Weapon_Sword_Copper": { "page": 0, "x": 0, "y": 0, "w": 64, "h": 64 }
  }
}
```

Use `background-position` / `background-size` on a div, or slice coordinates in canvas.
Icon atlases live under committed `data/` static output — regenerate after SDK/asset
updates.

### URL hashes

Navigation syncs to `location.hash` for shareable deep links:

| Hash | View |
|------|------|
| `#item/Weapon_Sword_Copper` | Item dossier (Recipes) |
| `#item/Weapon_Sword_Copper/tree` | Craft tree |
| `#item/Weapon_Sword_Copper/uses` | Used in |
| `#item/Weapon_Sword_Copper/obtain` | Obtain |
| `#search/copper` | Search results |
| `#bench` | By bench (default station) |
| `#bench/Weapon_Bench` | By bench, filtered to a station |

### Live Server (VS Code / Cursor)

Open the **repo root** with Live Server, then browse:

`http://<host>:5500/apps/recipe-kiosk/`

Run `npm run build` first so `index.html` + `assets/` exist. Script tags use **relative**
paths (`assets/...`, `data/...`) so they resolve under that folder — not `/assets/` at
the server root. A dev `webpack serve` build with `publicPath: "/"` breaks this; use
`npm run build` for Live Server.

## UI structure

One omnibox in the header drives everything: picking a suggestion focuses that item,
Enter shows all matches. Every item anywhere in the app renders as a clickable
`ItemLink` chip that refocuses the dossier.

| Tab | What it shows |
|-----|---------------|
| **Item** | Dossier for the focused item, with sections: Recipes (canonical cards), Craft tree (dependency tree + total raw materials), Used in (consuming recipes), Obtain (craft + loot sources) |
| Search results | Grouped matches across items, recipes, blocks, droplists |
| By bench | Filter recipes by station |

Recipe rendering is unified in `src/components/ui/recipe-display.tsx` —
`RecipeFlow` (inputs → outputs chips), `RecipeCard`, and `RecipeList` are the only
ways a recipe is drawn, so every view looks the same. The tag contract: bench
stations are geekblue and **clickable** (they deep-link to By bench); categories
and times are quiet borderless tags; raw/cycle/depth-limit use semantic presets.
Each recipe has one quiet Copy control (plain text / markdown / JSON menu).
The tile/compact display preference persists in localStorage.

Shared query logic lives in `apps/library/recipe-query/` (ported from
`tools/recipes/gamedata.js`); it stays UI-framework-agnostic — all Ant Design
rendering lives in this app.
