#!/usr/bin/env node
/*
 * Build docs/sdk-reference/methods.json + methods.txt from per-package .md files.
 * Fast — no jar/javap. Called by extract-sdk-reference.js and usable standalone.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { discoverPackages, parsePackageFile } = require("./library/parse-sdk-package");

const DEFAULT_REF_DIR = path.resolve(__dirname, "..", "..", "docs", "sdk-reference");

function readStampedVersion(outDir) {
  const stampPath = path.join(outDir, ".sdk-source.json");
  if (!fs.existsSync(stampPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(stampPath, "utf8")).version || null;
  } catch {
    return null;
  }
}

/**
 * @param {object} opts
 * @param {string} [opts.outDir]
 * @param {boolean} [opts.quiet]
 * @param {string} [opts.version]
 */
function buildMethodIndex({ outDir = DEFAULT_REF_DIR, quiet = false, version } = {}) {
  const resolvedVersion = version || readStampedVersion(outDir);
  const packages = discoverPackages(outDir);
  if (!packages.length) {
    throw new Error(`No packages found under ${outDir} — has the extractor run?`);
  }

  const entries = [];
  const byMethod = new Map();

  for (const meta of packages) {
    const parsed = parsePackageFile(path.join(outDir, meta.file));
    if (!parsed) continue;
    for (const cls of parsed.classes) {
      for (const method of cls.methods) {
        const row = {
          method: method.name,
          class: cls.name,
          package: parsed.pkg,
          file: meta.file,
          signature: method.signature,
        };
        entries.push(row);
        if (!byMethod.has(method.name)) byMethod.set(method.name, []);
        byMethod.get(method.name).push(row);
      }
    }
  }

  entries.sort((a, b) => a.method.localeCompare(b.method)
    || a.class.localeCompare(b.class)
    || a.package.localeCompare(b.package));

  const jsonPath = path.join(outDir, "methods.json");
  fs.writeFileSync(jsonPath, `${JSON.stringify({
    version: resolvedVersion,
    generatedBy: "tools/sdk/build-sdk-method-index.js",
    methodCount: entries.length,
    uniqueMethods: byMethod.size,
    entries,
  }, null, 2)}\n`);

  const txtLines = [
    `# Hytale Server SDK method index${resolvedVersion ? ` v${resolvedVersion}` : ""}`,
    "",
    "Grep-friendly: `grep placeBlock methods.txt` then open the listed .md file for context.",
    "Regenerate: `node tools/sdk/build-sdk-method-index.js` (or full extract — see tools/sdk/README.md)",
    "",
  ];
  for (const row of entries) {
    txtLines.push(`${row.method}\t${row.class}\t${row.package}\t${row.file}`);
  }
  const txtPath = path.join(outDir, "methods.txt");
  fs.writeFileSync(txtPath, `${txtLines.join("\n")}\n`);

  if (!quiet) {
    console.log(`Wrote ${jsonPath}`);
    console.log(`Wrote ${txtPath}`);
    console.log(`  ${entries.length} method entries, ${byMethod.size} unique names`);
  }
  return { jsonPath, txtPath, entries: entries.length, uniqueMethods: byMethod.size };
}

module.exports = { buildMethodIndex };

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
      console.log("Usage: node tools/sdk/build-sdk-method-index.js [--out <dir>]");
      process.exit(0);
    }
    buildMethodIndex(opts);
  } catch (err) {
    console.error(`build-sdk-method-index: ${err.message}`);
    process.exitCode = 1;
  }
}
