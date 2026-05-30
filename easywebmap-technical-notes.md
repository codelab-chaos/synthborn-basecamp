# EasyWebMap Technical Notes

Source inspected: `_references/sample-mods/EasyWebMap`

EasyWebMap is a Hytale server mod that exposes an in-browser live map. The current
implementation is a 2D Leaflet map backed by server-generated PNG tiles, plus a
WebSocket feed for live player positions. It is useful as a reference because it shows
how to embed a Netty web server inside a Hytale plugin, route browser API calls into
server world data, and protect the server from expensive map generation through caching,
batching, and explored-chunk checks.

## Current Architecture

At plugin setup time, `EasyWebMap` creates four main services:

- `MapConfig`: loads `config.json` from the plugin data directory.
- `TileManager`: owns memory cache, disk cache, tile generation, composite tiles, and
  chunk-index checks.
- `WebServer`: starts Netty HTTP and, optionally, HTTPS.
- `PlayerTracker`: polls player positions and broadcasts them over WebSocket.

`EasyWebMap.setup()` wires those services together and registers `/easywebmap`.
`EasyWebMap.start()` starts the HTTP server and player tracker. If HTTPS is enabled,
`AcmeManager` handles the Let's Encrypt flow and then starts the HTTPS listener.

The browser side is bundled as static resources under `src/main/resources/web`:

- `index.html` loads Leaflet from a CDN and `js/map.js` from the mod jar.
- `map.js` creates a custom `L.TileLayer.Batch` layer, requests tiles from the mod API,
  connects to `/ws`, and renders player markers.
- `map.css` styles the map, control overlay, connection badge, and player list.

## Web Server Pipeline

`WebServer` uses Hytale's Netty utilities to create one boss event loop and four worker
threads. Each HTTP channel installs:

- `HttpServerCodec`
- `HttpObjectAggregator`
- `HttpContentCompressor`
- `HttpRequestHandler`

`HttpRequestHandler` is the router. It handles:

- `/.well-known/acme-challenge/*` for Let's Encrypt HTTP-01 validation.
- `/ws` when the request is a WebSocket upgrade.
- `POST /api/tiles/batch` for batched tile reads.
- `GET /api/tiles/{world}/{zoom}/{x}/{z}.png` for a single PNG tile.
- `GET /api/players/{world}` for a JSON snapshot of players.
- `GET /api/worlds` for enabled worlds.
- Everything else as static web resources from `/web`.

The static handler serves files from the jar resources. HTML is served with `no-cache`;
CSS and JavaScript are served with a one-day immutable cache.

## Tile Model

The current map is chunk-oriented:

- One base tile represents one chunk.
- A chunk is treated as 32 blocks on the browser side.
- A base tile is encoded as a 256 by 256 PNG.
- Browser conversion uses `SCALE = 256 / 32`, so one block maps to 8 Leaflet units at
  native zoom.

The key point: EasyWebMap does not manually inspect voxels for the terrain image.
`TileManager.generateTile()` asks Hytale for a map image:

```java
WorldMapManager mapManager = world.getWorldMapManager();
return mapManager.getImageAsync(tileX, tileZ)
```

`PngEncoder` then converts Hytale's `MapImage` RGBA-ish integer data into an RGB
`BufferedImage` and encodes it as PNG. The encoder favors speed over compression by
using a thread-local `ImageWriter` and maximum compression quality, which means less PNG
compression work.

## Tile Request Flow

For a normal tile request:

1. Browser requests `GET /api/tiles/{world}/{zoom}/{x}/{z}.png`.
2. `TileHandler` validates method, URI shape, and whether the world is enabled.
3. `TileManager.getTile(world, zoom, x, z)` decides whether this is a base tile or
   composite tile.
4. Memory cache is checked first.
5. If generation is already pending for the same key, the same `CompletableFuture` is
   reused.
6. Disk cache is checked if enabled.
7. Stale disk tiles are reused unless a player is close enough that terrain could have
   changed.
8. If needed, `WorldMapManager.getImageAsync()` generates a fresh `MapImage`.
9. `PngEncoder` converts the image to PNG bytes.
10. Non-empty PNGs are cached in memory and asynchronously written to disk.
11. The Netty handler returns the PNG with CORS headers and a short browser cache.

