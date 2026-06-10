import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type IconAtlasPage = {
  file: string;
  width: number;
  height: number;
};

export type IconAtlasEntry = {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type IconAtlasManifest = {
  tile: number;
  pages: IconAtlasPage[];
  items: Record<string, IconAtlasEntry>;
};

export type IconSprite = IconAtlasEntry & {
  url: string;
  pageWidth: number;
  pageHeight: number;
  tile: number;
};

type IconAtlasContextValue = {
  ready: boolean;
  available: boolean;
  getSprite: (itemId: string) => IconSprite | null;
};

const IconAtlasContext = createContext<IconAtlasContextValue>({
  ready: false,
  available: false,
  getSprite: () => null,
});

export function IconAtlasProvider({ children }: { children: ReactNode }) {
  const [manifest, setManifest] = useState<IconAtlasManifest | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("data/icons-atlas/manifest.json");
        if (!res.ok) return;
        const data = await res.json() as IconAtlasManifest;
        if (!cancelled) setManifest(data);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const value = useMemo<IconAtlasContextValue>(() => {
    if (!manifest) {
      return { ready, available: false, getSprite: () => null };
    }

    const getSprite = (itemId: string): IconSprite | null => {
      const entry = manifest.items[itemId];
      if (!entry) return null;
      const page = manifest.pages[entry.page];
      if (!page) return null;
      return {
        ...entry,
        url: `data/icons-atlas/${page.file}`,
        pageWidth: page.width,
        pageHeight: page.height,
        tile: manifest.tile,
      };
    };

    return { ready, available: true, getSprite };
  }, [manifest, ready]);

  return (
    <IconAtlasContext.Provider value={value}>
      {children}
    </IconAtlasContext.Provider>
  );
}

export function useIconAtlas() {
  return useContext(IconAtlasContext);
}
