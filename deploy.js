#!/usr/bin/env node
"use strict";

const { runDeployCli } = require("./library/deploy-targets");

try {
  runDeployCli(process.argv.slice(2), {
    commandName: "node tools/deploy.js",
  });
} catch (err) {
  console.error(`deploy: ${err.message}`);
  process.exit(1);
}
