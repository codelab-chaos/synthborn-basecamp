import type { PrefabEntry } from "./types";

export type TagTree = Record<string, string[]>;

function tagsFromPath(entry: PrefabEntry): string[] {
  const parts = entry.path.split(" / ").map((part) => part.trim()).filter(Boolean);
  if (parts[0] === "Vanilla _Assets") return parts.slice(1);
  return parts;
}

export function entryTagPath(entry: PrefabEntry): string[] {
  const fromPath = tagsFromPath(entry);
  const fromTags = entry.tags || [];
  return fromPath.length > fromTags.length ? fromPath : fromTags;
}

export function buildTagTree(entries: PrefabEntry[]): TagTree {
  const tree: Record<string, Set<string>> = {};

  for (const entry of entries) {
    const tags = entryTagPath(entry);
    for (let i = 0; i < tags.length - 1; i++) {
      const parent = tags[i];
      const child = tags[i + 1];
      if (!tree[parent]) tree[parent] = new Set();
      tree[parent].add(child);
    }
  }

  const sorted: TagTree = {};
  for (const [parent, children] of Object.entries(tree)) {
    sorted[parent] = Array.from(children).sort((a, b) => a.localeCompare(b));
  }
  return sorted;
}

export function rootTagList(entries: PrefabEntry[], tagList?: string[]): string[] {
  if (tagList?.length) return [...tagList].sort((a, b) => a.localeCompare(b));
  const roots = new Set<string>();
  for (const entry of entries) {
    const tags = entryTagPath(entry);
    if (tags[0]) roots.add(tags[0]);
  }
  return Array.from(roots).sort((a, b) => a.localeCompare(b));
}

export function visibleTagOptions(
  roots: string[],
  tagTree: TagTree,
  selectedTags: string[],
): { roots: string[]; subfolders: string[] } {
  const subfolders = new Set<string>();

  for (const tag of selectedTags) {
    for (const child of tagTree[tag] || []) {
      subfolders.add(child);
    }
  }

  return {
    roots,
    subfolders: Array.from(subfolders)
      .filter((tag) => !roots.includes(tag))
      .sort((a, b) => a.localeCompare(b)),
  };
}

export function entryMatchesTags(entry: PrefabEntry, selectedTags: string[]): boolean {
  if (selectedTags.length === 0) return true;
  const tags = entryTagPath(entry);
  return selectedTags.some((tag) => tags.includes(tag));
}
