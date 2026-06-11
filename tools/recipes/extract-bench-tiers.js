#!/usr/bin/env node
/*
 * Build a bench TIER index from the unpacked Hytale assets in _Assets/.
 *
 * Source: _Assets/Server/Item/Items/Bench/*.json -> BlockType.Bench.TierLevels[].
 *   Each placed bench starts at tier 1. TierLevels[i] describes tier (i+1):
 *     - CraftingTimeReductionModifier : the craft-speed bonus AT that tier
 *     - UpgradeRequirement            : the Material[] + TimeSeconds to upgrade
 *                                       to the NEXT tier (absent on the top tier)
 *
 * This is the data behind "upgrade a crafting bench through its tiers" and is the
 * companion to the recipe/dependency tools. NOTE: which RECIPES a tier unlocks is
 * NOT in the recipe assets (no per-recipe TierLevel field) — it is the SDK-computed
 * `CraftingRecipe.isRestrictedByBenchTierLevel`, a runtime check. So this index
 * captures the upgrade LADDER + COST per bench; recipe-tier gating stays runtime.
 *
 * Emits two artifacts in docs/recipes/:
 *   - bench-tiers.txt   grep-friendly ladder, one section per bench
 *   - bench-tiers.json  structured data + byBenchId index for programmatic use
 *
 * Cross-platform Node, no deps. Mirrors extract-recipes.js conventions.
 *
 * Usage:
 *   node tools/recipes/extract-bench-tiers.js [--assets <dir>] [--out <dir>]
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_ASSETS = path.join(REPO_ROOT, "_Assets");
const DEFAULT_OUT = path.join(REPO_ROOT, "docs", "recipes");
const BENCH_DIR = path.join("Server", "Item", "Items", "Bench");

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} requires a value`);
      return v;
    };
    switch (a) {
      case "-h": case "--help": opts.help = true; return opts;
      case "--assets": opts.assets = next(); break;
      case "--out": opts.out = next(); break;
      case "--verbose": opts.verbose = true; break;
      default: throw new Error(`Unknown argument: ${a}`);
    }
  }
  return opts;
}

function usage() {
  console.log(`Usage: node tools/recipes/extract-bench-tiers.js [options]

  --assets <dir>   _Assets root (default: <repo>/_Assets)
  --out <dir>      output dir   (default: <repo>/docs/recipes)
  --verbose        log each bench scanned
  -h, --help       this help`);
}

function normalizeMaterials(req) {
  const mats = Array.isArray(req && req.Material) ? req.Material : [];
  return mats
    .map((m) => ({ itemId: m.ItemId, quantity: m.Quantity }))
    .filter((m) => m.itemId);
}

/** One bench item -> { itemId, benchId, categories, upgradable, maxTier, tiers[] }, or null if not a bench. */
function readBench(file, itemId) {
  let json;
  try {
    json = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return null;
  }
  const bench = json && json.BlockType && json.BlockType.Bench;
  if (!bench) return null;

  const categories = Array.isArray(bench.Categories)
    ? bench.Categories.map((c) => c.Id).filter(Boolean)
    : [];
  const levels = Array.isArray(bench.TierLevels) ? bench.TierLevels : [];

  // Each TierLevels[i] = state of tier (i+1); its UpgradeRequirement is the cost to reach tier (i+2).
  const tiers = levels.map((lvl, i) => ({
    tier: i + 1,
    craftingTimeReduction: typeof lvl.CraftingTimeReductionModifier === "number" ? lvl.CraftingTimeReductionModifier : 0,
    upgradeToNext: lvl.UpgradeRequirement
      ? {
          toTier: i + 2,
          timeSeconds: typeof lvl.UpgradeRequirement.TimeSeconds === "number" ? lvl.UpgradeRequirement.TimeSeconds : null,
          materials: normalizeMaterials(lvl.UpgradeRequirement),
        }
      : null,
  }));

  return {
    itemId,
    benchId: bench.Id || null,
    categories,
    upgradable: tiers.some((t) => t.upgradeToNext),
    maxTier: tiers.length ? tiers.length : 1,
    tiers,
  };
}

