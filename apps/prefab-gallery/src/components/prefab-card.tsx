import { Button, Card, Typography } from "antd";
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
      className="prefab-card"
      styles={{ body: { padding: 0 } }}
    >
      <div className="prefab-card__header">
        <div className="prefab-card__title-row">
          <Typography.Text ellipsis={{ tooltip: entry.label }} strong className="prefab-card__title">
            {entry.label}
          </Typography.Text>
          <Button
            size="small"
            type="text"
            className="prefab-icon-button prefab-icon-button--maximize"
            aria-label={`Maximize ${entry.label}`}
            title="Maximize preview"
            onClick={() => onExpand(entry)}
          >
            <span className="prefab-window-icon prefab-window-icon--maximize" aria-hidden="true" />
          </Button>
        </div>
        <Typography.Text type="success" className="prefab-card__stats">
          <span>{entry.bounds}</span>
          <span>{entry.blockCount} blocks</span>
        </Typography.Text>
      </div>

      <div className="prefab-card__meta">
        <Typography.Text type="secondary" ellipsis={{ tooltip: entry.id }} className="prefab-card__id">
          {entry.id}
        </Typography.Text>
        <PrefabPathLinks entry={entry} activeTags={activeTags} onTagSelect={onTagSelect} />
      </div>

      <div className="prefab-card__preview-wrap">
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