The cache key is:

```text
{worldName}/{zoom}/{x}/{z}
```

Disk tiles live under:

```text
{pluginData}/tilecache/{worldName}/{zoom}/{x}_{z}.png
```

## Composite Zoom Tiles

EasyWebMap supports negative zoom levels through tile pyramids. At zoom `0`, one tile is
one chunk. At zoom `-1`, one tile covers 2 by 2 chunks. At zoom `-3`, one tile covers 8
by 8 chunks.

`CompositeTileGenerator` implements this by:

1. Calculating `chunksPerAxis = 1 << -zoom`.
2. Fetching each base tile in the area.
3. Using `TileManager.getBaseTileWithPixels()` so it can reuse decoded pixel arrays.
4. Scaling each base tile into a sub-rectangle of the output tile.
5. Encoding the composite image back into one PNG.

This lets the browser zoom out without requesting hundreds of individual base chunk
tiles. The client currently asks the server for native tiles down to `minNativeZoom: -3`
and lets Leaflet scale those further when the user reaches `-4`.

## Batching

The browser overrides Leaflet's normal one-request-per-tile behavior with
`L.TileLayer.Batch`.

When Leaflet asks for tile images, the custom layer queues tile coordinates for a short
delay and sends them as:

```json
{
  "world": "world",
  "tiles": [
    { "z": 0, "x": 12, "y": -4 }
  ]
}
```

`BatchTileHandler` fans those out to `TileManager.getTile()` calls, waits for all futures
to complete, and returns a JSON object keyed by `z/x/y`. PNGs are base64 encoded unless
they are empty, in which case the server returns `{ "empty": true }`.

The browser turns non-empty base64 payloads into `Blob` URLs for `<img>` tiles and uses a
1 by 1 transparent data URL for empty tiles. It aborts pending batches on zoom changes so
obsolete tile requests do not keep burning server work.

## Explored-Chunk and Refresh Strategy

The default config only renders explored chunks. `TileManager.isChunkExplored()` reads
the world chunk index through:

```java
world.getChunkStore().getLoader().getIndexes()
```

The result is cached per world for `chunkIndexCacheMs`, defaulting to 30 seconds. This is
important because it prevents the public map from forcing generation or rendering of
unexplored world areas.

Tile freshness is also tied to player proximity. If a disk tile exists but is older than
`tileRefreshIntervalMs`, EasyWebMap only regenerates it when a player is near that chunk
or composite area. If nobody is nearby, the stale tile is considered valid because no
player could have changed that area.

`PlayerTracker` maintains a thread-safe world to player-chunk cache for this decision.
It updates the cache from world threads because player transforms are thread-bound ECS
data.

## Player Tracking

Player tracking has two API surfaces:

- `GET /api/players/{world}` returns a point-in-time JSON array.
- `WS /ws` streams periodic player updates.

`PlayerTracker` runs a scheduled task at `updateIntervalMs`. For each enabled world, it
uses `world.execute()` to read player transforms on the correct world thread. It then
broadcasts a message like:

```json
{
  "type": "players",
  "timestamp": 123456789,
  "worlds": {
    "world": [
      { "name": "Player", "uuid": "...", "x": 1, "y": 64, "z": 2, "yaw": 0.5 }
    ]
  }
}
```

The browser stores player data by UUID, updates Leaflet markers in place, rotates arrow
icons from yaw, and updates a sidebar list.

## Operational Lessons

EasyWebMap has a few patterns worth copying for richer map tooling:

- Keep browser requests coarse. Batch when the UI can trigger many requests at once.
- Put hard limits on generation concurrency. `TileManager` uses a semaphore for tile
  generation.
- Cache at multiple layers: in-memory LRU, raw pixels for composites, disk persistence,
  and browser cache headers.
- Separate thread-bound ECS reads from arbitrary web-server threads. Player transforms
  are read through `world.execute()`, then copied into thread-safe data structures.
- Avoid generating invisible or unknown data. Explored-chunk checks are a strong guard
  against accidental world scanning.
