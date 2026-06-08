"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const IS_WINDOWS = process.platform === "win32";

/**
 * Deployment config lives in basecamp only — the mod repos carry none, so each builds
 * standalone in CI. Process-env vars still override (see configureRemoteHost).
 */
const ENV_FILES = [
  path.join(REPO_ROOT, "remote-host.env"),
];

const REMOTE_ENV_KEYS = [
  "HYTALE_REMOTE_HOST",
  "HYTALE_REMOTE_USER",
  "HYTALE_REMOTE_SAVES",
  "HYTALE_REMOTE_REPO",
  "HYTALE_REMOTE_INSTALL",
  "HYTALE_REMOTE_SSH",
  "SYNTH_RCON_HOST",
  "SYNTH_TERRASCAPE_URL",
];

const SAVE_RCON_PORTS = {
  "overseer-test": 25577,
  "synthtest-02": 25576,
  "synth-worldview-mvp": 25578,
};

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseEnvLine(rawLine) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) return null;

  const eq = line.indexOf("=");
  if (eq <= 0) return null;

  const key = line.slice(0, eq).trim();
  let value = line.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function readMergedEnvFiles() {
  const merged = {};
  for (const filePath of ENV_FILES) {
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const parsed = parseEnvLine(rawLine);
      if (parsed) merged[parsed.key] = parsed.value;
    }
  }
  return merged;
}

function parseRemoteFlags(argv) {
  return {
    local: argv.includes("--local"),
    remote: argv.includes("--remote"),
  };
}

function stripRemoteFlags(argv) {
  return argv.filter((arg) => arg !== "--local" && arg !== "--remote");
}

function resolveRemoteEnabled(options = {}, merged = readMergedEnvFiles()) {
  if (options.local) return false;
  if (options.remote) return true;
  if (merged.HYTALE_REMOTE_ENABLED !== undefined) {
    return parseBool(merged.HYTALE_REMOTE_ENABLED, false);
  }
  if (process.env.HYTALE_REMOTE_ENABLED !== undefined) {
    return parseBool(process.env.HYTALE_REMOTE_ENABLED, false);
  }
  return false;
}

function clearRemoteEnv(merged) {
  for (const key of REMOTE_ENV_KEYS) {
    const fromFile = merged[key];
    if (fromFile !== undefined && process.env[key] === fromFile) {
      delete process.env[key];
    }
  }
  if (process.env.SYNTH_RCON_HOST && merged.SYNTH_RCON_HOST === process.env.SYNTH_RCON_HOST) {
    delete process.env.SYNTH_RCON_HOST;
  }
}

/**
 * Apply remote-host.env settings. CLI --local / --remote override HYTALE_REMOTE_ENABLED.
 * Priority: CLI flag > remote-host.env > existing process.env > default (local).
 */
