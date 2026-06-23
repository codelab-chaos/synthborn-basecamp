import { Tooltip } from "antd";
import { humanizeId, isResourceKey, rawId } from "../../library/humanize";
import { useItemNav } from "../item-nav";
import { ItemIcon } from "./item-icon";

export type ItemLinkVariant = "chip" | "tile";

type ItemLinkProps = {
  /** Raw game id, optionally with the "(type)" resource suffix. */
  id: string;
  quantity?: number;
  highlighted?: boolean;
  variant?: ItemLinkVariant;
  /** Icon edge length — tile defaults larger than chip. */
  iconSize?: number;
};

/**
 * The single way an item id is rendered anywhere in the app:
 * chip (inline) or tile (square icon with qty badged on its corner, label below).
 */
export function ItemLink({
  id,
  quantity,
  highlighted,
  variant = "chip",
  iconSize,
}: ItemLinkProps) {
  const { focusItem } = useItemNav();
  const raw = rawId(id);
  const resolvedIconSize = iconSize ?? (variant === "tile" ? 52 : 18);
  const classes = [
    "item-link",
    variant === "tile" ? "item-link-tile" : "item-link-chip",
    isResourceKey(id) ? "item-link-resource" : "",
    highlighted ? "item-link-highlighted" : "",
  ].filter(Boolean).join(" ");

  const tooltip = isResourceKey(id) ? (
    <span>
      <span className="id-chip">{raw}</span>
      <br />
      <span>Resource type — any matching item counts</span>
    </span>
  ) : (
    <span className="id-chip">{raw}</span>
  );

  const content = variant === "tile" ? (
    <span className="item-link-tile-body">
      <span className="item-link-tile-iconwrap">
        <ItemIcon id={id} size={resolvedIconSize} className="item-link-tile-icon" />
        {quantity != null ? <span className="item-link-tile-qty">{quantity}×</span> : null}
      </span>
      <span className="item-link-tile-label">{humanizeId(id)}</span>
    </span>
  ) : (
    <>
      <ItemIcon id={id} size={resolvedIconSize} />
      {quantity != null ? <span className="item-link-qty">{quantity}×</span> : null}
      <span className="item-link-label">{humanizeId(id)}</span>
    </>
  );

  return (
    <Tooltip title={tooltip} mouseEnterDelay={0.3}>
      <span
        className={classes}
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          focusItem(raw);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            focusItem(raw);
          }
        }}
      >
        {content}
      </span>
    </Tooltip>
  );
}
