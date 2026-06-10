import { useIconAtlas } from "../../hooks/use-icon-atlas";
import { rawId } from "../../library/humanize";

type ItemIconProps = {
  id: string;
  size?: number;
  className?: string;
};

export function ItemIcon({ id, size = 20, className }: ItemIconProps) {
  const { getSprite } = useIconAtlas();
  const sprite = getSprite(rawId(id));

  if (!sprite) return null;

  const scale = size / sprite.tile;

  return (
    <span
      className={["item-icon", className].filter(Boolean).join(" ")}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${sprite.url})`,
        backgroundPosition: `${-sprite.x * scale}px ${-sprite.y * scale}px`,
        backgroundSize: `${sprite.pageWidth * scale}px ${sprite.pageHeight * scale}px`,
      }}
      aria-hidden
    />
  );
}
