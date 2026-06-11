export type PrefabMaterial = {
  name: string;
  count: number;
  color: string;
};

export type VoxelRef = {
  pack: string;
  offset: number;
  length: number;
};

export type PreviewAtlasRef = {
  atlas: string;
  x: number;
  y: number;
  tile: number;
  atlasW: number;
  atlasH: number;
};

export type PrefabEntry = {
  label: string;
  id: string;
  path: string;
  tags: string[];
  sourceGroup: string;
  blockCount: number;
  bounds: string;
  voxelData: string | VoxelRef;
  preview?: PreviewAtlasRef;
  materials: PrefabMaterial[];
};

export type TagTree = Record<string, string[]>;

export type GalleryManifest = {
  entries: PrefabEntry[];
  tagList: string[];
  tagTree?: TagTree;
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
  preserveDrawingBuffer?: boolean;
  tiltX?: number;
  tiltY?: number;
};

export type VoxelViewer = {
  load: (payload: UnpackedVoxels) => void;
  applySlices: (top: number, side: number) => void;
  getPayload: () => UnpackedVoxels | null;
  captureSnapshot: (target: HTMLCanvasElement) => boolean;
  dispose: () => void;
};
