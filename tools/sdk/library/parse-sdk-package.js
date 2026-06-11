"use strict";

const fs = require("node:fs");
const path = require("node:path");

const TYPE_DECL_RE = /^\s*(?:public\s+)?(?:abstract\s+|final\s+|static\s+)*(?:class|interface|enum|record|@interface)\s+(\w+)/;
const METHOD_RE = /^\s+(?:(?:public|protected|private)\s+)?(?:(?:static|final|native|synchronized|abstract|default)\s+)*[\w<>,\[\].\s$]+\s+(\w+)\s*\(/;

function discoverPackages(refDir) {
  const out = [];
  for (const name of fs.readdirSync(refDir).sort()) {
    if (!name.endsWith(".md")) continue;
    const file = path.join(refDir, name);
    const text = fs.readFileSync(file, "utf8");
    const headerMatch = /^# (com\.hypixel\.hytale[\w.]+)\s*$/m.exec(text);
    if (!headerMatch) continue;
    const purposeMatch = /^>\s*(.+?)\s*$/m.exec(text);
    out.push({
      pkg: headerMatch[1],
      file: name,
      purpose: purposeMatch ? purposeMatch[1] : "",
    });
  }
  return out;
}

function parsePackageMarkdown(text) {
  const headerMatch = /^# (com\.hypixel\.hytale[\w.]+)\s*$/m.exec(text);
  if (!headerMatch) return null;
  const purposeMatch = /^>\s*(.+?)\s*$/m.exec(text);

  const classes = [];
  const lines = text.split(/\r?\n/);
  let currentClass = null;
  let inCode = false;
  let codeLines = [];

  const flushClass = () => {
    if (!currentClass) return;
    const block = codeLines.join("\n");
    const declLine = codeLines.find((l) => l.trim() && !l.trim().startsWith("//"));
    const decl = declLine ? declLine.trim() : "";
    const kind = decl.includes(" interface ") ? "interface"
      : decl.includes(" enum ") ? "enum"
        : decl.includes(" record ") ? "record"
          : decl.includes(" @interface ") ? "annotation"
            : "class";

    const methods = [];
    for (const line of codeLines) {
      if (TYPE_DECL_RE.test(line)) continue;
      const m = METHOD_RE.exec(line);
      if (!m) continue;
      const name = m[1];
      if (name === currentClass) continue;
      methods.push({ name, signature: line.trim() });
    }

    classes.push({ name: currentClass, kind, decl, methods });
    currentClass = null;
    codeLines = [];
  };

  for (const raw of lines) {
    const h2 = /^## (\S+)/.exec(raw);
    if (h2) {
      flushClass();
      currentClass = h2[1];
      inCode = false;
      continue;
    }
    if (!currentClass) continue;
    if (raw === "```java") { inCode = true; continue; }
    if (raw === "```") {
      if (inCode) flushClass();
      inCode = false;
      continue;
    }
    if (inCode) codeLines.push(raw);
  }
  flushClass();

  return {
    pkg: headerMatch[1],
    purpose: purposeMatch ? purposeMatch[1] : "",
    classes,
  };
}

function parsePackageFile(filePath) {
  return parsePackageMarkdown(fs.readFileSync(filePath, "utf8"));
}

function loadReference(refDir) {
  const packages = discoverPackages(refDir);
  const byFile = new Map();
  for (const meta of packages) {
    const parsed = parsePackageFile(path.join(refDir, meta.file));
    if (parsed) byFile.set(meta.file, { ...meta, ...parsed });
  }
  return { refDir, packages, byFile };
}

module.exports = {
  discoverPackages,
  parsePackageMarkdown,
  parsePackageFile,
  loadReference,
};