function configureRemoteHost(options = {}) {
  const merged = readMergedEnvFiles();
  const enabled = resolveRemoteEnabled(options, merged);
  process.env.HYTALE_REMOTE_ENABLED = enabled ? "true" : "false";

  if (enabled) {
    for (const [key, value] of Object.entries(merged)) {
      if (key === "HYTALE_REMOTE_ENABLED") continue;
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } else {
    clearRemoteEnv(merged);
  }

  return enabled;
}

function loadRemoteHostEnv(options = {}) {
  return configureRemoteHost(options);
}

function isRemoteEnabled() {
  return parseBool(process.env.HYTALE_REMOTE_ENABLED, false);
}

function requireRemoteConfig() {
  if (!isRemoteEnabled()) {
    throw new Error("Remote host is disabled. Set HYTALE_REMOTE_ENABLED=true or pass --remote.");
  }
  const host = process.env.HYTALE_REMOTE_HOST;
  const user = process.env.HYTALE_REMOTE_USER;
  const saves = process.env.HYTALE_REMOTE_SAVES;
  if (!host || !user || !saves) {
    throw new Error("Remote deploy requires HYTALE_REMOTE_HOST, HYTALE_REMOTE_USER, and HYTALE_REMOTE_SAVES.");
  }
  return { host, user, saves };
}

function sshTarget() {
  if (process.env.HYTALE_REMOTE_SSH) {
    return process.env.HYTALE_REMOTE_SSH.trim();
  }
  const { host, user } = requireRemoteConfig();
  return `${user}@${host}`;
}

function requireRemoteHostConfig() {
  const merged = readMergedEnvFiles();
  const host = process.env.HYTALE_REMOTE_HOST || merged.HYTALE_REMOTE_HOST;
  const user = process.env.HYTALE_REMOTE_USER || merged.HYTALE_REMOTE_USER;
  const saves = process.env.HYTALE_REMOTE_SAVES || merged.HYTALE_REMOTE_SAVES;
  const ssh = process.env.HYTALE_REMOTE_SSH || merged.HYTALE_REMOTE_SSH;
  if (!ssh && (!host || !user || !saves)) {
    throw new Error("Remote copy requires HYTALE_REMOTE_SSH or HYTALE_REMOTE_HOST + USER + SAVES in remote-host.env.");
  }
  return { host, user, saves, ssh };
}

function shellQuote(value) {
  if (IS_WINDOWS) {
    return `"${String(value).replace(/"/g, '\\"')}"`;
  }
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/** Remote scp destination — pass as one argv token; spaces are fine without extra quotes. */
function scpRemoteSpec(target, posixPath) {
  return `${target}:${posixPath}`;
}

/** Single-quoted path for remote ssh shell commands (handles spaces). */
function remotePathQuote(posixPath) {
  return `'${String(posixPath).replace(/'/g, `'\"'\"'`)}'`;
}

/** On Windows, Git Bash ssh cannot use the OpenSSH agent — use System32 OpenSSH instead. */
function opensshBin(name) {
  if (IS_WINDOWS) {
    const candidate = path.join(
      process.env.SystemRoot || process.env.WINDIR || "C:\\Windows",
      "System32",
      "OpenSSH",
      `${name}.exe`,
    );
    if (fs.existsSync(candidate)) return candidate;
  }
  return name;
}

function sshConfigArgs() {
  const configPath = path.join(os.homedir(), ".ssh", "config");
  if (fs.existsSync(configPath)) {
    return ["-F", configPath];
  }
  return [];
}

function testSshConnection() {
  const target = sshTarget();
  const res = spawnSync(opensshBin("ssh"), [
    ...sshConfigArgs(),
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=15",
    target,
    "echo ok",
  ], { encoding: "utf8", shell: false });
  if (res.status !== 0) {
    const hint = IS_WINDOWS
      ? "On Windows, ensure your key is in the OpenSSH agent:\n"
        + "  powershell: Start-Service ssh-agent; ssh-add $env:USERPROFILE\\.ssh\\id_ed25519\n"
        + "  (Tools use C:\\Windows\\System32\\OpenSSH\\ssh.exe, not Git Bash ssh.)"
      : "Ensure ssh-agent has your key: ssh-add ~/.ssh/id_ed25519";
    throw new Error(
      `SSH to ${target} failed (${res.stderr?.trim() || "permission denied"}).\n${hint}`,
    );
  }
}

function runChecked(label, command, args, opts = {}) {
  const res = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    encoding: "utf8",
    ...opts,
  });
  if (res.status !== 0) {
    throw new Error(`${label} failed with exit code ${res.status}`);
  }
  return res;
}

function sshRun(command, opts = {}) {
  const target = sshTarget();
  const res = spawnSync(opensshBin("ssh"), [...sshConfigArgs(), target, command], {
    stdio: opts.silent ? "pipe" : "inherit",
    shell: false,
    encoding: "utf8",
  });
  if (res.status !== 0) {
    const detail = [res.stderr, res.stdout].filter(Boolean).join("\n").trim();
    throw new Error(
      `ssh ${target} failed with exit code ${res.status}${detail ? `:\n${detail}` : ""}`,
    );
  }
  return res.stdout || "";
}

function sshRunOk(command) {
  const target = sshTarget();
  const res = spawnSync(opensshBin("ssh"), [...sshConfigArgs(), target, command], {
    stdio: "pipe",
    shell: false,
    encoding: "utf8",
  });
  return res.status === 0;
}

