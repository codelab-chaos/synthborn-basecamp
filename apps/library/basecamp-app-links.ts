export type BasecampAppId = "recipeKiosk" | "prefabGallery";

/** Relative URLs for Live Server at repo root (`/apps/<app>/`). */
export const basecampApps = {
  recipeKiosk: {
    id: "recipeKiosk" as const,
    href: "../recipe-kiosk/",
    navLabel: "Recipe Kiosk",
    pageTitle: "Synthborn Basecamp: Hytale Recipe Kiosk",
    iconSrc: "../images/recipe-kiosk-icon.png",
  },
  prefabGallery: {
    id: "prefabGallery" as const,
    href: "../prefab-gallery/",
    navLabel: "Prefab Gallery",
    pageTitle: "Prefab Preview Gallery",
    iconSrc: "../images/prefab-gallery-icon.png",
  },
} satisfies Record<BasecampAppId, {
  id: BasecampAppId;
  href: string;
  navLabel: string;
  pageTitle: string;
  iconSrc: string;
}>;