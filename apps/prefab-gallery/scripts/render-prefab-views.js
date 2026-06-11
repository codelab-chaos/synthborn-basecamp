#!/usr/bin/env node
/*
 * Render schematic PNG preview views for Hytale .prefab.json files.
 *
 * Dependency-free by design: uses only Node built-ins so it can run in this
 * repo without npm install and can later share logic with a map/web viewer.
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const DEFAULT_SIZE = 1024;
const DEFAULT_BG = [18, 22, 28, 255];
const GRID = [52, 60, 70, 255];
const EDGE = [8, 10, 14, 150];

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.inputs.length === 0) {
    printUsage(args.help ? 0 : 1);
  }

  const outDir = path.resolve(args.out || "build/prefab-previews");
  fs.mkdirSync(outDir, { recursive: true });

  let rendered = 0;
  for (const input of expandInputs(args.inputs)) {
    const prefabPath = path.resolve(input);
    const prefab = readPrefab(prefabPath);
    const blocks = normalizeBlocks(prefab.blocks || [], null);
    if (blocks.length === 0) {
      console.warn(`[skip] ${prefabPath}: no non-empty blocks`);
      continue;
    }

    const stem = args.prefix || safeStem(path.basename(prefabPath).replace(/\.prefab\.json$/i, "").replace(/\.json$/i, ""));
    const size = clampInt(args.size || DEFAULT_SIZE, 256, 4096);
    const views = args.views || ["top", "front", "back", "profile", "iso45"];
    const bounds = getBounds(blocks);

    for (const view of views) {
      const image =
        view === "iso45"
          ? renderIso45(blocks, bounds, size)
          : renderOrtho(blocks, bounds, size, view);
      const outPath = path.join(outDir, `${stem}-${view}.png`);
      writePng(outPath, image.width, image.height, image.rgba);
      rendered++;
      console.log(`[rendered] ${outPath}`);
    }
  }

  console.log(`[done] rendered ${rendered} image(s)`);
}

function parseArgs(argv) {
  const args = { inputs: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--out") args.out = requireValue(argv, ++i, "--out");
    else if (arg === "--size") args.size = Number(requireValue(argv, ++i, "--size"));
    else if (arg === "--prefix") args.prefix = safeStem(requireValue(argv, ++i, "--prefix"));
    else if (arg === "--views") args.views = requireValue(argv, ++i, "--views").split(",").map((v) => v.trim()).filter(Boolean);
    else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    else args.inputs.push(arg);
  }
  return args;
}

function requireValue(argv, i, name) {
  if (i >= argv.length) throw new Error(`${name} requires a value`);
  return argv[i];
}

function printUsage(code) {
  const script = path.relative(process.cwd(), __filename);
  console.log(`Usage:
  node ${script} <prefab.json|directory> [more inputs...] [--out DIR] [--size 1024]

Options:
  --out DIR       Output directory. Default: build/prefab-previews
  --size N        Square image size, 256..4096. Default: 1024
  --prefix NAME   File prefix for a single input. Default: prefab basename
  --views LIST    Comma list. Default: top,front,back,profile,iso45

Examples:
  node ${script} C:/.../HyTinys-FortifiedVillageHouseLarge.prefab.json
  node ${script} C:/.../example-prefabs --out docs/procbuild/previews --size 768`);
  process.exit(code);
}

function expandInputs(inputs) {
  const out = [];
  for (const input of inputs) {
    const resolved = path.resolve(input);
    if (!fs.existsSync(resolved)) throw new Error(`Input not found: ${input}`);
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) collectPrefabs(resolved, out);
    else out.push(resolved);
  }
  return out;
}

function collectPrefabs(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectPrefabs(full, out);
    else if (/\.prefab\.json$/i.test(entry.name) || /\.json$/i.test(entry.name)) out.push(full);
  }
}

function readPrefab(prefabPath) {
  try {
    return JSON.parse(fs.readFileSync(prefabPath, "utf8"));
  } catch (err) {
    throw new Error(`Failed to read ${prefabPath}: ${err.message}`);
  }
}

function normalizeBlocks(blocks, colorResolver) {
  return blocks
    .filter((b) => b && Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.z))
    .filter((b) => !isEmptyBlock(b.name))
    .map((b) => ({
      x: b.x | 0,
      y: b.y | 0,
      z: b.z | 0,
      name: String(b.name || "Unknown"),
      color: colorResolver ? colorResolver(String(b.name || "Unknown")) : colorForBlock(String(b.name || "Unknown")),
    }));
}

function isEmptyBlock(name) {
  if (!name) return true;
  const n = String(name).toLowerCase();
  return n === "empty" || n === "air" || n.endsWith(":air") || n.includes("void_air");
}

function getBounds(blocks) {
  const b = {
    minX: Infinity, minY: Infinity, minZ: Infinity,
    maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity,
  };
  for (const block of blocks) {
    b.minX = Math.min(b.minX, block.x);
    b.minY = Math.min(b.minY, block.y);
    b.minZ = Math.min(b.minZ, block.z);
    b.maxX = Math.max(b.maxX, block.x);
    b.maxY = Math.max(b.maxY, block.y);
    b.maxZ = Math.max(b.maxZ, block.z);
  }
  b.sizeX = b.maxX - b.minX + 1;
  b.sizeY = b.maxY - b.minY + 1;
  b.sizeZ = b.maxZ - b.minZ + 1;
  return b;
}

function renderOrtho(blocks, bounds, size, view) {
  const canvas = new Canvas(size, size, DEFAULT_BG);
  const margin = Math.max(20, Math.round(size * 0.04));
  const dims = orthoDims(bounds, view);
  const cell = Math.max(1, Math.floor(Math.min((size - margin * 2) / dims.w, (size - margin * 2) / dims.h)));
  const drawW = dims.w * cell;
  const drawH = dims.h * cell;
  const ox = Math.floor((size - drawW) / 2);
  const oy = Math.floor((size - drawH) / 2);
  const visible = projectVisible(blocks, view);

  drawGrid(canvas, ox, oy, dims.w, dims.h, cell);
  for (const p of visible.values()) {
    const c = shade(p.block.color, p.shade);
    canvas.fillRect(ox + p.u * cell, oy + p.v * cell, cell, cell, [...c, 255]);
    if (cell >= 5) canvas.strokeRect(ox + p.u * cell, oy + p.v * cell, cell, cell, EDGE);
  }
  drawLabel(canvas, view.toUpperCase(), 12, 12);
  return canvas;
}

function orthoDims(bounds, view) {
  if (view === "top") return { w: bounds.sizeX, h: bounds.sizeZ };
  if (view === "front" || view === "back") return { w: bounds.sizeX, h: bounds.sizeY };
  if (view === "profile" || view === "side") return { w: bounds.sizeZ, h: bounds.sizeY };
  throw new Error(`Unknown view '${view}'. Use top,front,back,profile,iso45.`);
}

function projectVisible(blocks, view) {
  const bounds = getBounds(blocks);
  const visible = new Map();

  for (const block of blocks) {
    let u, v, depth, shade;
    if (view === "top") {
      u = block.x - bounds.minX;
      v = block.z - bounds.minZ;
      depth = block.y;
      shade = 1.12;
    } else if (view === "front") {
      u = block.x - bounds.minX;
      v = bounds.maxY - block.y;
      depth = -block.z;
      shade = 0.94;
    } else if (view === "back") {
      u = bounds.maxX - block.x;
      v = bounds.maxY - block.y;
      depth = block.z;
      shade = 0.9;
    } else if (view === "profile" || view === "side") {
      u = block.z - bounds.minZ;
      v = bounds.maxY - block.y;
      depth = -block.x;
      shade = 0.86;
    } else {
      throw new Error(`Unknown view '${view}'`);
    }
    const key = `${u},${v}`;
    const existing = visible.get(key);
    if (!existing || depth > existing.depth) visible.set(key, { u, v, depth, shade, block });
  }

  return visible;
}

function renderIso45(blocks, bounds, size) {
  const canvas = new Canvas(size, size, DEFAULT_BG);
  const margin = Math.max(24, Math.round(size * 0.05));
  const spanU = bounds.sizeX + bounds.sizeZ;
  const spanV = (bounds.sizeX + bounds.sizeZ) / 2 + bounds.sizeY;
  const cube = Math.max(2, Math.floor(Math.min((size - margin * 2) / spanU, (size - margin * 2) / spanV)));
  const halfW = cube;
  const halfH = Math.max(1, Math.round(cube * 0.5));
  const height = cube;

  const projected = blocks.map((b) => {
    const x = b.x - bounds.minX;
    const y = b.y - bounds.minY;
    const z = b.z - bounds.minZ;
    return { block: b, x, y, z, depth: x + z + y * 0.01 };
  }).sort((a, b) => a.depth - b.depth || a.y - b.y);

  const minIsoX = -bounds.sizeZ * halfW;
  const maxIsoX = bounds.sizeX * halfW;
  const minIsoY = -bounds.sizeY * height;
  const maxIsoY = (bounds.sizeX + bounds.sizeZ) * halfH;
  const drawW = maxIsoX - minIsoX + halfW * 2;
  const drawH = maxIsoY - minIsoY + height + halfH;
  const ox = Math.floor((size - drawW) / 2 - minIsoX + halfW);
  const oy = Math.floor((size - drawH) / 2 - minIsoY + halfH);

  for (const p of projected) {
    drawIsoBlock(canvas, ox, oy, p.x, p.y, p.z, halfW, halfH, height, p.block.color);
  }

  drawLabel(canvas, "ISO 45", 12, 12);
  return canvas;
}

function drawIsoBlock(canvas, ox, oy, x, y, z, hw, hh, h, baseColor) {
  const sx = ox + (x - z) * hw;
  const sy = oy + (x + z) * hh - y * h;
  const top = [[sx, sy - h], [sx + hw, sy - h + hh], [sx, sy - h + hh * 2], [sx - hw, sy - h + hh]];
  const left = [[sx - hw, sy - h + hh], [sx, sy - h + hh * 2], [sx, sy + hh * 2], [sx - hw, sy + hh]];
  const right = [[sx + hw, sy - h + hh], [sx, sy - h + hh * 2], [sx, sy + hh * 2], [sx + hw, sy + hh]];
  canvas.fillPoly(left, [...shade(baseColor, 0.76), 255]);
  canvas.fillPoly(right, [...shade(baseColor, 0.9), 255]);
  canvas.fillPoly(top, [...shade(baseColor, 1.15), 255]);
  if (hw >= 3) {
    canvas.strokePoly(left, EDGE);
    canvas.strokePoly(right, EDGE);
    canvas.strokePoly(top, EDGE);
  }
}

function drawGrid(canvas, ox, oy, w, h, cell) {
  if (cell < 8) return;
  for (let x = 0; x <= w; x++) canvas.line(ox + x * cell, oy, ox + x * cell, oy + h * cell, GRID);
  for (let y = 0; y <= h; y++) canvas.line(ox, oy + y * cell, ox + w * cell, oy + y * cell, GRID);
}

class Canvas {
  constructor(width, height, bg) {
    this.width = width;
    this.height = height;
    this.rgba = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      this.rgba[i * 4] = bg[0];
      this.rgba[i * 4 + 1] = bg[1];
      this.rgba[i * 4 + 2] = bg[2];
      this.rgba[i * 4 + 3] = bg[3];
    }
  }

  setPixel(x, y, color) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    const a = (color[3] ?? 255) / 255;
    this.rgba[i] = Math.round(color[0] * a + this.rgba[i] * (1 - a));
    this.rgba[i + 1] = Math.round(color[1] * a + this.rgba[i + 1] * (1 - a));
    this.rgba[i + 2] = Math.round(color[2] * a + this.rgba[i + 2] * (1 - a));
    this.rgba[i + 3] = 255;
  }

  fillRect(x, y, w, h, color) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + w));
    const y1 = Math.min(this.height, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) this.setPixel(xx, yy, color);
    }
  }

  strokeRect(x, y, w, h, color) {
    this.line(x, y, x + w, y, color);
    this.line(x + w, y, x + w, y + h, color);
    this.line(x + w, y + h, x, y + h, color);
    this.line(x, y + h, x, y, color);
  }

  line(x0, y0, x1, y1, color) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      this.setPixel(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  fillPoly(points, color) {
    const minY = Math.max(0, Math.floor(Math.min(...points.map((p) => p[1]))));
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(...points.map((p) => p[1]))));
    for (let y = minY; y <= maxY; y++) {
      const xs = [];
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if ((yi > y) !== (yj > y)) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i < xs.length; i += 2) {
        const x0 = Math.max(0, Math.ceil(xs[i]));
        const x1 = Math.min(this.width - 1, Math.floor(xs[i + 1]));
        for (let x = x0; x <= x1; x++) this.setPixel(x, y, color);
      }
    }
  }

  strokePoly(points, color) {
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      this.line(a[0], a[1], b[0], b[1], color);
    }
  }
}

function writePng(filePath, width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const chunks = [
    pngChunk("IHDR", concatBuffers([
      u32(width), u32(height), Buffer.from([8, 6, 0, 0, 0]),
    ])),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ];
  fs.writeFileSync(filePath, concatBuffers([pngSignature(), ...chunks]));
}

function pngSignature() {
  return Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  return concatBuffers([u32(data.length), typeBuf, data, u32(crc32(concatBuffers([typeBuf, data])) >>> 0)]);
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

function concatBuffers(parts) {
  return Buffer.concat(parts);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function colorForBlock(name) {
  const n = name.toLowerCase();
  if (n.includes("grass") || n.includes("leaf") || n.includes("leaves") || n.includes("foliage")) return [83, 150, 72];
  if (n.includes("soil") || n.includes("dirt") || n.includes("mud")) return [112, 82, 50];
  if (n.includes("wood") || n.includes("log") || n.includes("trunk") || n.includes("plank")) return [154, 100, 54];
  if (n.includes("roof") || n.includes("tile")) return [150, 56, 48];
  if (n.includes("stone") || n.includes("rock") || n.includes("marble") || n.includes("cobble")) return [127, 129, 124];
  if (n.includes("glass") || n.includes("crystal")) return [78, 156, 190];
  if (n.includes("water")) return [54, 108, 190];
  if (n.includes("lava") || n.includes("fire")) return [220, 92, 33];
  if (n.includes("snow") || n.includes("ice")) return [188, 218, 230];
  if (n.includes("lantern") || n.includes("torch") || n.includes("light")) return [232, 178, 67];
  return hashColor(name);
}

function hashColor(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hue = (h >>> 0) % 360;
  return hslToRgb(hue / 360, 0.42, 0.56);
}

function hslToRgb(h, s, l) {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function shade(rgb, factor) {
  return rgb.map((v) => Math.max(0, Math.min(255, Math.round(v * factor))));
}

function safeStem(s) {
  return String(s).replace(/[^a-z0-9_.-]+/gi, "_").replace(/^_+|_+$/g, "") || "prefab";
}

function clampInt(n, min, max) {
  if (!Number.isFinite(n)) return DEFAULT_SIZE;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function drawLabel(canvas, text, x, y) {
  // Tiny block font for just enough orientation. Not meant to be pretty.
  const glyphs = {
    "0": ["111", "101", "101", "101", "111"], "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "111", "001", "111"],
    "A": ["010", "101", "111", "101", "101"], "B": ["110", "101", "110", "101", "110"], "C": ["011", "100", "100", "100", "011"],
    "D": ["110", "101", "101", "101", "110"], "E": ["111", "100", "110", "100", "111"], "F": ["111", "100", "110", "100", "100"],
    "I": ["111", "010", "010", "010", "111"], "K": ["101", "101", "110", "101", "101"], "L": ["100", "100", "100", "100", "111"],
    "N": ["101", "111", "111", "111", "101"],
    "O": ["111", "101", "101", "101", "111"], "P": ["110", "101", "110", "100", "100"], "R": ["110", "101", "110", "101", "101"],
    "S": ["011", "100", "010", "001", "110"], "T": ["111", "010", "010", "010", "010"], " ": ["000", "000", "000", "000", "000"],
  };
  const scale = 3;
  let cx = x;
  for (const ch of text) {
    const g = glyphs[ch] || glyphs[" "];
    for (let yy = 0; yy < g.length; yy++) {
      for (let xx = 0; xx < g[yy].length; xx++) {
        if (g[yy][xx] === "1") canvas.fillRect(cx + xx * scale, y + yy * scale, scale, scale, [225, 231, 238, 210]);
      }
    }
    cx += 4 * scale;
  }
}

module.exports = {
  DEFAULT_SIZE,
  expandInputs,
  readPrefab,
  normalizeBlocks,
  getBounds,
  renderOrtho,
  renderIso45,
  writePng,
  safeStem,
  clampInt,
};

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`[error] ${err.message}`);
    process.exit(1);
  }
}
