#!/usr/bin/env node
"use strict";

/*
 * List top-level classes in the Hytale Server jar for quick SDK discovery.
 *
 * Usage:
 *   node tools/refs/sdk/list-hytale-server-api.js
 *   node tools/refs/sdk/list-hytale-server-api.js --package com/hypixel/hytale/server/npc
 *   node tools/refs/sdk/list-hytale-server-api.js --first 100
 *   node tools/refs/sdk/list-hytale-server-api.js --jar /path/to/Server.jar
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function parseArgs(argv) {
  const opts = {
    package: "com/hypixel/hytale/server",
    first: 400,
    jar: process.env.HYTALE_SERVER_JAR || null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (!value) throw new Error(`${arg} requires a value`);
      return value;
    };
    if (arg === "--package" || arg === "--pkg" || arg === "-p") opts.package = next();
    else if (arg === "--first" || arg === "--limit" || arg === "-n") opts.first = Number(next());
    else if (arg === "--jar") opts.jar = path.resolve(next());
    else if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(opts.first) || opts.first < 1) {
    throw new Error("--first must be a positive integer");
  }
  opts.package = opts.package.replace(/\./g, "/").replace(/^\/+|\/+$/g, "");
  return opts;
}

function usage() {
  console.log(`Usage:
  node tools/refs/sdk/list-hytale-server-api.js [--package <pkg>] [--first <n>] [--jar <path>]

Options:
  --package, -p   Package prefix as slash or dot notation (default: com/hypixel/hytale/server)
  --first, -n     Maximum classes to print (default: 400)
  --jar           Explicit Hytale Server jar path

Environment:
  HYTALE_SERVER_JAR can provide the jar path.
`);
}

function findServerJar() {
  const root = path.join(os.homedir(), ".gradle", "caches", "modules-2", "files-2.1", "com.hypixel.hytale", "Server");
  if (!fs.existsSync(root)) return null;

  const jars = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".jar")) {
        jars.push({ file: full, mtimeMs: fs.statSync(full).mtimeMs });
      }
    }
  }
  walk(root);

  jars.sort((a, b) => b.mtimeMs - a.mtimeMs || a.file.localeCompare(b.file));
  return jars[0]?.file || null;
}

function listJar(jarPath) {
  return execFileSync("jar", ["tf", jarPath], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }).split(/\r?\n/);
}

function main() {
  const opts = parseArgs(process.argv);
  const jar = opts.jar || findServerJar();
  if (!jar) {
    throw new Error("Could not find com.hypixel.hytale:Server jar in Gradle cache. Run ./gradlew compileJava in a mod repo first, or pass --jar.");
  }
  if (!fs.existsSync(jar)) throw new Error(`Jar not found: ${jar}`);

  const classes = listJar(jar)
    .filter((name) => name.startsWith(opts.package) && name.endsWith(".class") && !name.includes("$"))
    .map((name) => name.replace(/\//g, ".").replace(/\.class$/, ""))
    .sort()
    .slice(0, opts.first);

  console.log(`JAR: ${jar}`);
  console.log(`PACKAGE: ${opts.package}`);
  console.log("");
  for (const className of classes) console.log(className);
}

main();
