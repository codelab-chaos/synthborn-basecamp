import { Button, Modal, Segmented, Slider, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import { loadVoxelPayload } from "../library/load-voxel-payload";
import { createViewer } from "../library/prefab-voxel-viewer";
import type { PrefabEntry, VoxelViewer, VoxelViewerMode } from "../library/types";

type PrefabViewerModalProps = {
  entry: PrefabEntry | null;
  open: boolean;
  onClose: () => void;
};

const viewModeOptions: { label: string; value: VoxelViewerMode }[] = [
  { label: "Front", value: "front" },
  { label: "Right", value: "right" },
  { label: "3D", value: "3d" },
];

export function PrefabViewerModal({ entry, open, onClose }: PrefabViewerModalProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<VoxelViewer | null>(null);
  const [viewMode, setViewMode] = useState<VoxelViewerMode>("3d");
  const [topSlice, setTopSlice] = useState(0);
  const [sideSlice, setSideSlice] = useState(0);
  const [maxTop, setMaxTop] = useState(0);
  const [maxSide, setMaxSide] = useState(0);

  useEffect(() => {
    if (open && entry) setViewMode("3d");
  }, [entry, open]);

  useEffect(() => {
    if (!open || !entry || !hostRef.current) return;

    let cancelled = false;
    const host = hostRef.current;

    if (!viewerRef.current) {
      viewerRef.current = createViewer(host, { interaction: "free" });
    }

    loadVoxelPayload(entry.voxelData)
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

  useEffect(() => {
    viewerRef.current?.setViewMode(viewMode);
  }, [viewMode]);

  return (
    <Modal
      className="prefab-viewer-modal"
      title={
        entry ? (
          <div className="prefab-viewer-modal__header">
            <div className="prefab-viewer-modal__title">
              <Typography.Text ellipsis={{ tooltip: entry.label }} strong>
                {entry.label}
              </Typography.Text>
              <Typography.Text type="success" className="prefab-viewer-modal__stats">
                <span>{entry.bounds}</span>
                <span>{entry.blockCount} blocks</span>
              </Typography.Text>
            </div>
            <Segmented
              size="small"
              options={viewModeOptions}
              value={viewMode}
              onChange={(value) => setViewMode(value as VoxelViewerMode)}
            />
            <Button
              size="small"
              type="text"
              className="prefab-icon-button prefab-icon-button--minimize"
              aria-label="Minimize preview"
              title="Minimize preview"
              onClick={onClose}
            >
              <span className="prefab-window-icon prefab-window-icon--minimize" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          "Voxel Viewer"
        )
      }
      closable={false}
      open={open}
      onCancel={onClose}
      footer={null}
      width="calc(100vw - 32px)"
      forceRender
      destroyOnHidden={false}
    >
      {entry ? (
        <div className="prefab-viewer-modal__body">
          <Typography.Paragraph type="secondary" className="prefab-viewer-modal__path">
            {entry.id} · {entry.path}
          </Typography.Paragraph>
          <div ref={hostRef} className="modal-viewer" />
          <div className="modal-controls">
            <div>
              <Typography.Text>Top slice</Typography.Text>
              <Slider min={0} max={maxTop} value={topSlice} onChange={setTopSlice} />
            </div>
            <div>
              <Typography.Text>Side slice</Typography.Text>
              <Slider min={0} max={maxSide} value={sideSlice} onChange={setSideSlice} />
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
