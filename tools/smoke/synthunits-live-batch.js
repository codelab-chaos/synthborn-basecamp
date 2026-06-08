#!/usr/bin/env node
/*
 * Parallel live-simulation batch orchestrator for SynthUnits (sprint-board: "Parallel Live-Sim Arena
 * Framework"). Runs the arena-converted two-phase live-sims CONCURRENTLY, each in its own isolated sky
 * arena, collapsing the ~9-min serial suite to roughly one wait window.
 *
 * Flow: allocate a spaced sky arena per scenario -> fire every `-start at <arenaPos>` -> wait once for
 * the longest behavior window -> fire every `-check` -> aggregate pass/fail from the server log.
 *
 * The synth `-start` is a slow async chain (chunk-gen + platform + spawn) that out-runs the RCON ~5s
 * wait, so the RCON client call may time out while the scenario keeps running server-side. The
 * authoritative result is always the server-log line `runtime-validation <name> ... pass=...`, which is
 * what this script parses (baseline-counted so it never reads a stale prior-run line).
 *
 * Cross-platform Node, no deps. Usage:
 *   node tools/smoke/synthunits-live-batch.js [--save <name>] [--only base1,base2]
 */

"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const {
  configureRemoteHost,
  parseRemoteFlags,
  stripRemoteFlags,
} = require("../library/remote-host");

const rawArgv = process.argv.slice(2);
configureRemoteHost(parseRemoteFlags(rawArgv));

const root = path.resolve(__dirname, "..", "..");

// Live-sims converted to sky-arena mode (start routes spawn-Y >= 180 through openArena, verify uses the
// parallel-safe checkSynthTracked). Add one line here as each scenario is converted. waitSec ~ the
// scenario's behavior window (see RuntimeValidationRunner per-scenario wait times, plus margin).
const SCENARIOS = [
  { base: "berry-gather-deposit-live", waitSec: 75 },
  { base: "gathering-live", waitSec: 100 },
  { base: "known-chest-withdraw-live", waitSec: 90 },
  { base: "first-chest-place-live", waitSec: 90 },
  { base: "known-chest-gather-deposit-live", waitSec: 100 },
  { base: "starter-hatchet-live", waitSec: 180 },
  { base: "farming-live", waitSec: 120 },
  { base: "first-chest-live", waitSec: 150 },
  { base: "native-threat-live", waitSec: 20 },
];

// Arena allocation: a line of high-Y void platforms. Spacing must exceed the chunk-LOADER footprint, not
// just the work radius: a radius-2 loader spans 5 chunks (160 blocks), and overlapping loaders thrash the
// shared chunks' keep-loaded/ticking state, destabilizing the synth entity refs. 192 (6 chunks) keeps each
// arena's loader fully disjoint. Grid this if the count ever outgrows a single row.
// --stack layout (vertical packing): instead of a z-row of disjoint loaders, all arenas in a wave share one
// x/z column and separate by Y (yStackBase + j*yStack). World height is 320 (ChunkUtil.HEIGHT, MIN_Y=0) and
// terrain ~y124, so yStackBase=190 leaves headroom; yStack=64 exceeds the 32-block gather work radius so a
// synth can't reach the level above/below (assuming 3D vision — exactly what the stacked probe validates).
// The win: every stacked arena falls in the SAME chunk column, so one loader's 25-column footprint covers
// them all instead of one loader per arena — directly easing the ticking-chunk ceiling that caps concurrency.
// hSpacing is the horizontal arena-center spacing for the --grid layout (x and z). 64 > the 32-block work
// radius so neighbors don't cross-target; the grid is centered on (x, z0) so the whole footprint lands in one
// loader region (openArena snaps the loader to a region grid, so a clustered grid shares ONE refcounted
// loader — the throughput win generalized from the vertical stack to all three axes).
const ARENA = { x: -1380, y: 205, z0: 64, spacing: 192, yStackBase: 184, yStack: 64, hSpacing: 64 };

