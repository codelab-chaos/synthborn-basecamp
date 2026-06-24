export type DossierSection = "recipes" | "tree" | "uses" | "obtain";

export type AppRoute =
  | { tab: "item"; itemId: string; section: DossierSection }
  | { tab: "search"; pattern: string }
  | { tab: "bench"; benchId?: string };

const DEFAULT_ITEM_ID = "Weapon_Sword_Copper";
const DEFAULT_SECTION: DossierSection = "recipes";
const DOSSIER_SECTIONS = new Set<string>(["recipes", "tree", "uses", "obtain"]);

function decodeSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function encodeSegment(value: string) {
  return encodeURIComponent(value);
}

export function parseHash(hash: string): AppRoute {
  const raw = hash.replace(/^#/, "").replace(/^\//, "");
  if (!raw) {
    return { tab: "item", itemId: DEFAULT_ITEM_ID, section: DEFAULT_SECTION };
  }

  const [head, ...rest] = raw.split("/");
  const decodedHead = decodeSegment(head);

  if (decodedHead === "search") {
    const pattern = rest.map(decodeSegment).join("/");
    return { tab: "search", pattern: pattern || "" };
  }

  if (decodedHead === "bench") {
    return { tab: "bench", benchId: rest[0] ? decodeSegment(rest[0]) : undefined };
  }

  if (decodedHead === "item") {
    const itemId = rest[0] ? decodeSegment(rest[0]) : DEFAULT_ITEM_ID;
    const sectionRaw = rest[1] ? decodeSegment(rest[1]) : DEFAULT_SECTION;
    const section = DOSSIER_SECTIONS.has(sectionRaw)
      ? (sectionRaw as DossierSection)
      : DEFAULT_SECTION;
    return { tab: "item", itemId, section };
  }

  // Legacy: #Weapon_Sword_Copper or #Weapon_Sword_Copper/tree
  const itemId = decodedHead || DEFAULT_ITEM_ID;
  const sectionRaw = rest[0] ? decodeSegment(rest[0]) : DEFAULT_SECTION;
  const section = DOSSIER_SECTIONS.has(sectionRaw)
    ? (sectionRaw as DossierSection)
    : DEFAULT_SECTION;
  return { tab: "item", itemId, section };
}

export function buildHash(route: AppRoute): string {
  if (route.tab === "bench") {
    return route.benchId ? `#bench/${encodeSegment(route.benchId)}` : "#bench";
  }
  if (route.tab === "search") {
    const pattern = route.pattern.trim();
    return pattern ? `#search/${encodeSegment(pattern)}` : "#search";
  }
  const base = `#item/${encodeSegment(route.itemId)}`;
  return route.section === DEFAULT_SECTION ? base : `${base}/${route.section}`;
}

export function readHashRoute(): AppRoute {
  return parseHash(window.location.hash);
}

export function writeHashRoute(route: AppRoute, replace = false) {
  const next = buildHash(route);
  if (window.location.hash === next) return;
  if (replace) {
    window.history.replaceState(null, "", next);
  } else {
    window.location.hash = next.slice(1);
  }
}