function loadLocalSaveDevConfig(saveName) {
  const file = path.join(localSaveDir(saveName), "dev-server.json");
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function parseBindPort(bind) {
  const value = String(bind || "").trim();
  const lastColon = value.lastIndexOf(":");
  if (lastColon <= 0) return null;
  const port = Number(value.slice(lastColon + 1));
  return Number.isInteger(port) && port > 0 ? port : null;
}

/** When remote is enabled, SYNTH_RCON_HOST wins over save-localhost rconHost. */
function resolveRconHost(saveName, cliHost) {
  if (cliHost) return cliHost;
  if (isRemoteEnabled() && process.env.SYNTH_RCON_HOST) {
    return process.env.SYNTH_RCON_HOST;
  }
  const dev = loadLocalSaveDevConfig(saveName);
  return dev.rconHost || process.env.SYNTH_RCON_HOST || "127.0.0.1";
}

function resolveRconPort(saveName, cliPort) {
  if (cliPort) return cliPort;
  const dev = loadLocalSaveDevConfig(saveName);
  return dev.rconPort || resolveSaveRconPort(saveName) || Number(process.env.SYNTH_RCON_PORT) || 25576;
}

/**
 * HTTP base URL for SynthTerrascape (or other Mac-hosted HTTP services).
 * Priority: WORLDVIEW_URL > SYNTH_TERRASCAPE_URL > http://SYNTH_RCON_HOST:port (remote) > localhost.
 */
function resolveTerrascapeUrl(port = 5960) {
  if (process.env.WORLDVIEW_URL) return process.env.WORLDVIEW_URL;
  if (process.env.SYNTH_TERRASCAPE_URL) return process.env.SYNTH_TERRASCAPE_URL;
  configureRemoteHost();
  if (isRemoteEnabled() && process.env.SYNTH_RCON_HOST) {
    const host = process.env.SYNTH_RCON_HOST.replace(/^https?:\/\//, "").split(":")[0];
    return `http://${host}:${port}`;
  }
  return `http://127.0.0.1:${port}`;
}

function remoteRepoHasStartScript() {
  configureRemoteHost({ remote: true });
  const repo = remoteRepoShellPath();
  return sshRunOk(`test -f ${repo}/tools/server/start-server.js && command -v node >/dev/null 2>&1`);
}

function remoteStartServerDirect(saveName, options = {}) {
  const dev = loadLocalSaveDevConfig(saveName);
  const bind = dev.bind || "0.0.0.0:5520";
  const bindPort = parseBindPort(bind);
  const rconPort = resolveRconPort(saveName);
  const minRam = options.minRamGB || 2;
  const maxRam = options.maxRamGB || 6;
  const install = remotePathForShell(remoteInstallDir());
  const save = remotePathForShell(remoteSaveDir(saveName));
  const bindSafe = bind.replace(/'/g, "'\\''");
  const skipPortCheck = options.skipRunningCheck ? "true" : "false";

  const cmd = [
    `INSTALL=${install}`,
    `SAVE=${save}`,
    `BIND='${bindSafe}'`,
    'JAVA="$INSTALL/jre/latest/Contents/Home/bin/java"',
    'if [ ! -x "$JAVA" ]; then JAVA="$INSTALL/jre/latest/bin/java"; fi',
    'JAR="$INSTALL/game/latest/Server/HytaleServer.jar"',
    'ASSETS="$INSTALL/game/latest/Assets.zip"',
    'test -x "$JAVA" || { echo "java not found under $INSTALL/jre/latest"; exit 1; }',
    'test -f "$JAR" || { echo "missing $JAR"; exit 1; }',
    'test -f "$ASSETS" || { echo "missing $ASSETS"; exit 1; }',
    bindPort ? `if [ "${skipPortCheck}" != "true" ] && lsof -i UDP:${bindPort} >/dev/null 2>&1; then echo "UDP port ${bindPort} already in use"; exit 1; fi` : null,
    'mkdir -p "$SAVE/logs"',
    'cd "$SAVE"',
    `nohup "$JAVA" -Xms${minRam}G -Xmx${maxRam}G -Dsynthrcon.host=0.0.0.0 -Dsynthrcon.port=${rconPort} -Dsynthrcon.allowRemote=true -Dterrascape.http.host=0.0.0.0 -jar "$JAR" --assets "$ASSETS" --auth-mode authenticated --bind "$BIND" >>"$SAVE/logs/dev-server.out" 2>&1 & echo $! > "$SAVE/.dev-server.pid"`,
    'echo "started detached pid=$(cat "$SAVE/.dev-server.pid")"',
  ].filter(Boolean).join(" && ");

  sshRun(cmd);
}

function remoteStartServer(saveName, options = {}) {
  configureRemoteHost({ remote: true });
  requireRemoteHostConfig();
  testSshConnection();

  if (remoteRepoHasStartScript()) {
    const repo = remoteRepoShellPath();
    const savePath = remotePathForShell(remoteSaveDir(saveName));
    const install = remotePathForShell(remoteInstallDir());
    let startCmd = `node tools/server/start-server.js --save ${savePath} --install ${install} --background`;
    if (options.maxRamGB) startCmd += ` --max-ram ${options.maxRamGB}`;
    if (options.minRamGB) startCmd += ` --min-ram ${options.minRamGB}`;
    if (options.skipRunningCheck) startCmd += " --skip-running-check";
    sshRun(`cd ${repo} && ${startCmd}`);
    return;
  }

  process.stderr.write(
    "remote-host: repo not found on Mac — starting via direct java (clone hytale-mods to "
    + `${remoteRepoDir()} for start-server.js)\n`,
  );
  remoteStartServerDirect(saveName, options);
}

function scpToRemote(localPaths, remoteDest) {
  const target = `${sshTarget()}:${remoteDest}`;
  runChecked("scp", opensshBin("scp"), [...sshConfigArgs(), ...localPaths, target]);
}

function localSaveDir(saveName) {
  if (IS_WINDOWS && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "Hytale", "UserData", "Saves", saveName);
  }
  return path.join(os.homedir(), "Library", "Application Support", "Hytale", "UserData", "Saves", saveName);
}

function remoteSaveDir(saveName) {
  const saves = process.env.HYTALE_REMOTE_SAVES || readMergedEnvFiles().HYTALE_REMOTE_SAVES;
  if (!saves) {
    throw new Error("HYTALE_REMOTE_SAVES not set in remote-host.env");
  }
  return `${saves.replace(/\/$/, "")}/${saveName}`;
}

function remoteInstallDir() {
  return process.env.HYTALE_REMOTE_INSTALL
    || readMergedEnvFiles().HYTALE_REMOTE_INSTALL
    || "~/Library/Application Support/Hytale/install/release/package";
}

function resolveSaveRconPort(saveName) {
  const localConfig = path.join(localSaveDir(saveName), "dev-server.json");
  if (fs.existsSync(localConfig)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(localConfig, "utf8"));
      if (Number.isInteger(parsed.rconPort)) return parsed.rconPort;
    } catch {
      // fall through
    }
  }
  return SAVE_RCON_PORTS[saveName] || null;
}

