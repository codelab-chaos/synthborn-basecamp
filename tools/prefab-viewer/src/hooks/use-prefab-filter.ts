import { useEffect, useMemo, useState } from "react";
import {
  readGalleryFilterState,
  writeGalleryFilterState,
  type FilterState,
} from "../library/gallery-filter-state";
import { formatPrefabLabel } from "../library/format-prefab-label";
import { entryMatchesTags, entryTagPath } from "../library/tag-hierarchy";
import type { PrefabEntry } from "../library/types";

export type { FilterState };

export function usePrefabFilter(entries: PrefabEntry[]) {
  const [state, setState] = useState<FilterState>(readGalleryFilterState);

  useEffect(() => {
    writeGalleryFilterState(state);
  }, [state]);

  const filtered = useMemo(() => {
    const query = state.query.trim().toLowerCase();
    return entries.filter((entry) => {
      const entryTags = entryTagPath(entry);
      const haystack = [
        entry.label,
        entry.id,
        entry.path,
        entryTags.join(" "),
        entryTags.map(formatPrefabLabel).join(" "),
        entry.sourceGroup,
        entry.bounds,
        String(entry.blockCount),
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = !query || haystack.includes(query);
      const matchesTags = entryMatchesTags(entry, state.tags);
      return matchesQuery && matchesTags;
    });
  }, [entries, state.query, state.tags]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  const page = Math.min(Math.max(1, state.page), totalPages);
  const pageStart = (page - 1) * state.pageSize;
  const pageEntries = filtered.slice(pageStart, pageStart + state.pageSize);

  const update = (patch: Partial<FilterState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      if (patch.query !== undefined || patch.tags !== undefined || patch.pageSize !== undefined) {
        next.page = 1;
      }
      return next;
    });
  };

  return {
    state: { ...state, page },
    filtered,
    pageEntries,
    totalPages,
    setQuery: (query: string) => update({ query }),
    setTags: (tags: string[]) => update({ tags }),
    addTag: (tag: string) =>
      setState((prev) => {
        if (prev.tags.includes(tag)) return prev;
        return { ...prev, tags: [...prev.tags, tag], page: 1 };
      }),
    setPage: (page: number) => update({ page }),
    setPageSize: (pageSize: number) => update({ pageSize }),
  };
}
