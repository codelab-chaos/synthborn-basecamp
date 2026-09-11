"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const extractor = path.resolve(__dirname, "../extract-sdk-reference.js");

test("incremental extraction matches a clean build and preserves unchanged Markdown", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-incremental-"));
  try {
    const src = path.join(root, "src");
    const bin = path.join(root, "bin");
    const out = path.join(root, "out");
    const jar = path.join(root, "Server-1.0.jar");
    fs.mkdirSync(src); fs.mkdirSync(bin);
    const source = (name, body, pkg = "fixture") => fs.writeFileSync(path.join(src, name + ".java"), `package com.hypixel.hytale.${pkg}; ${body}`);
    const build = () => {
      fs.rmSync(bin, { recursive: true }); fs.mkdirSync(bin);
      execFileSync("javac", ["-d", bin, ...fs.readdirSync(src).map(f => path.join(src, f))]);
      execFileSync("jar", ["cf", jar, "-C", bin, "."]);
    };
    const run = (...args) => execFileSync(process.execPath, [extractor, "--full", "--jar", jar, "--out", out, ...args], { encoding: "utf8" });
    source("A", "public class A { public int value() { return 1; } }");
    source("Hidden", "class Hidden { public void invisible() {} }");
    source("Gone", "public class Gone {}", "removed");
    build();
    const cold = JSON.parse(run("--json"));
    assert.equal(cold.inspect, 3);
    assert.equal(fs.existsSync(out), false, "preflight must not create output");
    run();
    const file = path.join(out, "com.hypixel.hytale.fixture.md");
    const oldMd = fs.readFileSync(file, "utf8");
    const oldTime = fs.statSync(file).mtimeMs;
    assert.equal(JSON.parse(run("--json")).inspect, 0);
    run();
    assert.equal(fs.statSync(file).mtimeMs, oldTime);
    source("A", "public class A { public int value() { return 2; } }");
    build();
    assert.deepEqual(JSON.parse(run("--json")).changed, ["com.hypixel.hytale.fixture.A"]);
    run();
    assert.equal(fs.readFileSync(file, "utf8"), oldMd);
    assert.equal(fs.statSync(file).mtimeMs, oldTime, "body-only edit must not rewrite signatures");
    source("A", "public class A { public long value() { return 2; } public void added() {} }");
    source("Hidden", "public class Hidden { public void visible() {} }");
    fs.unlinkSync(path.join(src, "Gone.java"));
    source("New", "public class New {}", "added");
    build();
    const plan = JSON.parse(run("--json"));
    assert.equal(plan.added.length, 1); assert.equal(plan.removed.length, 1);
    run();
    assert.equal(fs.existsSync(path.join(out, "com.hypixel.hytale.removed.md")), false);
    assert.match(fs.readFileSync(file, "utf8"), /public long value/);
    assert.match(fs.readFileSync(file, "utf8"), /## Hidden/);
    const fresh = path.join(root, "fresh");
    execFileSync(process.execPath, [extractor, "--full", "--jar", jar, "--out", fresh]);
    for (const file of fs.readdirSync(out).filter(f => f.endsWith(".md"))) {
      assert.equal(fs.readFileSync(path.join(out, file), "utf8"), fs.readFileSync(path.join(fresh, file), "utf8"));
    }
    const before = fs.readFileSync(path.join(out, ".sdk-source.json"), "utf8");
    fs.unlinkSync(file);
    run();
    assert.match(fs.readFileSync(file, "utf8"), /public long value/);
    fs.writeFileSync(path.join(bin, "com/hypixel/hytale/fixture/A.class"), "not a class");
    execFileSync("jar", ["cf", jar, "-C", bin, "."]);
    assert.throws(() => run(), /Command failed/);
    assert.equal(fs.readFileSync(path.join(out, ".sdk-source.json"), "utf8"), before,
      "failed extraction must not advance the success stamp");
    fs.writeFileSync(path.join(out, ".sdk-cache.json"), "broken");
    assert.equal(JSON.parse(run("--json")).inspect, 3, "corrupt cache requires a cold run");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
