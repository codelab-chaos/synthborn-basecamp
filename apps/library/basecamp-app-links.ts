export type BasecampAppId = "recipeKiosk" | "prefabGallery" | "sdkExplorer";
export type BasecampLinkedAppId = Exclude<BasecampAppId, "sdkExplorer">;

/** Relative URLs for Live Server at repo root (`/apps/<app>/`). */
export const basecampApps = {
  recipeKiosk: {
    id: "recipeKiosk" as const,
    href: "../recipe-kiosk/",
    navLabel: "Recipe Kiosk",
    pageTitle: "Hytale Recipe Kiosk",
    iconSrc: "../images/recipe-kiosk-icon.png",
  },
  prefabGallery: {
    id: "prefabGallery" as const,
    href: "../prefab-gallery/",
    navLabel: "Hytale Prefab Gallery",
    pageTitle: "Hytale Prefab Gallery",
    iconSrc: "../images/prefab-gallery-icon.png",
  },
  sdkExplorer: {
    id: "sdkExplorer" as const,
    href: "../sdk-explorer/",
    navLabel: "SDK Explorer",
    pageTitle: "Hytale SDK Explorer",
    iconSrc: "../images/sdk-explorer-icon.png",
  },
} satisfies Record<BasecampAppId, {
  id: BasecampAppId;
  href: string;
  navLabel: string;
  pageTitle: string;
  iconSrc: string;
}>;

export const basecampLinkedAppIds: BasecampLinkedAppId[] = ["recipeKiosk", "prefabGallery"];
