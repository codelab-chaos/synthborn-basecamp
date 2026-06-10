import { Card, Col, Empty, Row, Slider, Space, Switch, Table, Tag, Tree, Typography } from "antd";
import type { TreeDataNode } from "antd";
import { useMemo, useState } from "react";
import { buildTechTree } from "../../../library/recipe-query/build-tech-tree";
import type { RecipeCatalog } from "../../../library/recipe-query/recipe-index";
import type { TechTreeChild, TechTreeNode } from "../../../library/recipe-query/types";
import { ItemLink } from "./ui/item-link";
import { BenchTags } from "./ui/recipe-display";

const TREE_ICON_SIZE = 22;

type TechTreePanelProps = {
  itemId: string;
  catalog: RecipeCatalog;
};

function nodeTags(node: TechTreeNode) {
  if (node.cycle) return <Tag color="error">cycle</Tag>;
  if (node.depthLimit) return <Tag color="warning">depth limit</Tag>;
  if (node.leaf || node.resource) return <Tag color="success">raw</Tag>;
  return (
    <>
      <BenchTags bench={node.bench} />
      {node.timeSeconds != null ? <Tag bordered={false}>{node.timeSeconds}s</Tag> : null}
      {node.knowledgeRequired ? <Tag color="gold">knowledge</Tag> : null}
    </>
  );
}

function toTreeData(
  node: TechTreeNode,
  path: string[],
  expandedKeys: string[],
  childMeta?: TechTreeChild,
): TreeDataNode {
  const key = [...path, childMeta ? childMeta.key : node.id].join("/");
  if (path.length < 2) expandedKeys.push(key);

  const isBenchDep = childMeta?.kind === "bench";
  return {
    key,
    title: (
      <span className="tree-node">
        {isBenchDep ? <Tag color="purple">bench</Tag> : null}
        <ItemLink
          id={childMeta && !isBenchDep ? childMeta.key : node.id}
          quantity={childMeta && !isBenchDep ? childMeta.quantity : undefined}
          variant="chip"
          iconSize={TREE_ICON_SIZE}
        />
        <span className="tree-node-tags">{nodeTags(node)}</span>
      </span>
    ),
    children: (node.children || []).length
      ? (node.children || []).map((child) =>
          toTreeData(child.dependency, [...path, node.id], expandedKeys, child))
      : undefined,
  };
}

export function TechTreePanel({ itemId, catalog }: TechTreePanelProps) {
  const [maxDepth, setMaxDepth] = useState(10);
  const [includeBenchDeps, setIncludeBenchDeps] = useState(true);

  const entry = useMemo(
    () => buildTechTree(itemId, catalog.allRecipes, { maxDepth, includeBenchDeps }),
    [itemId, catalog, maxDepth, includeBenchDeps],
  );

  const { treeData, expandedKeys } = useMemo(() => {
    if (!entry) return { treeData: [], expandedKeys: [] };
    const keys: string[] = [];
    return { treeData: [toTreeData(entry.tree, [], keys)], expandedKeys: keys };
  }, [entry]);

  if (!entry) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={(
          <>
            No craft tree —
            {" "}
            <Typography.Text code>{itemId}</Typography.Text>
            {" "}
            is raw or gathered only. Check the Obtain section for loot sources.
          </>
        )}
      />
    );
  }

  return (
    <Row gutter={[20, 20]} className="tech-tree-layout">
      <Col xs={24} lg={16} xl={17}>
      <Card
        className="tech-tree-card"
        title="Dependency tree"
        extra={(
          <Space size="small" wrap>
            <Typography.Text type="secondary">Depth</Typography.Text>
            <Slider
              min={4}
              max={16}
              defaultValue={maxDepth}
              onChangeComplete={setMaxDepth}
              style={{ width: 96 }}
            />
            <Switch
              size="small"
              checked={includeBenchDeps}
              onChange={setIncludeBenchDeps}
              checkedChildren="Benches"
              unCheckedChildren="Benches"
            />
          </Space>
        )}
      >
        <div className="tech-tree-panel tech-tree-panel-compact">
          <Tree
            key={`${itemId}-${maxDepth}-${includeBenchDeps}`}
            showLine
            selectable={false}
            defaultExpandedKeys={expandedKeys}
            treeData={treeData}
            blockNode
          />
        </div>
      </Card>
      </Col>

      <Col xs={24} lg={8} xl={7}>
      <Card className="tech-tree-materials-card" title="Total raw materials">
        <Table
          size="small"
          className="tech-tree-materials-table"
          pagination={{ pageSize: 24, hideOnSinglePage: true, size: "small" }}
          rowKey="id"
          dataSource={entry.leaves}
          columns={[
            {
              title: "Resource",
              dataIndex: "id",
              render: (id: string) => (
                <ItemLink id={id} variant="chip" iconSize={TREE_ICON_SIZE} />
              ),
            },
            {
              title: "Qty",
              dataIndex: "quantity",
              width: 56,
              align: "right" as const,
            },
          ]}
        />
      </Card>
      </Col>
    </Row>
  );
}
