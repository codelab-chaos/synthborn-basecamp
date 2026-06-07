import { Form, Input, Select } from "antd";
import { formatPrefabLabel } from "../library/format-prefab-label";

type PrefabFiltersProps = {
  query: string;
  tags: string[];
  tagList: string[];
  onQueryChange: (value: string) => void;
  onTagsChange: (value: string[]) => void;
};

export function PrefabFilters({
  query,
  tags,
  tagList,
  onQueryChange,
  onTagsChange,
}: PrefabFiltersProps) {
  const tagOptions = tagList.map((value) => ({
    value,
    label: formatPrefabLabel(value),
  }));

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
          placeholder="All tags"
          value={tags}
          onChange={onTagsChange}
          options={tagOptions}
          optionFilterProp="label"
          maxTagCount="responsive"
          style={{ width: "100%" }}
        />
      </Form.Item>
    </Form>
  );
}
