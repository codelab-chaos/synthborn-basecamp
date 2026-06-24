#!/usr/bin/env node
/*
 * Extract a quick-reference map of Hytale Server SDK classes most relevant to
 * synth-style modding. Reads the HytaleServer.jar from the Gradle cache (the
 * exact version the mod compiles against), runs `javap -protected` per public
 * top-level class in a curated allowlist of packages, and writes one markdown
 * file per package under docs/sdk/, plus an index.
 *
 * Cross-platform Node, no deps beyond JDK `jar` and `javap` on PATH.
 *
 * Usage:
 *   node tools/refs/sdk/extract-sdk-reference.js [--full] [--jar <path>] [--out <dir>]
 *
 * See tools/refs/sdk/README.md for the version-bump refresh workflow.
 *
 * Environment fallbacks:
 *   HYTALE_SERVER_JAR — explicit jar path
 */

"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { buildLlmsTxt } = require("./build-sdk-llms-txt");
const { buildMethodIndex } = require("./build-sdk-method-index");
const { buildSdkAppData } = require("./build-sdk-app-data");
const { MODULE_DIRS, modDir } = require("../../lib/workspace");

// Curated to the "neighborhood" a synth-style plugin works in. Reading
// `_references/hytale-mod-quickref/` and `docs/hytale-server-api-index.md`
// would lead a reader to exactly these packages.
const PACKAGES = [
  // Plugin lifecycle
  "com/hypixel/hytale/server/core/plugin",
  // Commands
  "com/hypixel/hytale/server/core/command/system",
  "com/hypixel/hytale/server/core/command/system/basecommands",
  // Universe / world / events
  "com/hypixel/hytale/server/core/universe",
  "com/hypixel/hytale/server/core/universe/world",
  "com/hypixel/hytale/server/core/universe/world/storage",
  "com/hypixel/hytale/server/core/universe/world/events",
  // Components / entities
  "com/hypixel/hytale/component",
  "com/hypixel/hytale/server/core/modules/entity/component",
  // Items / inventory (gatherer-relevant)
  "com/hypixel/hytale/server/core/modules/entity/item",
  "com/hypixel/hytale/server/core/modules/item",
  "com/hypixel/hytale/server/core/inventory",
  "com/hypixel/hytale/server/core/inventory/container",
  "com/hypixel/hytale/server/core/inventory/transaction",
  // First-level core modules — curated broad include, not recursive.
  // Add deeper subpackages on demand when work actually touches them.
  "com/hypixel/hytale/server/core/modules/block",
  "com/hypixel/hytale/server/core/modules/blockhealth",
  "com/hypixel/hytale/server/core/modules/blockset",
  "com/hypixel/hytale/server/core/modules/collision",
  "com/hypixel/hytale/server/core/modules/interaction",
  "com/hypixel/hytale/server/core/modules/physics",
  "com/hypixel/hytale/server/core/modules/projectile",
  "com/hypixel/hytale/server/core/modules/time",
  // NPC system
  "com/hypixel/hytale/server/npc",
  "com/hypixel/hytale/server/npc/role",
  "com/hypixel/hytale/server/npc/instructions",
  "com/hypixel/hytale/server/npc/corecomponents",
  "com/hypixel/hytale/server/npc/sensorinfo",
  // Messages, skins, common protocol types
  "com/hypixel/hytale/protocol",
  // Built-in plugins — Hytale's first-party mods, source of truth for how the engine's
  // mechanics are implemented. Modders subclass / register against these. Whole namespace
  // pulled because we keep discovering integration points the SDK reference didn't surface
  // (e.g. UndoActionRegistry under buildertools, BlockColorIndex for image→block conversion).
  // 37 subpackages, ~2500 classes — most are inner classes that javap will skip.
  "com/hypixel/hytale/builtin/adventure",
  "com/hypixel/hytale/builtin/ambience",
  "com/hypixel/hytale/builtin/asseteditor",
  "com/hypixel/hytale/builtin/audio",
  "com/hypixel/hytale/builtin/beds",
  "com/hypixel/hytale/builtin/blockphysics",
  "com/hypixel/hytale/builtin/blockspawner",
  "com/hypixel/hytale/builtin/blocktick",
  "com/hypixel/hytale/builtin/buildertools",
  "com/hypixel/hytale/builtin/commandmacro",
  "com/hypixel/hytale/builtin/crafting",
  "com/hypixel/hytale/builtin/creativehub",
  "com/hypixel/hytale/builtin/crouchslide",
  "com/hypixel/hytale/builtin/deployables",
  "com/hypixel/hytale/builtin/fallingblocks",
  "com/hypixel/hytale/builtin/fluid",
  "com/hypixel/hytale/builtin/hytalegenerator",
  "com/hypixel/hytale/builtin/instances",
  "com/hypixel/hytale/builtin/landiscovery",
  "com/hypixel/hytale/builtin/locate",
  "com/hypixel/hytale/builtin/mantling",
  "com/hypixel/hytale/builtin/model",
  "com/hypixel/hytale/builtin/mounts",
  "com/hypixel/hytale/builtin/npccombatactionevaluator",
  "com/hypixel/hytale/builtin/npceditor",
  "com/hypixel/hytale/builtin/parkour",
  "com/hypixel/hytale/builtin/path",
  "com/hypixel/hytale/builtin/portals",
  "com/hypixel/hytale/builtin/randomtick",
  "com/hypixel/hytale/builtin/safetyroll",
  "com/hypixel/hytale/builtin/sprintforce",
  "com/hypixel/hytale/builtin/tagset",
  "com/hypixel/hytale/builtin/teleport",
  "com/hypixel/hytale/builtin/triggervolumes",
  "com/hypixel/hytale/builtin/weather",
  "com/hypixel/hytale/builtin/worldgen",
];

