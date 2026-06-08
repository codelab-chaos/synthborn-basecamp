#!/usr/bin/env node
/*
 * Build docs/sdk-reference/llms.txt from the already-generated per-package
 * markdown files. Reads README.md for the package list/purposes, reads each
 * package .md for class declarations, emits a flat, grep-friendly index so
 * an LLM (or human) can decide which package file to cat without reading
 * them all.
 *
 * Fast (single-digit seconds) — no jar/javap involvement.
 *
 * Two entry points:
 *   - CLI: `node tools/sdk/build-sdk-llms-txt.js [--out <dir>]`
 *   - API: `require("./build-sdk-llms-txt").buildLlmsTxt({ outDir })`
 *
 * The extractor (`extract-sdk-reference.js`) imports this and calls it as a
 * final step so one command refreshes everything; this script also works
 * standalone when you only need to tweak the index format.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_REF_DIR = path.resolve(__dirname, "..", "..", "docs", "sdk-reference");

function discoverPackages(refDir) {
  // Discover packages by scanning .md files. Skip llms.txt (it's .txt anyway)
  // and any incidental files that don't start with `# com.hypixel.hytale`.
  const out = [];
  for (const name of fs.readdirSync(refDir).sort()) {
    if (!name.endsWith(".md")) continue;
    const file = path.join(refDir, name);
    const text = fs.readFileSync(file, "utf8");
    const headerMatch = /^# (com\.hypixel\.hytale[\w.]+)\s*$/m.exec(text);
    if (!headerMatch) continue;
    const pkg = headerMatch[1];
    const purposeMatch = /^>\s*(.+?)\s*$/m.exec(text);
    out.push({ pkg, file: name, purpose: purposeMatch ? purposeMatch[1] : "" });
  }
  return out;
}

function shortenDeclaration(line, pkg) {
  // line example:
  //   public abstract class com.hypixel.hytale.server.core.plugin.JavaPlugin extends com.hypixel.hytale.server.core.plugin.PluginBase {
  let s = line.trim();
  s = s.replace(/^public\s+/, "");
  s = s.replace(/\s*\{\s*$/, "");

  // Drop the class's own FQCN prefix (turn `pkg.ClassName` -> `ClassName`).
  const pkgPrefix = pkg.replace(/\./g, "\\.") + "\\.";
  s = s.replace(new RegExp(pkgPrefix + "(\\w+)"), "$1");

  // Shorten remaining com.hypixel.hytale.* references to short names.
  s = s.replace(/com\.hypixel\.hytale\.[\w.]+\.(\w+)/g, "$1");

  // Shorten common java.* references too — keeps lines scannable.
  s = s.replace(/java\.(?:lang|util|nio\.file|util\.function)\.([\w$]+)/g, "$1");

  return s.trim();
}

function parseClasses(filePath, pkg) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const out = [];
  let currentClass = null;
  let inCodeBlock = false;
  let declCaptured = false;

  for (const raw of lines) {
    const h2 = /^## (\S+)/.exec(raw);
    if (h2) {
      currentClass = h2[1];
      inCodeBlock = false;
      declCaptured = false;
      continue;
    }
    if (!currentClass || declCaptured) continue;
    if (raw === "```java") { inCodeBlock = true; continue; }
    if (inCodeBlock && raw.trim()) {
      out.push({ name: currentClass, decl: shortenDeclaration(raw, pkg) });
      declCaptured = true;
      inCodeBlock = false;
    }
  }
  return out;
}

/**
 * Build llms.txt at `${outDir}/llms.txt` from the per-package .md files in `outDir`.
 *
 * @param {object} opts
 * @param {string} [opts.outDir]   - Reference directory (default: docs/sdk-reference).
 * @param {boolean} [opts.quiet]   - Suppress console output.
 * @param {Array<{pkg:string,file:string,purpose:string}>} [opts.packages]
 *                                 - Pre-ordered package list (extractor passes its
 *                                   curated order). If omitted, packages are
 *                                   discovered from the filesystem and sorted.
 * @param {string} [opts.version]  - SDK version label (e.g., "0.5.1").
 * @returns {{ outFile: string, packages: number, classes: number }}
 */
function buildLlmsTxt({ outDir = DEFAULT_REF_DIR, quiet = false, packages, version } = {}) {
  const pkgs = packages && packages.length ? packages : discoverPackages(outDir);
  if (!pkgs.length) {
    throw new Error(`No packages found under ${outDir} — has the extractor run?`);
  }

  const lines = [];
  lines.push(`# Hytale Server SDK Reference${version ? ` v${version}` : ""}`);
  lines.push("");
  lines.push("> Flat index of public SDK types by package. Each entry shows the class declaration (kind, extends, implements) so you can pick which file to read for full method signatures.");
  lines.push("");
  lines.push("Source: `javap -protected` over the Hytale server jar. Excludes package-private classes and inner classes. FQCNs are shortened to leaf names for readability.");
  lines.push("");
  lines.push("Regenerate per-package files + this index: `node tools/sdk/extract-sdk-reference.js` (slow — re-reads the jar)");
  lines.push("Regenerate this index only:               `node tools/sdk/build-sdk-llms-txt.js` (fast — reads existing .md files)");
  lines.push("");
  lines.push("## How to use this file");
  lines.push("");
  lines.push("- Grep for the class name or interface you need: `grep ClassName llms.txt`");
  lines.push("- The package heading above each match tells you which `.md` file to read for method signatures.");
  lines.push("- Class entries are listed in jar/javap order within each package; packages in extractor order (lifecycle → commands → world → components → modules → npc → protocol).");
  lines.push("");

  let totalClasses = 0;
  for (const p of pkgs) {
    const classes = parseClasses(path.join(outDir, p.file), p.pkg);
    totalClasses += classes.length;
    lines.push(`## ${p.pkg}`);
    const purposeFrag = p.purpose ? `*${p.purpose}* — ` : "";
    lines.push(`${purposeFrag}[\`${p.file}\`](./${p.file}) (${classes.length})`);
    lines.push("");
    for (const c of classes) {
      lines.push(`- \`${c.name}\` — ${c.decl}`);
    }
    lines.push("");
  }

  const outFile = path.join(outDir, "llms.txt");
  fs.writeFileSync(outFile, lines.join("\n"));
  if (!quiet) {
    console.log(`Wrote ${outFile}`);
    console.log(`  ${pkgs.length} packages, ${totalClasses} classes`);
  }
  return { outFile, packages: pkgs.length, classes: totalClasses };
}

module.exports = { buildLlmsTxt };

function parseCliArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") opts.outDir = argv[++i];
    else if (arg === "-h" || arg === "--help") opts.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

if (require.main === module) {
  try {
    const opts = parseCliArgs(process.argv.slice(2));
    if (opts.help) {
      console.log(`Usage: node tools/sdk/build-sdk-llms-txt.js [--out <dir>]`);
      process.exit(0);
    }
    buildLlmsTxt(opts);
  } catch (err) {
    console.error(`build-sdk-llms-txt: ${err.message}`);
    process.exitCode = 1;
  }
}
