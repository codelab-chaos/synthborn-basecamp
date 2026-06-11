import { Card, Empty, Select, Space } from "antd";
import { useMemo } from "react";
import { recipesAtBench } from "../../../library/recipe-query/queries";
import type { Recipe } from "../../../library/recipe-query/types";
import { humanizeId } from "../library/humanize";
import { RecipeList } from "./ui/recipe-display";

const DEFAULT_BENCH = "Campfire";

type BenchPanelProps = {
  recipes: Recipe[];
  /** Bench requirement id from the route; falls back to a sensible default. */
  benchId?: string;
  onBenchChange: (benchId: string) => void;
};

export function BenchPanel({ recipes, benchId, onBenchChange }: BenchPanelProps) {
  const bench = benchId || DEFAULT_BENCH;
  const { hits, known } = useMemo(() => recipesAtBench(bench, recipes), [bench, recipes]);

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Select
        showSearch
        style={{ width: "100%", maxWidth: 420 }}
        value={bench}
        onChange={onBenchChange}
        options={known.map((id) => ({ value: id, label: humanizeId(id || "") }))}
        placeholder="Pick a bench — Campfire, Furnace, Tannery, Workbench…"
      />

      {!hits.length ? (
        <Empty description={`No recipes at bench "${humanizeId(bench)}"`} />
      ) : (
        <Card title={`${hits.length} recipes at ${humanizeId(bench)}`}>
          <RecipeList recipes={hits} pageSize={15} omitBenchId={bench} />
        </Card>
      )}
    </Space>
  );
}
