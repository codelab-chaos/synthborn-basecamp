#!/usr/bin/env node
const { execSync } = require('child_process');

const logPath = process.argv[2];
if (!logPath) {
  console.error('Usage: node parse-client-log.js <log-path-or-ssh-cmd>');
  process.exit(1);
}

let raw;
if (logPath.startsWith('ssh:')) {
  raw = execSync(logPath.slice(4), { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
} else {
  const fs = require('fs');
  raw = fs.readFileSync(logPath, 'utf8');
}

const events = [];
for (const line of raw.split('\n')) {
  const m = line.match(/client-log (\{.*\})/);
  if (!m) continue;
  try {
    const j = JSON.parse(m[1]);
    for (const e of j.events || []) events.push(e);
  } catch {
    // skip
  }
}

const byType = {};
for (const e of events) {
  byType[e.type] = (byType[e.type] || 0) + 1;
}

function stats(nums) {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const p = (r) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * r))];
  return {
    count: sorted.length,
    p50: p(0.5),
    p95: p(0.95),
    max: sorted[sorted.length - 1],
  };
}

const hitches = events.filter((e) => e.type === 'frame_hitch');
const loads = events.filter((e) => e.type === 'terrain_single_load');
const grids = events.filter((e) => e.type === 'grid_load');

console.log(JSON.stringify({
  totalEvents: events.length,
  byType,
  frame_hitch: {
    ...stats(hitches.map((e) => e.deltaMs)),
    loadGrid: hitches.filter((e) => e.load === 'grid').length,
    loadNone: hitches.filter((e) => e.load === 'none').length,
    loadBatch: hitches.filter((e) => e.load === 'batch').length,
  },
  terrain_single_load: {
    ...stats(loads.map((e) => e.ms)),
    over100ms: loads.filter((e) => e.ms > 100).length,
    over500ms: loads.filter((e) => e.ms > 500).length,
  },
  grid_load: grids.map((g) => ({
    ms: g.ms,
    needed: g.needed,
    cacheHits: g.cacheHits,
    cacheParseMs: g.cacheParseMs,
    radius: g.radius,
  })),
}, null, 2));
