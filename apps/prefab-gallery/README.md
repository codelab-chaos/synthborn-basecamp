# Prefab Gallery

React 19 + Ant Design 6 + Webpack gallery for Hytale prefab voxel previews.

Self-contained under `apps/prefab-gallery/` — source, build scripts, generated gallery
data, previews, and deployable static output live in one folder. Do not maintain a second
copy under `docs/prefab-gallery/`.

## Layout

```
apps/prefab-gallery/
  src/               React app
  scripts/           Node data pipeline
  index.html         built shell (committed)
  assets/            built bundles (committed)
  manifest.json      built catalog (committed)
  data/packs/        category-sharded .pxv3 voxel packs (committed app output)
  previews/atlas/    baked 45° webp preview atlases (committed app output)
  previews/Vanilla _Assets/  legacy per-prefab webps — **obsolete** once atlas previews exist
```

Card images use **atlas sprites** (`manifest.json` → `preview.atlas`). The old
`previews/Vanilla _Assets/**` tree was the pre-atlas layout (`data/X.vox` → `previews/X.webp`).
It is only consulted when an entry has no `preview` field. A full `build-previews` run covers
all entries, so `previews/Vanilla _Assets/` can be deleted locally to reclaim disk (~tens of MB).
Keep `previews/atlas/` for static serving.

Voxel data is sharded by top-level category (~20 pack files instead of ~7,775 loose
`.vox` files). Card previews are baked into category atlases (256×256 tiles, 16 columns,
multiple pages for large categories).

## Commands

From `apps/prefab-gallery`:

```bash
npm install

# Three independent build steps — run any subset, in order:
npm run build-source     # manifest.json + data/packs/*.pxv3
npm run build-web        # index.html + assets/*
npm run build-previews   # previews/atlas/*.webp + manifest preview refs

npm run build            # all three (full gallery)
npm run serve            # static file server on :8877
npm run dev              # webpack dev server on :8878
```

### Smoke test (fast local verify)

```bash
npm run build:smoke      # build-source + build-web + build-previews, each --limit 80
npm run smoke            # build:smoke, then serve on :8877
```

Or run steps individually with a custom limit:

```bash
npm run build-source -- --limit 40
npm run build-web
npm run build-previews -- --limit 40
npm run serve
```

Open `http://127.0.0.1:8877/` (or your WSL host IP on port 5500 if using Live Server).

Legacy aliases `build:data` and `build:web` still work.

Data build from repo root (without npm):

```bash
node apps/prefab-gallery/scripts/build-prefab-gallery.js _Assets/Server/Prefabs
```
