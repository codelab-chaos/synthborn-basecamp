#!/usr/bin/env node
'use strict';

/*
 * build-assets-toc.js — generate a single, versioned table-of-contents for the
 * Hytale game assets so we can detect what changes between game updates.
 *
 * Each entry records the file's path, uncompressed size, and CRC-32. The CRC-32
 * read from a zip's central directory is identical to zlib.crc32() of the
 * extracted file, so a TOC built from Assets.zip and one built from an unpacked
 * _Assets/ folder are directly comparable.
 *
 * The output JSON has sorted keys so committing one file per game version gives
 * clean `git diff`s across updates — that's the change-detection mechanism.
 *
 * Usage:
 *   node tools/assets/build-assets-toc.js                 # zip from the local install, auto-detect version
 *   node tools/assets/build-assets-toc.js --dir _Assets   # build from an already-extracted folder
 *   node tools/assets/build-assets-toc.js --zip /path/Assets.zip --version 0.5.4 --out toc.json
 *
 * zip mode shells out to `unzip` (present on macOS/Linux). --dir mode is pure Node.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const BASECAMP_ROOT = path.resolve(__dirname, '..', '..');

// ---- OS-aware default Hytale install location (mirrors the gradle deploy convention) ----
function defaultGameLatest() {
  const os = process.platform;
  const home = require('os').homedir();
  if (os === 'win32') return path.join(process.env.APPDATA || '', 'Hytale/install/release/package/game/latest');
  if (os === 'darwin') return path.join(home, 'Library/Application Support/Hytale/install/release/package/game/latest');
  return path.join(home, '.local/share/Hytale/install/release/package/game/latest');
}

function parseArgs(argv) {
  const a = { dir: null, zip: null, version: null, out: null, game: null };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    if (k === '--dir') a.dir = next();
    else if (k === '--zip') a.zip = next();
    else if (k === '--version') a.version = next();
    else if (k === '--out') a.out = next();
    else if (k === '--game') a.game = next();
    else if (k === '-h' || k === '--help') a.help = true;
    else throw new Error(`Unknown argument: ${k}`);
  }
  return a;
}

// Read Implementation-Version from the Server jar's MANIFEST.MF (the most reliable marker).
function detectVersion(gameLatest) {
  try {
    const jar = path.join(gameLatest, 'Server', 'HytaleServer.jar');
    const mf = execFileSync('unzip', ['-p', jar, 'META-INF/MANIFEST.MF'], { encoding: 'utf8', maxBuffer: 1 << 20 });
    const m = mf.match(/Implementation-Version:\s*([^\r\n]+)/i);
    if (m) return m[1].trim();
  } catch (_) { /* fall through */ }
  return 'unknown';
}

// Build {path: {size, crc}} from a zip's central directory via `unzip -v`.
function tocFromZip(zipPath) {
  const out = execFileSync('unzip', ['-v', zipPath], { encoding: 'utf8', maxBuffer: 1 << 30 });
  const re = /^\s*(\d+)\s+\S+\s+\d+\s+\S+\s+\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}\s+([0-9a-fA-F]{8})\s+(.+?)\s*$/;
  const files = {};
  for (const line of out.split('\n')) {
    const m = line.match(re);
    if (!m) continue;
    const name = m[3];
    if (name.endsWith('/')) continue; // directory entry
    files[name] = { size: parseInt(m[1], 10), crc: m[2].toLowerCase() };
  }
  return files;
}

// Build {path: {size, crc}} by walking an extracted folder (pure Node, cross-platform).
function tocFromDir(root) {
  const files = {};
  (function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile()) {
        const rel = path.relative(root, full).split(path.sep).join('/');
        const buf = fs.readFileSync(full);
        files[rel] = { size: buf.length, crc: zlib.crc32(buf).toString(16).padStart(8, '0') };
      }
    }
  })(root);
  return files;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Usage: node tools/assets/build-assets-toc.js [--zip <path>|--dir <path>] [--version <v>] [--out <path>] [--game <dir>]');
    return;
  }

  const gameLatest = args.game || defaultGameLatest();
  const version = args.version || detectVersion(gameLatest);

  let files, source;
  if (args.dir) {
    source = path.resolve(args.dir);
    console.log(`Scanning extracted folder: ${source}`);
    files = tocFromDir(source);
  } else {
    const zip = args.zip || path.join(gameLatest, 'Assets.zip');
    if (!fs.existsSync(zip)) throw new Error(`Assets.zip not found: ${zip}`);
    source = zip;
    console.log(`Reading zip central directory: ${zip}`);
    files = tocFromZip(zip);
  }

  // Sort keys so the JSON is stable and git-diffable across versions.
  const sorted = {};
  let totalBytes = 0;
  for (const k of Object.keys(files).sort()) {
    sorted[k] = files[k];
    totalBytes += files[k].size;
  }

  const meta = {
    schema: 'hytale-assets-toc/v1',
    version,
    source: path.basename(source),
    generatedAt: new Date().toISOString(),
    fileCount: Object.keys(sorted).length,
    totalBytes,
  };

  // Serialize with ONE file entry per line. Still valid JSON, but compact and git-diffable:
  // a changed/added/removed asset shows up as exactly one changed line across versions.
  const head = Object.entries(meta)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(',\n');
  const entries = Object.keys(sorted)
    .map((k) => `${JSON.stringify(k)}: {"size":${sorted[k].size},"crc":"${sorted[k].crc}"}`)
    .join(',\n');
  const json = `{\n${head},\n  "files": {\n${entries}\n  }\n}\n`;

  const out = args.out || path.join(BASECAMP_ROOT, 'tools', 'assets', 'toc', `assets-toc-${version}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, json);

  console.log(`\nHytale assets TOC written:`);
  console.log(`  version:    ${version}`);
  console.log(`  files:      ${meta.fileCount.toLocaleString()}`);
  console.log(`  totalBytes: ${totalBytes.toLocaleString()} (${(totalBytes / 1e9).toFixed(2)} GB)`);
  console.log(`  out:        ${path.relative(BASECAMP_ROOT, out)}`);
}

main();
