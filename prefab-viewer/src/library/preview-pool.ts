import { createPreviewPool } from "./prefab-voxel-viewer";

let pool = createPreviewPool(10);
let activePageSize = 10;

export function getPreviewPool(pageSize: number) {
  if (pageSize !== activePageSize) {
    pool.disposeAll();
    pool = createPreviewPool(pageSize);
    activePageSize = pageSize;
  }
  return pool;
}

export function disposePreviewPool() {
  pool.disposeAll();
}
