import { CopyOutlined } from "@ant-design/icons";
import { App, Button, Card, Dropdown, Empty, Flex, List, Tag, Tooltip, Typography } from "antd";
import { Fragment } from "react";
import { inputKey } from "../../../../library/recipe-query/format";
import {
  recipeToJson,
  recipeToMarkdown,
  recipeToPlainText,
} from "../../../../library/recipe-query/recipe-export";
import type { BenchRequirement, Recipe } from "../../../../library/recipe-query/types";
import { copyText } from "../../library/copy-text";
import { benchLabels, humanizeId } from "../../library/humanize";
import { useItemNav } from "../item-nav";
import { ItemLink, type ItemLinkVariant } from "./item-link";

const COPY_FORMATS = [
  { key: "text", label: "Plain text", toText: recipeToPlainText },
  { key: "md", label: "Markdown", toText: recipeToMarkdown },
  { key: "json", label: "JSON", toText: recipeToJson },
] as const;

/** One quiet copy control per recipe — format picked from a menu, feedback via message. */
export function RecipeCopyActions({ recipe }: { recipe: Recipe }) {
  const { message } = App.useApp();

  return (
    <Dropdown
      trigger={["click"]}
      menu={{
        items: COPY_FORMATS.map((f) => ({ key: f.key, label: f.label })),
        onClick: async ({ key, domEvent }) => {
          domEvent.stopPropagation();
          const format = COPY_FORMATS.find((f) => f.key === key);
          if (!format) return;
          if (await copyText(format.toText(recipe))) {
            message.success(`Copied as ${format.label.toLowerCase()}`);
          } else {
            message.error("Copy failed");
          }
        },
      }}
    >
      <Button
        type="text"
        size="small"
        icon={<CopyOutlined />}
        className="recipe-copy-trigger"
        onClick={(e) => e.stopPropagation()}
      >
        Copy
      </Button>
    </Dropdown>
  );
}

type BenchTagsProps = {
  bench?: BenchRequirement[];
  /** Bench requirement id to omit (e.g. when the list is already filtered to it). */
  omitBenchId?: string;
  /** Rendered when there are no bench requirements at all; omit to render nothing. */
  emptyText?: string;
};

/**
 * Tag contract: bench stations are geekblue and clickable (they navigate to the
 * By-bench view); categories are quiet borderless qualifiers.
 */
export function BenchTags({ bench, omitBenchId, emptyText }: BenchTagsProps) {
  const { focusBench } = useItemNav();
  const all = benchLabels(bench);
  if (!all.length) {
    return emptyText ? <Tag bordered={false}>{emptyText}</Tag> : null;
  }
  const tags = omitBenchId
    ? all.filter((t) => t.benchReqId !== omitBenchId)
    : all;

  return (
    <>
      {tags.map((tag) => (tag.kind === "bench" ? (
        <Tooltip
          key={tag.key}
          title={tag.hint ? <span className="id-chip">{tag.hint}</span> : undefined}
          mouseEnterDelay={0.3}
        >
          <Tag
            color="geekblue"
            className="bench-tag"
            onClick={(e) => {
              e.stopPropagation();
              if (tag.benchReqId) focusBench(tag.benchReqId);
            }}
          >
            {tag.label}
          </Tag>
        </Tooltip>
      ) : (
        <Tag key={tag.key} bordered={false}>{tag.label}</Tag>
      )))}
    </>
  );
}

type RecipeMetaTagsProps = {
  recipe: Recipe;
  omitBenchId?: string;
};

/** Bench / time / knowledge tags — the one way recipe metadata is shown. */
export function RecipeMetaTags({ recipe, omitBenchId }: RecipeMetaTagsProps) {
  return (
    <>
      <BenchTags bench={recipe.bench} omitBenchId={omitBenchId} emptyText="no bench" />
      {recipe.timeSeconds != null ? <Tag bordered={false}>{recipe.timeSeconds}s</Tag> : null}
      {recipe.knowledgeRequired ? <Tag color="gold">knowledge</Tag> : null}
    </>
  );
}

type RecipeFlowProps = {
  recipe: Recipe;
  /** Item id to visually emphasize wherever it appears in the flow. */
  highlightId?: string;
  itemVariant?: ItemLinkVariant;
  iconSize?: number;
};

