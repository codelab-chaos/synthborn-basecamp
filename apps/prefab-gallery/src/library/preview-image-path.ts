/** Maps a manifest voxelData path (data/X.vox) to its baked preview image (previews/X.webp). */
export function previewImagePath(voxelData: string): string {
  return voxelData.replace(/^data\//, "previews/").replace(/\.(vox|json)$/i, ".webp");
}
