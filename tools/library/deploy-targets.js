"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  REPO_ROOT,
  configureRemoteHost,
  isRemoteEnabled,
  localSaveDir,
  deployModRemote,
  remoteStopServer,
  remoteStartServer,
  waitForRemoteHealth,
  remoteOverseerSetupLine,
  printModeBanner,
  pauseMs,
} = require("./remote-host");
const { modDir } = require("./workspace");

const TARGETS = {
  overseer: {
    save: "overseer-test",
    modules: [
      { name: "SynthRCON" },
      {
        name: "SynthOverseer",
        extraRemotePaths: [
          { local: "overseer-config.example.json", remote: "synthoverseer/overseer-config.example.json" },
          { local: "overseer-config.json", remote: "synthoverseer/overseer-config.json" },
        ],
      },
    ],
    verify: verifyOverseer,
  },
  units: {
    save: "synthtest-02",
    modules: [
      { name: "SynthRCON" },
      { name: "SynthUnits" },
      // Map-viewer integration is opt-in, not cadence: pass --with-terrascape to include it
      // (viewer on :6776 via SAVE_TERRASCAPE_PORTS). Without the flag, units deploys leave any
      // hand-deployed terrascape jar in the save's mods/ untouched.
      { name: "SynthTerrascape", optionalFlag: "withTerrascape" },
    ],
    smokeScript: path.join("tools", "smoke", "synthunits-smoke.js"),
    verify: verifyUnits,
  },
  terrascape: {
    save: "synth-worldview-mvp",
    modules: [
      { name: "SynthRCON" },
      { name: "SynthTerrascape" },
    ],
  },
};

function usage(scriptName) {
  const command = scriptName || "node tools/deploy.js";
  console.log(`Usage:
  ${command} <target> [options]

Targets:
  ${Object.keys(TARGETS).join(", ")}

Options:
  --restart           Stop, deploy, start, then verify when supported.
  --with-terrascape   Also deploy optional SynthTerrascape (units target; viewer on :6776).
  --verify            Run target verification after deploy.
  --smoke             Run target smoke test after deploy when supported.
  --test              Run target test command when supported.
  --build             Build without deploying.
  --list              Show target matrix.
  --local             Force local Windows target.
  --remote            Force remote Mac target.
  --max-ram <GB>      Max RAM for restart/start.
  --min-ram <GB>      Min RAM for restart/start.
  --skip-running-check
  --clear-cache       After deploy, run /terrascape clearcache (terrascape only; mesh work).
  --help, -h          Show this help.
`);
}

function parseArgs(argv) {
  const opts = {
    targetName: null,
    restart: false,
    verify: false,
    smoke: false,
    test: false,
    build: false,
    list: false,
    maxRamGB: null,
    minRamGB: null,
    skipRunningCheck: false,
    clearCache: false,
    withTerrascape: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        opts.help = true;
        return opts;
      case "--list":
        opts.list = true;
        break;
      case "--restart":
        opts.restart = true;
        opts.verify = true;
        break;
      case "--with-terrascape":
        opts.withTerrascape = true;
        break;
      case "--verify":
        opts.verify = true;
        break;
      case "--smoke":
        opts.smoke = true;
        break;
      case "--test":
        opts.test = true;
        break;
      case "--build":
        opts.build = true;
        break;
      case "--max-ram":
        opts.maxRamGB = Number(requireValue(argv, ++i, arg));
        break;
      case "--min-ram":
        opts.minRamGB = Number(requireValue(argv, ++i, arg));
        break;
      case "--skip-running-check":
        opts.skipRunningCheck = true;
        break;
      case "--clear-cache":
        opts.clearCache = true;
        break;
      case "--local":
      case "--remote":
        break;
      default:
        if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
        if (opts.targetName) throw new Error(`Unexpected argument: ${arg}`);
        opts.targetName = arg;
    }
  }
  return opts;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || String(value).startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function targetByName(name) {
  const target = TARGETS[name];
  if (!target) {
    throw new Error(`Unknown target: ${name}. Known targets: ${Object.keys(TARGETS).join(", ")}`);
  }
  return target;
}

function runChecked(label, command, args, options = {}) {
  console.log(`\n== ${label}`);
  console.log(`$ ${[command, ...args].join(" ")}`);
  const res = spawnSync(command, args, {
    cwd: options.cwd || REPO_ROOT,
    stdio: "inherit",
    shell: false,
    env: process.env,
  });
  if (res.status !== 0) {
    throw new Error(`${label} failed with exit code ${res.status}`);
  }
  return res;
}

function gradle(moduleName, task, extraArgs = []) {
  const cwd = modDir(moduleName);
  if (process.platform === "win32") {
    runChecked(
      `${moduleName} ${task}`,
      "cmd.exe",
      ["/d", "/s", "/c", ".\\gradlew.bat", task, ...extraArgs],
      { cwd },
    );
    return;
  }
  runChecked(`${moduleName} ${task}`, "sh", ["gradlew", task, ...extraArgs], { cwd });
}

