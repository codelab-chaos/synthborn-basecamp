import * as THREE from "three";
import { buildVoxelMesh, disposeVoxelMesh } from "./build-voxel-mesh";
import {
  configureRenderer,
  installPreviewLighting,
  placePreviewCamera,
} from "./prefab-voxel-viewer";
import type { UnpackedVoxels } from "./types";

export type SnapshotRenderer = {
  render(payload: UnpackedVoxels): HTMLCanvasElement;
  dispose(): void;
};

/** Single persistent WebGL context for batch-baking card previews. */
export function createSnapshotRenderer(size = 256): SnapshotRenderer {
  const scene = new THREE.Scene();
  scene.background = null;
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 5000);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  configureRenderer(renderer);
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);

  const root = new THREE.Group();
  scene.add(root);
  installPreviewLighting(scene);

  let currentMesh: THREE.InstancedMesh | null = null;

  const clearCurrentMesh = () => {
    if (!currentMesh) return;
    root.remove(currentMesh);
    disposeVoxelMesh(currentMesh);
    currentMesh = null;
  };

  return {
    render(payload: UnpackedVoxels) {
      clearCurrentMesh();
      currentMesh = buildVoxelMesh(payload);
      root.add(currentMesh);

      const maxDim = Math.max(payload.size[0], payload.size[1], payload.size[2]);
      placePreviewCamera(camera, maxDim);
      renderer.render(scene, camera);
      return renderer.domElement;
    },
    dispose() {
      clearCurrentMesh();
      renderer.dispose();
    },
  };
}
