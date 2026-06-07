import { Empty } from "antd";
import { useEffect } from "react";
import { disposePreviewPool, getPreviewPool } from "../library/preview-pool";
import type { PrefabEntry } from "../library/types";
import { PrefabCard } from "./prefab-card";

type PrefabGalleryGridProps = {
  entries: PrefabEntry[];
  page: number;
  pageSize: number;
  onExpand: (entry: PrefabEntry) => void;
};

export function PrefabGalleryGrid({ entries, page, pageSize, onExpand }: PrefabGalleryGridProps) {
  useEffect(() => {
    getPreviewPool(pageSize);
    return () => disposePreviewPool();
  }, [page, pageSize, entries]);

  if (!entries.length) {
    return <Empty description="No prefabs match the current filters." />;
  }

  return (
    <div className="gallery-grid">
      {entries.map((entry) => (
        <PrefabCard key={`${entry.id}-${entry.voxelData}`} entry={entry} pageSize={pageSize} onExpand={onExpand} />
      ))}
    </div>
  );
}
