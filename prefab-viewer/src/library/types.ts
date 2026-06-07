export type PrefabMaterial = {
  name: string;
  count: number;
  color: string;
};

export type PrefabEntry = {
  label: string;
  id: string;
  path: string;
  tags: string[];
  sourceGroup: string;
  blockCount: number;
  bounds: string;
  voxelData: string;
  materials: PrefabMaterial[];
};

export type GalleryManifest = {
  entries: PrefabEntry[];
  tagList: string[];
  groups: string[];
  generatedAt: string;
  assetsRoot: string;
  previewMode: string;
};

export type UnpackedVoxels = {
  size: number[];
  palette: number[][];
  voxels: number[];
  materials: unknown[];
};

export type ViewerOptions = {
  interaction?: "springIso" | "free";
  antialias?: boolean;
  maxPixelRatio?: number;
  tiltX?: number;
  tiltY?: number;
};

export type VoxelViewer = {
  load: (rawPayload: unknown) => void;
  applySlices: (top: number, side: number) => void;
  getPayload: () => UnpackedVoxels | null;
  dispose: () => void;
};
