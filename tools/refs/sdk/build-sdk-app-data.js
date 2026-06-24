#!/usr/bin/env node
/*
 * Build compact static data for the SDK Explorer app from docs/sdk markdown.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { loadReference } = require("./library/parse-sdk-package");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const DEFAULT_REF_DIR = path.join(REPO_ROOT, "docs", "sdk");
const DEFAULT_OUT = path.join(REPO_ROOT, "apps", "sdk-explorer", "data", "sdk-reference.json");

function parseArgs(argv) {
  const opts = { refDir: DEFAULT_REF_DIR, outFile: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (!value) throw new Error(`${arg} requires a value`);
      return value;
    };
    if (arg === "--ref-dir") opts.refDir = path.resolve(next());
    else if (arg === "--out") opts.outFile = path.resolve(next());
    else if (arg === "-h" || arg === "--help") opts.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

function usage() {
  console.log(`Usage:
  node tools/refs/sdk/build-sdk-app-data.js [--ref-dir docs/sdk] [--out apps/sdk-explorer/data/sdk-reference.json]
`);
}

function readStamp(refDir) {
  const stampPath = path.join(refDir, ".sdk-source.json");
  try {
    return JSON.parse(fs.readFileSync(stampPath, "utf8"));
  } catch {
    return null;
  }
}

function searchTextFor(values) {
  return values
    .flat(Infinity)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function memberLine(member) {
  return `  ${member.signature}`;
}

function classCode(cls) {
  const lines = [
    cls.decl,
    ...(cls.fields || []).map(memberLine),
    ...(cls.constructors || []).map(memberLine),
    ...(cls.methods || []).map(memberLine),
    "}",
  ].filter(Boolean);
  return lines.join("\n");
}

function classMarkdown(card) {
  return [
    `## ${card.className}`,
    "",
    "```java",
    card.code,
    "```",
  ].join("\n");
}

function simpleMembers(members) {
  return (members || []).map((member) => ({
    name: member.name,
    signature: member.signature,
  }));
}

function buildSdkAppData({ refDir = DEFAULT_REF_DIR, outFile = DEFAULT_OUT } = {}) {
  const loaded = loadReference(refDir);
  const stamp = readStamp(refDir);

  const cards = [];
  for (const meta of loaded.packages) {
    const parsed = loaded.byFile.get(meta.file);
    if (!parsed) continue;

    for (const cls of parsed.classes) {
      const fields = simpleMembers(cls.fields);
      const constructors = simpleMembers(cls.constructors);
      const methods = simpleMembers(cls.methods);
      const code = classCode({ ...cls, fields, constructors, methods });
      const card = {
        id: `${parsed.pkg}.${cls.name}`,
        package: parsed.pkg,
        file: meta.file,
        className: cls.name,
        kind: cls.kind,
        purpose: parsed.purpose || meta.purpose || "",
        declaration: cls.decl,
        fields,
        constructors,
        methods,
        code,
        markdown: "",
        searchText: "",
      };
      card.markdown = classMarkdown(card);
      card.searchText = searchTextFor([
        card.package,
        card.file,
        card.className,
        card.kind,
        card.purpose,
        card.declaration,
        card.code,
        card.markdown,
        fields.map((field) => [field.name, field.signature]),
        constructors.map((ctor) => [ctor.name, ctor.signature]),
        methods.map((method) => [method.name, method.signature]),
      ]);
      cards.push(card);
    }
  }

  cards.sort((a, b) => a.id.localeCompare(b.id));

  const data = {
    schemaVersion: 3,
    generatedAt: new Date().toISOString(),
    source: {
      path: path.relative(REPO_ROOT, refDir).split(path.sep).join("/"),
      hytaleVersion: stamp?.version || null,
      jar: stamp?.jar || null,
      full: typeof stamp?.full === "boolean" ? stamp.full : null,
    },
    counts: {
      packages: loaded.packages.length,
      cards: cards.length,
      fields: cards.reduce((sum, card) => sum + card.fields.length, 0),
      constructors: cards.reduce((sum, card) => sum + card.constructors.length, 0),
      methods: cards.reduce((sum, card) => sum + card.methods.length, 0),
    },
    cards,
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path.relative(REPO_ROOT, outFile)}`);
  console.log(`  ${data.counts.packages} packages, ${data.counts.cards} cards`);
  return data;
}

if (require.main === module) {
  try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
      usage();
    } else {
      buildSdkAppData(opts);
    }
  } catch (err) {
    console.error(`build-sdk-app-data: ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = { buildSdkAppData };
