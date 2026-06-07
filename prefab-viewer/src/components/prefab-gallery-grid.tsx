import { Empty } from "antd";
import type { PrefabEntry } from "../library/types";
import { PrefabCard } from "./prefab-card";

type PrefabGalleryGridProps = {
  entries: PrefabEntry[];
  activeTags: string[];
  onTagSelect: (tag: string) => void;
  onExpand: (entry: PrefabEntry) => void;
};

export function PrefabGalleryGrid({ entries, activeTags, onTagSelect, onExpand }: PrefabGalleryGridProps) {
  if (!entries.length) {
    return <Empty description="No prefabs match the current filters." />;
  }

  return (
    <div className="gallery-grid">
      {entries.map((entry) => (
        <PrefabCard
          key={entry.id}
          entry={entry}
          activeTags={activeTags}
          onTagSelect={onTagSelect}
          onExpand={onExpand}
        />
      ))}
    </div>
  );
}
