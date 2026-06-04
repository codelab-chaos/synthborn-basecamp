#!/usr/bin/env node

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const {
  configureRemoteHost,
  parseRemoteFlags,
  stripRemoteFlags,
  isRemoteEnabled,
} = require("../library/remote-host");

const cliArgv = process.argv.slice(2);
configureRemoteHost(parseRemoteFlags(cliArgv));

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 25576;
const DEFAULT_TIMEOUT_MS = 5000;

function usage() {
  console.log(`Usage:
  node tools/rcon/synth-rcon.js [options] <command...>
  node tools/rcon/synth-rcon.js synth list
  node tools/rcon/synth-rcon.js synth spawn -- synth list -- synth inspect 1
  node tools/rcon/synth-rcon.js --health

Options:
  --save <name|path>  Save to target — name under %APPDATA%/Hytale/UserData/Saves or absolute path.
                      The save's dev-server.json supplies rconHost/rconPort if no flag is given.
  --host <host>       SynthRCON host (overrides save config; default: ${DEFAULT_HOST})
  --port <port>       SynthRCON port (overrides save config; default: ${DEFAULT_PORT})
  --token <value>     SynthRCON token (or SYNTH_RCON_TOKEN env var)
  --timeout <ms>      Request timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --json              Print raw JSON responses instead of command text
  --health            Check /health instead of sending commands
  --local             Target local server (127.0.0.1); overrides HYTALE_REMOTE_ENABLED
  --remote            Target remote Mac host; overrides HYTALE_REMOTE_ENABLED
  --help              Show this help

Resolution order for host/port: CLI flag > <save>/dev-server.json > env var > default.
Environment:
  HYTALE_REMOTE_ENABLED, HYTALE_SAVE, SYNTH_RCON_HOST, SYNTH_RCON_PORT, SYNTH_RCON_TOKEN, SYNTH_RCON_TIMEOUT_MS
`);
}

function resolveSavePath(save) {
  if (!save) return null;
  if (path.isAbsolute(save) || save.includes(path.sep) || save.includes("/")) return save;
  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "Hytale", "UserData", "Saves", save);
  }
  return null;
}

function loadSaveConfig(savePath) {
  if (!savePath) return {};
  const file = path.join(savePath, "dev-server.json");
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    const out = {};
    if (typeof parsed.rconHost === "string") out.rconHost = parsed.rconHost;
    if (Number.isInteger(parsed.rconPort)) out.rconPort = parsed.rconPort;
    return out;
  } catch (err) {
    process.stderr.write(`synth-rcon: ignoring malformed ${file} (${err.message})\n`);
    return {};
  }
}

function resolveHostPort(options) {
  const saveConfig = loadSaveConfig(resolveSavePath(options.save));
  if (!options.host) {
    if (isRemoteEnabled() && process.env.SYNTH_RCON_HOST) {
      options.host = process.env.SYNTH_RCON_HOST;
    } else {
      options.host = saveConfig.rconHost || process.env.SYNTH_RCON_HOST || DEFAULT_HOST;
    }
  }
  if (!options.port) {
    options.port = saveConfig.rconPort || Number(process.env.SYNTH_RCON_PORT) || DEFAULT_PORT;
  }
}

function parseArgs(argv) {
  argv = stripRemoteFlags(argv);
  const options = {
    save: process.env.HYTALE_SAVE || null,
    host: null,
    port: null,
    token: process.env.SYNTH_RCON_TOKEN || "",
    timeoutMs: Number(process.env.SYNTH_RCON_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    commands: [],
  };

  let currentCommand = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return options;
    }

    if (arg === "--health") {
      options.health = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--save") {
      options.save = requireValue(argv, ++i, arg);
      continue;
    }

    if (arg === "--host") {
      options.host = requireValue(argv, ++i, arg);
      continue;
    }

    if (arg === "--port") {
      options.port = Number(requireValue(argv, ++i, arg));
      continue;
    }

    if (arg === "--token") {
      options.token = requireValue(argv, ++i, arg);
      continue;
    }

    if (arg === "--timeout") {
      options.timeoutMs = Number(requireValue(argv, ++i, arg));
      continue;
    }

    if (arg === "--") {
      pushCommand(options.commands, currentCommand);
      currentCommand = [];
      continue;
    }

    currentCommand.push(arg);
  }

  pushCommand(options.commands, currentCommand);
  resolveHostPort(options);
  return options;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function pushCommand(commands, parts) {
  const command = parts.join(" ").trim();
  if (command) {
    commands.push(command);
  }
}

function requestJson(options, path, method, body) {
  const payload = body ? JSON.stringify(body) : "";
  const headers = {
    Accept: "application/json",
  };

  if (payload) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(payload);
  }

  if (options.token) {
    headers["X-SynthRCON-Token"] = options.token;
  }

  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: options.host,
        port: options.port,
        path,
        method,
        headers,
        timeout: options.timeoutMs,
      },
      (response) => {
        let data = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          let parsed;
          try {
            parsed = data ? JSON.parse(data) : {};
          } catch (error) {
            reject(new Error(`Expected JSON response, got: ${data}`));
            return;
          }

          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(parsed.error || `HTTP ${response.statusCode}`));
            return;
          }

          resolve(parsed);
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("SynthRCON request timed out"));
    });
    request.on("error", reject);
    request.end(payload);
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  if (!Number.isInteger(options.port) || options.port <= 0) {
    throw new Error("SynthRCON port must be a positive integer.");
  }

  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error("SynthRCON timeout must be a positive number.");
  }

  if (options.health) {
    const response = await requestJson(options, "/health", "GET");
    console.log(JSON.stringify(response, null, 2));
    return;
  }

  if (options.commands.length === 0) {
    usage();
    throw new Error("Missing command to send.");
  }

  for (const command of options.commands) {
    const response = await requestJson(options, "/command", "POST", { command });
    if (options.json) {
      console.log(JSON.stringify(response, null, 2));
      continue;
    }

    console.log(`> ${command}`);
    const messages = Array.isArray(response.messages) ? response.messages : [];
    if (messages.length > 0) {
      console.log(messages.join("\n"));
    } else {
      console.log(JSON.stringify(response, null, 2));
    }
  }
}

main().catch((error) => {
  console.error(`synth-rcon: ${error.message}`);
  process.exitCode = 1;
});
