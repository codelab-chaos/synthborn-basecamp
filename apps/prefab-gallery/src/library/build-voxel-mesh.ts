import * as THREE from "three";
import type { UnpackedVoxels } from "./types";

export function enrichPreviewRgb(rgb: number[]) {
  const saturation = 1.18;
  const contrast = 1.06;
  const midpoint = 128;
  const r = rgb[0];
  const g = rgb[1];
  const b = rgb[2];
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const saturate = (channel: number) => {
    const vivid = lum + (channel - lum) * saturation;
    return midpoint + (vivid - midpoint) * contrast;
  };
  return [
    Math.max(0, Math.min(255, Math.round(saturate(r)))),
    Math.max(0, Math.min(255, Math.round(saturate(g)))),
    Math.max(0, Math.min(255, Math.round(saturate(b)))),
  ];
}

export function setInstanceColor(
  mesh: THREE.InstancedMesh,
  slot: number,
  rgb: number[],
  colorScratch: THREE.Color,
) {
  colorScratch.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
  mesh.setColorAt(slot, colorScratch);
}

/** Builds the instanced voxel mesh shared by the live viewer and the snapshot renderer. */
export function buildVoxelMesh(payload: UnpackedVoxels): THREE.InstancedMesh {
  const geom = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    shininess: 24,
    specular: 0x1a1a1a,
  });
  const voxelCount = payload.voxels.length / 4;
  const mesh = new THREE.InstancedMesh(geom, mat, voxelCount);
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();

  for (let i = 0; i < payload.voxels.length; i += 4) {
    const slot = i / 4;
    const x = payload.voxels[i];
    const y = payload.voxels[i + 1];
    const z = payload.voxels[i + 2];
    const pi = payload.voxels[i + 3];
    const rgb = enrichPreviewRgb(payload.palette[pi] || [145, 145, 145]);
    matrix.makeTranslation(
      x - payload.size[0] / 2,
      y - payload.size[1] / 2,
      z - payload.size[2] / 2,
    );
    mesh.setMatrixAt(slot, matrix);
    setInstanceColor(mesh, slot, rgb, color);
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.userData.payload = payload;
  return mesh;
}

export function disposeVoxelMesh(mesh: THREE.InstancedMesh) {
  mesh.geometry.dispose();
  const material = mesh.material;
  if (Array.isArray(material)) material.forEach((m) => m.dispose());
  else material.dispose();
  mesh.dispose();
}