function runRepoNodeTool(relativeScript, args, opts = {}) {
  const script = path.join(REPO_ROOT, relativeScript);
  const res = spawnSync(process.execPath, [script, ...args], {
    stdio: opts.silent ? "pipe" : "inherit",
    encoding: "utf8",
    cwd: REPO_ROOT,
    env: process.env,
  });
  if (res.status !== 0) {
    throw new Error(`${relativeScript} failed with exit code ${res.status}`);
  }
  return res;
}

function remoteServerHealth(saveName) {
  configureRemoteHost({ remote: true });
  const args = [
    path.join(REPO_ROOT, "tools", "rcon", "synth-rcon.js"),
    "--save", saveName,
    "--host", resolveRconHost(saveName),
    "--port", String(resolveRconPort(saveName)),
    "--health",
    "--remote",
  ];
  const res = spawnSync(process.execPath, args, {
    encoding: "utf8",
    cwd: REPO_ROOT,
    env: process.env,
  });
  const ok = res.status === 0 && /"ok"\s*:\s*true/.test(res.stdout || "");
  return { ok, output: `${res.stdout || ""}${res.stderr || ""}`.trim() };
}

function waitForRemoteHealth(saveName, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const health = remoteServerHealth(saveName);
    if (health.ok) return health;
    pauseMs(2000);
  }
  throw new Error(`timed out waiting for ${saveName} RCON health on remote host`);
}

