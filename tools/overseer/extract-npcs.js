#!/usr/bin/env node
/**
 * One-time extraction script. Walks _Assets/Server/NPC/Roles/ and emits a flat JSON
 * catalog at mods/SynthOverseer/src/main/resources/synthoverseer/npc/npcs-en.json.
 * Re-run after Hytale updates if NPC stats / roles change.
 */
const fs = require("node:fs");
const path = require("node:path");
const { modDir } = require("../library/workspace");

const ROOT = path.resolve(__dirname, "../../_Assets/Server/NPC/Roles");
const DEST = path.join(modDir("SynthOverseer"), "src/main/resources/synthoverseer/npc/npcs-en.json");

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, results);
    else if (entry.name.endsWith(".json")) results.push(full);
  }
  return results;
}

function attitudeFor(categoryLower) {
  if (categoryLower.includes("aggressive") || categoryLower.includes("undead")
      || categoryLower.includes("elemental")) return "hostile";
  if (categoryLower.includes("livestock") || categoryLower.includes("critter")) return "passive";
  if (categoryLower.includes("intelligent") && !categoryLower.includes("aggressive")) return "neutral";
  return "unknown";
}

const out = {};
const skipped = [];
for (const file of walk(ROOT)) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const id = path.basename(file, ".json");
    const relPath = path.relative(ROOT, file).split(path.sep).join("/").replace(/\.json$/, "");
    const category = path.posix.dirname(relPath);
    const modify = raw.Modify || {};

    out[id] = {
      id,
      category,
      attitude: attitudeFor(category.toLowerCase()),
      reference: raw.Reference || null,
      maxHealth: modify.MaxHealth ?? null,
      dropList: modify.DropList ?? null,
      appearance: modify.Appearance ?? null,
    };
  } catch (e) {
    skipped.push({ file, err: e.message });
  }
}

fs.mkdirSync(path.dirname(DEST), { recursive: true });
fs.writeFileSync(DEST, JSON.stringify(out));
console.log(`extracted ${Object.keys(out).length} NPC roles`);
console.log(`skipped ${skipped.length}`);
for (const sample of ["Skeleton", "Chicken", "Cow", "Mosshorn", "Goblin"]) {
  if (out[sample]) console.log("  " + sample + ":", JSON.stringify(out[sample]));
}
