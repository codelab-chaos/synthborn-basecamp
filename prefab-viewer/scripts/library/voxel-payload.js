/*
 * Compact hue-only voxel payloads for prefab gallery previews.
 * v2: JSON + base64 uint16 records (legacy)
 * v3: raw PXV3 binary (.vox) — uint8 coords, 4–5 bytes/voxel, no embedded materials
 */

const VOXEL_RECORD_BYTES = 8;
const VOXEL_FILE_MAGIC = "PXV3";

function rgbToHex(rgb) {
  return `#${rgb.map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, "0")).join("")}`;
}

function packBlocks(blocks, bounds) {
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

  return { palette, packed };
}

function buildVoxelPayload(blocks, bounds, materials) {
  const { palette, packed } = packBlocks(blocks, bounds);
  return {
    v: 2,
    s: [bounds.sizeX, bounds.sizeY, bounds.sizeZ],
    p: palette,
    d: packVoxelsUint16(packed),
    materials: materials.map((m) => [m.name, m.count, m.color]),
  };
}

function packVoxelsUint16(flat) {
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

function encodeVoxelFileV3(blocks, bounds) {
  const { palette, packed } = packBlocks(blocks, bounds);
  const voxelCount = packed.length / 4;
  const widePalette = palette.length > 256;
  const stride = widePalette ? 5 : 4;

  if (bounds.sizeX > 255 || bounds.sizeY > 255 || bounds.sizeZ > 255) {
    throw new Error(`prefab bounds exceed uint8 coords: ${bounds.sizeX}x${bounds.sizeY}x${bounds.sizeZ}`);
  }

  const buf = Buffer.alloc(10 + palette.length * 3 + 4 + voxelCount * stride);
  buf.write(VOXEL_FILE_MAGIC, 0);
  buf.writeUInt8(stride, 4);
  buf.writeUInt8(bounds.sizeX, 5);
  buf.writeUInt8(bounds.sizeY, 6);
  buf.writeUInt8(bounds.sizeZ, 7);
  buf.writeUInt16LE(palette.length, 8);

  let off = 10;
  for (const rgb of palette) {
    buf.writeUInt8(rgb[0], off++);
    buf.writeUInt8(rgb[1], off++);
    buf.writeUInt8(rgb[2], off++);
  }

  buf.writeUInt32LE(voxelCount, off);
  off += 4;

  for (let i = 0; i < packed.length; i += 4) {
    buf.writeUInt8(packed[i], off++);
    buf.writeUInt8(packed[i + 1], off++);
    buf.writeUInt8(packed[i + 2], off++);
    if (widePalette) {
      buf.writeUInt16LE(packed[i + 3], off);
      off += 2;
    } else {
      buf.writeUInt8(packed[i + 3], off++);
    }
  }

  return buf;
}

function decodeVoxelFileV3(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (bytes.length < 14 || bytes.toString("ascii", 0, 4) !== VOXEL_FILE_MAGIC) {
    throw new Error("Unsupported voxel file");
  }

  const stride = bytes.readUInt8(4);
  const size = [bytes.readUInt8(5), bytes.readUInt8(6), bytes.readUInt8(7)];
  const paletteCount = bytes.readUInt16LE(8);
  let off = 10;
  const palette = [];

  for (let i = 0; i < paletteCount; i++) {
    palette.push([bytes.readUInt8(off), bytes.readUInt8(off + 1), bytes.readUInt8(off + 2)]);
    off += 3;
  }

  const voxelCount = bytes.readUInt32LE(off);
  off += 4;
  const voxels = [];

  for (let i = 0; i < voxelCount; i++) {
    const x = bytes.readUInt8(off++);
    const y = bytes.readUInt8(off++);
    const z = bytes.readUInt8(off++);
    const pi = stride === 5 ? bytes.readUInt16LE(off) : bytes.readUInt8(off);
    off += stride === 5 ? 2 : 1;
    voxels.push(x, y, z, pi);
  }

  return { size, palette, voxels, materials: [] };
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
  encodeVoxelFileV3,
  decodeVoxelFileV3,
  packVoxels: packVoxelsUint16,
  unpackVoxels,
};
