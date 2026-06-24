import { Card, Col, Empty, List, Row, Tag, Typography } from "antd";
import { cmdFind } from "../../../library/recipe-query/queries";
import type { LootFile, RecipesFile } from "../../../library/recipe-query/types";
import { humanizeId } from "../library/humanize";
import { ItemLink } from "./ui/item-link";

type ItemSearchPanelProps = {
  pattern: string;
  recipes: RecipesFile;
  loot: LootFile;
};

// Blocks and droplists aren't items — focusing them leads to an empty dossier,
// so they render as copyable text instead of links.
const SECTIONS = [
  { key: "outputs", label: "Craft outputs", color: "blue", linkable: true },
  { key: "inputs", label: "Recipe inputs", color: "cyan", linkable: true },
  { key: "recipes", label: "Recipe ids", color: "purple", linkable: true },
  { key: "droppedItems", label: "Dropped items", color: "green", linkable: true },
  { key: "blocks", label: "Blocks", color: "gold", linkable: false },
  { key: "droplists", label: "Droplists", color: "orange", linkable: false },
] as const;

export function ItemSearchPanel({ pattern, recipes, loot }: ItemSearchPanelProps) {
  if (!pattern.trim()) {
    return <Empty description="Type in the search box above — item, recipe, block, or droplist" />;
  }

  const result = cmdFind(pattern.trim(), recipes, loot);
  const total = SECTIONS.reduce((n, s) => n + result[s.key].length, 0);

  if (!total) {
    return <Empty description={`No matches for "${pattern}"`} />;
  }

  return (
    <Row gutter={[16, 16]}>
      {SECTIONS.map((section) => {
        const rows = result[section.key];
        if (!rows.length) return null;
        return (
          <Col key={section.key} xs={24} lg={12} xl={8}>
            <Card
              size="small"
              title={(
                <span>
                  {section.label}
                  {" "}
                  <Tag color={section.color}>{rows.length}</Tag>
                </span>
              )}
            >
              <List
                size="small"
                dataSource={rows}
                rowKey={(r) => r}
                pagination={rows.length > 10 ? { pageSize: 10, size: "small" } : false}
                renderItem={(id) => (
                  <List.Item className="search-result-row">
                    {section.linkable ? (
                      <ItemLink id={id} />
                    ) : (
                      <Typography.Text copyable={{ text: id }}>
                        {humanizeId(id)}
                      </Typography.Text>
                    )}
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}