// Parse a "CxRxL" grid spec (cols x rows x levels) into a wave shape. cols/rows are the horizontal grid,
// levels is the vertical stack. Capacity per wave = C*R*L. Throws on malformed input.
function parseGrid(spec) {
  const m = /^(\d+)x(\d+)x(\d+)$/i.exec(spec);
  if (!m) throw new Error(`--grid expects CxRxL (e.g. 2x2x1, 3x3x3), got: ${spec}`);
  const grid = { cols: Number(m[1]), rows: Number(m[2]), levels: Number(m[3]) };
  if (grid.cols * grid.rows * grid.levels < 1) throw new Error(`--grid dimensions must be >= 1: ${spec}`);
  return grid;
}

function parseArgs(argv) {
  // Concurrency cap: running too many live-sims at once force-loads too many ticking chunks and starves
  // the world-thread NPC scheduler (synths stop progressing). Empirically ~5 is the safe ceiling for the row
  // layout, so run in waves of this size. Override with --concurrency N. --stack switches to the vertical
  // layout; --grid CxRxL packs a 3D cube (loaders shared per region) to push past the row ceiling.
  const opts = { save: "synthtest-02", only: null, concurrency: 4, stack: false, grid: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--save") opts.save = argv[++i];
    else if (argv[i] === "--only") opts.only = argv[++i].split(",").map((s) => s.trim());
    else if (argv[i] === "--concurrency") opts.concurrency = Math.max(1, Number(argv[++i]));
    else if (argv[i] === "--stack") opts.stack = true;
    else if (argv[i] === "--grid") opts.grid = parseGrid(argv[++i]);
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  // --grid sets the wave capacity; align concurrency to it so chunking matches the cube shape.
  if (opts.grid) opts.concurrency = opts.grid.cols * opts.grid.rows * opts.grid.levels;
  return opts;
}

function rcon(save, ...cmd) {
  return spawnSync("node", [path.join("tools", "rcon", "synth-rcon.js"), "--save", save, ...cmd], {
    cwd: root,
    shell: process.platform === "win32",
    encoding: "utf8",
    timeout: 40000,
  });
}

// All `runtime-validation <name> ... pass=...` log lines for a scenario, newest last.
// NOTE: `logs.js grep` collects matches oldest-first and breaks at --limit (default 50). On a long-lived
// server a scenario's result lines accumulate past 50, which both saturates the count (baseline-delta
// detection silently stops finding new results — every scenario reads "(no result)" at once) AND makes
// lines[last] a stale old line instead of the newest. Pass a high explicit --limit so ALL matches return in
// file order (newest last). The previous `-n 0` was a no-op: logs.js has no `-n` flag, so the 50 cap applied.
function resultLines(save, name) {
  const r = spawnSync("node", [
    path.join("tools", "server", "logs.js"), "grep", save, `runtime-validation ${name} `, "--limit", "1000000",
  ], { cwd: root, shell: process.platform === "win32", encoding: "utf8", timeout: 30000 });
  return (r.stdout || "")
    .split(/\r?\n/)
    .filter((l) => l.includes(`runtime-validation ${name} `) && l.includes("pass="));
}

function parseResult(line) {
  const m = line.match(/pass=(true|false)\s+checked=(\d+)\s+failures=(\d+)(?:\s+codes=(.*))?/);
  if (!m) return null;
  return { pass: m[1] === "true", checked: Number(m[2]), failures: Number(m[3]), codes: (m[4] || "").trim() };
}

function sleep(seconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.round(seconds * 1000));
}

// Poll until a NEW result line (beyond the pre-fire baseline count) appears for every scenario phase.
function awaitNewResults(save, scenarios, phase, baseline, deadlineMs) {
  const found = {};
  while (Date.now() < deadlineMs && Object.keys(found).length < scenarios.length) {
    sleep(5);
    for (const s of scenarios) {
      const name = `${s.base}-${phase}`;
      if (found[s.base]) continue;
      const lines = resultLines(save, name);
      if (lines.length > baseline[name]) {
        found[s.base] = parseResult(lines[lines.length - 1]);
        const r = found[s.base];
        console.log(`  ${name}: ${r && r.pass ? "PASS" : "FAIL"} ${r ? `(${r.checked}/${r.failures})` : ""} ${r && r.codes ? r.codes : ""}`.trimEnd());
      }
    }
  }
  return found;
}

