export const ATLAS_TILE = 256;
export const ATLAS_COLS = 16;
export const MAX_TILES_PER_PAGE = ATLAS_COLS * ATLAS_COLS;

export type AtlasPageLayout = {
  pageIndex: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
  placements: { tileIndex: number; x: number; y: number }[];
};

export function paginateAtlas(
  count: number,
  tileSize = ATLAS_TILE,
  cols = ATLAS_COLS,
): AtlasPageLayout[] {
  const pages: AtlasPageLayout[] = [];
  for (let start = 0; start < count; start += MAX_TILES_PER_PAGE) {
    const pageCount = Math.min(MAX_TILES_PER_PAGE, count - start);
    const rows = Math.ceil(pageCount / cols);
    const placements = [];
    for (let i = 0; i < pageCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      placements.push({
        tileIndex: start + i,
        x: col * tileSize,
        y: row * tileSize,
      });
    }
    pages.push({
      pageIndex: pages.length,
      cols,
      rows,
      width: cols * tileSize,
      height: rows * tileSize,
      placements,
    });
  }
  return pages;
}