function parseArgs(argv) {
  const opts = { jar: null, out: null, full: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${arg} requires a value`);
      return v;
    };
    switch (arg) {
      case "-h":
      case "--help":
        opts.help = true;
        return opts;
      case "--jar":
        opts.jar = next();
        break;
      case "--out":
        opts.out = next();
        break;
      case "--full":
        // Auto-discover every package under com/hypixel/hytale/ with at least one
        // non-inner class. Replaces the curated PACKAGES allowlist.
        opts.full = true;
        break;
      case "--force":
        // Re-extract even when the source jar is unchanged since the last run.
        opts.force = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function usage() {
  console.log(`Usage:
  node tools/refs/sdk/extract-sdk-reference.js [--jar <path>] [--out <dir>]

Options:
  --jar    Most recent HytaleServer.jar under ~/.gradle/caches/.../com.hypixel.hytale/Server/
           (or HYTALE_SERVER_JAR env var)
  --out    <repo>/docs/sdk
  --full   Auto-discover every package (vs the curated allowlist)
  --force  Re-extract even if the source jar is unchanged since last run

Skips extraction when the source jar fingerprint (name/size/mtime/version/mode)
matches the last run, recorded in <out>/.sdk-source.json. Pass --force to override.
`);
}

function findPinnedSdkVersions() {
  // Scan each mod's build.gradle.kts for `compileOnly("com.hypixel.hytale:Server:VERSION")`.
  const versions = new Set();
  const stack = Object.keys(MODULE_DIRS).map((name) => modDir(name));
  while (stack.length) {
    const dir = stack.pop();
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "build" || entry.name === ".gradle") continue;
        stack.push(full);
      } else if (entry.name === "build.gradle.kts") {
        const text = fs.readFileSync(full, "utf8");
        const re = /com\.hypixel\.hytale:Server:([^"'\s)]+)/g;
        let m;
        while ((m = re.exec(text)) !== null) versions.add(m[1]);
      }
    }
  }
  return [...versions];
}

function jarUnder(versionDir) {
  for (const h of fs.readdirSync(versionDir)) {
    const hashRoot = path.join(versionDir, h);
    if (!fs.statSync(hashRoot).isDirectory()) continue;
    const jar = fs.readdirSync(hashRoot).find(f => f.endsWith(".jar"));
    if (jar) return path.join(hashRoot, jar);
  }
  return null;
}

function defaultJar(repoRoot) {
  if (process.env.HYTALE_SERVER_JAR) return process.env.HYTALE_SERVER_JAR;
  const cacheRoot = path.join(
    os.homedir(),
    ".gradle", "caches", "modules-2", "files-2.1",
    "com.hypixel.hytale", "Server"
  );
  if (!fs.existsSync(cacheRoot)) return null;

  // Prefer the version the mods actually pin in build.gradle.kts.
  const pinned = findPinnedSdkVersions();
  for (const v of pinned) {
    const versionDir = path.join(cacheRoot, v);
    if (fs.existsSync(versionDir)) {
      const jar = jarUnder(versionDir);
      if (jar) return jar;
    }
  }

  // Fall back: most-recent jar by jar-file mtime (not directory mtime).
  const candidates = [];
  for (const v of fs.readdirSync(cacheRoot)) {
    const versionDir = path.join(cacheRoot, v);
    if (!fs.statSync(versionDir).isDirectory()) continue;
    const jar = jarUnder(versionDir);
    if (jar) candidates.push({ jar, m: fs.statSync(jar).mtimeMs });
  }
  candidates.sort((a, b) => b.m - a.m);
  return candidates[0]?.jar || null;
}

let CACHED_JAR_ENTRIES = null;
function jarEntries(jar) {
  if (CACHED_JAR_ENTRIES) return CACHED_JAR_ENTRIES;
  const raw = execFileSync("jar", ["tf", jar], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  CACHED_JAR_ENTRIES = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  return CACHED_JAR_ENTRIES;
}

function listPublicClasses(jar, pkg) {
  return jarEntries(jar)
    .filter(s => s.startsWith(pkg + "/") && s.endsWith(".class"))
    .filter(s => !s.slice(pkg.length + 1).includes("/"))  // top-level only
    .filter(s => !s.includes("$"))                          // no inner classes
    .map(s => s.replace(/\.class$/, "").replace(/\//g, "."))
    .sort();
}

// Packages excluded from --full discovery. Engine plumbing with no modder-facing API:
//   - protocol/packets — wire-format DTOs; we work against high-level engine APIs
//   - codec — serialization machinery; codecs are used via annotations, not subclassing
//   - hytalegenerator density / position-providers / curves / props — noise-asset JSON-loader
//     scaffolding (the noise *math* lives in procedurallib, which we keep)
const FULL_EXCLUDE_PREFIXES = [
  "com/hypixel/hytale/protocol/packets",
  "com/hypixel/hytale/codec",
  "com/hypixel/hytale/builtin/hytalegenerator/density",
  "com/hypixel/hytale/builtin/hytalegenerator/assets/density",
  "com/hypixel/hytale/builtin/hytalegenerator/assets/positionproviders",
  "com/hypixel/hytale/builtin/hytalegenerator/assets/curves",
  "com/hypixel/hytale/builtin/hytalegenerator/assets/props",
];

// Auto-discover every package under `com/hypixel/hytale/` that contains at least one
// top-level non-inner class. Replaces the hand-maintained PACKAGES allowlist when called
// in "full" mode — gives us complete coverage without hand-listing 150+ subpackages.
function discoverAllPackages(jar) {
  const pkgs = new Set();
  for (const entry of jarEntries(jar)) {
    if (!entry.endsWith(".class")) continue;
    if (!entry.startsWith("com/hypixel/hytale/")) continue;
    if (entry.includes("$")) continue;
    const slash = entry.lastIndexOf("/");
    if (slash <= 0) continue;
    const pkg = entry.slice(0, slash);
    if (FULL_EXCLUDE_PREFIXES.some(p => pkg === p || pkg.startsWith(p + "/"))) continue;
    pkgs.add(pkg);
  }
  return [...pkgs].sort();
}

function javap(jar, className) {
  try {
    return execFileSync("javap", ["-protected", "-classpath", jar, className], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (err) {
    return `// javap failed for ${className}: ${err.message}`;
  }
}