function deployModuleLocal(moduleSpec, saveName) {
  const modsDir = path.join(localSaveDir(saveName), "mods");
  gradle(moduleSpec.name, "deploy", [`-PmodsDir=${modsDir}`]);
}

function deployModuleRemote(moduleSpec, saveName) {
  deployModRemote({
    modDir: modDir(moduleSpec.name),
    saveName,
    extraRemotePaths: moduleSpec.extraRemotePaths || [],
  });
}

// Modules with an optionalFlag ride only when that flag was passed (e.g. --with-terrascape).
function modulesFor(target, opts) {
  return target.modules.filter((m) => !m.optionalFlag || opts[m.optionalFlag]);
}

function buildTarget(target, opts) {
  for (const moduleSpec of modulesFor(target, opts)) {
    gradle(moduleSpec.name, "build");
  }
}

function deployTarget(target, targetName, opts) {
  printModeBanner("deploy");
  console.log(`target=${targetName} save=${target.save}`
      + ` modules=${modulesFor(target, opts).map((m) => m.name).join(",")}`);
  for (const moduleSpec of modulesFor(target, opts)) {
    if (isRemoteEnabled()) {
      deployModuleRemote(moduleSpec, target.save);
    } else {
      deployModuleLocal(moduleSpec, target.save);
    }
  }
}

function runNodeTool(label, relativeScript, args = []) {
  runChecked(label, process.execPath, [path.join(REPO_ROOT, relativeScript), ...args], {
    cwd: REPO_ROOT,
  });
}

function restartTarget(target, targetName, opts) {
  if (!isRemoteEnabled()) {
    runNodeTool("stop local server", path.join("tools", "server", "stop-server.js"), ["--save", target.save, "--local"]);
    pauseMs(4000);
    deployTarget(target, targetName, opts);
    const startArgs = ["--background", "--save", localSaveDir(target.save), "--local"];
    if (opts.maxRamGB) startArgs.push("--max-ram", String(opts.maxRamGB));
    if (opts.minRamGB) startArgs.push("--min-ram", String(opts.minRamGB));
    if (opts.skipRunningCheck) startArgs.push("--skip-running-check");
    runNodeTool("start local server", path.join("tools", "server", "start-server.js"), startArgs);
    return;
  }

  console.log(`\n== stop remote ${target.save}`);
  remoteStopServer(target.save, { tolerateDown: true, force: true });
  pauseMs(4000);
  deployTarget(target, targetName, opts);
  console.log(`\n== start remote ${target.save}`);
  remoteStartServer(target.save, {
    maxRamGB: opts.maxRamGB,
    minRamGB: opts.minRamGB,
    skipRunningCheck: opts.skipRunningCheck,
  });
  console.log(`\n== wait for remote health ${target.save}`);
  const health = waitForRemoteHealth(target.save);
  console.log(health.output || '{"ok":true}');
}

function verifyOverseer(target) {
  if (isRemoteEnabled()) {
    console.log("\n== verify remote SynthOverseer setup");
    const line = remoteOverseerSetupLine();
    console.log(line);
    if (!line.includes("tools=[")) {
      throw new Error("SynthOverseer setup line is missing tools=[...]");
    }
    return;
  }

  runNodeTool("verify local SynthOverseer setup", path.join("tools", "overseer", "redeploy.js"), ["--verify", "--local"]);
}

const CHUNK_SIZE = 32;

function runRconCaptured(saveName, args) {
  const res = spawnSync(process.execPath, [
    path.join(REPO_ROOT, "tools", "rcon", "synth-rcon.js"),
    "--save", saveName,
    ...args,
  ], { cwd: REPO_ROOT, encoding: "utf8", env: process.env });
  if (res.status !== 0) {
    throw new Error(`synth-rcon ${args.join(" ")} failed: ${(res.stderr || res.stdout || "").trim()}`);
  }
  return `${res.stdout || ""}${res.stderr || ""}`;
}

/**
 * Units verify: RCON health, then make sure the synth test home sits inside a persistent chunk
 * loader so `/validate <scenario>` works immediately after a fresh restart instead of failing
 * `target_chunk_not_loaded` until someone warms the area by hand. Idempotent — an existing
 * covering loader is left alone (loaders persist across restarts).
 */
