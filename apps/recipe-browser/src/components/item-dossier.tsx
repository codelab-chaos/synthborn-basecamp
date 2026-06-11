import { AppstoreOutlined, BarsOutlined, SearchOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Empty,
  Flex,
  Result,
  Segmented,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useMemo } from "react";
import type { RecipeCatalog } from "../../../library/recipe-query/recipe-index";
import {
  recipesForOutput,
  recipesUsingInput,
  sourceForItem,
} from "../../../library/recipe-query/queries";
import type { LootFile, LootSource, Recipe } from "../../../library/recipe-query/types";
import type { DossierSection } from "../library/hash-route";
import { humanizeId } from "../library/humanize";
import { ItemDossierHeader } from "./item-dossier-header";
import { TechTreePanel } from "./tech-tree-panel";
import { RecipeCard, RecipeList } from "./ui/recipe-display";
import type { ItemLinkVariant } from "./ui/item-link";

type ItemDossierProps = {
  itemId: string;
  section: DossierSection;
  onSectionChange: (section: DossierSection) => void;
  /** Set when the user arrived from a search — enables the back link. */
  backToSearch?: { pattern: string; onClick: () => void };
  itemVariant: ItemLinkVariant;
  onItemVariantChange: (variant: ItemLinkVariant) => void;
  recipes: Recipe[];
  loot: LootFile;
  catalog: RecipeCatalog;
};

function formatExpected(v: number | undefined) {
  if (v == null) return "—";
  if (v >= 0.95) return `~${v >= 10 ? Math.round(v) : v.toFixed(1)}`;
  if (v <= 0) return "—";
  return `1 in ~${Math.round(1 / v)}`;
}

function LootSourceTable({ sources }: { sources: LootSource[] }) {
  if (!sources.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No loot table entries" />;
  }
  return (
    <Table
      size="small"
      rowKey={(s) => `${s.kind}-${s.id}-${s.mode || ""}`}
      pagination={{ pageSize: 10, hideOnSinglePage: true }}
      dataSource={sources}
      columns={[
        {
          title: "Source",
          render: (_: unknown, s: LootSource) => (
            <Space size="small">
              <Tag color={s.kind === "block" ? "gold" : "orange"}>{s.kind}</Tag>
              <Typography.Text>{humanizeId(s.id)}</Typography.Text>
              {s.mode ? <Typography.Text type="secondary">({s.mode})</Typography.Text> : null}
            </Space>
          ),
        },
        {
          title: "Expected",
          dataIndex: "expected",
          width: 110,
          align: "right" as const,
          sorter: (a: LootSource, b: LootSource) => (a.expected ?? 0) - (b.expected ?? 0),
          render: (v: number | undefined) => formatExpected(v),
        },
        {
          title: "Chance",
          dataIndex: "chancePct",
          width: 100,
          sorter: (a: LootSource, b: LootSource) => (a.chancePct ?? -1) - (b.chancePct ?? -1),
          render: (v: number | null | undefined) => (
            v == null ? <Tag bordered={false}>?</Tag> : <Tag bordered={false}>{v}%</Tag>
          ),
        },
      ]}
    />
  );
}

export function ItemDossier({
  itemId,
  section,
  onSectionChange,
  backToSearch,
  itemVariant,
  onItemVariantChange,
  recipes,
  loot,
  catalog,
}: ItemDossierProps) {
  const tileIconSize = 56;
  const chipIconSize = 20;
  const iconSize = itemVariant === "tile" ? tileIconSize : chipIconSize;

  const producers = useMemo(() => recipesForOutput(itemId, recipes), [itemId, recipes]);
  const { consumers } = useMemo(() => recipesUsingInput(itemId, recipes), [itemId, recipes]);
  const source = useMemo(() => sourceForItem(itemId, recipes, loot, true), [itemId, recipes, loot]);

  if (!itemId.trim()) {
    return <Empty description="Pick an item from search to see its dossier" />;
  }

  // Dead end — the id has no recipe, use, or loot data (likely a block or droplist id).
  if (!producers.length && !consumers.length && !source.droppedBy.length) {
    return (
      <Result
        status="info"
        title={`No data for ${humanizeId(itemId)}`}
        subTitle={(
          <>
            <Typography.Text code>{itemId}</Typography.Text>
            {" "}
            has no recipes, uses, or loot sources — it may be a block, droplist, or
            unobtainable id.
          </>
        )}
        extra={backToSearch ? (
          <Button icon={<SearchOutlined />} onClick={backToSearch.onClick}>
            {`Back to search results for "${backToSearch.pattern}"`}
          </Button>
        ) : undefined}
      />
    );
  }

  const displayToggle = (
    <Tooltip title="Item display: tiles or compact chips">
      <Segmented
        size="small"
        value={itemVariant}
        onChange={(value) => onItemVariantChange(value as ItemLinkVariant)}
        options={[
          { value: "tile", icon: <AppstoreOutlined />, label: "" },
          { value: "chip", icon: <BarsOutlined />, label: "" },
        ]}
      />
    </Tooltip>
  );

  const tabItems = [
    {
      key: "recipes",
      label: "Recipes",
      children: producers.length ? (
        <Flex vertical gap={20} style={{ width: "100%" }}>
          {producers.map((r) => (
            <RecipeCard
              key={r.id + (r.sourceFile || "")}
              recipe={r}
              highlightId={itemId}
              itemVariant={itemVariant}
              iconSize={iconSize}
            />
          ))}
        </Flex>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Not craftable — check Obtain for loot sources"
        />
      ),
    },
    {
      key: "tree",
      label: "Craft tree",
      children: <TechTreePanel itemId={itemId} catalog={catalog} />,
    },
    {
      key: "uses",
      label: "Used in",
      children: (
        <Card title={`Recipes consuming ${humanizeId(itemId)}`}>
          <RecipeList
            recipes={consumers}
            highlightId={itemId}
            pageSize={12}
            emptyText="Nothing consumes this item"
            itemVariant={itemVariant}
            iconSize={iconSize}
          />
        </Card>
      ),
    },
    {
      key: "obtain",
      label: "Obtain",
      children: (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Card title={`Crafted by (${producers.length})`}>
            <RecipeList
              recipes={producers}
              highlightId={itemId}
              emptyText="Not craftable"
              itemVariant={itemVariant}
              iconSize={iconSize}
            />
          </Card>
          <Card title={`Dropped by (${source.droppedBy.length})`}>
            <LootSourceTable sources={source.droppedBy} />
          </Card>
        </Space>
      ),
    },
  ];

  return (
    <Flex vertical gap={28} className="dossier-layout" style={{ width: "100%" }}>
      <ItemDossierHeader
        itemId={itemId}
        section={section}
        onSectionChange={onSectionChange}
        backToSearch={backToSearch}
        recipeCount={producers.length}
        consumerCount={consumers.length}
        lootSourceCount={source.droppedBy.length}
        craftable={producers.length > 0}
      />

      <Tabs
        className="dossier-tabs"
        activeKey={section}
        onChange={(key) => onSectionChange(key as DossierSection)}
        tabBarExtraContent={displayToggle}
        items={tabItems}
      />
    </Flex>
  );
}
