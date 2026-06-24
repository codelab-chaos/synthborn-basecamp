import { useEffect, useState } from "react";
import type { SdkReferenceData } from "../library/types";

type SdkDataState = {
  loading: boolean;
  error: string | null;
  data: SdkReferenceData | null;
};

export function useSdkData(): SdkDataState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SdkReferenceData | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("data/sdk-reference.json")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<SdkReferenceData>;
      })
      .then((nextData) => {
        if (cancelled) return;
        setData(nextData);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, error, data };
}
