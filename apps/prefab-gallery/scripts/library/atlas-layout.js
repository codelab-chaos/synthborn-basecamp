const ATLAS_TILE = 256;
const ATLAS_COLS = 16;
const MAX_TILES_PER_PAGE = ATLAS_COLS * ATLAS_COLS;

function paginateAtlas(count, tileSize = ATLAS_TILE, cols = ATLAS_COLS) {
  const pages = [];
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

module.exports = { ATLAS_TILE, ATLAS_COLS, MAX_TILES_PER_PAGE, paginateAtlas };
