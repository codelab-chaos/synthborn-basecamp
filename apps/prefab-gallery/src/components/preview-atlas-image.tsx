import type { PreviewAtlasRef } from "../library/types";

type PreviewAtlasImageProps = {
  preview: PreviewAtlasRef;
  className?: string;
  hidden?: boolean;
  onError?: () => void;
};

export function PreviewAtlasImage({ preview, className, hidden, onError }: PreviewAtlasImageProps) {
  const tilesX = preview.atlasW / preview.tile;
  const tilesY = preview.atlasH / preview.tile;

  return (
    <div className={["preview-atlas", className, hidden ? "is-hidden" : ""].filter(Boolean).join(" ")}>
      <div className="preview-atlas__frame">
        <img
          className="preview-atlas__sprite"
          src={preview.atlas}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={onError}
          style={{
            width: `${tilesX * 100}%`,
            height: `${tilesY * 100}%`,
            left: `${-(preview.x / preview.tile) * 100}%`,
            top: `${-(preview.y / preview.tile) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
