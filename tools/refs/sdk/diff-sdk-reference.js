#!/usr/bin/env node
/*
 * Summarize SDK reference changes between two snapshots.
 *
 * Usage:
 *   node tools/refs/sdk/diff-sdk-reference.js                    # vs git HEAD
 *   node tools/refs/sdk/diff-sdk-reference.js --against main
 *   node tools/refs/sdk/diff-sdk-reference.js --against ../old-sdk-reference
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { parsePackageMarkdown } = require("./library/parse-sdk-package");

const DEFAULT_REF_DIR = path.resolve(__dirname, "..", "..", "..", "docs", "sdk");

function parseArgs(argv) {
  const opts = { refDir: DEFAULT_REF_DIR, against: "HEAD" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "-h":
      case "--help":
        opts.help = true;
        return opts;
      case "--out":
        opts.refDir = path.resolve(next());
        break;
      case "--against":
        opts.against = next();
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function usage() {
  console.log(`Usage:
  node tools/refs/sdk/diff-sdk-reference.js [--against <git-ref|dir>] [--out <dir>]

Compares the current docs/sdk tree to:
  - a git ref (default: HEAD) — reads committed .md blobs
  - another directory on disk

Prints added/removed packages, classes, and changed method signatures.
`);
}

function readStamp(refDir) {
  const stampPath = path.join(refDir, ".sdk-source.json");
  if (!fs.existsSync(stampPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(stampPath, "utf8"));
  } catch {
    return null;
  }
}

function snapshotFromDir(refDir) {
  const snap = new Map();
  for (const name of fs.readdirSync(refDir)) {
    if (!name.endsWith(".md")) continue;
    const parsed = parsePackageMarkdown(fs.readFileSync(path.join(refDir, name), "utf8"));
    if (parsed) snap.set(name, parsed);
  }
  return snap;
}

function snapshotFromGit(refDir, gitRef) {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const rel = path.relative(repoRoot, refDir).split(path.sep).join("/");
  let names;
  try {
    const ls = execFileSync("git", ["ls-tree", "-r", "--name-only", gitRef, "--", rel], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    names = ls.split(/\r?\n/).filter((n) => n.endsWith(".md")).map((n) => path.basename(n));
  } catch {
    throw new Error(`Could not list ${rel} at git ref "${gitRef}" — commit SDK docs first?`);
  }

  const snap = new Map();
  for (const name of names) {
    const blobPath = `${rel}/${name}`;
    let text;
    try {
      text = execFileSync("git", ["show", `${gitRef}:${blobPath}`], {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      });
    } catch {
      continue;
    }
    const parsed = parsePackageMarkdown(text);
    if (parsed) snap.set(name, parsed);
  }
  return snap;
}

function classMap(pkg) {
  const map = new Map();
  for (const cls of pkg.classes) {
    map.set(cls.name, cls);
  }
  return map;
}

function methodSet(cls) {
  return new Set(cls.methods.map((m) => m.signature));
}

// The signature view lists declared members only. A class that gains a superclass (or whose
// methods are hoisted into one) would otherwise report the moved methods as removed, so
// removals are judged against own + inherited members, resolved inside the same snapshot.
function stripGenerics(text) {
  let depth = 0;
  let out = "";
  for (const ch of text) {
    if (ch === "<") depth++;
    else if (ch === ">") depth = Math.max(0, depth - 1);
    else if (depth === 0) out += ch;
  }
  return out;
}

function ancestorNames(decl) {
  const flat = stripGenerics(decl.replace(/\s*\{\s*$/, ""));
  const names = [];
  for (const m of flat.matchAll(/\b(?:extends|implements)\s+([^]*?)(?=\s+(?:extends|implements|permits)\b|$)/g)) {
    for (const part of m[1].split(",")) {
      const name = part.trim();
      if (name) names.push(name);
    }
  }
  return names;
}

function indexClasses(snapshot) {
  const index = new Map();
  for (const entry of snapshot.values()) {
    for (const cls of entry.classes) index.set(`${entry.pkg}.${cls.name}`, cls);
  }
  return index;
}

function effectiveMethodSet(fqcn, index, seen = new Set()) {
  const cls = index.get(fqcn);
  if (!cls || seen.has(fqcn)) return new Set();
  seen.add(fqcn);
  const sigs = methodSet(cls);
  for (const parent of ancestorNames(cls.decl)) {
    for (const sig of effectiveMethodSet(parent, index, seen)) sigs.add(sig);
  }
  return sigs;
}

function compareSnapshots(current, baseline) {
  const addedPackages = [];
  const removedPackages = [];
  const addedClasses = [];
  const removedClasses = [];
  const changedClasses = [];

  const allFiles = new Set([...current.keys(), ...baseline.keys()]);
  const curIndex = indexClasses(current);
  const baseIndex = indexClasses(baseline);

  for (const file of [...allFiles].sort()) {
    const cur = current.get(file);
    const base = baseline.get(file);
    if (!base && cur) {
      addedPackages.push({ file, pkg: cur.pkg, classes: cur.classes.length });
      continue;
    }
    if (!cur && base) {
      removedPackages.push({ file, pkg: base.pkg, classes: base.classes.length });
      continue;
    }
    if (!cur || !base) continue;

    const curClasses = classMap(cur);
    const baseClasses = classMap(base);

    for (const [name, cls] of curClasses) {
      if (!baseClasses.has(name)) {
        addedClasses.push({ file, pkg: cur.pkg, class: name, methods: cls.methods.length });
      }
    }
    for (const [name, cls] of baseClasses) {
      if (!curClasses.has(name)) {
        removedClasses.push({ file, pkg: base.pkg, class: name, methods: cls.methods.length });
      }
    }
    for (const [name, cls] of curClasses) {
      const prev = baseClasses.get(name);
      if (!prev) continue;
      const curMethods = methodSet(cls);
      const prevMethods = methodSet(prev);
      const curEffective = effectiveMethodSet(`${cur.pkg}.${name}`, curIndex);
      const prevEffective = effectiveMethodSet(`${base.pkg}.${name}`, baseIndex);
      // Declared-only diff, then drop members that merely moved up to or down from a superclass.
      const added = [...curMethods].filter((m) => !prevMethods.has(m) && !prevEffective.has(m));
      const removed = [...prevMethods].filter((m) => !curMethods.has(m) && !curEffective.has(m));
      const moved = [...prevMethods].filter((m) => !curMethods.has(m) && curEffective.has(m)).length
        + [...curMethods].filter((m) => !prevMethods.has(m) && prevEffective.has(m)).length;
      if (added.length || removed.length || cls.decl !== prev.decl) {
        changedClasses.push({
          file,
          pkg: cur.pkg,
          class: name,
          added,
          removed,
          declChanged: cls.decl !== prev.decl,
          moved,
        });
      }
    }
  }

  return { addedPackages, removedPackages, addedClasses, removedClasses, changedClasses };
}

function printSection(title, rows, formatter) {
  if (!rows.length) return;
  console.log(`## ${title} (${rows.length})`);
  console.log("");
  for (const row of rows) console.log(formatter(row));
  console.log("");
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    return;
  }

  const currentStamp = readStamp(opts.refDir);
  const current = snapshotFromDir(opts.refDir);

  let baseline;
  let baselineLabel;
  if (fs.existsSync(opts.against) && fs.statSync(opts.against).isDirectory()) {
    baseline = snapshotFromDir(path.resolve(opts.against));
    baselineLabel = opts.against;
  } else {
    baseline = snapshotFromGit(opts.refDir, opts.against);
    baselineLabel = `git ${opts.against}`;
  }
  const diff = compareSnapshots(current, baseline);

  console.log("# SDK reference diff");
  console.log("");
  console.log(`Current : ${currentStamp?.version || "?"} (${current.size} packages) — ${opts.refDir}`);
  console.log(`Against : ${baselineLabel} (${baseline.size} packages)`);
  console.log("");

  printSection("Added packages", diff.addedPackages, (r) => `+ ${r.pkg} (${r.file}, ${r.classes} classes)`);
  printSection("Removed packages", diff.removedPackages, (r) => `- ${r.pkg} (${r.file}, ${r.classes} classes)`);
  printSection("Added classes", diff.addedClasses, (r) => `+ ${r.class} in ${r.pkg} (${r.file}, ${r.methods} methods)`);
  printSection("Removed classes", diff.removedClasses, (r) => `- ${r.class} in ${r.pkg} (${r.file}, ${r.methods} methods)`);
  printSection("Changed classes", diff.changedClasses, (r) => {
    const lines = [`~ ${r.class} in ${r.pkg} (${r.file})`];
    if (r.declChanged) lines.push("    declaration changed");
    if (r.moved) lines.push(`    ${r.moved} member(s) moved to or from a superclass (not removed)`);
    for (const sig of r.added) lines.push(`    + ${sig}`);
    for (const sig of r.removed) lines.push(`    - ${sig}`);
    return lines.join("\n");
  });

  const total = diff.addedPackages.length + diff.removedPackages.length
    + diff.addedClasses.length + diff.removedClasses.length + diff.changedClasses.length;
  if (!total) {
    console.log("No package/class/method signature changes detected.");
  } else {
    console.log(`Summary: ${total} change group(s).`);
    console.log("Note: This signature view omits deprecation annotations — compile with deprecation/removal lint or inspect javap -v.");
  }
}

try {
  main();
} catch (err) {
  console.error(`diff-sdk-reference: ${err.message}`);
  process.exitCode = 1;
}
