import { BENCH_ITEM_BY_REQUIREMENT_ID } from "./bench-map";
import type { BenchRequirement, Recipe, RecipeInput } from "./types";

function humanizeToken(id: string) {
  return id.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

/** Resolve requirement id (e.g. Weapon_Bench) to placeable bench item id (e.g. Bench_Weapon). */
export function benchItemId(requirement?: BenchRequirement) {
  if (!requirement?.id) return undefined;
  return BENCH_ITEM_BY_REQUIREMENT_ID[requirement.id] || requirement.id;
}

/** One bench requirement → display label using the unique bench item id + optional categories. */
export function formatBenchLabel(requirement: BenchRequirement) {
  const itemId = benchItemId(requirement) || requirement.type || "?";
  const base = humanizeToken(itemId);
  if (requirement.categories?.length) {
    const cats = requirement.categories.map(humanizeToken).join(", ");
    return `${base} (${cats})`;
  }
  return base;
}

export type BenchTagInfo = {
  key: string;
  label: string;
  hint?: string;
  /** "bench" = the placeable station (an entity), "category" = a crafting category qualifier. */
  kind: "bench" | "category";
  /** Requirement id (e.g. "Weapon_Bench") — the token bench views filter by. */
  benchReqId?: string;
};

/** Tags for UI: bench item + each crafting category as separate entries. */
export function formatBenchTags(bench?: BenchRequirement[]): BenchTagInfo[] {
  const tags: BenchTagInfo[] = [];
  for (const requirement of bench || []) {
    const itemId = benchItemId(requirement) || requirement.id || requirement.type || "?";
    tags.push({
      key: `${requirement.id || requirement.type}-item`,
      label: humanizeToken(itemId),
      hint: requirement.id,
      kind: "bench",
      benchReqId: requirement.id,
    });
    for (const category of requirement.categories || []) {
      tags.push({
        key: `${requirement.id}-${category}`,
        label: humanizeToken(category),
        hint: category,
        kind: "category",
      });
    }
  }
  return tags;
}

export function formatBenchList(bench?: BenchRequirement[]) {
  if (!Array.isArray(bench) || bench.length === 0) return "—";
  return bench.map(formatBenchLabel).join(" or ");
}

export function inputKey(input: RecipeInput) {
  return input.kind === "resource" ? `${input.id}(type)` : input.id;
}

export function benchText(bench?: BenchRequirement[]) {
  if (!Array.isArray(bench) || bench.length === 0) return "—";
  return bench
    .map((b) => {
      const cat = Array.isArray(b.categories) && b.categories.length
        ? `,${b.categories.join(",")}`
        : "";
      const item = b.id ? BENCH_ITEM_BY_REQUIREMENT_ID[b.id] : undefined;
      return `${b.type || "?"}[${b.id || "?"}${cat}]${item ? `→${item}` : ""}`;
    })
    .join(" or ");
}

export function recipeLine(r: Recipe) {
  const inputs = r.inputs.map((i) => `${i.quantity}x ${inputKey(i)}`).join(" + ") || "—";
  const outputs = r.outputs.map((o) => `${o.quantity}x ${o.id}`).join(" + ") || "—";
  const time = r.timeSeconds != null ? `${r.timeSeconds}s` : "—";
  const k = r.knowledgeRequired ? " | knowledge-required" : "";
  return `${inputs} → ${outputs} | bench=${benchText(r.bench)} | ${time}${k}`;
}

export function isSalvage(r: Recipe) {
  return r.id.startsWith("Salvage_")
    || (r.sourceFile || "").includes("/Recipes/Salvage/")
    || (Array.isArray(r.bench) && r.bench.some((b) => b.id === "Salvagebench"));
}