// Position arena index j within a wave per the chosen layout. --grid CxRxL packs a 3D cube centered
// horizontally on (x, z0) so the footprint lands in one loader region (shared, refcounted loader); --stack is
// a vertical column; default row spaces arenas along z beyond a single loader footprint.
function wavePosition(j, opts) {
  if (opts.grid) {
    const { cols, rows } = opts.grid;
    const col = j % cols;
    const row = Math.floor(j / cols) % rows;
    const level = Math.floor(j / (cols * rows));
    return [
      ARENA.x + (col - (cols - 1) / 2) * ARENA.hSpacing,
      ARENA.yStackBase + level * ARENA.yStack,
      ARENA.z0 + (row - (rows - 1) / 2) * ARENA.hSpacing,
    ];
  }
  if (opts.stack) return [ARENA.x, ARENA.yStackBase + j * ARENA.yStack, ARENA.z0];
  return [ARENA.x, ARENA.y, ARENA.z0 + j * ARENA.spacing];
}

// Runs one wave (<= concurrency scenarios) fully in 3 phases:
//   (1) fire all prepares (loader + platform, no synth) -> wait
//   (2) fire all starts (props + spawn + seed, reusing pre-staged arena) -> wait
//   (3) wait behavior window -> fire all checks -> aggregate
// Phased staging ensures NO synths exist while chunk-loaders are being staged for other arenas,
// eliminating the entity-ref churn that limited the 2×2×2 cube to 7/8. Each scenario tears its
// own arena down in its check; we sweep synths at the end. Returns { results, timing }.
function runWave(save, wave) {
  const baseline = {};
  for (const s of wave) {
    baseline[`${s.base}-prepare`] = resultLines(save, `${s.base}-prepare`).length;
    baseline[`${s.base}-start`] = resultLines(save, `${s.base}-start`).length;
    baseline[`${s.base}-check`] = resultLines(save, `${s.base}-check`).length;
  }

  // Phase 1: stage all arenas (loader + platform) — NO synth spawns yet.
  console.log(`  prepare (${wave.length} concurrent arenas, no spawns):`);
  const tPrepareFire = Date.now();
  for (const s of wave) {
    console.log(`    ${s.base}-prepare @ ${s.pos.join(",")}`);
    rcon(save, "--timeout", "8000", "validate", `${s.base}-prepare`, "at", `${s.pos[0]}`, `${s.pos[1]}`, `${s.pos[2]}`);
  }
  const prepared = awaitNewResults(save, wave, "prepare", baseline, Date.now() + 90000);
  const prepareDetectSec = Math.round((Date.now() - tPrepareFire) / 1000);
  const prepareFailures = wave.filter((s) => !prepared[s.base] || !prepared[s.base].pass);
  if (prepareFailures.length) {
    console.log(`  WARNING: ${prepareFailures.length} prepare(s) did not pass — those starts may fail.`);
  }

  // Phase 2: spawn all synths (start reuses the pre-staged arenas via openArenaOrReuse).
  console.log(`  start (${wave.length} concurrent spawns into pre-staged arenas):`);
  const tStartFire = Date.now();
  for (const s of wave) {
    console.log(`    ${s.base}-start @ ${s.pos.join(",")}`);
    rcon(save, "--timeout", "8000", "validate", `${s.base}-start`, "at", `${s.pos[0]}`, `${s.pos[1]}`, `${s.pos[2]}`);
  }
  const started = awaitNewResults(save, wave, "start", baseline, Date.now() + 120000);
  const startDetectSec = Math.round((Date.now() - tStartFire) / 1000);
  const startFailures = wave.filter((s) => !started[s.base] || !started[s.base].pass);
  if (startFailures.length) {
    console.log(`  WARNING: ${startFailures.length} start(s) did not pass — those checks may be meaningless.`);
  }

  const waitSec = Math.max(...wave.map((s) => s.waitSec));
  console.log(`  waiting ${waitSec}s for concurrent behavior...`);
  sleep(waitSec);

  console.log("  check:");
  const tCheckFire = Date.now();
  for (const s of wave) {
    // Fire-and-forget: a check can block server-side while it recovers a stale synth ref (~40s), but the
    // authoritative result is the log line, not the RCON response. Use a short RCON timeout so the fire loop
    // returns promptly and polling starts immediately; then poll generously for the (possibly delayed) line.
    rcon(save, "--timeout", "8000", "validate", `${s.base}-check`);
  }
  const checked = awaitNewResults(save, wave, "check", baseline, Date.now() + 150000);
  const checkDetectSec = Math.round((Date.now() - tCheckFire) / 1000);
  rcon(save, "synth", "rm", "all");

  // Perf signals: prepareDetectSec ~ chunk-gen+platform cost (no spawns); startDetectSec ~ spawn+seed cost
  // (should be fast since platform is pre-staged); checkDetectSec ~ how long after the fixed wait until every
  // synth's check logged. A rising checkDetectSec across denser layouts = scheduler starvation.
  const timing = { prepareDetectSec, startDetectSec, waitSec, checkDetectSec, arenas: wave.length };
  console.log(`  timing: prepare-detect ${prepareDetectSec}s, start-detect ${startDetectSec}s, wait ${waitSec}s, check-detect ${checkDetectSec}s (${wave.length} arenas)`);
  return { results: checked, timing };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const selected = opts.only ? SCENARIOS.filter((s) => opts.only.includes(s.base)) : SCENARIOS;
  if (selected.length === 0) {
    throw new Error("No scenarios selected.");
  }

  const layout = opts.grid
    ? `grid ${opts.grid.cols}x${opts.grid.rows}x${opts.grid.levels}`
    : (opts.stack ? "stack" : "row");
  const waveCount = Math.ceil(selected.length / opts.concurrency);
  console.log(`Parallel live-sim batch: ${selected.length} scenario(s) in ${waveCount} wave(s) of <= ${opts.concurrency}, layout=${layout}, save=${opts.save}`);

  const results = {};
  const timings = [];
  const tBatch = Date.now();
  for (let i = 0; i < selected.length; i += opts.concurrency) {
    // Each wave reuses the same near-spawn arena positions (waves are sequential + fully torn down),
    // which also avoids generating far-flung chunks. Layout (row/stack/grid) is picked by wavePosition.
    const wave = selected.slice(i, i + opts.concurrency)
      .map((s, j) => ({ ...s, pos: wavePosition(j, opts) }));
    console.log(`\n--- Wave ${Math.floor(i / opts.concurrency) + 1}/${waveCount}: ${wave.map((s) => s.base).join(", ")} ---`);
    const wave_out = runWave(opts.save, wave);
    Object.assign(results, wave_out.results);
    timings.push(wave_out.timing);
  }
  const batchSec = Math.round((Date.now() - tBatch) / 1000);

  console.log("\n=== BATCH RESULTS ===");
  let allPass = true;
  for (const s of selected) {
    const r = results[s.base];
    const ok = !!(r && r.pass);
    if (!ok) allPass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${s.base}-check  ${r ? `${r.checked}/${r.failures} ${r.codes}`.trimEnd() : "(no result)"}`);
  }

  console.log(`\n=== TIMING (layout=${layout}, total ${batchSec}s) ===`);
  timings.forEach((t, i) => console.log(
    `  wave ${i + 1}: ${t.arenas} arenas — prepare-detect ${t.prepareDetectSec}s, start-detect ${t.startDetectSec}s, wait ${t.waitSec}s, check-detect ${t.checkDetectSec}s`));

  console.log(allPass ? "\nBatch PASSED." : "\nBatch had failures.");
  process.exitCode = allPass ? 0 : 1;
}

try {
  main();
} catch (err) {
  console.error(`synthunits-live-batch: ${err.message}`);
  process.exitCode = 1;
}
