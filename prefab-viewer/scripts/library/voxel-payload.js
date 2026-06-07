/*
 * Compact hue-only voxel payloads for prefab gallery previews.
 * Colors come from sampled asset metadata or hashed block-name hues — not textures.
 */

function rgbToHex(rgb) {
  return `#${rgb.map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, "0")).join("")}`;
}

function buildVoxelPayload(blocks, bounds, materials) {
  const palette = [];
  const paletteIndex = new Map();
  const packed = [];

  for (const block of blocks) {
    const color = block.color;
    const colorKey = `${color[0]},${color[1]},${color[2]}`;
    let pi = paletteIndex.get(colorKey);
    if (pi == null) {
      pi = palette.length;
      paletteIndex.set(colorKey, pi);
      palette.push([color[0] | 0, color[1] | 0, color[2] | 0]);
    }
    packed.push(
      (block.x - bounds.minX) | 0,
      (block.y - bounds.minY) | 0,
      (block.z - bounds.minZ) | 0,
      pi,
    );
  }

  return {
    v: 2,
    s: [bounds.sizeX, bounds.sizeY, bounds.sizeZ],
    p: palette,
    d: packVoxels(packed),
    materials: materials.map((m) => [m.name, m.count, m.color]),
  };
}

const VOXEL_RECORD_BYTES = 8;

function packVoxels(flat) {
  const count = flat.length / 4;
  const buf = Buffer.alloc(count * VOXEL_RECORD_BYTES);
  let off = 0;
  for (let i = 0; i < flat.length; i += 4) {
    buf.writeUInt16LE(flat[i], off);
    off += 2;
    buf.writeUInt16LE(flat[i + 1], off);
    off += 2;
    buf.writeUInt16LE(flat[i + 2], off);
    off += 2;
    buf.writeUInt16LE(flat[i + 3], off);
    off += 2;
  }
  return buf.toString("base64");
}

function unpackVoxels(payload) {
  if (payload.v === 2 && payload.d) {
    const bytes = Buffer.from(payload.d, "base64");
    const stride = bytes.length % VOXEL_RECORD_BYTES === 0 && bytes.length % 7 !== 0
      ? VOXEL_RECORD_BYTES
      : 7;
    const voxels = [];
    for (let off = 0; off < bytes.length; off += stride) {
      voxels.push(
        bytes.readUInt16LE(off),
        bytes.readUInt16LE(off + 2),
        bytes.readUInt16LE(off + 4),
        stride === VOXEL_RECORD_BYTES ? bytes.readUInt16LE(off + 6) : bytes[off + 6],
      );
    }
    return {
      size: payload.s,
      palette: payload.p,
      voxels,
      materials: payload.materials || [],
    };
  }

  if (payload.voxels && payload.palette) {
    const palette = payload.palette.map((entry) => {
      if (Array.isArray(entry)) return entry;
      const hex = String(entry).replace("#", "");
      return [
        Number.parseInt(hex.slice(0, 2), 16),
        Number.parseInt(hex.slice(2, 4), 16),
        Number.parseInt(hex.slice(4, 6), 16),
      ];
    });
    return {
      size: payload.size,
      palette,
      voxels: payload.voxels,
      materials: payload.materials || [],
    };
  }

  throw new Error("Unsupported voxel payload");
}

module.exports = {
  rgbToHex,
  buildVoxelPayload,
  packVoxels,
  unpackVoxels,
};
