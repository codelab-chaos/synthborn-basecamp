import { formatBenchTags } from "../../../library/recipe-query/format";

const RESOURCE_SUFFIX = "(type)";

/** Input keys for resource-kind inputs look like "Wood_Log(type)". */
export function isResourceKey(key: string) {
  return key.endsWith(RESOURCE_SUFFIX);
}

export function rawId(key: string) {
  return isResourceKey(key) ? key.slice(0, -RESOURCE_SUFFIX.length) : key;
}

/** "Weapon_Sword_Copper" → "Weapon Sword Copper" — display label for any game id. */
export function humanizeId(key: string) {
  return rawId(key).replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

/** Bench item id + category tags for recipe metadata chips. */
export function benchLabels(bench?: Parameters<typeof formatBenchTags>[0]) {
  return formatBenchTags(bench);
}
