# Prefab Viewer

React 19 + Ant Design 6 + Webpack gallery for Hytale prefab voxel previews.

## Layout

```
tools/prefab-viewer/
  scripts/           Node data pipeline (no npm deps required to run alone)
    build-prefab-gallery.js
    render-prefab-views.js
    serve-static.js
    library/
  src/               React app
    components/
    hooks/
    library/
    styles/
```

Output lands in `docs/prefab-gallery/`:

- `manifest.json` + `data/**/*.vox` from `scripts/build-prefab-gallery.js` (PXV3 binary voxel blobs)
- `index.html` + `assets/**` from Webpack

## Commands

From `tools/prefab-viewer`:

```bash
npm install
npm run build:data    # manifest + voxel JSON only
npm run build:web     # React bundle only (needs manifest.json present)
npm run build         # both
npm run dev           # webpack dev server on :8878 (serves existing gallery data)
npm run serve         # static file server on :8877
```

Data build from repo root (without npm):

```bash
node tools/prefab-viewer/scripts/build-prefab-gallery.js _Assets/Server/Prefabs
```

Vanilla `_Assets/Server/Prefabs` only — third-party creator prefab packs are excluded
(`_references/example-prefabs`, mod `Server/Prefabs`, etc. are skipped even if passed on the CLI).

Output path is **`docs/prefab-gallery/`** at the repo root. Ignore `tools/docs/prefab-gallery/` if present — that was a mistaken output from an old `REPO_ROOT` bug and may carry a stale manifest.

## Memory

`npm run dev` writes bundles into `docs/prefab-gallery/` next to ~8k voxel JSON files. Webpack is configured to **not** file-watch that data directory (watching it can balloon a Node process into many GB on Windows). After `npm run build:data`, refresh the browser — the dev server does not watch `manifest.json` or `data/**`.

`npm run build:data` streams a compact `manifest.json` (~6 MB) and writes per-prefab **`.vox`** files (PXV3 binary: uint8 coords, 4–5 bytes/voxel, materials only in manifest).

### PXV3 `.vox` format

| Section | Bytes |
|---------|-------|
| Magic | `PXV3` |
| Stride | `4` (palette ≤256) or `5` (wider palette) |
| Size | `uint8` × 3 |
| Palette | `uint16` count + RGB triplets |
| Voxels | `uint32` count + packed records |

Legacy `.json` v2 payloads still load in the browser during migration.
