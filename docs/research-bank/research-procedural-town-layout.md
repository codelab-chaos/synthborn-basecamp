# Research: Procedural Town & Settlement Layout Generation

*Survey of map/layout procgen techniques — Watabou (Procgen Arcana), peer tools and papers, and how they apply to Kyn emergent settlements and Overseer village planning. Companion to Kyn [`settlement-spec.md`](https://github.com/codelab-chaos/synthborn-kyn/blob/main/kyn-docs/settlement-spec.md) and Overseer [`making-towns-research.md`](https://github.com/codelab-chaos/synthborn-overseer/blob/main/docs/making-towns-research.md).*

**Date:** 2026-06-19  
**Status:** Durable background research — not an implementation spec.  
**Local reference clone:** `~/git/map-gen/TownGeneratorOS` (early MFCG snapshot, GPL-3.0).

---

## Short answer

Use **constraint-first, terrain-aware, seeded planners** — not pure noise generators.

- **Kyn** settlements **accrete** one plot-pair at a time. Borrow *scoring, spacing, and semantic role placement* from procgen literature; skip full Voronoi city generators.
- **Overseer** already has the right direction (`PlotGrid`, `VillagePlanCompiler`, `PathRouter`, `making-towns-research.md`). The gap is a deterministic `plan_settlement` layer that replaces LLM spatial guessing and the primitive `plan_village` tree/rect heuristics.

**Do not port TownGeneratorOS (Haxe/GPL) into mods.** Study algorithms; reimplement patterns in pure Java.

---

## Watabou / Procgen Arcana

### Stack and licensing

Per the [Procgen Arcana FAQ](https://watabou.github.io/faq.html):

- All generators ([City](https://watabou.github.io/city.html), Village, Dungeon, etc.) are built in **Haxe + OpenFL**.
- Generated maps may be used freely (attribution appreciated, not required); selling raw generated maps is discouraged.
- Source is **not** open while a generator is in active development.
- The only public city code is an **early** [TownGeneratorOS](https://github.com/watabou/TownGeneratorOS) snapshot (GPL-3.0, last push ~2021). It lacks water bodies, options UI, and newer street work.

The live Medieval Fantasy City Generator (MFCG) has evolved beyond the clone — notably **0.10 alpha** district-wide streets via merged patches and "twisted bisection" (see Watabou's Patreon release notes). The clone still documents the core pipeline clearly.

### MFCG pipeline (2D polygon geometry)

MFCG optimizes for *looking like a city on a map*, not simulation accuracy. Output is SVG/PNG/JSON — not voxels.

```
Spiral point seeds
  → Voronoi partition
  → Lloyd relaxation (center cells enlarged)
  → Patches (= wards)
  → Junction merge / simplify
  → Curtain wall + gates + optional citadel
  → Topology graph on patch edges
  → A* arteries: gates → plaza/center
  → Assign ward types (semantic rateLocation scoring)
  → Per-ward: polygon inset → recursive bisect → building lots
  → Outskirts density filter
```

**Core techniques in TownGeneratorOS:**

| Technique | Role |
|-----------|------|
| Voronoi + relaxation | Organic district shapes; plaza/citadel get central cells |
| Polygon inset/buffer | Street widths (main / regular / alley) carved from ward edges |
| Recursive bisection (`Cutter.bisect`) | Split blocks into building lots with controlled chaos |
| Graph + A* (`Topology.buildPath`) | Gate-to-center routing over patch boundary network |
| Ward `rateLocation()` | Semantic placement: Market at plaza, GateWard at walls, etc. |
| `filterOutskirts()` | Density falloff at city edge |

Orchestration spine (`Model.build()`): `buildPatches` → `optimizeJunctions` → `buildWalls` → `buildStreets` → `createWards` → `buildGeometry`.

**Size bands** (patch count): Small Town 6, Large Town 10, Small City 15, Large City 24, Metropolis 40.

### What to take from Watabou

| Borrow | Skip (for our mods) |
|--------|---------------------|
| Semantic zone scoring (`rateLocation` pattern) | Full Voronoi ward partition at Kyn/Overseer scale |
| Radial gate-to-center arteries | Polygon bisection into building lots (we place prefabs) |
| Street-width inset logic (conceptual) | Haxe/OpenFL runtime |
| Seeded reproducibility | GPL source copy-paste |
| Outskirts density falloff (large towns) | Metropolis-scale 40-patch cities in v1 |

---

## Other open-source and research approaches

| Source | Core idea | Best fit |
|--------|-----------|----------|
| [Azgaar Fantasy Map Generator](https://github.com/Azgaar/Fantasy-Map-Generator) | Macro: score land cells → quadtree-spaced burg placement → inter-burg routes. Per-burg detail via MFCG seed/link (`MFCG`, `walls`, `plaza` fields on burg records). | Overseer **anchor selection** on scanned terrain |
| Emilien et al. — *Procedural Generation of Villages on Arbitrary Terrains* (2012) | Progressive growth: seed building → route road → update accessibility → next building | **Both mods** — matches Kyn accretion and Overseer `plan_settlement` |
| Parish & Müller — *Procedural Modeling of Cities* (SIGGRAPH 2001) | Road-first: global goals → roads → lots → buildings | Overseer `path_style` modes |
| Chen et al. — tensor-field street modeling | Guided street networks (organic ↔ grid) | Defer until `size=large` towns |
| Galin et al. — terrain-aware road generation | Weighted anisotropic shortest paths (slope, obstacles) | Extend Overseer `PathRouter` |
| Jones — Poisson-disk / blue noise | Random but evenly spaced points | Kyn plot spacing; Overseer building seeds |
| Bulbul — semantically plausible small towns (2023) | Weighted principles: security, economy, beauty, social life | Overseer NL → planner weights |
| [gen-city](https://github.com/neki-dev/gen-city) (TypeScript) | Runtime random street growth from seed node | Lightweight reference; less terrain-aware |
| [ogun](https://github.com/EliasVahlberg/ogun) / [oku](https://github.com/EliasVahlberg/oku) (Rust, 2026) | Sequential logit placement; β controls organic ↔ grid | Interesting for large towns later; heavy for v1 |
| [symbios-tensor](https://docs.rs/symbios-tensor/latest/symbios_tensor/) (Rust) | Tensor-field roads → blocks → lots on heightmaps | Future hillside towns with real elevation fields |

---

## Where Kyn and Overseer are today

### Kyn — emergent settlement, not upfront town generation

From `settlement-spec.md`:

- Settlements **accrete by adjacency** — each Kyn claims a **paired plot** (e.g. 10×10 private + 10×10 public adjacent).
- Discovery via a **shared home registry** (Phase 1).
- **Landscape-aware siting** via vision/survey primitives; `SynthHomeSiteScorer` already scores flatness, space, clearance, distance-to-spawn.

Kyn does **not** need MFCG-style Voronoi cities. The procgen question is: *where does the next plot-pair attach?*

### Overseer — planner gap, solid foundation

Existing stack (see `overseer-sprint-board.md`):

- `VillagePlan` + `VillagePlanCompiler` + `PlotGrid` (8×8 cells, compass sectors)
- `PathRouter` — A* over buildable cells, slope-bounded
- `propose_village` / `materialize_village`
- `plan_village` — **marker placement only** (`tree` / `rect` layouts + footprint checks)

Documented gap (`making-towns-research.md`): the **LLM authors too much spatial structure**. Target tool: **`plan_settlement`** — constraint-first, seeded, ranked layout candidates → `VillagePlan`.

---

## Recommended architecture

### Shared library candidate (basecamp or `affinity-module-proofs`)

Pure, testable modules both mods can consume:

- Seeded RNG
- 2D plot/cell scoring
- Poisson-disk / min-spacing
- Progressive growth scheduler (ordered role placement loop)

### Kyn — "accretion planner"

When adjacent establishment (V1) lands:

1. **Query** candidates within adjacency radius of existing claims (home registry).
2. **Filter** hard constraints: room for private + public plot pair, standable, no overlap.
3. **Score** each candidate:
   - Extend `SynthHomeSiteScorer` (flatness, space, clearance)
   - **Adjacency bonus** — shared edge with neighbor's public plot
   - **Commons proximity** — near existing public bench zone (when V4 exists)
   - **Resource affinity** — trees/ore/water from vision snapshot
   - **Poisson penalty** — too close to another private plot
4. **Pick** best; register claim.

Maps to Emilien progressive growth **without** roads or ward types — one agent at a time. Watabou's `rateLocation` becomes "orient public plot toward settlement center."

### Overseer — `plan_settlement`

Align with `making-towns-research.md`; enrich with Watabou/Azgaar ideas.

**Phase 1 (80% value):**

1. Scan terrain → `PlotGrid` with per-cell scores.
2. Seeded progressive placement: central feature → required roles → residences → edge roles.
3. Route paths **during** placement; discount cells near existing paths.
4. Score N candidate layouts; emit top `VillagePlan`.
5. Preview (`highlight_volume`); commit (`materialize_village`).

**Phase 2:**

- `path_style=radial` — entry points → center arteries (MFCG `buildStreets` analogue).
- Compass-sector role affinity (already on `PlotGrid`).
- Outskirts density falloff for `size=medium`.

**Phase 3:**

- Azgaar-style anchor picking before fixing anchor.
- Optional MFCG JSON for *map preview* of large towns (visual only, not block placement).

---

## Borrow vs. defer (summary)

### Adopt now

| Technique | Kyn | Overseer |
|-----------|-----|----------|
| Terrain scoring maps | Extend home/adjacency scorer | `VillageTerrainPreScanner` / research doc |
| Poisson / min-spacing | Between plot-pairs | Between building plots |
| Progressive growth | Next Kyn attachment | `plan_settlement` core |
| Semantic role scoring | Public vs private plot orientation | Civic center first, farms at edge |
| A* + path reuse discount | Optional late (footpaths) | Extend `PathRouter` |
| Seeded determinism | Test arenas | Same seed + anchor → same plan |

### Defer

| Technique | Why |
|-----------|-----|
| Full Voronoi cities | Incremental Kyn growth; Overseer v1 is 4–10 buildings |
| Polygon lot subdivision | Prefab placement, not extruded footprints |
| Tensor-field streets | Overkill until large towns |
| ogun/oku potential games | Research-grade; large port |
| Haxe/OpenFL port | Wrong runtime |

---

## Concrete next steps (when promoted to stories)

| Priority | Mod | Work | Effort |
|----------|-----|------|--------|
| 1 | Overseer | `plan_settlement` per `making-towns-research.md` | Medium |
| 2 | Kyn | `SynthAdjacencySiteScorer` for V1 adjacent establishment | Small |
| 3 | Shared | `library/plot-scoring` + `library/poisson-spacing` | Small |
| 4 | Overseer | Prefab role index (safety, theme, footprint) | Medium |
| 5 | Both | Algorithm provenance + license notes in mod discovery docs | Trivial |

---

## Source list

### Watabou

- [Procgen Arcana](https://watabou.github.io/index.html)
- [FAQ](https://watabou.github.io/faq.html)
- [City generator page](https://watabou.github.io/city.html)
- [TownGeneratorOS](https://github.com/watabou/TownGeneratorOS) (GPL-3.0 early snapshot)
- [Medieval Fantasy City Generator on itch.io](https://watabou.itch.io/medieval-fantasy-city-generator)

### Papers and tools

- Emilien, Bernhardt, Peytavie, Cani, Galin — *Procedural Generation of Villages on Arbitrary Terrains* (The Visual Computer, 2012)
- Parish & Müller — *Procedural Modeling of Cities* (SIGGRAPH 2001) — https://people.eecs.berkeley.edu/~sequin/CS285/PAPERS/Parish_Muller01.pdf
- Chen et al. — *Interactive Procedural Street Modeling* (ACM TOG, 2008)
- Galin et al. — *Procedural Generation of Roads* (Computer Graphics Forum, 2010)
- Galin et al. — *Authoring Hierarchical Road Networks* (Computer Graphics Forum, 2011)
- Jones — *Efficient Generation of Poisson-Disk Sampling Patterns* (JGT, 2006)
- Bulbul — *Procedural generation of semantically plausible small-scale towns* (Graphical Models, 2023)
- [Azgaar FMG — settlements (burgs)](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Data-model)
- [gen-city](https://github.com/neki-dev/gen-city) (MIT)
- [ogun](https://github.com/EliasVahlberg/ogun) / [oku](https://github.com/EliasVahlberg/oku) (MIT)

### Synthborn cross-references

- Kyn: `synthborn-kyn/kyn-docs/settlement-spec.md`
- Kyn siting: `synthborn-kyn/src/.../targeting/SynthHomeSiteScorer.java`
- Overseer: `synthborn-overseer/overseer-docs/making-towns-research.md`
- Overseer tools: `PlanVillageTool`, `VillagePlanCompiler`, `PlotGrid`, `PathRouter`
- Local MFCG clone: `~/git/map-gen/TownGeneratorOS`

---

## Changelog

- **2026-06-19** — Initial survey from operator review session (Watabou Procgen Arcana, TownGeneratorOS clone, peer tools, Kyn/Overseer fit).
