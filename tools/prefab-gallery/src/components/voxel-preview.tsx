import { useCallback, useEffect, useRef, useState } from "react";
import { useElementVisibility } from "../hooks/use-element-visibility";
import { getElementViewportPriority } from "../library/get-element-viewport-priority";
import { createViewer } from "../library/prefab-voxel-viewer";
import { loadVoxelPayload } from "../library/load-voxel-payload";
import { registerWebglPreviewSlotClient } from "../library/webgl-preview-slots";
import type { VoxelViewer } from "../library/types";

type VoxelPreviewProps = {
  voxelData: string;
  className?: string;
};

export function VoxelPreview({ voxelData, className }: VoxelPreviewProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const snapshotRef = useRef<HTMLCanvasElement | null>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const visible = useElementVisibility(host);
  const [queued, setQueued] = useState(false);

  const setRootRef = useCallback((node: HTMLDivElement | null) => {
    rootRef.current = node;
    setHost(node);
  }, []);

  const showSnapshot = useCallback(() => {
    snapshotRef.current?.classList.add("is-active");
  }, []);

  const hideSnapshot = useCallback(() => {
    snapshotRef.current?.classList.remove("is-active");
  }, []);

  useEffect(() => {
    const canvasHost = canvasHostRef.current;
    if (!canvasHost || !visible) {
      setQueued(false);
      return;
    }

    let cancelled = false;
    let viewer: VoxelViewer | null = null;
    let mounting = false;
    let mountGeneration = 0;
    let slotGranted = false;

    const teardown = () => {
      if (viewer && snapshotRef.current) {
        if (viewer.captureSnapshot(snapshotRef.current)) {
          showSnapshot();
        }
      }
      viewer?.dispose();
      viewer = null;
      canvasHost.textContent = "";
    };

    const mount = async () => {
      if (cancelled || viewer || mounting || !slotGranted || !canvasHostRef.current) return;

      mounting = true;
      setQueued(false);
      const generation = ++mountGeneration;
      canvasHost.textContent = "";

      try {
        const payload = await loadVoxelPayload(voxelData);
        if (cancelled || !slotGranted || generation !== mountGeneration || !canvasHostRef.current) {
          teardown();
          return;
        }

        viewer = createViewer(canvasHost, {
          interaction: "springIso",
          maxPixelRatio: 1.5,
          preserveDrawingBuffer: true,
        });
        viewer.load(payload);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!cancelled && viewer) hideSnapshot();
          });
        });
      } catch (err) {
        teardown();
        if (!cancelled && canvasHostRef.current) {
          canvasHostRef.current.textContent = "Preview unavailable";
        }
        console.error(voxelData, err);
      } finally {
        mounting = false;
      }
    };

    const unregister = registerWebglPreviewSlotClient(
      () => {
        const target =
          rootRef.current?.closest<HTMLElement>(".prefab-card__preview-wrap") ?? rootRef.current;
        return target ? getElementViewportPriority(target) : Number.POSITIVE_INFINITY;
      },
      () => {
        slotGranted = true;
        setQueued(false);
        void mount();
      },
      () => {
        slotGranted = false;
        mountGeneration += 1;
        setQueued(true);
        teardown();
      },
    );

    if (!slotGranted) setQueued(true);

    return () => {
      cancelled = true;
      mountGeneration += 1;
      unregister();
      teardown();
      setQueued(false);
    };
  }, [visible, voxelData, hideSnapshot, showSnapshot]);

  const classNames = [className, queued ? "preview-queued" : ""].filter(Boolean).join(" ");

  return (
    <div ref={setRootRef} className={classNames}>
      <canvas ref={snapshotRef} className="preview-snapshot" aria-hidden="true" />
      <div ref={canvasHostRef} className="preview-canvas-host" />
      {queued ? <span className="preview-status">Loading preview…</span> : null}
    </div>
  );
}