- Reuse pending futures for duplicate requests instead of doing duplicate work.

## Limits of the Current Approach

The 2D map is fast and simple, but it is ultimately a texture service:

- It only exposes the map image that Hytale's `WorldMapManager` knows how to render.
- Height, caves, bridges, interiors, and overhangs are flattened away.
- The browser receives PNGs, not semantic terrain or block geometry.
- User interaction is mostly pan, zoom, select world, and click player.
- The server cannot stream partial structure inside one chunk; a tile is all-or-nothing
  PNG bytes.

For a 3D navigable map, the shape of the system can remain similar, but the payload must
change from "image tile" to "mesh chunk".

## What a Three.js 3D Mesh Map Could Look Like

The direct 3D analogue is a chunk mesh streaming service:

```text
Hytale world chunk data
        |
        v
Server mesh extractor
        |
        v
Chunk mesh cache: memory + disk
        |
        v
HTTP batch endpoint or binary WebSocket stream
        |
        v
Three.js scene with stitched chunk meshes
```

Instead of `GET /api/tiles/world/0/x/z.png`, the client would request something like:

```text
POST /api/meshes/batch
GET  /api/meshes/{world}/{lod}/{chunkX}/{chunkZ}.mesh
WS   /mesh-stream
```

Each payload would describe a chunk or region mesh, not an image:

```json
{
  "world": "world",
  "lod": 0,
  "chunkX": 12,
  "chunkZ": -4,
  "origin": [384, 0, -128],
  "bounds": [32, 256, 32],
  "format": "binary-gltf-or-custom",
  "version": 42
}
```

The actual geometry should be binary, not JSON. Good candidates:

- glTF/GLB for compatibility and tooling.
- Draco-compressed glTF for lower bandwidth.
- A custom binary format for maximum speed: positions, normals, uvs, material IDs,
  indices, and optional light/biome attributes.

## Server-Side Mesh Extraction

The hard part is data access. EasyWebMap can rely on `WorldMapManager.getImageAsync()`.
A 3D map needs one of these sources:

1. A Hytale API that exposes chunk block states or render meshes.
2. A server-side snapshot format that can be read safely outside the world thread.
3. A mod-maintained journal of block changes plus periodic chunk snapshots.

The safest design is to split extraction from serialization:

1. On the world thread, copy the minimal chunk snapshot needed for rendering:
   block IDs, solid/transparent flags, material IDs, light, and height range.
2. Off the world thread, convert the immutable snapshot into mesh buffers.
3. Cache the resulting mesh by `{world, lod, chunkX, chunkZ, revision}`.
4. Stream mesh payloads to the browser.

This mirrors `PlayerTracker`: touch ECS/world data only on the correct thread, then hand
off plain data to worker threads.

## Meshing Strategy

A naive mesh with one cube per visible block is too large. The server should generate
optimized chunk geometry:

- Face culling: only emit faces touching air or transparent blocks.
- Greedy meshing: merge adjacent coplanar faces with the same material.
- Material atlasing: group faces by texture/material to reduce draw calls.
- Optional ambient occlusion or baked vertex light.
- Separate opaque and transparent geometry so the browser can render them correctly.
- Keep chunk edges deterministic so adjacent chunks meet cleanly.

For a web map, the first useful target does not need perfect in-game rendering. It can
start with colored terrain materials:

- grass, dirt, stone, sand, water, foliage, snow, built blocks
- one atlas or per-material vertex colors
- simplified water planes
- no entities except player markers

That would already make the map navigable and spatially meaningful.

## Stitching Chunk Meshes

Chunk stitching should be handled by coordinate discipline, not by merging every chunk
into one giant mesh.

Each chunk mesh uses local coordinates from `0..32` in X/Z and actual block Y. The client
places it at:

```text
worldX = chunkX * 32
worldZ = chunkZ * 32
```

If both neighboring chunks use the same coordinate convention, their boundary vertices
line up. The only seam issue is missing faces at chunk borders. The server should inspect
one-block neighbor margins when generating a chunk mesh so it can decide whether a border
face is visible.

For performance, the client should keep chunks as independent Three.js objects:

