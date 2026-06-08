import { Space, Tag, Tooltip } from "antd";
import type { PrefabMaterial } from "../library/types";

type MaterialStripProps = {
  materials: PrefabMaterial[];
};

export function MaterialStrip({ materials }: MaterialStripProps) {
  if (!materials.length) return null;

  return (
    <Space size={4} wrap={false} className="material-strip">
      {materials.map((material) => (
        <Tooltip key={material.name} title={material.name}>
          <Tag
            style={{
              backgroundColor: material.color,
              borderColor: material.color,
              color: "#fff",
              margin: 0,
            }}
          >
            {material.count}
          </Tag>
        </Tooltip>
      ))}
    </Space>
  );
}
