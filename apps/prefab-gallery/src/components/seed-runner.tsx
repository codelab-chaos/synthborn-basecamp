import { useEffect, useRef, useState } from "react";
import { ATLAS_TILE, paginateAtlas } from "../library/atlas-layout";
import { atlasPath, categoryKey } from "../library/category-key";
import { loadVoxelPayload } from "../library/load-voxel-payload";
import { createSnapshotRenderer } from "../library/snapshot-renderer";
import type { GalleryManifest, PreviewAtlasRef, UnpackedVoxels } from "../library/types";

const PREFETCH_AHEAD = 6;
const LOG_EVERY = 100;

type SeedProgress = {
  phase: "loading" | "running" | "complete" | "failed";
  total: number;
  done: number;
  skipped: number;
  failed: number;
  message: string;
};

type ManifestPatch = {
  index: number;
  preview: PreviewAtlasRef;
};

type CategoryBatch = {
  category: string;
  indices: number[];
};

function readNumberParam(params: URLSearchParams, key: string, fallback: number) {
  const value = Number(params.get(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

async function fetchExistingAtlases(): Promise<Set<string>> {
  const response = await fetch("__seed/existing");
  if (!response.ok) throw new Error(`__seed/existing ${response.status}`);
  return new Set((await response.json()) as string[]);
}

async function saveAtlas(target: string, blob: Blob) {
  const response = await fetch(`__seed/save?path=${encodeURIComponent(target)}`, {
    method: "PUT",
    body: blob,
  });
  if (!response.ok) throw new Error(`save ${target} ${response.status}`);
}

async function patchManifest(patches: ManifestPatch[]) {
  if (patches.length === 0) return;
  const response = await fetch("__seed/patch-manifest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patches }),
  });
  if (!response.ok) throw new Error(`patch-manifest ${response.status}`);
}

function groupByCategory(manifest: GalleryManifest): CategoryBatch[] {
  const map = new Map<string, number[]>();
  manifest.entries.forEach((entry, index) => {
    const key = categoryKey(entry.tags, entry.id);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(index);
  });
  return Array.from(map.entries()).map(([category, indices]) => ({ category, indices }));
}

function pageNeedsWork(
  pageIndices: number[],
  manifest: GalleryManifest,
  atlasRel: string,
  existingAtlases: Set<string>,
): boolean {
  if (!existingAtlases.has(atlasRel)) return true;
  return pageIndices.some((index) => !manifest.entries[index].preview);
}

export function SeedRunner() {
  const [progress, setProgress] = useState<SeedProgress>({
    phase: "loading",
    total: 0,
    done: 0,
    skipped: 0,
    failed: 0,
    message: "Loading manifest…",
  });
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const size = readNumberParam(params, "size", ATLAS_TILE);
    const quality = Math.min(1, readNumberParam(params, "quality", 0.6));
    const limit = readNumberParam(params, "limit", Number.POSITIVE_INFINITY);

    const finish = (phase: "complete" | "failed", message: string) => {
      setProgress((prev) => ({ ...prev, phase, message }));
      console.log(`[seed] ${message}`);
      document.title = phase === "complete" ? "SEED_COMPLETE" : "SEED_FAILED";
    };

    const run = async () => {
      const manifestResponse = await fetch("manifest.json");
      if (!manifestResponse.ok) throw new Error(`manifest.json ${manifestResponse.status}`);
      const manifest = (await manifestResponse.json()) as GalleryManifest;
      const existingAtlases = await fetchExistingAtlases();

      const batches = groupByCategory(manifest);
      const workPages: {
        category: string;
        indices: number[];
        pageIndex: number;
        atlasRel: string;
      }[] = [];
      let remaining = limit;

      for (const batch of batches) {
        const indices: number[] = [];
        for (const index of batch.indices) {
          if (remaining !== Number.POSITIVE_INFINITY) {
            if (remaining <= 0) break;
            remaining -= 1;
          }
          indices.push(index);
        }
        if (indices.length === 0) continue;
        const pages = paginateAtlas(indices.length, size);
        for (const page of pages) {
          const pageIndices = page.placements.map((placement) => indices[placement.tileIndex]);
          const atlasRel = atlasPath(batch.category, page.pageIndex);
          if (!pageNeedsWork(pageIndices, manifest, atlasRel, existingAtlases)) continue;
          workPages.push({
            category: batch.category,
            indices,
            pageIndex: page.pageIndex,
            atlasRel,
          });
        }
      }

      const totalTiles = workPages.reduce((sum, page) => {
        const pages = paginateAtlas(page.indices.length, size);
        return sum + (pages[page.pageIndex]?.placements.length ?? 0);
      }, 0);

      setProgress({
        phase: "running",
        total: totalTiles,
        done: 0,
        skipped: manifest.entries.filter((entry) => entry.preview).length,
        failed: 0,
        message: `Rendering ${workPages.length} atlas page(s)…`,
      });

      const snapshot = createSnapshotRenderer(size);
      const inFlight = new Map<string, Promise<UnpackedVoxels | null>>();
      const prefetch = (voxelRef: string | { pack: string; offset: number; length: number }) => {
        const key = typeof voxelRef === "string" ? voxelRef : `${voxelRef.pack}@${voxelRef.offset}`;
        if (!inFlight.has(key)) {
          inFlight.set(
            key,
            loadVoxelPayload(voxelRef).catch((err: Error) => {
              console.warn(`[seed] payload failed ${key}: ${err.message}`);
              return null;
            }),
          );
        }
      };

      let done = 0;
      let failed = 0;
      let skipped = manifest.entries.filter((entry) => entry.preview).length;

      try {
        for (const workPage of workPages) {
          const pages = paginateAtlas(workPage.indices.length, size);
          const page = pages[workPage.pageIndex];
          if (!page) continue;

          const canvas = document.createElement("canvas");
          canvas.width = page.width;
          canvas.height = page.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("2d context unavailable");

          const patches: ManifestPatch[] = [];

          for (const placement of page.placements) {
            const manifestIndex = workPage.indices[placement.tileIndex];
            const entry = manifest.entries[manifestIndex];
            prefetch(entry.voxelData);
            const key =
              typeof entry.voxelData === "string"
                ? entry.voxelData
                : `${entry.voxelData.pack}@${entry.voxelData.offset}`;
            const payload = await inFlight.get(key);
            inFlight.delete(key);

            const preview: PreviewAtlasRef = {
              atlas: workPage.atlasRel,
              x: placement.x,
              y: placement.y,
              tile: size,
              atlasW: page.width,
              atlasH: page.height,
            };

            if (!payload) {
              failed++;
            } else {
              const tileCanvas = snapshot.render(payload);
              ctx.drawImage(tileCanvas, placement.x, placement.y, size, size);
              done++;
            }

            patches.push({ index: manifestIndex, preview });
            manifest.entries[manifestIndex].preview = preview;

            if (done % LOG_EVERY === 0) {
              setProgress((prev) => ({ ...prev, done, failed }));
            }
          }

          const blob = await canvasToWebp(canvas, quality);
          if (!blob || blob.type !== "image/webp") {
            throw new Error(`webp encode failed for ${workPage.atlasRel}`);
          }

          await saveAtlas(workPage.atlasRel, blob);
          await patchManifest(patches);
          console.log(`[seed] ${workPage.atlasRel} (${patches.length} tile(s))`);
        }
      } finally {
        snapshot.dispose();
      }

      setProgress((prev) => ({ ...prev, done, failed, skipped }));
      finish("complete", `done: ${done} rendered, ${skipped} skipped, ${failed} failed`);
    };

    run().catch((err: Error) => {
      console.error(err);
      finish("failed", `error: ${err.message}`);
    });
  }, []);

  return (
    <div style={{ padding: 32, fontFamily: "monospace", color: "#eef2f0", background: "#101419", minHeight: "100vh" }}>
      <h2>Prefab preview seeder</h2>
      <p>{progress.message}</p>
      <p>
        rendered {progress.done} / {progress.total} · skipped {progress.skipped} · failed{" "}
        {progress.failed}
      </p>
    </div>
  );
}