- Easy frustum culling.
- Easy unload when the camera moves away.
- Easy replacement when a chunk updates.
- Easy LOD switching.

The client can optionally combine static chunks into larger render batches after they are
loaded, but that is an optimization rather than the base model.

## LOD and Region Meshes

PNG tile pyramids become mesh LODs:

- `lod 0`: full chunk mesh.
- `lod 1`: simplified 2 by 2 chunk area.
- `lod 2`: simplified 4 by 4 chunk area.
- `lod 3`: heightfield or terrain-only mesh for distant views.

For distant regions, a heightfield mesh may be enough. The server can collapse each X/Z
column to its top visible block, producing a terrain surface with material colors. Near
the camera, it switches to full voxel face meshes.

This hybrid model avoids streaming caves and interiors for far-away chunks while still
letting the user fly into detailed areas.

## Three.js Client Design

The browser should use a chunk manager around a Three.js scene:

- Perspective camera with orbit/fly controls.
- Grid or world-origin helper for orientation.
- A streaming radius around the camera target.
- Priority queue for chunk requests: near chunks first, then visible frustum, then
  background prefetch.
- Worker thread for decoding binary mesh payloads.
- `BufferGeometry` objects with shared materials.
- Instanced or sprite-based player markers fed by the existing `/ws` player stream.

At runtime:

1. Camera moves.
2. Client computes visible chunk coordinates and desired LOD.
3. Client batches missing mesh requests.
4. Server returns mesh payloads or "empty/unexplored".
5. Client decodes payloads in a Web Worker.
6. Client creates or updates `THREE.BufferGeometry`.
7. Chunks outside the retain radius are disposed to free GPU memory.

This is the same mental model as Leaflet tiles, but with a 3D camera and GPU mesh
resources instead of absolutely positioned `<img>` tiles.

## Update Model

There are two viable update strategies:

1. Pull-based freshness, like EasyWebMap tiles.
   The client re-requests chunks after a TTL if a player is nearby.

2. Push-based dirty chunks.
   The server tracks chunk revisions and broadcasts invalidations over WebSocket:

```json
{
  "type": "meshDirty",
  "world": "world",
  "chunks": [
    { "x": 12, "z": -4, "revision": 43 }
  ]
}
```

The best design is probably hybrid. Use pull-based loading for initial discovery and
LOD changes, then WebSocket invalidations for chunks that change while loaded.

## Proposed API Surface

Minimum useful endpoints:

```text
GET  /api/worlds
GET  /api/players/{world}
POST /api/meshes/batch
WS   /ws
```

`POST /api/meshes/batch`:

```json
{
  "world": "world",
  "requests": [
    { "lod": 0, "chunkX": 12, "chunkZ": -4, "revision": 42 }
  ]
}
```

Response:

```json
{
  "meshes": {
    "0/12/-4": {
      "revision": 43,
      "contentType": "model/gltf-binary",
      "data": "base64..."
    }
  },
  "empty": ["0/13/-4"],
  "unexplored": ["0/14/-4"]
}
```

For performance, a later version should move mesh responses to binary HTTP bodies or a
binary WebSocket protocol. JSON plus base64 is fine for a prototype, but it repeats the
same overhead that EasyWebMap already pays for batched PNGs.

## SDK-Grounded `getTerrainAsync()` Sketch

The SDK references suggest we can build a conservative `getTerrainAsync()` layer today,
even if Hytale does not provide a literal terrain mesh API. The relevant exposed pieces
are:

- `World` implements `ChunkAccessor<WorldChunk>` and exposes `getChunkAsync(long)`,
  `getNonTickingChunkAsync(long)`, `getChunkIfLoaded(long)`, and `getChunkStore()`.
- `WorldChunk` exposes `getBlock(x, y, z)`, `getBlockType(x, y, z)`, `getHeight(x, z)`,
  `getFluidId(x, y, z)`, `getRotationIndex(x, y, z)`, and `getTint(x, z)`.
- `BlockChunk` exposes the lower-level block data, heightmap, section access, lighting,
  and block counts.
- `BlockType` exposes IDs, textures, material, opacity, draw type, computed color,
  tint arrays, custom model info, and flags.