function isPublicTopLevel(javapOutput) {
  for (const line of javapOutput.split(/\r?\n/)) {
    if (/^Compiled from /.test(line)) continue;
    if (line.trim() === "") continue;
    return /^public\s+(?:abstract\s+|final\s+|sealed\s+|non-sealed\s+|static\s+)*(?:class|interface|enum|@interface|record)\s/.test(line);
  }
  return false;
}

function cleanJavap(javapOutput) {
  return javapOutput
    .split(/\r?\n/)
    .filter(line => !/^Compiled from /.test(line))
    .join("\n")
    .trim();
}

function shortName(fqcn) {
  const i = fqcn.lastIndexOf(".");
  return i < 0 ? fqcn : fqcn.slice(i + 1);
}

function pkgFile(pkg) {
  return pkg.replace(/\//g, ".") + ".md";
}

function renderPackage(jar, pkg, purpose) {
  const pkgDot = pkg.replace(/\//g, ".");
  const allClasses = listPublicClasses(jar, pkg);
  const sections = [];
  let publicCount = 0;
  let skipped = 0;
  for (const cls of allClasses) {
    const dump = javap(jar, cls);
    if (!isPublicTopLevel(dump)) { skipped++; continue; }
    publicCount++;
    sections.push(`## ${shortName(cls)}`);
    sections.push("");
    sections.push("```java");
    sections.push(cleanJavap(dump));
    sections.push("```");
    sections.push("");
  }
  const header = [
    `# ${pkgDot}`,
    "",
  ];
  if (purpose) {
    header.push(`> ${purpose}`);
    header.push("");
  }
  header.push(`${publicCount} public top-level type(s)` + (skipped ? ` (${skipped} package-private skipped)` : "") + ".");
  header.push("");
  header.push(`Auto-generated by [tools/refs/sdk/extract-sdk-reference.js](../../tools/refs/sdk/extract-sdk-reference.js). Do not edit by hand — regenerate on SDK updates.`);
  header.push("");
  header.push("---");
  header.push("");
  return { md: header.concat(sections).join("\n"), publicCount, skipped };
}

const PURPOSE = {
  "com/hypixel/hytale/server/core/plugin": "JavaPlugin base class + plugin lifecycle/init",
  "com/hypixel/hytale/server/core/command/system": "Command interface, sender, context, registry",
  "com/hypixel/hytale/server/core/command/system/basecommands": "Abstract base classes for player/world/async commands",
  "com/hypixel/hytale/server/core/universe": "Universe and PlayerRef entry points",
  "com/hypixel/hytale/server/core/universe/world": "World runtime context",
  "com/hypixel/hytale/server/core/universe/world/storage": "EntityStore and entity-component access",
  "com/hypixel/hytale/server/core/universe/world/events": "World/chunk/event subscription types",
  "com/hypixel/hytale/component": "ComponentType, Ref, Store — entity-component primitives",
  "com/hypixel/hytale/server/core/modules/entity/component": "Built-in entity components (TransformComponent, etc.)",
  "com/hypixel/hytale/server/core/modules/entity/item": "ItemComponent, PickupItemComponent — dropped-item entities",
  "com/hypixel/hytale/server/core/modules/item": "Item module + item-related commands",
  "com/hypixel/hytale/server/core/inventory": "ItemStack and inventory primitives",
  "com/hypixel/hytale/server/core/inventory/container": "Container abstractions (ItemStackItemContainer, etc.)",
  "com/hypixel/hytale/server/core/inventory/transaction": "Inventory transaction types",
  "com/hypixel/hytale/server/core/modules/block": "Block module — block placement, removal, runtime queries",
  "com/hypixel/hytale/server/core/modules/blockhealth": "Block health / damage / breaking",
  "com/hypixel/hytale/server/core/modules/blockset": "BlockSet registry and operations",
  "com/hypixel/hytale/server/core/modules/collision": "Collision detection module",
  "com/hypixel/hytale/server/core/modules/interaction": "Player/entity interaction events and handlers",
  "com/hypixel/hytale/server/core/modules/physics": "Physics module — velocity, gravity, knockback",
  "com/hypixel/hytale/server/core/modules/projectile": "Projectile module — arrows, thrown items, ballistics",
  "com/hypixel/hytale/server/core/modules/time": "World time / day-night / scheduling primitives",
  "com/hypixel/hytale/server/npc": "NPCPlugin, NPCEntity, role base classes",
  "com/hypixel/hytale/server/npc/role": "Role data and active-role types",
  "com/hypixel/hytale/server/npc/instructions": "Role JSON instruction structures",
  "com/hypixel/hytale/server/npc/corecomponents": "Built-in NPC components used by roles",
  "com/hypixel/hytale/server/npc/sensorinfo": "Sensor base classes + PositionProvider, Feature",
  "com/hypixel/hytale/protocol": "Wire types — FormattedMessage, PlayerSkin, etc.",
};

function extractVersion(jarPath) {
  const m = /Server-([\d.\-a-f]+)\.jar$/.exec(path.basename(jarPath));
  return m ? m[1] : null;
}

// Fingerprint of the source jar + extraction mode. If this is unchanged since the last
// run, the output is identical, so we can skip the (per-class javap) work entirely.
function sourceFingerprint(jar, full) {
  const st = fs.statSync(jar);
  return {
    jar: path.basename(jar),
    size: st.size,
    mtimeMs: Math.round(st.mtimeMs),
    version: extractVersion(jar),
    full: !!full,
  };
}

function fingerprintMatches(a, b) {
  return !!a && !!b
    && a.jar === b.jar && a.size === b.size && a.mtimeMs === b.mtimeMs
    && a.version === b.version && a.full === b.full;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { usage(); return; }

  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const jar = opts.jar || defaultJar(repoRoot);
  if (!jar || !fs.existsSync(jar)) {
    throw new Error("Could not locate HytaleServer.jar. Pass --jar <path> or set HYTALE_SERVER_JAR.");
  }
  const outDir = opts.out
    ? path.resolve(opts.out)
    : path.resolve(__dirname, "..", "..", "..", "docs", "sdk");
  fs.mkdirSync(outDir, { recursive: true });

  const version = extractVersion(jar);
  console.log(`JAR    : ${jar}`);
  if (version) console.log(`Version: ${version}`);
  console.log(`Output : ${outDir}`);
  console.log("");

  // Skip-if-unchanged: if the source jar + mode match the last run, the output would be
  // byte-identical, so there's nothing to do. --force overrides.
  const stampPath = path.join(outDir, ".sdk-source.json");
  const fingerprint = sourceFingerprint(jar, opts.full);
  if (!opts.force && fs.existsSync(stampPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(stampPath, "utf8"));
      if (fingerprintMatches(prev, fingerprint)) {
        console.log(`Up to date: already extracted from this jar (version ${version || "?"}, `
          + `${opts.full ? "full" : "curated"} mode). Pass --force to re-extract.`);
        const appData = buildSdkAppData({ refDir: outDir });
        console.log(`Wrote SDK app data: ${appData.counts.classes} classes, ${appData.counts.dependencies} dependency edges`);
        return;
      }
    } catch { /* malformed stamp — fall through and re-extract */ }
  }

  // In --full mode, discover every package from the jar directly. Curated PACKAGES list
  // is the default for fast targeted runs.
  const packages = opts.full ? discoverAllPackages(jar) : PACKAGES;
  if (opts.full) {
    console.log(`Mode: --full (auto-discovered ${packages.length} packages)`);
  }

  const rows = [];
  const total = packages.length;
  let i = 0;
  for (const pkg of packages) {
    i++;
    process.stdout.write(`  [${i}/${total}] ${pkg.replace(/\//g, ".")} ... `);
    const purpose = PURPOSE[pkg] || "";
    const { md, publicCount, skipped } = renderPackage(jar, pkg, purpose);
    fs.writeFileSync(path.join(outDir, pkgFile(pkg)), md);
    rows.push({ pkg, file: pkgFile(pkg), purpose, publicCount, skipped });
    console.log(`${publicCount} public (${skipped} skipped)`);
  }
  console.log("");
  console.log(`Wrote ${rows.length} package file(s) to ${outDir}`);

  // Derive the LLM-friendly flat index from the .md files we just wrote.
  const llms = buildLlmsTxt({ outDir, quiet: true, packages: rows, version });
  console.log(`Wrote llms.txt: ${llms.packages} packages, ${llms.classes} classes`);

  const methods = buildMethodIndex({ outDir, quiet: true, version });
  console.log(`Wrote methods index: ${methods.entries} entries, ${methods.uniqueMethods} unique names`);

  const appData = buildSdkAppData({ refDir: outDir });
  console.log(`Wrote SDK app data: ${appData.counts.classes} classes, ${appData.counts.dependencies} dependency edges`);

  // Record the fingerprint so the next run can skip when nothing changed.
  fs.writeFileSync(stampPath, JSON.stringify(fingerprint, null, 2) + "\n");
}

try {
  main();
} catch (err) {
  console.error(`extract-sdk-reference: ${err.message}`);
  process.exitCode = 1;
}