function remoteStopServerViaLocalRcon(saveName) {
  const port = resolveRconPort(saveName);
  const merged = readMergedEnvFiles();
  const token = process.env.SYNTH_RCON_TOKEN || merged.SYNTH_RCON_TOKEN || "";
  const tokenArg = token
    ? ` -H 'X-SynthRCON-Token: ${token.replace(/'/g, `'\"'\"'`)}'`
    : "";
  sshRun(
    `curl -fsS -X POST 'http://127.0.0.1:${port}/command'`
    + ` -H 'Content-Type: application/json'${tokenArg}`
    + ` -d '{"command":"stop"}'`,
  );
}

function remoteStopServerViaSsh(saveName) {
  const dev = loadLocalSaveDevConfig(saveName);
  const bindPort = parseBindPort(dev.bind || "0.0.0.0:5520");
  const save = remotePathForShell(remoteSaveDir(saveName));
  const parts = [
    `SAVE=${save}`,
    'if [ -f "$SAVE/.dev-server.pid" ]; then',
    '  PID=$(cat "$SAVE/.dev-server.pid" 2>/dev/null)',
    '  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then kill "$PID" && echo "killed pid $PID"; fi',
    "fi",
  ];
  if (bindPort) {
    parts.push(
      `PIDS=$(lsof -ti UDP:${bindPort} 2>/dev/null || true)`,
      'if [ -n "$PIDS" ]; then kill $PIDS && echo "killed UDP:${bindPort} ($PIDS)"; fi',
    );
  }
  parts.push('rm -f "$SAVE/.dev-server.pid"', 'echo "ssh stop complete"');
  sshRun(parts.join("; "));
}

function remoteStopServer(saveName, options = {}) {
  configureRemoteHost({ remote: true });
  try {
    remoteStopServerViaLocalRcon(saveName);
  } catch (err) {
    if (options.force) {
      process.stderr.write(`remote-host: RCON stop failed (${err.message}); trying SSH kill\n`);
      remoteStopServerViaSsh(saveName);
      return;
    }
    if (options.tolerateDown) {
      process.stderr.write(`remote-host: stop skipped (${err.message})\n`);
      return;
    }
    throw err;
  }
}

/** Expand ~/ and quote for remote zsh (Application Support spaces). */
function remotePathForShell(posixPath) {
  let expanded = posixPath;
  if (expanded.startsWith("~/")) {
    expanded = `$HOME/${expanded.slice(2)}`;
  }
  if (expanded.includes(" ") || expanded.includes("$HOME")) {
    return `"${expanded.replace(/"/g, '\\"')}"`;
  }
  return expanded;
}

function remoteRepoShellPath() {
  return remotePathForShell(remoteRepoDir());
}

function remoteRestartServer(saveName, options = {}) {
  remoteStopServer(saveName, { force: options.force, tolerateDown: !options.force });
  pauseMs(options.pauseMs ?? 4000);
  remoteStartServer(saveName, options);
  if (options.wait) {
    process.stderr.write("remote-host: waiting for RCON health\n");
    const health = waitForRemoteHealth(saveName, options.waitTimeoutMs);
    process.stdout.write(`${health.output || '{"ok":true}'}\n`);
  }
}

function remoteModsDir(saveName) {
  return `${remoteSaveDir(saveName)}/mods`;
}