- `ChunkStore` and `IChunkLoader.getIndexes()` expose the same explored/on-disk chunk
  index shape EasyWebMap already uses to avoid unconstrained world scanning.

So the proposed internal API is not magic. It is a thin async wrapper around chunk reads:

```java
public final class TerrainManager {
    private final ExecutorService meshExecutor;
    private final Semaphore generationSemaphore = new Semaphore(8);

    public CompletableFuture<byte[]> getTerrainGlbAsync(
            String worldName,
            int lod,
            int chunkX,
            int chunkZ
    ) {
        World world = Universe.get().getWorld(worldName);
        if (world == null) {
            return CompletableFuture.completedFuture(Glb.empty());
        }

        if (!isChunkExplored(world, chunkX, chunkZ)) {
            return CompletableFuture.completedFuture(Glb.empty());
        }

        String key = worldName + "/" + lod + "/" + chunkX + "/" + chunkZ;
        byte[] cached = memoryCache.get(key);
        if (cached != null) {
            return CompletableFuture.completedFuture(cached);
        }

        return snapshotTerrainAsync(world, chunkX, chunkZ, lod)
                .thenCompose(snapshot -> CompletableFuture.supplyAsync(() -> {
                    acquireGenerationPermit();
                    try {
                        TerrainMesh mesh = TerrainMesher.meshVisibleFaces(snapshot);
                        byte[] glb = GltfWriter.writeGlb(mesh);
                        memoryCache.put(key, glb);
                        diskCache.putAsync(key, glb);
                        return glb;
                    } finally {
                        generationSemaphore.release();
                    }
                }, meshExecutor));
    }
}
```

The important boundary is `snapshotTerrainAsync()`. That function should touch Hytale
world/chunk objects and then immediately copy plain immutable data into our own arrays.
Everything after that can run on worker threads.

```java
private CompletableFuture<TerrainSnapshot> snapshotTerrainAsync(
        World world,
        int chunkX,
        int chunkZ,
        int lod
) {
    long index = ChunkUtil.indexChunk(chunkX, chunkZ);

    // Conservative first version: only inspect already loaded chunks.
    // Later versions can use getNonTickingChunkAsync() if loading cold chunks is acceptable.
    WorldChunk loaded = world.getChunkIfLoaded(index);
    if (loaded != null) {
        return CompletableFuture.completedFuture(copySurfaceSnapshot(loaded, lod));
    }

    return world.getChunkAsync(index)
            .thenApply(chunk -> copySurfaceSnapshot(chunk, lod))
            .completeOnTimeout(TerrainSnapshot.empty(chunkX, chunkZ), 1, TimeUnit.SECONDS)
            .exceptionally(ex -> TerrainSnapshot.empty(chunkX, chunkZ));
}
```

For the first prototype, `copySurfaceSnapshot()` should be intentionally modest: one
chunk, top surface plus immediately exposed side faces, no custom models, no caves, no
transparent sorting. That means we can lean on the heightmap and avoid scanning the full
vertical volume:

```java
private TerrainSnapshot copySurfaceSnapshot(WorldChunk chunk, int lod) {
    int step = lod == 0 ? 1 : (1 << lod);
    TerrainSnapshot out = new TerrainSnapshot(chunk.getX(), chunk.getZ(), step);

    for (int localZ = 0; localZ < 32; localZ += step) {
        for (int localX = 0; localX < 32; localX += step) {
            short topY = chunk.getHeight(localX, localZ);
            int blockId = chunk.getBlock(localX, topY, localZ);
            BlockType blockType = BlockType.getAssetMap().get(blockId);

            if (isRenderable(blockType)) {
                out.setColumn(localX, localZ, topY, new TerrainBlock(
                        blockId,
                        materialKey(blockType),
                        colorFor(blockType, chunk.getTint(localX, localZ)),
                        chunk.getFluidId(localX, topY, localZ),
                        chunk.getRotationIndex(localX, topY, localZ)
                ));
            }
        }
    }

    return out;
}
```

