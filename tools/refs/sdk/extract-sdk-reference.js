#!/usr/bin/env node
/*
 * Deterministic incremental SDK reference generation. Compare JAR class-entry
 * fingerprints, batch javap for new/changed classes, and write changed package
 * Markdown only. --full selects the established SDK scope; --force bypasses reuse.
 * Requires JDK jar/javap and unzip. No network, npm packages, or LLM calls.
 * See README.md for cache invalidation, coverage limits, and --plan/--json preflight.
 */

"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { buildLlmsTxt } = require("./build-sdk-llms-txt");
const { buildMethodIndex } = require("./build-sdk-method-index");
const { buildSdkAppData } = require("./build-sdk-app-data");
const { tocFromZip } = require("../assets/build-assets-toc");
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
      case "--plan":
        opts.plan = true;
        break;
      case "--json":
        opts.json = true;
        opts.plan = true;
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
  --force  Reinspect every class, bypassing the signature cache
  --plan   Read-only class-change preflight (no disassembly or writes)
  --json   Emit the preflight as JSON

Reuses class signatures in <out>/.sdk-cache.json; missing/incompatible cache
causes a batched cold inspection. Only changed package Markdown is written.
The completed source version and jar hash are recorded in <out>/.sdk-source.json.
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

function renderPackage(pkg, purpose, allClasses, dumps) {
  const pkgDot = pkg.replace(/\//g, ".");
  const sections = [];
  let publicCount = 0;
  let skipped = 0;
  for (const cls of allClasses) {
    const dump = dumps[cls].dump;
    if (!isPublicTopLevel(dump)) {
      skipped++;
    } else {
      publicCount++;
      sections.push(`## ${shortName(cls)}`);
      sections.push("");
      sections.push("```java");
      sections.push(cleanJavap(dump));
      sections.push("```");
      sections.push("");
    }
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
  if (m) return m[1];
  try {
    const manifest = execFileSync("unzip", ["-p", jarPath, "META-INF/MANIFEST.MF"], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    return manifest.match(/Implementation-Version:\s*([^\r\n]+)/i)?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

// Fingerprint of the source jar + extraction mode. If this is unchanged since the last
// run, the output is identical, so we can skip the (per-class javap) work entirely.
function sourceFingerprint(jar, full) {
  const st = fs.statSync(jar);
  return {
    jar: path.basename(jar),
    size: st.size,
    mtimeMs: Math.round(st.mtimeMs),
    sha256: sha256File(jar),
    version: extractVersion(jar),
    full: !!full,
  };
}

// Cache keys include extraction rules and javap version: changes to either must
// invalidate signatures even when the game jar is byte-identical.
function cacheKey() {
  return sha256File(__filename) + ":" + execFileSync("javap", ["-version"], { encoding: "utf8" }).trim();
}

function readCache(outDir, key) {
  try {
    const cache = JSON.parse(fs.readFileSync(path.join(outDir, ".sdk-cache.json"), "utf8"));
    if (cache.schema !== 1 || cache.key !== key || !cache.classes) return null;
    for (const entry of Object.values(cache.classes)) {
      if (typeof entry.dump !== "string" || typeof entry.crc !== "string" || !Number.isInteger(entry.size)) return null;
    }
    return cache;
  } catch { return null; }
}

function inspectClasses(jar, outDir, full, force = false) {
  CACHED_JAR_ENTRIES = null;
  const key = cacheKey();
  const cache = force ? null : readCache(outDir, key);
  const packages = full ? discoverAllPackages(jar) : PACKAGES;
  const classesByPackage = new Map(packages.map(pkg => [pkg, listPublicClasses(jar, pkg)]));
  const toc = tocFromZip(jar);
  const classes = {};
  const added = [], changed = [], reused = [];
  for (const name of [...classesByPackage.values()].flat()) {
    const entry = toc[name.replace(/\./g, "/") + ".class"];
    if (!entry) throw new Error(`Missing ZIP fingerprint for ${name}`);
    classes[name] = entry;
    const previous = cache?.classes[name];
    if (!previous) added.push(name);
    else if (previous.crc !== entry.crc || previous.size !== entry.size) changed.push(name);
    else reused.push(name);
  }
  const removed = Object.keys(cache?.classes || {}).filter(name => !classes[name]);
  return { key, cache, packages, classesByPackage, classes, added, changed, reused, removed };
}

function batchJavap(jar, names) {
  const dumps = {};
  for (let i = 0; i < names.length; i += 50) {
    const batch = names.slice(i, i + 50);
    // Fail before writing any output: never turn a javap error into a cached
    // package-private class and silently lose its public API.
    const output = execFileSync("javap", ["-protected", "-classpath", jar, ...batch], {
      encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
    });
    for (const part of output.split(/^}\r?$/m)) {
      if (!part.trim()) continue;
      const dump = cleanJavap(part + "}");
      const name = dump.match(/^(?:(?:public|protected|abstract|final|sealed|non-sealed|static)\s+)*(?:class|interface|enum|@interface|record)\s+([^\s<{]+)/m)?.[1];
      if (!name || !batch.includes(name) || dumps[name]) throw new Error("Unexpected javap batch output");
      dumps[name] = dump;
    }
    for (const name of batch) if (!dumps[name]) throw new Error(`No javap output for ${name}`);
    console.log(`  Inspected ${Math.min(i + batch.length, names.length)}/${names.length} classes`);
  }
  return dumps;
}

function writeIfChanged(file, text) {
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === text) return false;
  fs.writeFileSync(file, text);
  return true;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { usage(); return; }
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const jar = opts.jar || defaultJar(repoRoot);
  if (!jar || !fs.existsSync(jar)) throw new Error("Could not locate HytaleServer.jar. Pass --jar <path>.");
  const outDir = opts.out ? path.resolve(opts.out) : path.join(repoRoot, "docs", "sdk");
  const fingerprint = sourceFingerprint(jar, opts.full);
  const plan = inspectClasses(jar, outDir, opts.full, opts.force);
  const summary = {
    version: fingerprint.version, baselineVersion: plan.cache?.version || null,
    cache: plan.cache ? "ready" : "cold (all classes need inspection)",
    packages: plan.packages.length, total: Object.keys(plan.classes).length,
    added: plan.added, changed: plan.changed, removed: plan.removed,
    reused: plan.reused.length, inspect: plan.added.length + plan.changed.length,
  };
  if (opts.json) { console.log(JSON.stringify(summary, null, 2)); return; }
  console.log(`SDK ${summary.baselineVersion || "uncached"} -> ${summary.version}: ${summary.total} classes, ${summary.packages} packages`);
  console.log(`Class bytecode: ${summary.added.length} new/uncached, ${summary.changed.length} changed, ${summary.removed.length} removed, ${summary.reused} reused`);
  console.log(`javap: ${summary.inspect} classes in ${Math.ceil(summary.inspect / 50)} batches`);
  if (opts.plan) { console.log("Read-only plan; bytecode changes may leave public signatures unchanged."); return; }

  const dumps = batchJavap(jar, [...plan.added, ...plan.changed]);
  const classes = {};
  for (const [name, entry] of Object.entries(plan.classes)) {
    classes[name] = { ...entry, dump: dumps[name] ?? plan.cache.classes[name].dump };
  }
  // All disassembly succeeds before any generated files are changed.
  const rendered = plan.packages.map(pkg => ({ pkg, file: pkgFile(pkg), purpose: PURPOSE[pkg] || "",
    ...renderPackage(pkg, PURPOSE[pkg] || "", plan.classesByPackage.get(pkg), classes) }));
  fs.mkdirSync(outDir, { recursive: true });
  let written = 0, deleted = 0;
  const expected = new Set(rendered.map(row => row.file));
  for (const file of fs.readdirSync(outDir)) {
    if (!opts.full || !/^com\.hypixel\.hytale(?:\..*)?\.md$/.test(file) || expected.has(file)) continue;
    const target = path.join(outDir, file);
    if (!fs.readFileSync(target, "utf8").includes("Auto-generated by [tools/refs/sdk/extract-sdk-reference.js]")) continue;
    fs.unlinkSync(target);
    deleted++;
  }
  for (const row of rendered) if (writeIfChanged(path.join(outDir, row.file), row.md)) written++;
  const version = fingerprint.version;
  const llms = buildLlmsTxt({ outDir, quiet: true, packages: rendered, version });
  const methods = buildMethodIndex({ outDir, quiet: true, version });
  // Pass the new source explicitly; the success stamp is only committed after
  // all indexes/app data succeed, and must not label new data with the old version.
  const appData = buildSdkAppData({ refDir: outDir, sourceStamp: fingerprint,
    ...(opts.out ? { outFile: path.join(outDir, "sdk-app-data.json") } : {}) });
  writeIfChanged(path.join(outDir, ".sdk-cache.json"), JSON.stringify({ schema: 1, key: plan.key, version, classes }) + "\n");
  writeIfChanged(path.join(outDir, ".sdk-source.json"), JSON.stringify(fingerprint, null, 2) + "\n");
  console.log(`Package Markdown: ${written} written, ${deleted} removed, ${rendered.length - written} untouched`);
  console.log(`Indexes: ${llms.classes} classes, ${methods.entries} methods; app: ${appData.counts.cards} cards`);
}

if (require.main === module) {
  try { main(); } catch (err) { console.error(`extract-sdk-reference: ${err.message}`); process.exitCode = 1; }
}
module.exports = { inspectClasses, batchJavap, renderPackage, main };
