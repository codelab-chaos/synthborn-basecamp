#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { configureRemoteHost, resolveTerrascapeUrl } = require("../library/remote-host");

const repoRoot = path.resolve(__dirname, "..", "..");

function usage() {
  console.log(`Usage:
  node tools/terrascape/probe-blocks.js --world <name> --at <x> <y> <z> [options]

Options:
  --rx <n>           Horizontal X radius (default 10)
  --ry <n>           Vertical radius (default 5)
  --rz <n>           Horizontal Z radius (default 10)
  --url <base>       Terrascape HTTP base (default from remote-host.env)
  --out <file>       Write JSON response to file
  --summary-only     Print block summary only
  --help, -h         Show this help

Examples:
  node tools/terrascape/probe-blocks.js --world default --at -1370 131 -1213
  node tools/terrascape/probe-blocks.js --at -1370 131 -1213 --rx 14 --ry 6 --rz 14
`);
}

function parseArgs(argv) {
  const opts = {
    world: "default",
    x: null,
    y: null,
    z: null,
    rx: 10,
    ry: 5,
    rz: 10,
    url: null,
    out: null,
    summaryOnly: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        opts.help = true;
        return opts;
      case "--world":
        opts.world = argv[++i];
        break;
      case "--at":
        opts.x = Number(argv[++i]);
        opts.y = Number(argv[++i]);
        opts.z = Number(argv[++i]);
        break;
      case "--rx":
        opts.rx = Number(argv[++i]);
        break;
      case "--ry":
        opts.ry = Number(argv[++i]);
        break;
      case "--rz":
        opts.rz = Number(argv[++i]);
        break;
      case "--url":
        opts.url = argv[++i];
        break;
      case "--out":
        opts.out = argv[++i];
        break;
      case "--summary-only":
        opts.summaryOnly = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!Number.isFinite(opts.x) || !Number.isFinite(opts.y) || !Number.isFinite(opts.z)) {
    throw new Error("Missing required --at <x> <y> <z>");
  }
  return opts;
}

function encodeWorld(world) {
  return encodeURIComponent(world);
}

async function fetchProbe(opts) {
  const base = (opts.url || resolveTerrascapeUrl()).replace(/\/$/, "");
  const url = `${base}/api/probe/${encodeWorld(opts.world)}/${opts.x}/${opts.y}/${opts.z}?rx=${opts.rx}&ry=${opts.ry}&rz=${opts.rz}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return JSON.parse(text);
}

function printSummary(data) {
  console.log(`probe ${data.world} @ ${data.center.x}, ${data.center.y}, ${data.center.z}`);
  console.log(`radius ${data.radius.x}/${data.radius.y}/${data.radius.z} · blocks ${data.blocks} · chunks ${data.chunksLoaded}${data.truncated ? " · truncated" : ""}`);
  console.log("");
  console.log("blockId\tcount\tpredictedLayer\tflags");
  for (const entry of data.summary) {
    const flags = [];
    if (entry.trunk) flags.push("trunk");
    if (entry.vegetation) flags.push("vegetation");
    if (entry.structuralPipeBranch) flags.push("pipe");
    if (entry.cosmeticMatch) flags.push(`cosmetic:${entry.cosmeticShape}`);
    if (entry.smallFoliage) flags.push("smallFoliage");
    if (entry.preferDetailLayer) flags.push("preferDetail");
    console.log(`${entry.blockId}\t${entry.count}\t${entry.predictedLayer}\t${flags.join(",")}`);
  }
}

async function main() {
  configureRemoteHost();
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    return;
  }

  const data = await fetchProbe(opts);
  if (opts.out) {
    const outPath = path.isAbsolute(opts.out) ? opts.out : path.join(repoRoot, opts.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    console.log(`wrote ${outPath}`);
  }

  if (opts.summaryOnly) {
    printSummary(data);
    return;
  }

  printSummary(data);
  console.log("");
  console.log("samples (first 20):");
  for (const sample of data.samples.slice(0, 20)) {
    console.log(`  ${sample.x},${sample.y},${sample.z} ${sample.blockId} rot=${sample.rotationIndex} layer=${sample.predictedLayer}`);
  }
}

main().catch((err) => {
  console.error(`probe-blocks: ${err.message}`);
  process.exit(1);
});