The exact asset-map lookup by integer ID needs a quick compile check. The references
show `BlockType.getAssetMap()`, `BlockType.EMPTY_ID`, and `WorldChunk.getBlock()` returning
an integer, but the generated docs do not spell out every overload on the asset map.
If integer lookup is awkward, the snapshot can start with raw block IDs and a tiny
hard-coded color table for common terrain blocks, then graduate to `BlockType` metadata.

`isRenderable()` should be strict:

```java
private boolean isRenderable(BlockType type) {
    if (type == null) return false;
    if (type == BlockType.EMPTY) return false;
    if (type.getId().equals(BlockType.EMPTY_KEY)) return false;
    if (type.getOpacity() == Opacity.TRANSPARENT) return false;
    return true;
}
```

That opacity enum name is illustrative; we need to verify the concrete protocol enum
values. The design intent is simple: empty/air does not emit geometry; everything else
can emit a coarse cube face until we learn more.

## Minimal Mesher

The first mesher can generate only faces that are visible from air. For a surface-only
prototype, emit:

- one top quad per sampled column
- side quads where the neighboring sampled column is lower
- no bottom quads
- no interior faces

```java
public final class TerrainMesher {
    public static TerrainMesh meshVisibleFaces(TerrainSnapshot s) {
        TerrainMesh mesh = new TerrainMesh();

        for (TerrainColumn c : s.columns()) {
            if (c.isEmpty()) continue;

            int x0 = c.localX();
            int x1 = x0 + s.step();
            int z0 = c.localZ();
            int z1 = z0 + s.step();
            int y = c.y();

            mesh.addQuad(
                    material(c),
                    v(x0, y + 1, z0), v(x1, y + 1, z0),
                    v(x1, y + 1, z1), v(x0, y + 1, z1),
                    normal(0, 1, 0),
                    color(c)
            );

            emitSideIfLower(mesh, s, c, Direction.NORTH);
            emitSideIfLower(mesh, s, c, Direction.SOUTH);
            emitSideIfLower(mesh, s, c, Direction.WEST);
            emitSideIfLower(mesh, s, c, Direction.EAST);
        }

        return mesh;
    }
}
```

This produces a heightfield-like terrain mesh. It will not show caves, overhangs, tree
canopies, bridges, or building interiors, but it gives us a navigable 3D map quickly.
Once the pipeline works, the next iteration can scan from `topY` downward until it has
emitted a bounded number of exposed faces, then later move to full face culling.

## glTF/GLB Writer Shape

For a prototype, a tiny GLB writer is enough. glTF wants:

- one scene
- one node
- one mesh
- one or more primitives grouped by material
- binary buffers for positions, normals, colors, uvs, and indices

The conservative material strategy is vertex color first. That avoids texture atlas work
and still gives a useful terrain preview.

```java
public final class GltfWriter {
    public static byte[] writeGlb(TerrainMesh mesh) {
        BinaryBuffer bin = new BinaryBuffer(ByteOrder.LITTLE_ENDIAN);

        BufferView positions = bin.writeFloat3(mesh.positions());
        BufferView normals = bin.writeFloat3(mesh.normals());
        BufferView colors = bin.writeUByte4Normalized(mesh.colors());
        BufferView indices = bin.writeUInt32(mesh.indices());

        JsonObject gltf = new JsonObject();
        gltf.add("asset", obj("version", "2.0", "generator", "SynthTerrain"));
        gltf.add("scene", primitive(0));
        gltf.add("scenes", array(obj("nodes", array(0))));
        gltf.add("nodes", array(obj("mesh", 0)));
        gltf.add("meshes", array(obj("primitives", array(primitive(
                attributes(
                        "POSITION", accessor(gltf, positions, "VEC3", FLOAT),
                        "NORMAL", accessor(gltf, normals, "VEC3", FLOAT),
                        "COLOR_0", accessor(gltf, colors, "VEC4", UNSIGNED_BYTE_NORMALIZED)
                ),
                "indices", accessor(gltf, indices, "SCALAR", UNSIGNED_INT),
                "material", 0
        )))));
        gltf.add("materials", array(obj(
                "pbrMetallicRoughness", obj(
                        "baseColorFactor", array(1, 1, 1, 1),
                        "metallicFactor", 0,
                        "roughnessFactor", 1
                )
        )));

        return Glb.pack(gltf, bin.bytes());
    }
}
```