/** The canonical "inputs → outputs" rendering used by every view. */
export function RecipeFlow({
  recipe,
  highlightId,
  itemVariant = "chip",
  iconSize,
}: RecipeFlowProps) {
  return (
    <span className={`recipe-flow${itemVariant === "tile" ? " recipe-flow-tile" : ""}`}>
      <span className="recipe-flow-group">
        {recipe.inputs.length ? recipe.inputs.map((input, i) => {
          const key = inputKey(input);
          return (
            <Fragment key={`${key}-${i}`}>
              {i > 0 ? <span className="recipe-flow-plus">+</span> : null}
              <ItemLink
                id={key}
                quantity={input.quantity}
                highlighted={input.id === highlightId}
                variant={itemVariant}
                iconSize={iconSize}
              />
            </Fragment>
          );
        }) : <Typography.Text type="secondary">nothing</Typography.Text>}
      </span>
      <span className="recipe-flow-arrow">→</span>
      <span className="recipe-flow-group">
        {recipe.outputs.length ? recipe.outputs.map((output, i) => (
          <Fragment key={`${output.id}-${i}`}>
            {i > 0 ? <span className="recipe-flow-plus">+</span> : null}
            <ItemLink
              id={output.id}
              quantity={output.quantity}
              highlighted={output.id === highlightId}
              variant={itemVariant}
              iconSize={iconSize}
            />
          </Fragment>
        )) : <Typography.Text type="secondary">nothing</Typography.Text>}
      </span>
    </span>
  );
}

type RecipeCardProps = {
  recipe: Recipe;
  highlightId?: string;
  itemVariant?: ItemLinkVariant;
  iconSize?: number;
};

/**
 * Full recipe card — flow front and center, metadata as tags.
 * The title is omitted when it would just repeat the focused item's name.
 */
export function RecipeCard({
  recipe,
  highlightId,
  itemVariant = "tile",
  iconSize = 56,
}: RecipeCardProps) {
  const showTitle = recipe.id !== highlightId;
  return (
    <Card
      className={`recipe-card${itemVariant === "tile" ? " recipe-card-large" : ""}`}
      title={showTitle ? (
        <Tooltip title={<span className="id-chip">{recipe.id}</span>} mouseEnterDelay={0.3}>
          <span>{humanizeId(recipe.id)}</span>
        </Tooltip>
      ) : undefined}
      extra={(
        <Flex gap={8} wrap="wrap" align="center">
          <RecipeMetaTags recipe={recipe} />
          <RecipeCopyActions recipe={recipe} />
        </Flex>
      )}
    >
      <div className="recipe-card-flow">
        <RecipeFlow
          recipe={recipe}
          highlightId={highlightId}
          itemVariant={itemVariant}
          iconSize={iconSize}
        />
      </div>
    </Card>
  );
}

type RecipeListProps = {
  recipes: Recipe[];
  highlightId?: string;
  pageSize?: number;
  emptyText?: string;
  itemVariant?: ItemLinkVariant;
  iconSize?: number;
  omitBenchId?: string;
};

/** Compact paginated list of recipes — same flow rendering, one per row. */
export function RecipeList({
  recipes,
  highlightId,
  pageSize = 10,
  emptyText = "No recipes",
  itemVariant = "tile",
  iconSize = 48,
  omitBenchId,
}: RecipeListProps) {
  if (!recipes.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }
  return (
    <List
      size="small"
      dataSource={recipes}
      rowKey={(r) => r.id + (r.sourceFile || "")}
      pagination={recipes.length > pageSize ? { pageSize, size: "small" } : false}
      renderItem={(recipe) => (
        <List.Item className={`recipe-row${itemVariant === "tile" ? " recipe-row-large" : ""}`}>
          <RecipeFlow
            recipe={recipe}
            highlightId={highlightId}
            itemVariant={itemVariant}
            iconSize={iconSize}
          />
          <Flex gap={8} wrap="wrap" align="center" className="recipe-row-meta">
            <RecipeMetaTags recipe={recipe} omitBenchId={omitBenchId} />
            <RecipeCopyActions recipe={recipe} />
          </Flex>
        </List.Item>
      )}
    />
  );
}
