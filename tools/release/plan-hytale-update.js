#!/usr/bin/env node
"use strict";

/*
 * Fast Hytale release impact planner.
 *
 * Reads Assets.zip's central directory and hashes HytaleServer.jar, then maps
 * those cheap comparisons to Basecamp reference/app pipelines. Nothing is
 * changed unless --apply is supplied.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  BASECAMP_ROOT,
  defaultGameLatest,
  detectVersion,
  tocFromZip,
} = require("../refs/assets/build-assets-toc.js");

const TOC_ROOT = path.join(BASECAMP_ROOT, "docs", "refs", "assets", "toc");
const { inspectClasses } = require("../refs/sdk/extract-sdk-reference");
const SDK_STAMP = path.join(BASECAMP_ROOT, "docs", "sdk", ".sdk-source.json");

const IMPACTS = [
  {
    id: "labels",
    label: "English labels",
    matches: (file) => file === "Server/Languages/en-US/server.lang",
    commands: [["node", ["tools/refs/labels/extract-labels.js"]]],
  },
  {
    id: "npcs",
    label: "NPC catalog",
    matches: (file) => file.startsWith("Server/NPC/")
      || file === "Server/Languages/en-US/server.lang",
    commands: [["node", ["tools/refs/npcs/extract-npcs.js"]]],
  },
  {
    id: "recipes",
    label: "Recipes, loot, and Recipe Kiosk data",
    matches: (file) => file.startsWith("Server/Item/Recipes/")
      || file.startsWith("Server/Item/Items/")
      || file.startsWith("Server/Drops/"),
    commands: [
      ["node", ["tools/refs/recipes/extract-recipes.js"]],
      ["node", ["tools/refs/recipes/extract-loot.js"]],
      ["node", ["tools/refs/recipes/build-dependency-tree.js", "--all"]],
      ["node", ["apps/scripts/sync-recipe-data.js", "recipe-kiosk"]],
    ],
  },
  {
    id: "benches",
    label: "Bench tiers",
    matches: (file) => file.startsWith("Server/Item/Items/Bench/"),
    commands: [["node", ["tools/refs/recipes/extract-bench-tiers.js"]]],
  },
  {
    id: "item-icons",
    label: "Recipe Kiosk item icons",
    matches: (file) => file.startsWith("Common/Icons/")
      || file.startsWith("Server/Item/Items/")
      || file.startsWith("Server/Item/ResourceTypes/")
      || file.startsWith("Server/Item/Recipes/")
      || file.startsWith("Server/Drops/"),
    commands: [["npm", ["run", "build-icons"], "apps/recipe-kiosk"]],
  },
  {
    id: "prefabs",
    label: "Prefab catalog and Prefab Gallery",
    // Gallery voxel colors/material metadata are also derived from block item JSON.
    matches: (file) => file.startsWith("Server/Prefabs/")
      || file.startsWith("Server/Item/Items/"),
    commands: [
      ["node", ["tools/refs/prefabs/index-hytale-prefabs.js"]],
      ["npm", ["run", "build-source"], "apps/prefab-gallery"],
      ["npm", ["run", "build-previews"], "apps/prefab-gallery"],
    ],
  },
];

// Gameplay data with no generated Basecamp consumer yet. Changes here are
// surfaced for manual review in the sibling mods instead of being lumped in
// with audio, cosmetics, and other cosmetic-only churn.
const REVIEW_AREAS = [
  {
    id: "item-interactions",
    label: "Item interactions and root interactions",
    matches: (file) => file.startsWith("Server/Item/Interactions/")
      || file.startsWith("Server/Item/RootInteractions/"),
  },
  {
    id: "block-items",
    label: "Block item definitions (Server/Item/Block)",
    matches: (file) => file.startsWith("Server/Item/Block/"),
  },
  {
    id: "encounters",
    label: "Encounter manager and trigger volume assets",
    matches: (file) => file.startsWith("Server/EncounterManager/")
      || file.startsWith("Server/TriggerVolumes/"),
  },
  {
    id: "entities",
    label: "Entity definitions",
    matches: (file) => file.startsWith("Server/Entity/"),
  },
  {
    id: "worldgen",
    label: "World generation (HytaleGenerator, World)",
    matches: (file) => file.startsWith("Server/HytaleGenerator/")
      || file.startsWith("Server/World/"),
  },
  {
    id: "instances",
    label: "Instances and objectives",
    matches: (file) => file.startsWith("Server/Instances/")
      || file.startsWith("Server/Objective/"),
  },
  {
    id: "projectiles",
    label: "Projectiles and projectile configs",
    matches: (file) => file.startsWith("Server/Projectile"),
  },
];

function parseArgs(argv) {
  const args = {
    game: null,
    zip: null,
    jar: null,
    fromToc: null,
    toToc: null,
    apply: false,
    forceSdk: false,
    showFiles: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (!next) throw new Error(`${arg} requires a value`);
      return next;
    };
    if (arg === "--game") args.game = value();
    else if (arg === "--zip") args.zip = value();
    else if (arg === "--jar") args.jar = value();
    else if (arg === "--from-toc") args.fromToc = value();
    else if (arg === "--to-toc") args.toToc = value();
    else if (arg === "--apply") args.apply = true;
    else if (arg === "--force-sdk") args.forceSdk = true;
    else if (arg === "--show-files") args.showFiles = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "-h" || arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node tools/release/plan-hytale-update.js [options]

Default: inspect the installed Hytale release and print a read-only impact plan.

Options:
  --apply             Sync changed assets and run only affected Basecamp pipelines
  --from-toc FILE     Explicit previous asset snapshot (normally auto-selected)
  --to-toc FILE       Compare against an existing new snapshot instead of Assets.zip
  --game DIR          Hytale game/latest directory
  --zip FILE          Explicit Assets.zip
  --jar FILE          Explicit HytaleServer.jar
  --show-files        Print every added, changed, and removed asset path
  --json              Emit the plan as JSON (read-only; cannot be combined with --apply)
  --force-sdk         Run full SDK extraction even when the jar is unchanged

Environment:
  HYTALE_GAME_LATEST  Default game/latest directory override

Examples:
  cd tools && npm run update:plan
  cd tools && npm run update:plan -- --show-files
  cd tools && npm run update:apply
  node tools/release/plan-hytale-update.js --from-toc docs/refs/assets/toc/assets-toc-0.5.6.json
`);
}

function loadToc(file) {
  const full = path.resolve(file);
  const data = JSON.parse(fs.readFileSync(full, "utf8"));
  if (data.schema !== "hytale-assets-toc/v1" || !data.files) {
    throw new Error(`Invalid assets TOC: ${file}`);
  }
  return { ...data, path: full };
}

function versionParts(version) {
  return String(version || "")
    .split(/[.-]/)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

function compareVersions(a, b) {
  const aa = versionParts(a);
  const bb = versionParts(b);
  const length = Math.max(aa.length, bb.length);
  for (let i = 0; i < length; i++) {
    const av = aa[i] ?? 0;
    const bv = bb[i] ?? 0;
    if (av === bv) continue;
    if (typeof av === "number" && typeof bv === "number") return av - bv;
    return String(av).localeCompare(String(bv), undefined, { numeric: true });
  }
  return 0;
}

function findPreviousToc(nextVersion) {
  if (!fs.existsSync(TOC_ROOT)) return null;
  const candidates = fs.readdirSync(TOC_ROOT)
    .filter((name) => /^assets-toc-.+\.json$/.test(name))
    .map((name) => {
      try {
        return loadToc(path.join(TOC_ROOT, name));
      } catch {
        return null;
      }
    })
    .filter((toc) => toc && toc.version !== nextVersion)
    .filter((toc) => !nextVersion || compareVersions(toc.version, nextVersion) < 0)
    .sort((a, b) => compareVersions(b.version, a.version));
  return candidates[0] || null;
}

function sameEntry(a, b) {
  return Boolean(a && b && a.size === b.size
    && String(a.crc).toLowerCase() === String(b.crc).toLowerCase());
}

function diffFiles(previous, next) {
  const added = [];
  const changed = [];
  const removed = [];
  let unchanged = 0;
  for (const file of Object.keys(next).sort()) {
    if (!previous[file]) added.push(file);
    else if (!sameEntry(previous[file], next[file])) changed.push(file);
    else unchanged++;
  }
  for (const file of Object.keys(previous).sort()) {
    if (!next[file]) removed.push(file);
  }
  return { added, changed, removed, unchanged };
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function readSdkStamp() {
  try {
    return JSON.parse(fs.readFileSync(SDK_STAMP, "utf8"));
  } catch {
    return null;
  }
}

function inspectSdk(jar, version, force) {
  if (!fs.existsSync(jar)) {
    return { changed: true, reason: `server jar not found: ${jar}`, jar, version };
  }
  const stat = fs.statSync(jar);
  const sha256 = sha256File(jar);
  const previous = readSdkStamp();
  let changed = force || !previous;
  let reason = force ? "forced" : "no previous SDK stamp";

  if (!force && previous) {
    if (previous.sha256) {
      changed = previous.sha256 !== sha256 || previous.full !== true;
      reason = changed ? "server jar content or extraction mode changed" : "server jar SHA-256 matches";
    } else {
      // Old stamps did not contain a hash. Version + byte size is enough for the
      // one-time compatibility decision; the next extraction writes SHA-256.
      changed = previous.version !== version || previous.size !== stat.size || previous.full !== true;
      reason = changed
        ? "server version, size, or extraction mode changed"
        : "legacy SDK stamp matches version and size";
    }
  }

  let classPlan = null;
  if (changed) {
    const scan = inspectClasses(jar, path.dirname(SDK_STAMP), true, force);
    classPlan = { cached: !!scan.cache, added: scan.added.length, changed: scan.changed.length,
      removed: scan.removed.length, reused: scan.reused.length,
      inspect: scan.added.length + scan.changed.length };
  }
  return {
    classPlan,
    changed,
    reason,
    jar,
    version,
    size: stat.size,
    sha256,
    previousVersion: previous?.version || null,
    previousSha256: previous?.sha256 || null,
  };
}

function classifyImpact(files) {
  return IMPACTS.map((impact) => ({
    id: impact.id,
    label: impact.label,
    files: files.filter(impact.matches),
    commands: impact.commands,
  })).filter((impact) => impact.files.length > 0);
}

function classifyReview(files) {
  return REVIEW_AREAS.map((area) => ({
    id: area.id,
    label: area.label,
    files: files.filter(area.matches),
  })).filter((area) => area.files.length > 0);
}

function commandText(command) {
  const [program, args, cwd] = command;
  const body = [program, ...args].join(" ");
  return cwd ? `(cd ${cwd} && ${body})` : body;
}

function uniqueCommands(impacts) {
  const seen = new Set();
  const commands = [];
  for (const impact of impacts) {
    for (const command of impact.commands) {
      const key = JSON.stringify(command);
      if (!seen.has(key)) {
        seen.add(key);
        commands.push(command);
      }
    }
  }
  return commands;
}

function sdkCommands(plan) {
  if (!plan.sdk.changed) return [];
  return [
    ["node", [
      "tools/refs/sdk/extract-sdk-reference.js",
      "--full",
      "--jar",
      plan.paths.jar,
      ...(plan.sdk.reason === "forced" ? ["--force"] : []),
    ]],
    ["node", ["tools/refs/sdk/diff-sdk-reference.js"]],
  ];
}

function run(command) {
  const [program, args, cwd] = command;
  console.log(`\n> ${commandText(command)}`);
  const result = spawnSync(program, args, {
    cwd: cwd ? path.join(BASECAMP_ROOT, cwd) : BASECAMP_ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status ?? "unknown"}): ${commandText(command)}`);
  }
}

function buildPlan(args) {
  const game = path.resolve(args.game || defaultGameLatest());
  const zip = path.resolve(args.zip || path.join(game, "Assets.zip"));
  const jar = path.resolve(args.jar || path.join(game, "Server", "HytaleServer.jar"));
  const toToc = args.toToc ? loadToc(args.toToc) : null;
  if (!toToc && !fs.existsSync(zip)) {
    throw new Error(`Assets.zip not found: ${zip}. Pass --game/--zip or set HYTALE_GAME_LATEST.`);
  }

  const version = toToc?.version || detectVersion(game);
  if (!version || version === "unknown") {
    throw new Error(`Could not detect the installed Hytale version from ${game}`);
  }
  const previous = args.fromToc ? loadToc(args.fromToc) : findPreviousToc(version);
  if (!previous) {
    throw new Error(`No previous asset TOC found before ${version}. Pass --from-toc <file>.`);
  }
  const nextFiles = toToc?.files || tocFromZip(zip);
  const diff = diffFiles(previous.files, nextFiles);
  const changedFiles = [...new Set([...diff.added, ...diff.changed, ...diff.removed])].sort();
  const impacts = classifyImpact(changedFiles);
  const classified = new Set(impacts.flatMap((impact) => impact.files));
  const unrouted = changedFiles.filter((file) => !classified.has(file));
  const review = classifyReview(unrouted);
  const reviewed = new Set(review.flatMap((area) => area.files));
  const unclassified = unrouted.filter((file) => !reviewed.has(file));
  const sdk = inspectSdk(jar, version, args.forceSdk);
  const targetTocPath = toToc?.path || path.join(TOC_ROOT, `assets-toc-${version}.json`);
  let snapshotMatches = Boolean(toToc);
  if (!toToc && fs.existsSync(targetTocPath)) {
    try {
      const snapshotDiff = diffFiles(loadToc(targetTocPath).files, nextFiles);
      snapshotMatches = snapshotDiff.added.length === 0
        && snapshotDiff.changed.length === 0
        && snapshotDiff.removed.length === 0;
    } catch {
      snapshotMatches = false;
    }
  }

  return {
    version: { from: previous.version, to: version },
    paths: {
      game,
      zip,
      jar,
      fromToc: previous.path,
      toToc: targetTocPath,
    },
    snapshotMatches,
    assets: { ...diff, totalChanged: changedFiles.length, files: changedFiles },
    impacts,
    review,
    unclassified,
    sdk,
  };
}

function printPlan(plan, showFiles, willApply = false) {
  const { assets, sdk } = plan;
  console.log(`Hytale ${plan.version.from} -> ${plan.version.to} impact plan`);
  console.log("");
  console.log("Fast checks");
  console.log(`  Assets: ${assets.added.length} added, ${assets.changed.length} changed,`
    + ` ${assets.removed.length} removed, ${assets.unchanged.toLocaleString()} unchanged`);
  console.log(`  TOC:    ${plan.snapshotMatches ? "ready" : "capture"} - ${path.relative(BASECAMP_ROOT, plan.paths.toToc)}`);
  console.log(`  SDK:    ${sdk.changed ? "EXTRACT" : "skip"} - ${sdk.reason}`);
  if (sdk.classPlan) {
    const c = sdk.classPlan;
    console.log(`  Classes: ${c.added} new/uncached, ${c.changed} bytecode changes, ${c.removed} removed, ${c.reused} reused; ${c.inspect} to inspect`);
  }

  console.log("");
  console.log("Affected Basecamp areas");
  if (plan.impacts.length === 0) console.log("  none");
  for (const impact of plan.impacts) {
    console.log(`  UPDATE ${impact.label} (${impact.files.length} source file(s))`);
  }
  for (const area of plan.review) {
    console.log(`  REVIEW ${area.label} (${area.files.length} source file(s)) - gameplay data with no generated consumer; check the sibling mods`);
  }
  if (plan.unclassified.length > 0) {
    console.log(`  NOTE   ${plan.unclassified.length} changed asset file(s) do not feed a generated app/reference`);
  }

  const commands = uniqueCommands(plan.impacts);
  commands.push(...sdkCommands(plan));
  console.log("");
  console.log("Planned derived updates");
  if (commands.length === 0) console.log("  none - snapshots/version pins and normal mod builds only");
  for (const command of commands) console.log(`  ${commandText(command)}`);

  if (showFiles && assets.files.length > 0) {
    console.log("");
    console.log("Changed asset paths");
    for (const file of assets.files) {
      const kind = assets.added.includes(file) ? "A"
        : assets.removed.includes(file) ? "D" : "M";
      console.log(`  ${kind} ${file}`);
    }
  }

  console.log("");
  if (willApply) console.log("Plan complete; --apply selected.");
  else console.log("Read-only plan complete. Run with --apply to sync assets and execute this plan.");
}

function applyPlan(plan) {
  console.log("\nApplying Basecamp release updates...");
  if (plan.assets.totalChanged > 0) {
    run(["node", [
      "tools/refs/assets/sync-assets.js",
      "--zip",
      plan.paths.zip,
      "--from-toc",
      plan.paths.fromToc,
    ]]);
  }

  if (!plan.snapshotMatches) {
    run(["node", [
      "tools/refs/assets/build-assets-toc.js",
      "--zip",
      plan.paths.zip,
      "--version",
      plan.version.to,
      "--out",
      plan.paths.toToc,
    ]]);
  } else {
    console.log(`\nReusing existing asset snapshot: ${path.relative(BASECAMP_ROOT, plan.paths.toToc)}`);
  }

  // SDK extraction updates the shared version stamp consumed by recipe/app data.
  for (const command of sdkCommands(plan)) run(command);
  for (const command of uniqueCommands(plan.impacts)) run(command);
  console.log("\nBasecamp release updates complete.");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return usage();
  if (args.json && args.apply) throw new Error("--json and --apply cannot be combined");
  const plan = buildPlan(args);
  if (args.json) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  printPlan(plan, args.showFiles, args.apply);
  if (args.apply) applyPlan(plan);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`plan-hytale-update: ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  IMPACTS,
  REVIEW_AREAS,
  buildPlan,
  classifyImpact,
  classifyReview,
  compareVersions,
  diffFiles,
  findPreviousToc,
};
