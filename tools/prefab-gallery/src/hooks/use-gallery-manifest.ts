import { useEffect, useState } from "react";
import type { GalleryManifest } from "../library/types";

export function useGalleryManifest() {
  const [manifest, setManifest] = useState<GalleryManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("manifest.json")
      .then((response) => {
        if (!response.ok) throw new Error(`manifest.json ${response.status}`);
        return response.json() as Promise<GalleryManifest>;
      })
      .then((data) => {
        if (!cancelled) {
          setManifest(data);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { manifest, error, loading };
}
