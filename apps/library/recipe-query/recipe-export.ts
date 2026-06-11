import { formatBenchList, inputKey } from "./format";
import type { Recipe, RecipeInput } from "./types";

function humanizeId(id: string) {
  return id.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function formatInputPlain(input: RecipeInput) {
  return `${input.quantity}x ${inputKey(input)}`;
}

function formatInputMarkdown(input: RecipeInput) {
  const suffix = input.kind === "resource" ? " *(resource type)*" : "";
  return `- ${input.quantity}× \`${input.id}\`${suffix}`;
}

function formatOutputsPlain(recipe: Recipe) {
  return recipe.outputs.map((o) => `${o.quantity}x ${o.id}`).join(" + ") || "—";
}

function formatOutputsMarkdown(recipe: Recipe) {
  if (!recipe.outputs.length) return "- —";
  return recipe.outputs.map((o) => `- ${o.quantity}× \`${o.id}\``).join("\n");
}

function formatTime(recipe: Recipe) {
  return recipe.timeSeconds != null ? `${recipe.timeSeconds}s` : "instant";
}

/** Single-line friendly summary — good for logs and spreadsheets. */
export function recipeToPlainText(recipe: Recipe): string {
  const lines = [
    `Recipe: ${recipe.id}`,
    `Inputs: ${recipe.inputs.map(formatInputPlain).join(" + ") || "—"}`,
    `Outputs: ${formatOutputsPlain(recipe)}`,
    `Bench: ${formatBenchList(recipe.bench)}`,
    `Time: ${formatTime(recipe)}`,
    `Knowledge: ${recipe.knowledgeRequired ? "required" : "no"}`,
  ];
  if (recipe.source) lines.push(`Source: ${recipe.source}`);
  if (recipe.sourceFile) lines.push(`SourceFile: ${recipe.sourceFile}`);
  return lines.join("\n");
}

/** Structured markdown — headings, lists, inline code ids. */
export function recipeToMarkdown(recipe: Recipe): string {
  const title = humanizeId(recipe.id);
  const benches = formatBenchList(recipe.bench);
  const lines = [
    `## ${title}`,
    "",
    `**ID:** \`${recipe.id}\``,
    "",
    "### Inputs",
    "",
    recipe.inputs.length
      ? recipe.inputs.map(formatInputMarkdown).join("\n")
      : "- —",
    "",
    "### Outputs",
    "",
    formatOutputsMarkdown(recipe),
    "",
    "### Bench",
    "",
    benches === "—" ? "—" : `\`${benches}\``,
    "",
    "### Meta",
    "",
    `- **Time:** ${formatTime(recipe)}`,
    `- **Knowledge:** ${recipe.knowledgeRequired ? "required" : "no"}`,
  ];
  if (recipe.source) lines.push(`- **Source:** ${recipe.source}`);
  if (recipe.sourceFile) lines.push(`- **Source file:** \`${recipe.sourceFile}\``);
  return lines.join("\n");
}

export function recipeToJson(recipe: Recipe): string {
  return JSON.stringify(recipe, null, 2);
}
