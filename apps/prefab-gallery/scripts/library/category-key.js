const { safeStem } = require("../render-prefab-views.js");

/** Top-level shard key — matches the first path segment under Vanilla _Assets. */
function categoryKey(tags, id) {
  if (Array.isArray(tags) && tags[0]) return tags[0];
  return safeStem(id) || "_root";
}

function packFilename(category) {
  return `${safeStem(category)}.pxv3`;
}

function atlasBasename(category, pageIndex) {
  return `${safeStem(category)}-${pageIndex}.webp`;
}

module.exports = { categoryKey, packFilename, atlasBasename };