function verifyUnits(target) {
  console.log(`\n== RCON health (${target.save})`);
  console.log(runRconCaptured(target.save, ["--health"]).trim());

  console.log(`\n== ensure test-home chunk loader (${target.save})`);
  const homeOut = runRconCaptured(target.save, ["synth", "testhome", "show"]);
  const home = homeOut.match(/Synth test home:\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (!home) {
    console.log("no test home configured — skipping chunk warmup (set one with /synth testhome set)");
    return;
  }
  const chunkX = Math.floor(Number(home[1]) / CHUNK_SIZE);
  const chunkZ = Math.floor(Number(home[3]) / CHUNK_SIZE);

  const listOut = runRconCaptured(target.save, ["synth", "chunk", "list"]);
  const loaderRe = /chunk=(-?\d+),(-?\d+) radius=(\d+)/g;
  let covered = false;
  let match;
  while ((match = loaderRe.exec(listOut)) !== null) {
    const [, lx, lz, radius] = match.map(Number);
    if (Math.abs(chunkX - lx) <= radius && Math.abs(chunkZ - lz) <= radius) {
      covered = true;
      break;
    }
  }
  if (!covered) {
    console.log(runRconCaptured(target.save, ["synth", "chunk", "load", String(chunkX), String(chunkZ), "2"]).trim());
  } else {
    console.log(`test home chunk ${chunkX},${chunkZ} already covered by a loader`);
  }

  // Loader chunks load asynchronously after a restart; a /validate fired immediately can still
  // fail target_chunk_not_loaded. Wait until every loader reports its chunks fully loaded.
  const deadline = Date.now() + 60_000;
  for (;;) {
    const status = runRconCaptured(target.save, ["synth", "chunk", "list"]);
    const pending = [...status.matchAll(/chunks=(\d+) kept=\d+ loaded=(\d+)/g)]
      .filter(([, total, loaded]) => Number(loaded) < Number(total));
    if (pending.length === 0) {
      console.log("all chunk loaders fully loaded — ready to validate");
      return;
    }
    if (Date.now() > deadline) {
      console.log("warning: chunk loaders still loading after 60s — validates may need a retry");
      return;
    }
    pauseMs(3000);
  }
}

function verifyTarget(target) {
  if (target.verify) {
    target.verify(target);
    return;
  }
  console.log(`No target-specific verifier for save ${target.save}; checking RCON health.`);
  runNodeTool("RCON health", path.join("tools", "rcon", "synth-rcon.js"), ["--save", target.save, "--health"]);
}

function clearTerrascapeServerCache(saveName) {
  console.log(`\n== clear SynthTerrascape server cache (${saveName})`);
  runNodeTool(
    "terrascape clearcache",
    path.join("tools", "rcon", "synth-rcon.js"),
    ["--save", saveName, "terrascape", "clearcache"],
  );
}

function smokeTarget(target, opts) {
  if (!target.smokeScript) {
    throw new Error(`Target ${opts.targetName} has no smoke script`);
  }
  const args = [];
  if (isRemoteEnabled()) args.push("--remote");
  else args.push("--local");
  runNodeTool(`${opts.targetName} smoke`, target.smokeScript, args);
}

function testTarget(target, opts) {
  if (opts.targetName === "terrascape") {
    const cwd = modDir("SynthTerrascape");
    if (process.platform === "win32") {
      runChecked("SynthTerrascape npm test", "cmd.exe", ["/d", "/s", "/c", "npm", "test"], { cwd });
    } else {
      runChecked("SynthTerrascape npm test", "npm", ["test"], { cwd });
    }
    return;
  }
  buildTarget(target, opts);
}

function printTargets() {
  for (const [name, target] of Object.entries(TARGETS)) {
    const modules = target.modules
        .map((m) => m.optionalFlag ? `${m.name} (optional: --${kebab(m.optionalFlag)})` : m.name)
        .join(", ");
    console.log(`${name.padEnd(10)} save=${target.save.padEnd(20)} modules=${modules}`);
  }
}

function kebab(camel) {
  return camel.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
}

function runDeployCli(argv, options = {}) {
  const remoteOptions = {
    ...remoteFlagOptions(argv),
    ...(options.forceRemote ? { remote: true, local: false } : {}),
  };
  configureRemoteHost(remoteOptions);

  const opts = parseArgs(argv);
  if (options.forceRemote) opts.remote = true;
  if (opts.help) {
    usage(options.commandName);
    return;
  }
  if (opts.list) {
    printTargets();
    return;
  }
  if (!opts.targetName) {
    usage(options.commandName);
    throw new Error("Missing target");
  }

  const target = targetByName(opts.targetName);

  if (opts.build && !opts.restart) {
    buildTarget(target, opts);
  } else if (opts.restart) {
    restartTarget(target, opts.targetName, opts);
  } else {
    deployTarget(target, opts.targetName, opts);
  }

  if (opts.verify && !opts.restart) {
    verifyTarget(target);
  } else if (opts.verify && opts.restart) {
    verifyTarget(target);
  }
  if (opts.smoke) smokeTarget(target, opts);
  if (opts.test) testTarget(target, opts);

  if (opts.clearCache) {
    if (opts.targetName !== "terrascape") {
      throw new Error("--clear-cache is only supported for the terrascape deploy target");
    }
    clearTerrascapeServerCache(target.save);
  }
}

function remoteFlagOptions(argv) {
  return {
    local: argv.includes("--local"),
    remote: argv.includes("--remote"),
  };
}

module.exports = {
  TARGETS,
  runDeployCli,
};
