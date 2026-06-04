#!/usr/bin/env node

const net = require("node:net");

const TYPE_AUTH = 3;
const TYPE_COMMAND = 2;
const TYPE_RESPONSE = 0;

const DEFAULT_HOST = process.env.RCON_HOST || "127.0.0.1";
const DEFAULT_PORT = Number(process.env.RCON_PORT || "25575");
const DEFAULT_TIMEOUT_MS = Number(process.env.RCON_TIMEOUT_MS || "5000");

function usage() {
  console.log(`Usage:
  node tools/rcon/node-rcon.js [options] <command...>
  node tools/rcon/node-rcon.js [options] synth spawn
  node tools/rcon/node-rcon.js [options] synth list -- synth inspect 1

Options:
  --host <host>        RCON host (default: ${DEFAULT_HOST})
  --port <port>        RCON port (default: ${DEFAULT_PORT})
  --password <value>   RCON password (or RCON_PASSWORD env var; empty is allowed)
  --timeout <ms>       Socket timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --help              Show this help

Environment:
  RCON_HOST, RCON_PORT, RCON_PASSWORD, RCON_TIMEOUT_MS
`);
}

function parseArgs(argv) {
  const options = {
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
    password: process.env.RCON_PASSWORD || "",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    commands: [],
  };

  let currentCommand = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return options;
    }

    if (arg === "--host") {
      options.host = requireValue(argv, ++i, arg);
      continue;
    }

    if (arg === "--port") {
      options.port = Number(requireValue(argv, ++i, arg));
      continue;
    }

    if (arg === "--password") {
      options.password = requireValue(argv, ++i, arg);
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

function encodePacket(id, type, body) {
  const bodyBuffer = Buffer.from(body, "utf8");
  const packet = Buffer.alloc(4 + 4 + 4 + bodyBuffer.length + 2);
  packet.writeInt32LE(packet.length - 4, 0);
  packet.writeInt32LE(id, 4);
  packet.writeInt32LE(type, 8);
  bodyBuffer.copy(packet, 12);
  packet.writeInt16LE(0, packet.length - 2);
  return packet;
}

function decodePackets(buffer) {
  const packets = [];
  let offset = 0;

  while (buffer.length - offset >= 4) {
    const length = buffer.readInt32LE(offset);
    const packetEnd = offset + 4 + length;
    if (buffer.length < packetEnd) {
      break;
    }

    packets.push({
      id: buffer.readInt32LE(offset + 4),
      type: buffer.readInt32LE(offset + 8),
      body: buffer.subarray(offset + 12, packetEnd - 2).toString("utf8"),
    });
    offset = packetEnd;
  }

  return {
    packets,
    remainder: buffer.subarray(offset),
  };
}

class RconClient {
  constructor({ host, port, password, timeoutMs }) {
    this.host = host;
    this.port = port;
    this.password = password;
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = Buffer.alloc(0);
    this.socket = new net.Socket();
  }

  connect() {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.socket.off("connect", onConnect);
        this.socket.off("error", onError);
      };
      const onConnect = () => {
        cleanup();
        this.socket.setTimeout(this.timeoutMs);
        this.socket.on("data", (chunk) => this.handleData(chunk));
        this.socket.on("timeout", () => this.failAll(new Error("RCON socket timed out")));
        this.socket.on("error", (error) => this.failAll(error));
        this.socket.on("close", () => this.failAll(new Error("RCON socket closed")));
        resolve();
      };
      const onError = (error) => {
        cleanup();
        reject(error);
      };

      this.socket.once("connect", onConnect);
      this.socket.once("error", onError);
      this.socket.connect(this.port, this.host);
    });
  }

  async authenticate() {
    const response = await this.sendPacket(TYPE_AUTH, this.password);
    if (response.id === -1) {
      throw new Error("RCON authentication failed");
    }
  }

  async command(command) {
    const response = await this.sendPacket(TYPE_COMMAND, command);
    return response.body;
  }

  sendPacket(type, body) {
    const id = this.nextId;
    this.nextId += 1;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.write(encodePacket(id, type, body));
    });
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const decoded = decodePackets(this.buffer);
    this.buffer = decoded.remainder;

    for (const packet of decoded.packets) {
      if (packet.id === -1) {
        this.failAll(new Error("RCON authentication failed"));
        continue;
      }

      const pending = this.pending.get(packet.id);
      if (!pending) {
        continue;
      }
      this.pending.delete(packet.id);
      pending.resolve(packet);
    }
  }

  failAll(error) {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }

  close() {
    if (!this.socket.destroyed) {
      this.socket.destroy();
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  if (!Number.isInteger(options.port) || options.port <= 0) {
    throw new Error("RCON port must be a positive integer.");
  }

  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error("RCON timeout must be a positive number.");
  }

  if (options.commands.length === 0) {
    usage();
    throw new Error("Missing command to send.");
  }

  const client = new RconClient(options);
  try {
    await client.connect();
    await client.authenticate();

    for (const command of options.commands) {
      console.log(`> ${command}`);
      const response = await client.command(command);
      if (response.trim()) {
        console.log(response.trimEnd());
      }
    }
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(`rcon: ${error.message}`);
  process.exitCode = 1;
});
