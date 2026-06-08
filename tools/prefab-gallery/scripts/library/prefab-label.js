/*
 * Human-readable prefab labels from file stems / ids.
 */

function formatPrefabLabel(stem) {
  return String(stem || "")
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = {
  formatPrefabLabel,
};
