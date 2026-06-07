import { Drawer, Slider, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import { createViewer } from "../library/prefab-voxel-viewer";
import type { PrefabEntry, VoxelViewer } from "../library/types";

type PrefabViewerDrawerProps = {
  entry: PrefabEntry | null;
  open: boolean;
  onClose: () => void;
};

export function PrefabViewerDrawer({ entry, open, onClose }: PrefabViewerDrawerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<VoxelViewer | null>(null);
  const [topSlice, setTopSlice] = useState(0);
  const [sideSlice, setSideSlice] = useState(0);
  const [maxTop, setMaxTop] = useState(0);
  const [maxSide, setMaxSide] = useState(0);

  useEffect(() => {
    if (!open || !entry || !hostRef.current) return;

    let cancelled = false;
    const host = hostRef.current;

    if (!viewerRef.current) {
      viewerRef.current = createViewer(host, { interaction: "free" });
    }

    fetch(entry.voxelData)
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled || !viewerRef.current) return;
        viewerRef.current.load(payload);
        const unpacked = viewerRef.current.getPayload();
        if (!unpacked) return;
        const top = Math.max(0, unpacked.size[1] - 1);
        const side = Math.max(0, unpacked.size[0] - 1);
        setMaxTop(top);
        setMaxSide(side);
        setTopSlice(top);
        setSideSlice(side);
        viewerRef.current.applySlices(top, side);
      })
      .catch((err: Error) => console.error(entry.label, err));

    return () => {
      cancelled = true;
    };
  }, [entry, open]);

  useEffect(() => {
    return () => {
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    viewerRef.current?.applySlices(topSlice, sideSlice);
  }, [sideSlice, topSlice]);

  return (
    <Drawer
      title={entry?.label ?? "Voxel Viewer"}
      open={open}
      onClose={onClose}
      width={Math.min(760, window.innerWidth)}
      destroyOnClose={false}
    >
      {entry ? (
        <>
          <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
            {entry.id} · {entry.path} · {entry.bounds} · {entry.blockCount} blocks
          </Typography.Paragraph>
          <div ref={hostRef} className="drawer-viewer" />
          <div className="drawer-controls" style={{ marginTop: 16 }}>
            <div>
              <Typography.Text>Top slice</Typography.Text>
              <Slider min={0} max={maxTop} value={topSlice} onChange={setTopSlice} />
            </div>
            <div>
              <Typography.Text>Side slice</Typography.Text>
              <Slider min={0} max={maxSide} value={sideSlice} onChange={setSideSlice} />
            </div>
          </div>
        </>
      ) : null}
    </Drawer>
  );
}
