import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Card, Flex, Statistic, Tag, Tooltip, Typography } from "antd";
import type { DossierSection } from "../library/hash-route";
import { humanizeId } from "../library/humanize";
import { ItemIcon } from "./ui/item-icon";

type StatDef = {
  key: string;
  title: string;
  tooltip: string;
  field: "recipeCount" | "consumerCount" | "lootSourceCount";
  section: DossierSection;
};

const STATS: StatDef[] = [
  {
    key: "craft",
    title: "Recipes",
    tooltip: "Recipes that craft this item",
    field: "recipeCount",
    section: "recipes",
  },
  {
    key: "uses",
    title: "Ingredients",
    tooltip: "Recipes that use this item as an ingredient",
    field: "consumerCount",
    section: "uses",
  },
  {
    key: "loot",
    title: "Drops",
    tooltip: "Loot tables and gather sources that drop this item",
    field: "lootSourceCount",
    section: "obtain",
  },
];

type ItemDossierHeaderProps = {
  itemId: string;
  section: DossierSection;
  onSectionChange: (section: DossierSection) => void;
  /** Set when the user arrived from a search — renders a back link. */
  backToSearch?: { pattern: string; onClick: () => void };
  recipeCount: number;
  consumerCount: number;
  lootSourceCount: number;
  craftable: boolean;
};

export function ItemDossierHeader({
  itemId,
  section,
  onSectionChange,
  backToSearch,
  recipeCount,
  consumerCount,
  lootSourceCount,
  craftable,
}: ItemDossierHeaderProps) {
  const values = { recipeCount, consumerCount, lootSourceCount };

  return (
    <Card className="dossier-detail-header">
      {backToSearch ? (
        <Button
          type="link"
          size="small"
          icon={<ArrowLeftOutlined />}
          className="dossier-back-link"
          onClick={backToSearch.onClick}
        >
          {`Search results for "${backToSearch.pattern}"`}
        </Button>
      ) : null}

      <div className="dossier-hero-row">
        <ItemIcon id={itemId} size={72} className="dossier-icon" />
        <div className="dossier-hero-text">
          <Typography.Title level={3} className="dossier-title">
            {humanizeId(itemId)}
          </Typography.Title>
          <Typography.Text className="id-chip dossier-item-id" copyable={{ text: itemId }}>
            {itemId}
          </Typography.Text>
          <Flex gap={8} wrap="wrap" className="dossier-tags">
            {craftable ? <Tag color="blue">craftable</Tag> : <Tag color="green">raw / gathered</Tag>}
            {lootSourceCount > 0 ? <Tag color="gold">lootable</Tag> : null}
          </Flex>
        </div>
        <div className="dossier-stats-grid">
          {STATS.map((stat) => (
            <Tooltip key={stat.key} title={stat.tooltip} mouseEnterDelay={0.4}>
              <button
                type="button"
                className={[
                  "dossier-stat-button",
                  section === stat.section ? "dossier-stat-active" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => onSectionChange(stat.section)}
                aria-label={stat.tooltip}
              >
                <Statistic
                  className="dossier-stat"
                  title={stat.title}
                  value={values[stat.field]}
                />
              </button>
            </Tooltip>
          ))}
        </div>
      </div>
    </Card>
  );
}
