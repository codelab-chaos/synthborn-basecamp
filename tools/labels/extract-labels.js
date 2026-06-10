#!/usr/bin/env node
/*
 * Extract English display names from Hytale's localization file:
 *   _Assets/Server/Languages/en-US/server.lang
 *
 * Hytale stores player-facing names separately from asset ids. An item id like
 * Ingredient_Fibre maps to items.Ingredient_Fibre.name = "Plant Fiber" in lang.
 *
 * Emits:
 *   docs/labels/labels.json   structured index (items, resourceTypes, npcRoles, byName)
 *   docs/labels/labels.txt    grep-friendly id → name lines
 *
 * Usage:
 *   node tools/labels/extract-labels.js [--assets <dir>] [--out <dir>]
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_ASSETS = path.join(REPO_ROOT, "_Assets");
const DEFAULT_OUT = path.join(REPO_ROOT, "docs", "labels");

/** Lang prefixes we index — { prefix, jsonKey, label in txt output } */
const SECTIONS = [
  { prefix: "items", key: "items", tag: "item" },
  { prefix: "resourceType", key: "resourceTypes", tag: "resource" },
  { prefix: "npcRoles", key: "npcRoles", tag: "npc" },
];

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
      case "-h":
      case "--help":
        opts.help = true;
        return opts;
      case "--assets":
        opts.assets = next();
        break;
      case "--out":
        opts.out = next();
        break;
      default:
        throw new Error(`Unknown argument: ${a}`);
    }
  }
  return opts;
}

function usage() {
  console.log(`Usage: node tools/labels/extract-labels.js [--assets <dir>] [--out <dir>]`);
}

function parseLangLine(line) {
  const eq = line.indexOf(" = ");
  if (eq <= 0) return null;
  const key = line.slice(0, eq).trim();
  const value = line.slice(eq + 3).trim();
  if (!key || !value) return null;
  const dot = key.lastIndexOf(".name");
  if (dot <= 0 || !key.endsWith(".name")) return null;
  const body = key.slice(0, dot);
  const sep = body.indexOf(".");
  if (sep <= 0) return null;
  return {
    prefix: body.slice(0, sep),
    id: body.slice(sep + 1),
    name: value,
  };
}

function buildReverseIndex(sections) {
  const byName = {};
  for (const { key, tag } of SECTIONS.map((s) => ({ key: s.key, tag: s.tag }))) {
    const map = sections[key];
    for (const [id, name] of Object.entries(map)) {
      const norm = name.toLowerCase();
      if (!byName[norm]) byName[norm] = [];
      byName[norm].push({ id, name, kind: tag });
    }
  }
  return byName;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) return usage();

  const assets = opts.assets || DEFAULT_ASSETS;
  const outDir = opts.out || DEFAULT_OUT;
  const langFile = path.join(assets, "Server", "Languages", "en-US", "server.lang");

  if (!fs.existsSync(langFile)) {
    throw new Error(
      `${langFile} not found. Unpack game assets to _Assets/ or pass --assets <dir>.`,
    );
  }

  const sections = Object.fromEntries(SECTIONS.map((s) => [s.key, {}]));
  const counts = Object.fromEntries(SECTIONS.map((s) => [s.key, 0]));

  const body = fs.readFileSync(langFile, "utf8");
  for (const line of body.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const parsed = parseLangLine(line);
    if (!parsed) continue;
    const section = SECTIONS.find((s) => s.prefix === parsed.prefix);
    if (!section) continue;
    sections[section.key][parsed.id] = parsed.name;
    counts[section.key]++;
  }

  const payload = {
    locale: "en-US",
    source: path.relative(REPO_ROOT, langFile).replace(/\\/g, "/"),
    generatedAt: new Date().toISOString(),
    counts,
    items: sections.items,
    resourceTypes: sections.resourceTypes,
    npcRoles: sections.npcRoles,
    byName: buildReverseIndex(sections),
  };

  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, "labels.json");
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);

  const txtLines = ["# Hytale en-US display names — id → English", `# source: ${payload.source}`, ""];
  for (const section of SECTIONS) {
    const entries = Object.entries(sections[section.key]).sort(([a], [b]) => a.localeCompare(b));
    txtLines.push(`# ${section.key} (${entries.length})`);
    for (const [id, name] of entries) {
      txtLines.push(`${section.tag}\t${id}\t${name}`);
    }
    txtLines.push("");
  }
  const txtPath = path.join(outDir, "labels.txt");
  fs.writeFileSync(txtPath, `${txtLines.join("\n")}\n`);

  console.log(`Wrote ${path.relative(REPO_ROOT, jsonPath)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, txtPath)}`);
  for (const section of SECTIONS) {
    console.log(`  ${section.key}: ${counts[section.key]}`);
  }
  console.log(`  byName keys: ${Object.keys(payload.byName).length}`);
}

main();
