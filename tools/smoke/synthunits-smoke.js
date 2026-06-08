#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const {
  configureRemoteHost,
  parseRemoteFlags,
  stripRemoteFlags,
  isRemoteEnabled,
  deployModRemote,
  printModeBanner,
} = require("../library/remote-host");
const { modDir } = require("../library/workspace");

const rawArgv = process.argv.slice(2);
configureRemoteHost(parseRemoteFlags(rawArgv));

const root = path.resolve(__dirname, "..", "..");
const options = parseArgs(stripRemoteFlags(rawArgv));
const shouldBuild = options.build;
const shouldDeploy = shouldBuild || options.deploy;
const fallbackTestHome = ["-1399", "37", "-4"];
const fallbackChunkLoader = ["-44", "-1", "2"];

function parseArgs(argv) {
  const parsed = {
    build: false,
    deploy: false,
    rconArgs: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--build":
        parsed.build = true;
        break;
      case "--deploy":
        parsed.deploy = true;
        break;
      case "--save":
      case "--host":
      case "--port":
      case "--token":
      case "--timeout":
        parsed.rconArgs.push(arg, requireValue(argv, ++i, arg));
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function run(label, command, commandArgs, options = {}) {
  console.log(`\n== ${label}`);
  console.log(`$ ${[command, ...commandArgs].join(" ")}`);
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd || root,
    shell: process.platform === "win32",
    encoding: "utf8",
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
  return `${result.stdout || ""}${result.stderr || ""}`;
}

function gradle(modName, task) {
  run(`${modName} ${task}`, ".\\gradlew.bat", [task], {
    cwd: modDir(modName),
  });
}

function deployMods() {
  printModeBanner("synthunits-smoke");
  if (isRemoteEnabled()) {
    deployModRemote({
      modDir: modDir("SynthRCON"),
      saveName: "synthtest-02",
    });
    deployModRemote({
      modDir: modDir("SynthUnits"),
      saveName: "synthtest-02",
    });
    return;
  }
  gradle("SynthRCON", "deploy");
  gradle("SynthUnits", "deploy");
}

function rcon(label, ...commandArgs) {
  return run(label, "node", [
    path.join("tools", "rcon", "synth-rcon.js"),
    ...options.rconArgs,
    ...commandArgs,
  ]);
}

// Validation lines now carry an optional tier tag, e.g.
// `runtime-validation spawn-basic [isolated-mechanic]: PASS`. Match PASS tier-agnostically.
function passed(output, scenario) {
  return new RegExp(`runtime-validation ${scenario}(?: \\[[^\\]]+\\])?: PASS`).test(output);
}

function validate(label, scenario, position = null) {
  const command = ["validate", scenario];
  if (position) {
    command.push("at", ...position);
  }
  const output = rcon(label, ...command);
  if (!passed(output, scenario)) {
    throw new Error(`${label} did not report PASS`);
  }
  return output;
}

function validateNativeHoover(position) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    validate(
      attempt === 1
        ? "nearby ground item pickup setup"
        : `nearby ground item pickup setup retry ${attempt}`,
      "nearby-ground-item-pickup-start",
      position
    );
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 6000);
    const output = rcon(
      attempt === 1
        ? "nearby ground item pickup validation"
        : `nearby ground item pickup validation retry ${attempt}`,
      "validate",
      "nearby-ground-item-pickup-check"
    );
    if (passed(output, "nearby-ground-item-pickup")) {
      return output;
    }
  }
  throw new Error("nearby ground item pickup validation did not report PASS after retries");
}

function synthIdFrom(output, label) {
  const match = output.match(/#(\d+)|spawned_id:\s*(\d+)/);
  if (!match) {
    throw new Error(`${label} did not report a synth id`);
  }
  return match[1] || match[2];
}

function testHomePositionFrom(output) {
  const match = output.match(/Synth test home:\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  return [match[1], match[2], match[3]];
}

try {
  if (shouldBuild) {
    gradle("SynthRCON", "build");
    gradle("SynthUnits", "build");
  }

  if (shouldDeploy) {
    deployMods();
  }

  rcon("RCON health", "--health");
  const chunkStatusOutput = rcon("chunk loader status", "synth", "chunk", "list");
  const testHomeOutput = rcon("test home anchor", "synth", "testhome", "show");
  const configuredTestHome = testHomePositionFrom(testHomeOutput);
  const validationPosition = configuredTestHome || fallbackTestHome;
  if (!configuredTestHome && !chunkStatusOutput.includes("chunk=-44,-1 radius=2")) {
    rcon("fallback chunk loader", "synth", "chunk", "load", ...fallbackChunkLoader);
  }
  validate("spawn validation", "spawn-basic", validationPosition);
  validate("gatherer validation", "gatherer-basic", validationPosition);
  validate("gathering validation", "gathering-basics", validationPosition);
  validate("hatchet crafting validation", "hatchet-crafting", validationPosition);
  validate("pickaxe crafting validation", "pickaxe-crafting", validationPosition);
  validate("tree chopping validation", "tree-chopping", validationPosition);
  validate("mining basics validation", "mining-basics", validationPosition);
  validate("vision snapshot validation", "vision-snapshot", validationPosition);
  validate("perception targeting validation", "perception-targeting", validationPosition);
  validate("first chest validation", "first-chest", validationPosition);
  validate("deposit goods validation", "deposit-goods", validationPosition);
  validate("withdraw goods validation", "withdraw-goods", validationPosition);
  validate("chest open/use validation", "chest-open-use", validationPosition);
  validate("dropped item pickup validation", "dropped-item-pickup", validationPosition);
  validateNativeHoover(validationPosition);
  validate("bench-required crafting validation", "bench-required-crafting", validationPosition);
  // Farming smoke pair: one regrow crop (berry) + one full uproot till->plant->tend->harvest cycle.
  // Full per-crop coverage (every uproot vegetable incl. wheat) lives in `/validate crop-matrix`, run on demand.
  validate("berry harvest validation", "berry-harvest", validationPosition);
  validate("farm cycle validation", "farm-cycle", validationPosition);
  validate("survival flee validation", "survival-flee", validationPosition);
  validate("vanished target reaction validation", "vanished-target-reaction", validationPosition);
  validate("vanished dropped item reaction validation", "vanished-dropped-item-reaction", validationPosition);
  validate("state nameplate validation", "state-nameplate", validationPosition);
  validate("unreachable target reaction validation", "unreachable-target-reaction", validationPosition);
  validate("full container reaction validation", "full-container-reaction", validationPosition);
  validate("starter stockpile validation", "starter-stockpile", validationPosition);
  validate("sprint stamina validation", "sprint-stamina", validationPosition);
  const [homeX, homeY, homeZ] = validationPosition;
  const planningSynthOutput = rcon("spawn planning command synth", "synth", "spawn", "at", homeX, homeY, homeZ);
  const planningSynthId = synthIdFrom(planningSynthOutput, "spawn planning command synth");
  try {
    rcon("planning command", "synth", "plan", planningSynthId, "ensure", "Tool_Hatchet_Crude", "1");
    rcon("storage command show", "synth", "storage", planningSynthId, "show");
    rcon("storage command find", "synth", "storage", planningSynthId, "find", "8");
  } finally {
    rcon("cleanup planning command synth", "synth", "rm", planningSynthId);
  }

  console.log("\nSmoke test passed.");
} catch (error) {
  console.error(`\nSmoke test failed: ${error.message}`);
  process.exit(1);
}
