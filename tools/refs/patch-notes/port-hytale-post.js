#!/usr/bin/env node
"use strict";

/*
 * port-hytale-post.js — port an official hytale.com news post (patch notes,
 * hotfix roundups) to a committed markdown doc under docs/patch-notes/.
 *
 * Fetches the article, isolates the post body, converts it with pandoc, then
 * normalizes the markdown the same way the Update 5 port was normalized:
 * embedded videos become a placeholder note, emote images are dropped, and a
 * source/author/published/capture header is prepended.
 *
 * Usage:
 *   node tools/refs/patch-notes/port-hytale-post.js <url> [--out FILE] [--html FILE]
 *
 * Options:
 *   --out FILE    Output markdown path (default docs/patch-notes/hytale-<slug>.md)
 *   --html FILE   Use a saved HTML capture instead of fetching the URL
 *   --stdout      Print the markdown instead of writing a file
 *
 * Requires `pandoc` on PATH. Node built-ins only otherwise.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { BASECAMP_ROOT } = require("../../lib/workspace");

const OUT_ROOT = path.join(BASECAMP_ROOT, "docs", "patch-notes");
const VIDEO_SENTINEL = "BASECAMP-VIDEO-OMITTED";
const VIDEO_NOTE = "*[Embedded video omitted. See source article.]*";

function parseArgs(argv) {
  const args = { url: null, out: null, html: null, stdout: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (!next) throw new Error(`${arg} requires a value`);
      return next;
    };
    if (arg === "--out") args.out = value();
    else if (arg === "--html") args.html = value();
    else if (arg === "--stdout") args.stdout = true;
    else if (arg === "-h" || arg === "--help") args.help = true;
    else if (arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
    else if (!args.url) args.url = arg;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node tools/refs/patch-notes/port-hytale-post.js <url> [--out FILE] [--html FILE] [--stdout]

Examples:
  node tools/refs/patch-notes/port-hytale-post.js https://hytale.com/news/2026/8/update-6-patch-notes
  node tools/refs/patch-notes/port-hytale-post.js https://hytale.com/news/2026/8/hotfixes-update-6
`);
}

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 synthborn-basecamp" } });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
  return res.text();
}

/** Return [start, end) offsets of the element whose opening tag begins at `open`. */
function elementBounds(html, open) {
  const tag = (html.slice(open).match(/^<([a-z0-9]+)/i) || [])[1];
  if (!tag) throw new Error("elementBounds: not at an opening tag");
  const re = new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi");
  re.lastIndex = open;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].startsWith("</")) {
      depth--;
      if (depth === 0) return [open, m.index + m[0].length];
    } else if (!m[0].endsWith("/>")) {
      depth++;
    }
  }
  throw new Error(`elementBounds: unclosed <${tag}>`);
}

function extractByClass(html, className) {
  const marker = html.indexOf(`class="${className}`);
  if (marker < 0) return null;
  const open = html.lastIndexOf("<", marker);
  const [start, end] = elementBounds(html, open);
  return html.slice(start, end);
}

function replaceElements(html, className, replacement) {
  let out = html;
  for (;;) {
    const marker = out.indexOf(`class="${className}`);
    if (marker < 0) return out;
    const open = out.lastIndexOf("<", marker);
    const [start, end] = elementBounds(out, open);
    out = out.slice(0, start) + replacement + out.slice(end);
  }
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

function extractMeta(html, url) {
  const heading = extractByClass(html, "post-heading") || "";
  const title = decodeEntities(heading.replace(/<[^>]+>/g, "").trim());
  const published = (html.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,\s+\d{4}/) || [])[0] || "";
  const author = (html.match(/post-author[^>]*>\s*(?:<[^>]+>\s*)*([^<]+)/) || [])[1] || "Hytale Team";
  return { title, published, author: author.trim(), url };
}

function cleanHtml(body) {
  let html = replaceElements(body, "video-container", `<p>${VIDEO_SENTINEL}</p>`);
  html = html.replace(/<img\b[^>]*class="emote[^"]*"[^>]*>/g, "");
  html = html.replace(/<span\b[^>]*>/g, "").replace(/<\/span>/g, "");
  html = html.replace(/<a\b([^>]*)>/g, (m, attrs) => {
    const href = (attrs.match(/href="([^"]*)"/) || [])[1];
    return href ? `<a href="${href}">` : "<a>";
  });
  return html;
}

function pandoc(html) {
  try {
    return execFileSync("pandoc", ["-f", "html", "-t", "gfm", "--wrap=none"], {
      input: html,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    if (err.code === "ENOENT") throw new Error("pandoc is required on PATH to port hytale.com posts");
    throw err;
  }
}

function cleanMarkdown(md) {
  return md
    .split(/\r?\n/)
    .filter((line) => !/^\s*<\/?div\b[^>]*>\s*$/.test(line))
    .map((line) => (line.trim() === VIDEO_SENTINEL ? VIDEO_NOTE : line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}

function slugFromUrl(url) {
  const last = new URL(url).pathname.split("/").filter(Boolean).pop() || "post";
  return last.startsWith("hytale-") ? last : `hytale-${last}`;
}

function header(meta) {
  const captured = new Date().toUTCString();
  return [
    `# ${meta.title.toUpperCase()}`,
    "",
    `**Source:** <${meta.url}>  `,
    `**Author:** ${meta.author}  `,
    `**Published:** ${meta.published || "unknown"}  `,
    `**Local capture:** ${captured}  `,
    "**Ported from:** hytale.com article HTML via `tools/refs/patch-notes/port-hytale-post.js`",
    "",
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.url) return usage();

  const html = args.html ? fs.readFileSync(args.html, "utf8") : await fetchHtml(args.url);
  const body = extractByClass(html, "post-body");
  if (!body) throw new Error("Could not find the post body (class=\"post-body\") in the page");

  const meta = extractMeta(html, args.url);
  const markdown = header(meta) + "\n" + cleanMarkdown(pandoc(cleanHtml(body)));

  if (args.stdout) {
    process.stdout.write(markdown);
    return;
  }
  const out = path.resolve(args.out || path.join(OUT_ROOT, `${slugFromUrl(args.url)}.md`));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, markdown);
  console.log(`Wrote ${path.relative(BASECAMP_ROOT, out)} (${markdown.split("\n").length} lines, "${meta.title}", ${meta.published || "date unknown"})`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`port-hytale-post: ${err.message}`);
    process.exitCode = 1;
  });
}

module.exports = { cleanHtml, cleanMarkdown, extractByClass, extractMeta, slugFromUrl };