The pseudo-code hides the boring glTF bookkeeping, but the shape is right: JSON chunk
plus BIN chunk. Later, `BlockType.getTextures()` can feed real UVs and a texture atlas,
but vertex colors are the fastest route to something we can fly around in Three.js.

## Three.js Loader Sketch

On the browser side, GLB payloads can go straight through `GLTFLoader`:

```js
const loader = new GLTFLoader();
const chunks = new Map();

async function loadChunk(world, lod, chunkX, chunkZ) {
  const key = `${lod}/${chunkX}/${chunkZ}`;
  if (chunks.has(key)) return;

  const response = await fetch(`/api/terrain/${world}/${lod}/${chunkX}/${chunkZ}.glb`);
  if (!response.ok) return;

  const arrayBuffer = await response.arrayBuffer();
  const gltf = await loader.parseAsync(arrayBuffer, "");
  const object = gltf.scene;

  object.position.set(chunkX * 32, 0, chunkZ * 32);
  scene.add(object);
  chunks.set(key, object);
}
```

If we instead return batched base64 GLBs like EasyWebMap's tile batch endpoint, the client
should decode them in a Web Worker or switch quickly to a binary batch format. GLBs are
larger than PNG tiles when we emit many faces, and the main thread will feel it.

## Conservative Iteration Plan for Terrain Meshes

The safest order is:

1. Heightfield GLB from `WorldChunk.getHeight()` and `getBlock()` with vertex colors.
2. Add chunk batching and the same memory/disk/pending-future cache pattern as tiles.
3. Add neighbor sampling so side faces at chunk boundaries are correct.
4. Replace one-quad-per-column with greedy merging by material and height.
5. Add real block colors from `BlockType.getTextureComputedColor()` and biome tint.
6. Add transparent water as a separate primitive.
7. Add limited exposed-face scanning below the heightmap for cliffs, holes, and player
   builds.
8. Add texture atlas UVs from `BlockType.getTextures()`.
9. Add dirty chunk invalidation from block changes or chunk update hooks.

This gives us a cheap `getTerrainAsync()` equivalent before attempting full voxel mesh
fidelity. It is okay if the first version looks like a simplified relief map. The point
is to prove chunk addressing, async snapshotting, cache behavior, GLB generation, browser
loading, and chunk disposal.

## Development Path

A practical implementation path:

1. Keep EasyWebMap's Netty server, static resource handling, world selection, config,
   and WebSocket player tracking.
2. Add a Three.js page beside the Leaflet page, for example `/3d.html`.
3. Prototype a fake mesh endpoint that generates flat colored planes from existing 2D
   map tiles or top-height samples.
4. Replace fake geometry with real chunk snapshots when a safe Hytale block-data access
   pattern is confirmed.
5. Add chunk mesh memory and disk caches.
6. Add LOD region meshes.
7. Add dirty-chunk invalidation and live updates.
8. Add material atlas, lighting, water, transparency, and player/entity markers.

The architectural north star is: treat 3D meshes exactly like map tiles. They are
addressable, cacheable, versioned chunk assets that the browser streams around the
camera.

## Main Risks

- Hytale may not expose enough server-side block/render data to generate faithful meshes.
- Reading chunk contents may be thread-bound or expensive, requiring careful snapshotting.
- Mesh generation can be far more CPU-heavy than PNG encoding unless greedy meshing and
  caching are in place.
- Browser GPU memory can grow quickly without aggressive chunk disposal.
- Transparent blocks, water, foliage, and lighting can multiply draw calls.
- Public servers need the same explored-area guard as EasyWebMap to avoid remote world
  scraping or accidental chunk generation.

## Takeaway

EasyWebMap is best understood as a tile streaming system: Hytale produces chunk map
images, the mod caches and serves them, and Leaflet navigates them. A Three.js version
would keep that streaming architecture but change the asset type from PNG tiles to
versioned chunk meshes. The strongest design is not one giant exported world model; it is
a live, cache-backed mesh grid where each chunk or region can be loaded, replaced,
culled, and stitched into place independently.
