import { Button, Card, Flex, Typography } from "antd";
import type { PrefabEntry } from "../library/types";
import { MaterialStrip } from "./material-strip";
import { PrefabPathLinks } from "./prefab-path-links";
import { VoxelPreview } from "./voxel-preview";

type PrefabCardProps = {
  entry: PrefabEntry;
  activeTags: string[];
  onTagSelect: (tag: string) => void;
  onExpand: (entry: PrefabEntry) => void;
};

export function PrefabCard({ entry, activeTags, onTagSelect, onExpand }: PrefabCardProps) {
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
        <PrefabPathLinks entry={entry} activeTags={activeTags} onTagSelect={onTagSelect} />
      </div>

      <div className="prefab-card__preview-wrap">
        <Flex className="prefab-card__view-label" justify="space-between" align="center">
          <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase" }}>
            Front
          </Typography.Text>
          <Button size="small" type="primary" onClick={() => onExpand(entry)}>
            Expand
          </Button>
        </Flex>
        <VoxelPreview
          voxelData={entry.voxelData}
          preview={entry.preview}
          className="prefab-card__preview"
        />
      </div>

      <MaterialStrip materials={entry.materials} />
    </Card>
  );
}
