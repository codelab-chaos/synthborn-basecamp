import type { UnpackedVoxels } from "./types";

const VOXEL_FILE_MAGIC = [0x50, 0x58, 0x56, 0x33];
const VOXEL_RECORD_BYTES = 8;

function isVoxelFileV3(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  return (
    bytes.length >= 14 &&
    bytes[0] === VOXEL_FILE_MAGIC[0] &&
    bytes[1] === VOXEL_FILE_MAGIC[1] &&
    bytes[2] === VOXEL_FILE_MAGIC[2] &&
    bytes[3] === VOXEL_FILE_MAGIC[3]
  );
}

function decodeVoxelFileV3(buffer: ArrayBuffer): UnpackedVoxels {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const stride = bytes[4];
  const size = [bytes[5], bytes[6], bytes[7]];
  const paletteCount = view.getUint16(8, true);
  let off = 10;
  const palette: number[][] = [];

  for (let i = 0; i < paletteCount; i++) {
    palette.push([bytes[off], bytes[off + 1], bytes[off + 2]]);
    off += 3;
  }

  const voxelCount = view.getUint32(off, true);
  off += 4;
  const voxels: number[] = [];

  for (let i = 0; i < voxelCount; i++) {
    const x = bytes[off++];
    const y = bytes[off++];
    const z = bytes[off++];
    const pi = stride === 5 ? view.getUint16(off, true) : bytes[off++];
    if (stride === 5) off += 2;
    voxels.push(x, y, z, pi);
  }

  return { size, palette, voxels, materials: [] };
}

export function unpackVoxelsJson(payload: Record<string, unknown>): UnpackedVoxels {
  if (payload.v === 2 && typeof payload.d === "string") {
    const binary = atob(payload.d);
    const stride =
      binary.length % VOXEL_RECORD_BYTES === 0 && binary.length % 7 !== 0
        ? VOXEL_RECORD_BYTES
        : 7;
    const voxels: number[] = [];
    for (let index = 0; index < binary.length; index += stride) {
      const byte = (offset: number) => binary.charCodeAt(index + offset);
      voxels.push(
        byte(0) | (byte(1) << 8),
        byte(2) | (byte(3) << 8),
        byte(4) | (byte(5) << 8),
        stride === VOXEL_RECORD_BYTES ? byte(6) | (byte(7) << 8) : byte(6),
      );
    }
    return {
      size: payload.s as number[],
      palette: payload.p as number[][],
      voxels,
      materials: (payload.materials as unknown[]) || [],
    };
  }

  if (Array.isArray(payload.voxels) && Array.isArray(payload.palette)) {
    const palette = (payload.palette as Array<number[] | string>).map((entry) => {
      if (Array.isArray(entry)) return entry;
      const hex = String(entry).replace("#", "");
      return [
        Number.parseInt(hex.slice(0, 2), 16),
        Number.parseInt(hex.slice(2, 4), 16),
        Number.parseInt(hex.slice(4, 6), 16),
      ];
    });
    return {
      size: payload.size as number[],
      palette,
      voxels: payload.voxels as number[],
      materials: (payload.materials as unknown[]) || [],
    };
  }

  throw new Error("Unsupported voxel payload");
}

export async function loadVoxelPayload(voxelUrl: string): Promise<UnpackedVoxels> {
  const response = await fetch(voxelUrl);
  if (!response.ok) throw new Error(`${voxelUrl} ${response.status}`);

  const buffer = await response.arrayBuffer();
  if (isVoxelFileV3(buffer)) return decodeVoxelFileV3(buffer);

  const text = new TextDecoder().decode(buffer).trim();
  if (text.startsWith("{")) {
    return unpackVoxelsJson(JSON.parse(text) as Record<string, unknown>);
  }

  throw new Error(`Unsupported voxel payload: ${voxelUrl}`);
}
