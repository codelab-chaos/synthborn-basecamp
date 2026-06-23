import { Input, Select } from "antd";
import { useMemo } from "react";
import { formatPrefabLabel } from "../library/format-prefab-label";
import {
  buildTagTree,
  rootTagList,
  visibleTagOptions,
  type TagTree,
} from "../library/tag-hierarchy";
import type { PrefabEntry } from "../library/types";

type PrefabFiltersProps = {
  query: string;
  tags: string[];
  entries: PrefabEntry[];
  tagList: string[];
  tagTree?: TagTree;
  onQueryChange: (value: string) => void;
  onTagsChange: (value: string[]) => void;
};

function toSelectOptions(values: string[]) {
  return values.map((value) => ({
    value,
    label: formatPrefabLabel(value),
  }));
}

export function PrefabFilters({
  query,
  tags,
  entries,
  tagList,
  tagTree,
  onQueryChange,
  onTagsChange,
}: PrefabFiltersProps) {
  const roots = useMemo(() => rootTagList(entries, tagList), [entries, tagList]);
  const tree = useMemo(() => tagTree ?? buildTagTree(entries), [entries, tagTree]);
  const { roots: parentTags, subfolders } = useMemo(
    () => visibleTagOptions(roots, tree, tags),
    [roots, tree, tags],
  );

  const selectOptions = useMemo(() => {
    const grouped = [{ label: "Categories", options: toSelectOptions(parentTags) }];
    if (subfolders.length) {
      grouped.push({ label: "Subfolders", options: toSelectOptions(subfolders) });
    }
    return grouped;
  }, [parentTags, subfolders]);

  return (
    <div className="prefab-filters">
      <Input.Search
        allowClear
        placeholder="Search name, tag, dimensions…"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />

      <Select
        mode="multiple"
        allowClear
        showSearch
        placeholder="Filter by tag"
        value={tags}
        onChange={onTagsChange}
        options={selectOptions}
        optionFilterProp="label"
        maxTagCount="responsive"
        style={{ width: "100%" }}
      />
    </div>
  );
}
