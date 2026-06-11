import { Typography } from "antd";
import { formatPrefabLabel } from "../library/format-prefab-label";
import { entryTagPath } from "../library/tag-hierarchy";
import type { PrefabEntry } from "../library/types";

type PrefabPathLinksProps = {
  entry: PrefabEntry;
  activeTags: string[];
  onTagSelect: (tag: string) => void;
};

export function PrefabPathLinks({ entry, activeTags, onTagSelect }: PrefabPathLinksProps) {
  const filterable = new Set(entryTagPath(entry));
  const parts = entry.path
    .split(" / ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) return null;

  return (
    <div className="prefab-card__path" title={entry.path}>
      {parts.map((part, index) => {
        const isFilterable = filterable.has(part);
        return (
          <span key={`${part}-${index}`}>
            {index > 0 && <span className="prefab-path__sep"> / </span>}
            {isFilterable ? (
              <Typography.Link
                className={activeTags.includes(part) ? "prefab-path__link is-active" : "prefab-path__link"}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onTagSelect(part);
                }}
              >
                {formatPrefabLabel(part)}
              </Typography.Link>
            ) : (
              <span className="prefab-path__static">{part}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
