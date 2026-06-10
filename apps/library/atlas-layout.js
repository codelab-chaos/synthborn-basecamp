const DEFAULT_TILE = 64;
const DEFAULT_COLS = 32;

function paginateAtlas(count, tileSize = DEFAULT_TILE, cols = DEFAULT_COLS) {
  const maxTilesPerPage = cols * cols;
  const pages = [];

  for (let start = 0; start < count; start += maxTilesPerPage) {
    const pageCount = Math.min(maxTilesPerPage, count - start);
    const rows = Math.ceil(pageCount / cols);
    const placements = [];

    for (let i = 0; i < pageCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      placements.push({
        index: start + i,
        x: col * tileSize,
        y: row * tileSize,
      });
    }

    pages.push({
      pageIndex: pages.length,
      cols,
      rows,
      tile: tileSize,
      width: cols * tileSize,
      height: rows * tileSize,
      placements,
    });
  }

  return pages;
}

module.exports = {
  DEFAULT_TILE,
  DEFAULT_COLS,
  paginateAtlas,
};
