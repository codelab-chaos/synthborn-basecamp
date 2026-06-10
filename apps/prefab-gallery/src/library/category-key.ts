function safeStem(value: string): string {
  return value.replace(/[^a-z0-9_.-]+/gi, "_").replace(/^_+|_+$/g, "") || "prefab";
}

/** Top-level shard key — matches the first tag / folder segment under Vanilla _Assets. */
export function categoryKey(tags: string[], id: string): string {
  if (tags[0]) return tags[0];
  return safeStem(id) || "_root";
}

export function packFilename(category: string): string {
  return `${safeStem(category)}.pxv3`;
}

export function atlasBasename(category: string, pageIndex: number): string {
  return `${safeStem(category)}-${pageIndex}.webp`;
}

export function atlasPath(category: string, pageIndex: number): string {
  return `previews/atlas/${atlasBasename(category, pageIndex)}`;
}
