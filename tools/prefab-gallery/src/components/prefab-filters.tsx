import { Form, Input, Select } from "antd";
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
    <Form
      layout="vertical"
      colon={false}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(240px, 1fr) minmax(320px, 1.4fr)",
        gap: 16,
      }}
    >
      <Form.Item label="Search" style={{ marginBottom: 0 }}>
        <Input.Search
          allowClear
          placeholder="Name, tag, dimensions"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </Form.Item>

      <Form.Item label="Tags" style={{ marginBottom: 0 }}>
        <Select
          mode="multiple"
          allowClear
          showSearch
          placeholder="All categories"
          value={tags}
          onChange={onTagsChange}
          options={selectOptions}
          optionFilterProp="label"
          maxTagCount="responsive"
          style={{ width: "100%" }}
        />
      </Form.Item>
    </Form>
  );
}