function collect(assetsDir, verbose) {
  const dir = path.join(assetsDir, BENCH_DIR);
  if (!fs.existsSync(dir)) throw new Error(`Bench assets not found: ${dir}`);
  const benches = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith(".json")) continue;
    const itemId = name.slice(0, -5);
    const bench = readBench(path.join(dir, name), itemId);
    if (!bench) continue;
    if (verbose) console.log(`  ${itemId} (benchId=${bench.benchId}, tiers=${bench.maxTier}, upgradable=${bench.upgradable})`);
    benches.push(bench);
  }
  return benches;
}

function renderText(benches, generatedAt) {
  const lines = [];
  lines.push("# Hytale Bench Tier Reference");
  lines.push("");
  lines.push(`> Generated ${generatedAt} from \`_Assets/Server/Item/Items/Bench/*.json\` (\`BlockType.Bench.TierLevels\`).`);
  lines.push("");
  lines.push("Each placed bench starts at **tier 1**. A tier's `upgrade -> N` line is the material + time cost to reach the next tier. Which *recipes* a tier unlocks is a runtime SDK check (`isRestrictedByBenchTierLevel`), not in this data.");
  lines.push("");
  lines.push("Regenerate: `node tools/recipes/extract-bench-tiers.js`");
  lines.push("");

  const upgradable = benches.filter((b) => b.upgradable);
  const flat = benches.filter((b) => !b.upgradable);

  lines.push(`## Upgradable benches (${upgradable.length})`);
  lines.push("");
  for (const b of upgradable) {
    lines.push(`### ${b.itemId}  (benchId=${b.benchId}, maxTier=${b.maxTier})`);
    if (b.categories.length) lines.push(`categories: ${b.categories.join(", ")}`);
    for (const t of b.tiers) {
      const bonus = t.craftingTimeReduction ? ` (craft-speed +${Math.round(t.craftingTimeReduction * 100)}%)` : "";
      if (t.upgradeToNext) {
        const mats = t.upgradeToNext.materials.map((m) => `${m.quantity}x ${m.itemId}`).join(", ");
        const secs = t.upgradeToNext.timeSeconds != null ? `, ${t.upgradeToNext.timeSeconds}s` : "";
        lines.push(`- T${t.tier}${bonus} -> T${t.upgradeToNext.toTier}: ${mats}${secs}`);
      } else {
        lines.push(`- T${t.tier}${bonus} (max tier)`);
      }
    }
    lines.push("");
  }

  lines.push(`## Single-tier benches (${flat.length})`);
  lines.push("");
  for (const b of flat) lines.push(`- ${b.itemId} (benchId=${b.benchId})`);
  lines.push("");

  return lines.join("\n");
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { usage(); return; }

  const assetsDir = path.resolve(opts.assets || DEFAULT_ASSETS);
  const outDir = path.resolve(opts.out || DEFAULT_OUT);
  if (!fs.existsSync(assetsDir)) throw new Error(`Assets directory not found: ${assetsDir}`);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Assets : ${assetsDir}`);
  console.log(`Output : ${outDir}`);
  console.log("");

  const t0 = Date.now();
  const benches = collect(assetsDir, opts.verbose);
  const generatedAt = new Date().toISOString();

  const byBenchId = {};
  for (const b of benches) if (b.benchId) byBenchId[b.benchId] = b.itemId;

  const jsonPayload = {
    generatedAt,
    source: "_Assets/Server/Item/Items/Bench/*.json (BlockType.Bench.TierLevels)",
    note: "Upgrade ladder + cost per bench. Recipe->tier gating is runtime (isRestrictedByBenchTierLevel), not in this index.",
    count: benches.length,
    upgradableCount: benches.filter((b) => b.upgradable).length,
    byBenchId,
    benches,
  };

  fs.writeFileSync(path.join(outDir, "bench-tiers.json"), `${JSON.stringify(jsonPayload, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "bench-tiers.txt"), renderText(benches, generatedAt));

  console.log(`Benches: ${benches.length} (${jsonPayload.upgradableCount} upgradable)`);
  console.log(`Wrote  : bench-tiers.json, bench-tiers.txt`);
  console.log(`Done in ${Date.now() - t0}ms`);
}

main();
