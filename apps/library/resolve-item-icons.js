const fs = require("node:fs");
const path = require("node:path");

function walkJsonFiles(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsonFiles(full, out);
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

function resolveIconPath(itemId, iconField, assetsRoot) {
  const commonRoot = path.join(assetsRoot, "Common");

  if (iconField) {
    const fromField = path.join(commonRoot, iconField);
    if (fs.existsSync(fromField)) return fromField;
  }

  const generated = path.join(commonRoot, "Icons", "ItemsGenerated", `${itemId}.png`);
  if (fs.existsSync(generated)) return generated;

  return null;
}

function collectResourceTypeIcons(assetsRoot) {
  const typesRoot = path.join(assetsRoot, "Server", "Item", "ResourceTypes");
  const icons = new Map();

  let entries;
  try {
    entries = fs.readdirSync(typesRoot, { withFileTypes: true });
  } catch {
    return icons;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const typeId = path.basename(entry.name, ".json");
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(typesRoot, entry.name), "utf8"));
    } catch {
      continue;
    }
    const iconPath = resolveIconPath(typeId, parsed.Icon, assetsRoot);
    if (iconPath) icons.set(typeId, iconPath);
  }

  return icons;
}

function collectItemIcons(assetsRoot) {
  const itemsRoot = path.join(assetsRoot, "Server", "Item", "Items");
  const icons = new Map();

  for (const filePath of walkJsonFiles(itemsRoot)) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      continue;
    }

    const itemId = parsed.Id || path.basename(filePath, ".json");
    const iconPath = resolveIconPath(itemId, parsed.Icon, assetsRoot);
    if (iconPath) icons.set(itemId, iconPath);
  }

  for (const [typeId, iconPath] of collectResourceTypeIcons(assetsRoot)) {
    if (!icons.has(typeId)) icons.set(typeId, iconPath);
  }

  return icons;
}

function collectRecipeItemIds(recipesPath, lootPath) {
  const ids = new Set();

  const addItemRef = (slot) => {
    const itemId = slot.itemId || slot.id;
    if (itemId) ids.add(itemId);
  };

  const addFromRecipes = (data) => {
    const recipes = Array.isArray(data) ? data : data.recipes || [];
    for (const recipe of recipes) {
      if (recipe.id) ids.add(recipe.id);
      for (const slot of recipe.inputs || []) addItemRef(slot);
      for (const slot of recipe.outputs || []) addItemRef(slot);
    }

    for (const index of [data.byInput, data.byOutput]) {
      if (index && typeof index === "object") {
        for (const itemId of Object.keys(index)) ids.add(itemId);
      }
    }
  };

  const addFromLoot = (data) => {
    if (data.byItem && typeof data.byItem === "object") {
      for (const itemId of Object.keys(data.byItem)) ids.add(itemId);
    }

    const tables = Array.isArray(data)
      ? data
      : data.droplists || data.tables || data.loot || [];

    for (const table of tables) {
      for (const entry of table.entries || table.drops || []) {
        if (entry.itemId) ids.add(entry.itemId);
        if (entry.item) ids.add(entry.item);
      }
    }
  };

  if (fs.existsSync(recipesPath)) {
    addFromRecipes(JSON.parse(fs.readFileSync(recipesPath, "utf8")));
  }
  if (fs.existsSync(lootPath)) {
    addFromLoot(JSON.parse(fs.readFileSync(lootPath, "utf8")));
  }

  return ids;
}

function filterIconsForRecipes(allIcons, recipeItemIds) {
  const filtered = new Map();
  for (const itemId of recipeItemIds) {
    const iconPath = allIcons.get(itemId);
    if (iconPath) filtered.set(itemId, iconPath);
  }
  return filtered;
}

module.exports = {
  collectItemIcons,
  collectResourceTypeIcons,
  collectRecipeItemIds,
  filterIconsForRecipes,
  resolveIconPath,
};