function findFatJar(modDir) {
  const libsDir = path.join(modDir, "build", "libs");
  if (!fs.existsSync(libsDir)) {
    throw new Error(`No build/libs in ${modDir} — run gradle fatJar first`);
  }
  const jars = fs.readdirSync(libsDir)
    .filter((name) => name.endsWith(".jar") && !name.includes("-sources") && !name.includes("-javadoc"))
    .map((name) => path.join(libsDir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (jars.length === 0) {
    throw new Error(`No jar found under ${libsDir}`);
  }
  return jars[0];
}

function gradleTask(modDir, task) {
  if (IS_WINDOWS) {
    runChecked(`gradle ${task}`, "cmd.exe", ["/d", "/s", "/c", ".\\gradlew.bat", task], { cwd: modDir });
    return;
  }
  runChecked(`gradle ${task}`, "./gradlew", [task], { cwd: modDir });
}

function deployModLocal(modDir, task = "deploy") {
  gradleTask(modDir, task);
}

function deployModRemote({ modDir, saveName, extraRemotePaths = [] }) {
  gradleTask(modDir, "fatJar");
  const jar = findFatJar(modDir);
  const dest = remoteModsDir(saveName);
  scpToRemote([jar], dest);

  if (extraRemotePaths.length > 0) {
    sshRun(`mkdir -p ${shellQuote(`${dest}/synthoverseer`)}`);
  }

  for (const entry of extraRemotePaths) {
    const localPath = path.join(modDir, entry.local);
    if (!fs.existsSync(localPath)) continue;
    const remotePath = `${dest}/${entry.remote}`.replace(/\\/g, "/");
    if (entry.remote.includes("/")) {
      sshRun(`mkdir -p ${shellQuote(path.posix.dirname(remotePath))}`);
    }
    scpToRemote([localPath], remotePath);
  }

  return jar;
}

function remoteRepoDir() {
  return process.env.HYTALE_REMOTE_REPO || readMergedEnvFiles().HYTALE_REMOTE_REPO || "~/git/hytale-mods";
}

function remoteOverseerSetupLine() {
  const savePath = remoteSaveDir("overseer-test");
  const cmd = [
    `L=$(ls -t ${remotePathQuote(`${savePath}/logs`)}/*_server.log 2>/dev/null | head -1)`,
    'if [ -z "$L" ]; then exit 3; fi',
    'grep "SynthOverseer setup complete" "$L" | tail -1',
  ].join("; ");
  const out = sshRun(cmd, { silent: true });
  if (!out.trim()) {
    throw new Error("no SynthOverseer setup line in remote latest log");
  }
  return out.trim();
}

function pauseMs(ms) {
  if (IS_WINDOWS) {
    spawnSync("powershell", ["-NoProfile", "-Command", `Start-Sleep -Milliseconds ${ms}`], { stdio: "ignore" });
  } else {
    spawnSync("sleep", [String(Math.max(1, Math.ceil(ms / 1000)))], { stdio: "ignore" });
  }
}

function printModeBanner(toolName) {
  const mode = isRemoteEnabled() ? "remote" : "local";
  const host = isRemoteEnabled() ? process.env.HYTALE_REMOTE_HOST : "127.0.0.1";
  process.stderr.write(`${toolName}: deploy/RCON mode=${mode} host=${host}\n`);
}

module.exports = {
  REPO_ROOT,
  ENV_FILES,
  REMOTE_ENV_KEYS,
  SAVE_RCON_PORTS,
  parseRemoteFlags,
  stripRemoteFlags,
  configureRemoteHost,
  loadRemoteHostEnv,
  isRemoteEnabled,
  requireRemoteConfig,
  requireRemoteHostConfig,
  sshTarget,
  sshRun,
  scpToRemote,
  opensshBin,
  sshConfigArgs,
  testSshConnection,
  runChecked,
  shellQuote,
  remotePathQuote,
  scpRemoteSpec,
  localSaveDir,
  remoteSaveDir,
  remoteModsDir,
  findFatJar,
  gradleTask,
  deployModLocal,
  deployModRemote,
  remoteInstallDir,
  resolveSaveRconPort,
  resolveRconHost,
  resolveRconPort,
  resolveTerrascapeUrl,
  remoteServerHealth,
  waitForRemoteHealth,
  remoteStopServer,
  remoteStopServerViaLocalRcon,
  remoteStopServerViaSsh,
  remoteStartServer,
  remoteRestartServer,
  remoteOverseerSetupLine,
  printModeBanner,
  pauseMs,
};
