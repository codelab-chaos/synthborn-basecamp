#!/usr/bin/env node
/*
 * English display name ↔ Hytale id lookup.
 *
 * Reads docs/refs/labels/labels.json (node tools/refs/labels/extract-labels.js).
 *
 * Subcommands:
 *   id <token>       Resolve an id (exact or fuzzy) → English name
 *   name <token>     Resolve English text → id(s)
 *   find <token>     Search ids and names (default when token is the only arg)
 *
 * Examples:
 *   node tools/refs/labels/lookup.js id Ingredient_Fibre
 *   node tools/refs/labels/lookup.js name "plant fiber"
 *   node tools/refs/labels/lookup.js find copper
 *   node tools/refs/labels/lookup.js Wood_Beech_Trunk
 *
 * Add --json for machine-readable output.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const LABELS_FILE = path.join(REPO_ROOT, "docs", "refs", "labels", "labels.json");

const KIND_ORDER = ["item", "resource", "npc"];

function loadLabels() {
  if (!fs.existsSync(LABELS_FILE)) {
    throw new Error(
      `${path.relative(REPO_ROOT, LABELS_FILE)} not found. Run: node tools/refs/labels/extract-labels.js`,
    );
  }
  return JSON.parse(fs.readFileSync(LABELS_FILE, "utf8"));
}

function makeMatcher(pattern) {
  if (pattern.startsWith("/") && pattern.endsWith("/") && pattern.length > 2) {
    return new RegExp(pattern.slice(1, -1), "i");
  }
  if (pattern.includes("*") || pattern.includes("?")) {
    const re = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    return new RegExp(`^${re}$`, "i");
  }
  const lower = pattern.toLowerCase();
  return { test: (s) => s.toLowerCase().includes(lower) };
}

function humanizeId(id) {
  return id.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function flattenEntries(data) {
  const out = [];
  for (const [id, name] of Object.entries(data.items || {})) {
    out.push({ id, name, kind: "item" });
  }
  for (const [id, name] of Object.entries(data.resourceTypes || {})) {
    out.push({ id, name, kind: "resource", recipeKey: `${id}(type)` });
  }
  for (const [id, name] of Object.entries(data.npcRoles || {})) {
    out.push({ id, name, kind: "npc" });
  }
  return out;
}

function sortEntries(entries) {
  return entries.sort((a, b) => {
    const ka = KIND_ORDER.indexOf(a.kind);
    const kb = KIND_ORDER.indexOf(b.kind);
    if (ka !== kb) return ka - kb;
    return a.id.localeCompare(b.id);
  });
}

function resolveById(token, data) {
  const entries = flattenEntries(data);
  const exact = entries.filter((e) => e.id.toLowerCase() === token.toLowerCase());
  if (exact.length) return { matches: exact, mode: "exact-id" };

  const m = makeMatcher(token);
  const fuzzy = entries.filter((e) => m.test(e.id) || m.test(humanizeId(e.id)));
  return { matches: sortEntries(fuzzy), mode: "fuzzy-id" };
}

function resolveByName(token, data) {
  const norm = token.toLowerCase().trim();
  const exact = data.byName?.[norm];
  if (exact?.length) return { matches: exact, mode: "exact-name" };

  const m = makeMatcher(token);
  const fuzzy = [];
  for (const [nameKey, hits] of Object.entries(data.byName || {})) {
    if (!m.test(nameKey)) continue;
    for (const hit of hits) fuzzy.push(hit);
  }
  return { matches: sortEntries(fuzzy), mode: "fuzzy-name" };
}

function resolveFind(token, data) {
  const byId = resolveById(token, data).matches;
  const byName = resolveByName(token, data).matches;
  const seen = new Set();
  const merged = [];
  for (const e of [...byId, ...byName]) {
    const key = `${e.kind}:${e.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(e);
  }
  return { matches: sortEntries(merged), mode: "find" };
}

function formatEntry(e, data) {
  const name = e.name || data.items?.[e.id] || data.resourceTypes?.[e.id] || data.npcRoles?.[e.id];
  const lines = [`${e.kind}\t${e.id}\t${name}`];
  if (e.kind === "resource") lines.push(`  recipe input key: ${e.id}(type)`);
  if (e.kind === "item" && humanizeId(e.id).toLowerCase() !== (name || "").toLowerCase()) {
    lines.push(`  humanize fallback: ${humanizeId(e.id)} (not the in-game name)`);
  }
  return lines.join("\n");
}

function printMatches(result, data, flags) {
  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (!result.matches.length) {
    console.log(`No matches for "${result.token}" (${result.mode}).`);
    console.log("Tip: ids use PascalCase_With_Underscores; English names live in server.lang.");
    return;
  }
  if (result.matches.length === 1) {
    const e = result.matches[0];
    const name = e.name || data.items?.[e.id] || data.resourceTypes?.[e.id] || data.npcRoles?.[e.id];
    console.log(`${e.id} → ${name}`);
    if (e.kind === "resource") console.log(`recipe key: ${e.id}(type)`);
    return;
  }
  console.log(`${result.matches.length} matches (${result.mode}):`);
  for (const e of result.matches.slice(0, 40)) console.log(formatEntry(e, data));
  if (result.matches.length > 40) console.log(`…(${result.matches.length - 40} more)`);
}

function usage() {
  console.log(`Usage:
  node tools/refs/labels/lookup.js id <token>
  node tools/refs/labels/lookup.js name <token>
  node tools/refs/labels/lookup.js find <token>
  node tools/refs/labels/lookup.js <token>          # same as find

Regenerate index: node tools/refs/labels/extract-labels.js`);
}

function main() {
  const argv = process.argv.slice(2);
  const flags = { json: argv.includes("--json") };
  const args = argv.filter((a) => a !== "--json");

  if (!args.length || args[0] === "-h" || args[0] === "--help") {
    usage();
    process.exit(args.length ? 0 : 1);
  }

  const data = loadLabels();
  let cmd = "find";
  let token = args[0];

  if (["id", "name", "find"].includes(args[0]) && args[1]) {
    cmd = args[0];
    token = args.slice(1).join(" ");
  }

  let resolved;
  switch (cmd) {
    case "id":
      resolved = resolveById(token, data);
      break;
    case "name":
      resolved = resolveByName(token, data);
      break;
    default:
      resolved = resolveFind(token, data);
  }

  printMatches({ token, mode: resolved.mode, matches: resolved.matches }, data, flags);
}

main();
