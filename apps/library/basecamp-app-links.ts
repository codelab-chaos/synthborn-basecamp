export type BasecampAppId = "recipeBrowser" | "prefabGallery";

/** Relative URLs for Live Server at repo root (`/apps/<app>/`). */
export const basecampApps = {
  recipeBrowser: {
    id: "recipeBrowser" as const,
    href: "../recipe-browser/",
    navLabel: "Recipe Browser",
    pageTitle: "Synthborn Basecamp: Hytale Recipe Browser",
  },
  prefabGallery: {
    id: "prefabGallery" as const,
    href: "../prefab-gallery/",
    navLabel: "Prefab Gallery",
    pageTitle: "Prefab Preview Gallery",
  },
} satisfies Record<BasecampAppId, {
  id: BasecampAppId;
  href: string;
  navLabel: string;
  pageTitle: string;
}>;
