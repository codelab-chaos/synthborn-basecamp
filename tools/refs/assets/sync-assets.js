#!/usr/bin/env node
'use strict';

/*
 * sync-assets.js — incrementally refresh the local _Assets/ tree from Assets.zip.
 *
 * Fast release path:
 *   pass --from-toc for the TOC that matches the current _Assets/ checkout. The
 *   script compares that TOC to the new zip central directory, then extracts only
 *   added/changed files and deletes files removed from the new zip.
 *
 * Safe path:
 *   omit --from-toc. The script scans _Assets/ and computes CRCs before planning.
 *   That reads the existing tree, but avoids assuming _Assets/ still matches an
 *   older committed TOC.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  BASECAMP_ROOT,
  defaultGameLatest,
  detectVersion,
  tocFromDir,
  tocFromZip,
} = require('./build-assets-toc.js');

const DEFAULT_ASSETS = path.join(BASECAMP_ROOT, '_Assets');
const DEFAULT_BATCH_SIZE = 200;

function parseArgs(argv) {
  const args = {
    assets: DEFAULT_ASSETS,
    zip: null,
    game: null,
    fromToc: null,
    dryRun: false,
    keepRemoved: false,
    batchSize: DEFAULT_BATCH_SIZE,
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[++i];
    };

    if (arg === '--assets' || arg === '--dir') args.assets = next();
    else if (arg === '--zip') args.zip = next();
    else if (arg === '--game') args.game = next();
    else if (arg === '--from-toc' || arg === '--previous-toc') args.fromToc = next();
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--keep-removed') args.keepRemoved = true;
    else if (arg === '--batch-size') args.batchSize = Number(next());
    else if (arg === '-h' || arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isInteger(args.batchSize) || args.batchSize < 1) {
    throw new Error(`--batch-size must be a positive integer; got ${args.batchSize}`);
  }

  return args;
}

function usage() {
  console.log(`Usage: node tools/refs/assets/sync-assets.js [options]

Options:
  --zip <path>             Assets.zip path. Defaults to <game>/Assets.zip.
  --game <dir>             Hytale game/latest directory used to find Assets.zip.
  --assets, --dir <dir>    Unpacked assets root. Default: _Assets.
  --from-toc <file>        Previous TOC that matches current _Assets; avoids local CRC scan.
  --dry-run                Print the plan without extracting or deleting.
  --keep-removed           Do not delete files missing from the new zip.
  --batch-size <n>         Zip entries per unzip call. Default: ${DEFAULT_BATCH_SIZE}.

Examples:
  node tools/refs/assets/sync-assets.js --dry-run
  node tools/refs/assets/sync-assets.js --from-toc docs/refs/assets/toc/assets-toc-0.5.4.json
  node tools/refs/assets/sync-assets.js --zip /path/to/Assets.zip --assets _Assets
`);
}

function loadToc(file) {
  const full = path.resolve(file);
  const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
  if (!parsed || parsed.schema !== 'hytale-assets-toc/v1' || !parsed.files) {
    throw new Error(`Invalid assets TOC: ${file}`);
  }
  return parsed;
}

function sameEntry(a, b) {
  return Boolean(a && b && a.size === b.size && String(a.crc).toLowerCase() === String(b.crc).toLowerCase());
}

function assertSafeZipPath(name) {
  if (!name || path.isAbsolute(name) || /^[a-zA-Z]:/.test(name)) {
    throw new Error(`Unsafe zip entry path: ${name}`);
  }
  const parts = name.split('/');
  if (parts.includes('..') || parts.includes('')) {
    throw new Error(`Unsafe zip entry path: ${name}`);
  }
}

function planSync(currentFiles, nextFiles) {
  const added = [];
  const changed = [];
  let same = 0;

  for (const name of Object.keys(nextFiles).sort()) {
    assertSafeZipPath(name);
    if (!currentFiles[name]) added.push(name);
    else if (!sameEntry(currentFiles[name], nextFiles[name])) changed.push(name);
    else same++;
  }

  const removed = [];
  for (const name of Object.keys(currentFiles).sort()) {
    assertSafeZipPath(name);
    if (!nextFiles[name]) removed.push(name);
  }

  return { added, changed, removed, same };
}

function formatPath(file) {
  return path.relative(BASECAMP_ROOT, path.resolve(file)) || '.';
}

function printSample(label, files) {
  if (!files.length) return;
  console.log(`  ${label} sample:`);
  for (const file of files.slice(0, 10)) {
    console.log(`    ${file}`);
  }
  if (files.length > 10) console.log(`    ... ${files.length - 10} more`);
}

function removeEmptyParents(file, root) {
  let dir = path.dirname(file);
  const stop = path.resolve(root);
  while (dir.startsWith(stop) && dir !== stop) {
    try {
      fs.rmdirSync(dir);
    } catch (_) {
      return;
    }
    dir = path.dirname(dir);
  }
}

function deleteRemoved(assetsRoot, removed) {
  for (const name of removed) {
    const full = path.join(assetsRoot, name);
    if (!full.startsWith(assetsRoot + path.sep)) {
      throw new Error(`Refusing to delete outside assets root: ${full}`);
    }
    if (!fs.existsSync(full)) continue;
    fs.unlinkSync(full);
    removeEmptyParents(full, assetsRoot);
  }
}

function extractEntries(zip, assetsRoot, entries, batchSize) {
  fs.mkdirSync(assetsRoot, { recursive: true });
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    execFileSync('unzip', ['-oq', zip, ...batch, '-d', assetsRoot], { stdio: 'inherit' });
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  let gameLatest = args.game ? path.resolve(args.game) : null;
  const zip = args.zip
    ? path.resolve(args.zip)
    : path.join(gameLatest || defaultGameLatest(), 'Assets.zip');
  if (!gameLatest) gameLatest = path.dirname(zip);
  const assetsRoot = path.resolve(args.assets);

  if (!fs.existsSync(zip)) throw new Error(`Assets.zip not found: ${zip}`);

  console.log(`Reading zip central directory: ${zip}`);
  const nextFiles = tocFromZip(zip);

  let currentFiles;
  let currentSource;
  if (args.fromToc) {
    const toc = loadToc(args.fromToc);
    currentFiles = toc.files;
    currentSource = `${formatPath(args.fromToc)} (version ${toc.version || '?'})`;
  } else if (fs.existsSync(assetsRoot)) {
    console.log(`Scanning extracted folder: ${assetsRoot}`);
    currentFiles = tocFromDir(assetsRoot);
    currentSource = formatPath(assetsRoot);
  } else {
    currentFiles = {};
    currentSource = `${formatPath(assetsRoot)} (missing)`;
  }

  const plan = planSync(currentFiles, nextFiles);
  const toExtract = [...plan.added, ...plan.changed].sort();
  const toRemove = args.keepRemoved ? [] : plan.removed;
  const version = detectVersion(gameLatest);

  console.log('\nHytale assets sync plan:');
  console.log(`  version:       ${version}`);
  console.log(`  current:       ${currentSource}`);
  console.log(`  next:          ${path.basename(zip)}`);
  console.log(`  same:          ${plan.same.toLocaleString()}`);
  console.log(`  added:         ${plan.added.length.toLocaleString()}`);
  console.log(`  changed:       ${plan.changed.length.toLocaleString()}`);
  console.log(`  removed:       ${plan.removed.length.toLocaleString()}${args.keepRemoved ? ' (kept)' : ''}`);
  console.log(`  extract total: ${toExtract.length.toLocaleString()}`);
  printSample('added', plan.added);
  printSample('changed', plan.changed);
  if (!args.keepRemoved) printSample('removed', plan.removed);

  if (args.dryRun) {
    console.log('\nDry run only; no files changed.');
    return;
  }

  if (toRemove.length) {
    console.log(`\nDeleting ${toRemove.length.toLocaleString()} removed asset file(s)...`);
    deleteRemoved(assetsRoot, toRemove);
  }

  if (toExtract.length) {
    console.log(`\nExtracting ${toExtract.length.toLocaleString()} added/changed asset file(s)...`);
    extractEntries(zip, assetsRoot, toExtract, args.batchSize);
  }

  console.log('\nHytale assets sync complete.');
}

try {
  main();
} catch (err) {
  console.error(`sync-assets: ${err.message}`);
  process.exit(1);
}
