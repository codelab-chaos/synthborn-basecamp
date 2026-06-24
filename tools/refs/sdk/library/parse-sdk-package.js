"use strict";

const fs = require("node:fs");
const path = require("node:path");

const TYPE_DECL_RE = /^\s*(?:public\s+)?(?:abstract\s+|final\s+|static\s+)*(?:class|interface|enum|record|@interface)\s+(\w+)/;
const METHOD_RE = /^\s+(?:(?:public|protected|private)\s+)?(?:(?:static|final|native|synchronized|abstract|default)\s+)*[\w<>,\[\].\s$]+\s+(\w+)\s*\(/;

function splitTopLevelList(text) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "<" || ch === "(" || ch === "[") depth++;
    else if (ch === ">" || ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    else if (ch === "," && depth === 0) {
      const part = text.slice(start, i).trim();
      if (part) out.push(part);
      start = i + 1;
    }
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

function leafName(value) {
  return value.split(".").pop() || value;
}

function parseCallable(line, currentClass) {
  const signature = line.trim();
  if (!signature.endsWith(";") || !signature.includes("(")) return null;

  const open = signature.indexOf("(");
  const close = signature.lastIndexOf(")");
  if (open === -1 || close === -1 || close < open) return null;

  const before = signature.slice(0, open).trim();
  const nameToken = before.split(/\s+/).pop() || "";
  const name = leafName(nameToken);
  const kind = name === currentClass || nameToken.endsWith(`.${currentClass}`)
    ? "constructor"
    : "method";
  const parameters = splitTopLevelList(signature.slice(open + 1, close));

  return {
    kind,
    name,
    signature,
    parameters,
    parameterCount: parameters.length,
  };
}

function parseField(line) {
  const signature = line.trim();
  if (!signature.endsWith(";") || signature.includes("(")) return null;
  const withoutSemi = signature.slice(0, -1).trim();
  const parts = withoutSemi.split(/\s+/);
  const name = parts.at(-1);
  if (!name) return null;
  return { name, signature };
}

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

    const fields = [];
    const constructors = [];
    const methods = [];
    for (const line of codeLines) {
      if (TYPE_DECL_RE.test(line)) continue;
      const callable = parseCallable(line, currentClass);
      if (callable) {
        if (callable.kind === "constructor") {
          constructors.push({
            name: callable.name,
            signature: callable.signature,
            parameters: callable.parameters,
            parameterCount: callable.parameterCount,
          });
        } else {
          methods.push({
            name: callable.name,
            signature: callable.signature,
            parameters: callable.parameters,
            parameterCount: callable.parameterCount,
          });
        }
        continue;
      }
      const field = parseField(line);
      if (field) fields.push(field);
    }

    classes.push({ name: currentClass, kind, decl, fields, constructors, methods });
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
