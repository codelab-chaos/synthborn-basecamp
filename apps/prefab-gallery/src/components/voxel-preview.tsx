import { useCallback, useEffect, useRef, useState } from "react";
import { getElementViewportPriority } from "../library/get-element-viewport-priority";
import { createViewer } from "../library/prefab-voxel-viewer";
import { loadVoxelPayload } from "../library/load-voxel-payload";
import { previewImagePath } from "../library/preview-image-path";
import { registerWebglPreviewSlotClient } from "../library/webgl-preview-slots";
import type { PreviewAtlasRef, VoxelRef, VoxelViewer } from "../library/types";
import { PreviewAtlasImage } from "./preview-atlas-image";

const HOVER_ACTIVATE_DELAY_MS = 120;
const HOVER_DEACTIVATE_DELAY_MS = 1500;

type VoxelPreviewProps = {
  voxelData: string | VoxelRef;
  preview?: PreviewAtlasRef;
  className?: string;
};

export function VoxelPreview({ voxelData, preview, className }: VoxelPreviewProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [live, setLive] = useState(false);
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveError, setLiveError] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const enterTimerRef = useRef(0);
  const leaveTimerRef = useRef(0);

  useEffect(() => {
    setLive(false);
    setLiveError(false);
    setImageFailed(false);
  }, [voxelData, preview?.atlas, preview?.x, preview?.y]);

  useEffect(
    () => () => {
      window.clearTimeout(enterTimerRef.current);
      window.clearTimeout(leaveTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const root = rootRef.current;
    const canvasHost = canvasHostRef.current;
    if (!live || !root || !canvasHost) return;

    let cancelled = false;
    let viewer: VoxelViewer | null = null;
    let mounting = false;
    let mountGeneration = 0;
    let slotGranted = false;

    const deactivate = () => {
      if (!cancelled) setLive(false);
    };

    const hideStaticPreview = () => {
      imageRef.current?.classList.add("is-hidden");
      root.querySelector(".preview-atlas")?.classList.add("is-hidden");
    };

    const showStaticPreview = () => {
      imageRef.current?.classList.remove("is-hidden");
      root.querySelector(".preview-atlas")?.classList.remove("is-hidden");
    };

    const teardown = () => {
      viewer?.dispose();
      viewer = null;
      canvasHost.textContent = "";
      showStaticPreview();
    };

    const mount = async () => {
      if (cancelled || viewer || mounting || !slotGranted) return;

      mounting = true;
      const generation = ++mountGeneration;
      setLoadingLive(true);

      try {
        const payload = await loadVoxelPayload(voxelData);
        if (cancelled || !slotGranted || generation !== mountGeneration) {
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
            if (!cancelled && viewer) hideStaticPreview();
          });
        });
      } catch (err) {
        teardown();
        if (!cancelled) setLiveError(true);
        console.error(voxelData, err);
      } finally {
        mounting = false;
        if (!cancelled) setLoadingLive(false);
      }
    };

    const unregister = registerWebglPreviewSlotClient(
      () => {
        const target = root.closest<HTMLElement>(".prefab-card__preview-wrap") ?? root;
        return getElementViewportPriority(target);
      },
      () => {
        slotGranted = true;
        void mount();
      },
      () => {
        slotGranted = false;
        mountGeneration += 1;
        deactivate();
      },
    );

    const observed = root.closest<HTMLElement>(".prefab-card__preview-wrap") ?? root;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) deactivate();
      }
    });
    observer.observe(observed);

    return () => {
      cancelled = true;
      mountGeneration += 1;
      observer.disconnect();
      unregister();
      teardown();
      setLoadingLive(false);
    };
  }, [live, voxelData]);

  const activate = useCallback(() => {
    window.clearTimeout(enterTimerRef.current);
    window.clearTimeout(leaveTimerRef.current);
    setLiveError(false);
    setLive(true);
  }, []);

  const handlePointerEnter = useCallback(() => {
    window.clearTimeout(leaveTimerRef.current);
    window.clearTimeout(enterTimerRef.current);
    enterTimerRef.current = window.setTimeout(() => {
      setLiveError(false);
      setLive(true);
    }, HOVER_ACTIVATE_DELAY_MS);
  }, []);

  const handlePointerLeave = useCallback(() => {
    window.clearTimeout(enterTimerRef.current);
    window.clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = window.setTimeout(() => setLive(false), HOVER_DEACTIVATE_DELAY_MS);
  }, []);

  const classNames = [className, live ? "is-live" : "is-image"].filter(Boolean).join(" ");
  const legacyImagePath = typeof voxelData === "string" ? previewImagePath(voxelData) : null;

  return (
    <div
      ref={rootRef}
      className={classNames}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onClick={live ? undefined : activate}
      role={live ? undefined : "button"}
      aria-label={live ? undefined : "Load interactive 3D preview"}
    >
      {!imageFailed && preview ? (
        <PreviewAtlasImage preview={preview} onError={() => setImageFailed(true)} />
      ) : null}
      {!imageFailed && !preview && legacyImagePath ? (
        <img
          ref={imageRef}
          className="preview-image"
          src={legacyImagePath}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setImageFailed(true)}
        />
      ) : null}
      {live ? <div ref={canvasHostRef} className="preview-canvas-host" /> : null}
      {!live && !liveError && imageFailed ? (
        <span className="preview-activate-hint">No preview image — hover to load 3D</span>
      ) : null}
      {live && loadingLive ? <span className="preview-status">Loading 3D…</span> : null}
      {liveError ? <span className="preview-status">Preview unavailable</span> : null}
    </div>
  );
}
