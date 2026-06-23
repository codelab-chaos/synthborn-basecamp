#!/usr/bin/env node
/*
 * Basecamp health check for reference tooling and docs.
 *
 * This is intentionally read-only: it validates existing generated data and
 * runs query smoke tests, but it does not regenerate refs or sync app data.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const TOOLS_ROOT = __dirname;
const REPO_ROOT = path.resolve(TOOLS_ROOT, "..");

const SKIP_DIRS = new Set([
  ".git",
  "_Assets",
  "_mod-example-sourcecode",
  "dist",
  "node_modules",
]);

const SKIP_PREFIXES = [
  "docs/external/",
  "apps/prefab-gallery/assets/",
  "apps/recipe-kiosk/assets/",
];

const TEXT_EXTENSIONS = new Set([
  ".css",
  ".cjs",
  ".gitignore",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const SIBLING_READMES = [
  "../synthborn-kyn/README.md",
  "../synthborn-overseer/README.md",
  "../synthborn-terrascape/README.md",
  "../synthborn-rcon/README.md",
].map((entry) => path.resolve(REPO_ROOT, entry));

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function relative(filePath) {
  return toPosix(path.relative(REPO_ROOT, filePath));
}

function shouldSkipPath(filePath) {
  const rel = relative(filePath);
  if (!rel || rel.startsWith("..")) return false;
  if (SKIP_PREFIXES.some((prefix) => rel.startsWith(prefix))) return true;
  return rel.split("/").some((part) => SKIP_DIRS.has(part));
}

function walkFiles(root, predicate, out = []) {
  if (!fs.existsSync(root) || shouldSkipPath(root)) return out;
  const stat = fs.statSync(root);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(root)) {
      walkFiles(path.join(root, entry), predicate, out);
    }
    return out;
  }
  if (stat.isFile() && predicate(root)) out.push(root);
  return out;
}

function step(name, fn) {
  try {
    const detail = fn();
    console.log(`PASS ${name}${detail ? ` (${detail})` : ""}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(err.message);
    process.exitCode = 1;
  }
}

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
    throw new Error(`${label} failed\n${output}`);
  }
}

function checkJavaScriptSyntax() {
  const files = walkFiles(TOOLS_ROOT, (file) => path.extname(file) === ".js");
  const failures = [];

  for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", file], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.status !== 0) {
      failures.push(`${relative(file)}\n${result.stderr.trim() || result.stdout.trim()}`);
    }
  }

  if (failures.length) throw new Error(failures.join("\n\n"));
  return `${files.length} files`;
}

function checkJsonParse() {
  const roots = [
    path.join(REPO_ROOT, "tools"),
    path.join(REPO_ROOT, "docs", "refs"),
    path.join(REPO_ROOT, "apps"),
  ];
  const files = roots.flatMap((root) => walkFiles(root, (file) => path.extname(file) === ".json"));
  const failures = [];

  for (const file of files) {
    try {
      JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (err) {
      failures.push(`${relative(file)}: ${err.message}`);
    }
  }

  if (failures.length) throw new Error(failures.join("\n"));
  return `${files.length} files`;
}

function isTextFile(file) {
  const base = path.basename(file);
  if (base === ".gitignore") return true;
  return TEXT_EXTENSIONS.has(path.extname(file));
}

function checkStalePaths() {
  const files = walkFiles(REPO_ROOT, (file) => isTextFile(file))
    .concat(SIBLING_READMES.filter((file) => fs.existsSync(file)))
    .filter((file) => path.resolve(file) !== path.resolve(__filename));

  const stalePatterns = [
    ["legacy tools/reference path", /tools[\\/]reference/g],
    ["legacy node reference runner", /\bnode\s+reference[\\/]/g],
    ["legacy docs/sdk-reference path", /docs[\\/]sdk-reference\b/g],
    ["legacy docs/recipes path", /docs[\\/]recipes(?:[\\/]|\.|\b)/g],
    ["legacy docs/labels path", /docs[\\/]labels(?:[\\/]|\.|\b)/g],
    ["legacy docs/prefabs path", /docs[\\/]prefabs(?:[\\/]|\.|\b)/g],
    ["legacy assets toc doc", /docs[\\/]hytale-assets-toc\.md\b/g],
    ["legacy hytale prefabs doc", /docs[\\/]hytale-prefabs(?:-index)?(?:\.md|\.json)?\b/g],
  ];
  const failures = [];

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const [label, pattern] of stalePatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const line = text.slice(0, match.index).split(/\r?\n/).length;
        failures.push(`${relative(file)}:${line}: ${label}: ${match[0]}`);
      }
    }
  }

  if (failures.length) throw new Error(failures.join("\n"));
  return `${files.length} files`;
}

function markdownFiles() {
  const files = [
    path.join(REPO_ROOT, "README.md"),
    path.join(REPO_ROOT, "tools", "README.md"),
    ...walkFiles(path.join(REPO_ROOT, "docs"), (file) => path.extname(file) === ".md"),
    ...walkFiles(path.join(REPO_ROOT, "apps"), (file) => path.extname(file) === ".md"),
    ...SIBLING_READMES.filter((file) => fs.existsSync(file)),
  ];
  return Array.from(new Set(files.map((file) => path.resolve(file))));
}

function markdownLinks(text) {
  const links = [];
  const inline = /!?\[[^\]\n]*\]\(([^)\n]+)\)/g;
  const reference = /^\s*\[[^\]\n]+\]:\s*(\S+)/gm;

  for (const pattern of [inline, reference]) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let href = match[1].trim();
      if (href.startsWith("<") && href.endsWith(">")) href = href.slice(1, -1);
      href = href.split(/\s+["'][^"']*["']\s*$/)[0];
      links.push({ href, index: match.index });
    }
  }

  return links;
}

function isExternalLink(href) {
  return (
    href.startsWith("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(href) ||
    href.startsWith("//")
  );
}

function localPathForLink(fromFile, href) {
  const withoutFragment = href.split("#")[0].split("?")[0];
  if (!withoutFragment) return null;
  try {
    return path.resolve(path.dirname(fromFile), decodeURIComponent(withoutFragment));
  } catch {
    return path.resolve(path.dirname(fromFile), withoutFragment);
  }
}

function linkExists(targetPath) {
  if (fs.existsSync(targetPath)) return true;
  if (fs.existsSync(`${targetPath}.md`)) return true;
  if (fs.existsSync(path.join(targetPath, "README.md"))) return true;
  return false;
}

function checkMarkdownLinks() {
  const files = markdownFiles();
  const failures = [];

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const { href, index } of markdownLinks(text)) {
      if (isExternalLink(href)) continue;
      const target = localPathForLink(file, href);
      if (!target) continue;
      if (!linkExists(target)) {
        const line = text.slice(0, index).split(/\r?\n/).length;
        failures.push(`${relative(file)}:${line}: broken link ${href}`);
      }
    }
  }

  if (failures.length) throw new Error(failures.join("\n"));
  return `${files.length} files`;
}

function smokeTests() {
  const tests = [
    ["labels lookup", process.execPath, ["tools/refs/labels/lookup.js", "id", "Ingredient_Fibre"]],
    ["recipe query", process.execPath, ["tools/refs/recipes/gamedata.js", "bench", "Campfire"]],
    ["sdk search", process.execPath, ["tools/refs/sdk/sdk-search.js", "--method", "placeBlock", "--limit", "1"]],
  ];

  for (const [label, command, args] of tests) {
    run(command, args, label);
  }

  return `${tests.length} commands`;
}

step("javascript syntax", checkJavaScriptSyntax);
step("json parse", checkJsonParse);
step("stale path scan", checkStalePaths);
step("markdown links", checkMarkdownLinks);
step("reference smoke tests", smokeTests);

if (!process.exitCode) {
  console.log("Basecamp verify passed.");
}
