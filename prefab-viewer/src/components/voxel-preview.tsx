import { useEffect, useRef } from "react";
import { getPreviewPool } from "../library/preview-pool";

type VoxelPreviewProps = {
  voxelData: string;
  pageSize: number;
  className?: string;
};

export function VoxelPreview({ voxelData, pageSize, className }: VoxelPreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    const pool = getPreviewPool(pageSize);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || cancelled) return;

        if (entry.isIntersecting) {
          if (host.textContent) host.textContent = "";
          pool
            .mount(host, voxelData)
            .catch((err: Error) => {
              if (!cancelled) host.textContent = "Preview unavailable";
              console.error(voxelData, err);
            });
        } else {
          pool.release(host);
        }
      },
      { rootMargin: "120px" },
    );

    observer.observe(host);

    return () => {
      cancelled = true;
      observer.disconnect();
      pool.release(host);
    };
  }, [pageSize, voxelData]);

  return <div ref={hostRef} className={className} />;
}
