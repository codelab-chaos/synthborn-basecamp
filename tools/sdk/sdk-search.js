#!/usr/bin/env node
/*
 * Search docs/sdk-reference by class, method, package, or free-text grep.
 *
 * Usage:
 *   node tools/sdk/sdk-search.js BlockPlaceUtils
 *   node tools/sdk/sdk-search.js --method placeBlock
 *   node tools/sdk/sdk-search.js --package interaction
 *   node tools/sdk/sdk-search.js --extends JavaPlugin
 *   node tools/sdk/sdk-search.js --grep "CompletableFuture"
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { loadReference } = require("./library/parse-sdk-package");

const DEFAULT_REF_DIR = path.resolve(__dirname, "..", "..", "docs", "sdk-reference");
const MAX_RESULTS = 40;

function parseArgs(argv) {
  const opts = {
    refDir: DEFAULT_REF_DIR,
    mode: "class",
    query: "",
    limit: MAX_RESULTS,
  };
  const positional = [];

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
      case "--method":
        opts.mode = "method";
        opts.query = next() || "";
        break;
      case "--package":
      case "--pkg":
        opts.mode = "package";
        opts.query = next() || "";
        break;
      case "--extends":
        opts.mode = "extends";
        opts.query = next() || "";
        break;
      case "--implements":
        opts.mode = "implements";
        opts.query = next() || "";
        break;
      case "--grep":
        opts.mode = "grep";
        opts.query = next() || "";
        break;
      case "--limit":
        opts.limit = Number(next());
        break;
      default:
        positional.push(arg);
    }
  }

  if (!opts.query && positional.length) {
    opts.query = positional.join(" ");
  }
  return opts;
}

function usage() {
  console.log(`Usage:
  node tools/sdk/sdk-search.js <ClassName>
  node tools/sdk/sdk-search.js --method <name>
  node tools/sdk/sdk-search.js --package <substring>
  node tools/sdk/sdk-search.js --extends <Type>
  node tools/sdk/sdk-search.js --implements <Type>
  node tools/sdk/sdk-search.js --grep <text>

Options:
  --out <dir>   SDK reference directory (default: docs/sdk-reference)
  --limit N     Max results (default: ${MAX_RESULTS})
`);
}

function loadMethodIndex(refDir) {
  const indexPath = path.join(refDir, "methods.json");
  if (!fs.existsSync(indexPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(indexPath, "utf8"));
  } catch {
    return null;
  }
}

function printHit(hit) {
  console.log(`${hit.class}.${hit.method}`);
  console.log(`  ${hit.package}`);
  console.log(`  ${hit.file}`);
  if (hit.signature) console.log(`  ${hit.signature}`);
  console.log("");
}

function search(opts) {
  const { refDir, mode, query, limit } = opts;
  if (!query) throw new Error("Missing search query");

  const q = query.toLowerCase();
  const hits = [];

  if (mode === "method") {
    const index = loadMethodIndex(refDir);
    if (index?.entries) {
      for (const row of index.entries) {
        if (row.method.toLowerCase().includes(q)) hits.push(row);
      }
    } else {
      const { byFile } = loadReference(refDir);
      for (const pkg of byFile.values()) {
        for (const cls of pkg.classes) {
          for (const method of cls.methods) {
            if (method.name.toLowerCase().includes(q)) {
              hits.push({
                method: method.name,
                class: cls.name,
                package: pkg.pkg,
                file: pkg.file,
                signature: method.signature,
              });
            }
          }
        }
      }
    }
  } else {
    const { packages, byFile } = loadReference(refDir);

    if (mode === "package") {
      for (const meta of packages) {
        if (meta.pkg.toLowerCase().includes(q) || meta.file.toLowerCase().includes(q)) {
          hits.push({
            method: "(package)",
            class: meta.file.replace(/\.md$/, ""),
            package: meta.pkg,
            file: meta.file,
            signature: meta.purpose || `${byFile.get(meta.file)?.classes.length || 0} class(es)`,
          });
        }
      }
    } else {
      for (const pkg of byFile.values()) {
        for (const cls of pkg.classes) {
          const decl = cls.decl.toLowerCase();
          let match = false;
          if (mode === "class") {
            match = cls.name.toLowerCase().includes(q) || cls.name.toLowerCase() === q;
          } else if (mode === "extends") {
            match = decl.includes(`extends ${query}`) || decl.includes(`extends ${q}`);
          } else if (mode === "implements") {
            match = decl.includes(`implements ${query}`) || decl.includes(`implements ${q}`);
          } else if (mode === "grep") {
            match = decl.includes(q)
              || cls.methods.some((m) => m.signature.toLowerCase().includes(q));
          }
          if (match) {
            hits.push({
              method: cls.kind,
              class: cls.name,
              package: pkg.pkg,
              file: pkg.file,
              signature: cls.decl,
            });
          }
        }
      }
    }
  }

  const shown = hits.slice(0, limit);
  console.log(`${shown.length} result(s) for ${mode} "${query}" (${hits.length} total)\n`);
  for (const hit of shown) printHit(hit);
  if (hits.length > limit) {
    console.log(`… ${hits.length - limit} more — raise --limit or narrow the query`);
  }
  return hits.length;
}

try {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    process.exit(0);
  }
  const count = search(opts);
  process.exitCode = count ? 0 : 1;
} catch (err) {
  console.error(`sdk-search: ${err.message}`);
  process.exitCode = 1;
}
