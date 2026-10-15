"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const diffTool = path.resolve(__dirname, "../diff-sdk-reference.js");

const pkgMd = (classes) => `# com.hypixel.hytale.fixture\n\n> test\n\n${classes}`;
const cls = (name, decl, methods) =>
  `## ${name}\n\n\`\`\`java\n${decl} {\n${methods.map((m) => `  ${m}`).join("\n")}\n}\n\`\`\`\n\n`;

function runDiff(baselineMd, currentMd) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-diff-"));
  try {
    const base = path.join(root, "base");
    const cur = path.join(root, "cur");
    fs.mkdirSync(base);
    fs.mkdirSync(cur);
    fs.writeFileSync(path.join(base, "com.hypixel.hytale.fixture.md"), baselineMd);
    fs.writeFileSync(path.join(cur, "com.hypixel.hytale.fixture.md"), currentMd);
    return execFileSync(process.execPath, [diffTool, "--out", cur, "--against", base], { encoding: "utf8" });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("methods hoisted into a new superclass are reported as moved, not removed", () => {
  const baseline = pkgMd(cls("Store", "public class com.hypixel.hytale.fixture.Store", [
    "public int load(long);",
    "public int own();",
  ]));
  const current = pkgMd(
    cls("Grid", "public class com.hypixel.hytale.fixture.Grid", ["public int load(long);"])
      + cls("Store", "public class com.hypixel.hytale.fixture.Store extends com.hypixel.hytale.fixture.Grid", ["public int own();"]),
  );
  const out = runDiff(baseline, current);
  assert.match(out, /1 member\(s\) moved to or from a superclass/);
  assert.doesNotMatch(out, /^ {4}- public int load/m);
});

test("methods that are really gone are still reported as removed", () => {
  const baseline = pkgMd(cls("Store", "public class com.hypixel.hytale.fixture.Store", ["public int gone();"]));
  const current = pkgMd(cls("Store", "public class com.hypixel.hytale.fixture.Store", ["public int other();"]));
  const out = runDiff(baseline, current);
  assert.match(out, /^ {4}- public int gone\(\);/m);
  assert.match(out, /^ {4}\+ public int other\(\);/m);
});
