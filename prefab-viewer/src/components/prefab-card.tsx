import { Button, Card, Flex, Typography } from "antd";
import type { PrefabEntry } from "../library/types";
import { MaterialStrip } from "./material-strip";
import { VoxelPreview } from "./voxel-preview";

type PrefabCardProps = {
  entry: PrefabEntry;
  pageSize: number;
  onExpand: (entry: PrefabEntry) => void;
};

export function PrefabCard({ entry, pageSize, onExpand }: PrefabCardProps) {
  return (
    <Card
      size="small"
      className="prefab-card"
      styles={{ body: { padding: 0 } }}
      title={
        <Typography.Text ellipsis={{ tooltip: entry.label }} strong>
          {entry.label}
        </Typography.Text>
      }
      extra={
        <Typography.Text type="success" style={{ fontSize: 12, textAlign: "right", whiteSpace: "nowrap" }}>
          {entry.bounds}
          <br />
          {entry.blockCount} blocks
        </Typography.Text>
      }
    >
      <div className="prefab-card__meta">
        <Typography.Text type="secondary" ellipsis={{ tooltip: entry.id }} className="prefab-card__id">
          {entry.id}
        </Typography.Text>
        <Typography.Text type="secondary" ellipsis={{ tooltip: entry.path }} className="prefab-card__path">
          {entry.path}
        </Typography.Text>
      </div>

      <div className="prefab-card__preview-wrap">
        <Flex className="prefab-card__view-label" justify="space-between" align="center">
          <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase" }}>
            Iso 45
          </Typography.Text>
          <Button size="small" type="primary" onClick={() => onExpand(entry)}>
            Expand
          </Button>
        </Flex>
        <VoxelPreview
          voxelData={entry.voxelData}
          pageSize={pageSize}
          className="prefab-card__preview"
        />
      </div>

      <MaterialStrip materials={entry.materials} />
    </Card>
  );
}
