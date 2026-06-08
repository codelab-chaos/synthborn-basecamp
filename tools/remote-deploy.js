#!/usr/bin/env node
"use strict";

const { runDeployCli } = require("./library/deploy-targets");

try {
  runDeployCli(process.argv.slice(2), {
    commandName: "node tools/remote-deploy.js",
    forceRemote: true,
  });
} catch (err) {
  console.error(`remote-deploy: ${err.message}`);
  process.exit(1);
}
