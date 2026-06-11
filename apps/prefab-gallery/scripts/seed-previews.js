#!/usr/bin/env node
/*
 * Bakes category-sharded preview atlases for every prefab in the gallery.
 *
 * Usage: node scripts/seed-previews.js [--port 8879] [--size 256] [--quality 0.6] [--limit N]
 */

const fs = require("fs");
const http = require("http");
const path = require("path");

const galleryRoot = path.resolve(__dirname, "..");
const previewsRoot = path.join(galleryRoot, "previews");
const atlasRoot = path.join(previewsRoot, "atlas");
const manifestPath = path.join(galleryRoot, "manifest.json");
const host = "127.0.0.1";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".css": "text/css; charset=utf-8",
  ".vox": "application/octet-stream",
  ".pxv3": "application/octet-stream",
};

function parseArgs(argv) {
  const args = { port: 8879, size: 256, quality: 0.6, limit: 0 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => argv[++i];
    if (arg === "--port") args.port = Number(value());
    else if (arg === "--size") args.size = Number(value());
    else if (arg === "--quality") args.quality = Number(value());
    else if (arg === "--limit") args.limit = Number(value());
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function listExistingAtlases() {
  const out = [];
  const walk = (dir, prefix) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, `${prefix}${entry.name}/`);
      else if (entry.name.toLowerCase().endsWith(".webp")) {
        out.push(`previews/${prefix}${entry.name}`);
      }
    }
  };
  walk(atlasRoot, "atlas/");
  return out;
}

function handleSeedSave(req, res, url) {
  const relPath = url.searchParams.get("path") || "";
  const target = path.resolve(galleryRoot, relPath);
  if (!relPath.startsWith("previews/") || !target.startsWith(previewsRoot)) {
    res.writeHead(400);
    res.end("Invalid path");
    return;
  }

  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, Buffer.concat(chunks));
      res.writeHead(200);
      res.end("ok");
    } catch (err) {
      res.writeHead(500);
      res.end(err.message);
    }
  });
}

function handlePatchManifest(req, res) {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const patches = Array.isArray(body.patches) ? body.patches : [];
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      for (const patch of patches) {
        if (!Number.isInteger(patch.index) || patch.index < 0 || patch.index >= manifest.entries.length) {
          continue;
        }
        manifest.entries[patch.index].preview = patch.preview;
      }
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`, "utf8");
      res.writeHead(200);
      res.end("ok");
    } catch (err) {
      res.writeHead(500);
      res.end(err.message);
    }
  });
}

function handleStatic(res, urlPath) {
  const target = path.resolve(galleryRoot, urlPath === "/" ? "index.html" : `.${urlPath}`);
  if (!target.startsWith(galleryRoot)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(target, (err, bytes) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(target).toLowerCase()] || "application/octet-stream",
    });
    res.end(bytes);
  });
}

function startServer(port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${host}`);
      const urlPath = decodeURIComponent(url.pathname);

      if (urlPath === "/__seed/existing") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(listExistingAtlases()));
        return;
      }
      if (urlPath === "/__seed/save" && req.method === "PUT") {
        handleSeedSave(req, res, url);
        return;
      }
      if (urlPath === "/__seed/patch-manifest" && req.method === "POST") {
        handlePatchManifest(req, res);
        return;
      }
      handleStatic(res, urlPath);
    });
    server.listen(port, host, () => resolve(server));
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(path.join(galleryRoot, "index.html"))) {
    throw new Error(`No built gallery at ${galleryRoot} — run npm run build-web first`);
  }
  if (!fs.existsSync(manifestPath)) {
    throw new Error("No manifest.json — run npm run build-source first");
  }
  fs.mkdirSync(atlasRoot, { recursive: true });

  const puppeteer = require("puppeteer");
  const server = await startServer(args.port);
  console.log(`[seed] server http://${host}:${args.port}/ -> ${atlasRoot}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--hide-scrollbars"],
  });

  let exitCode = 0;
  try {
    const page = await browser.newPage();
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.startsWith("[seed]")) console.log(text);
    });
    page.on("pageerror", (err) => console.error(`[seed] page error: ${err.message}`));

    const params = new URLSearchParams({
      seed: "1",
      size: String(args.size),
      quality: String(args.quality),
    });
    if (args.limit > 0) params.set("limit", String(args.limit));

    await page.goto(`http://${host}:${args.port}/?${params}`, { waitUntil: "domcontentloaded" });

    const deadline = Date.now() + 90 * 60 * 1000;
    let title = "";
    while (Date.now() < deadline) {
      title = await page.title();
      if (title === "SEED_COMPLETE" || title === "SEED_FAILED") break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (title !== "SEED_COMPLETE") exitCode = 1;
    if (title !== "SEED_COMPLETE" && title !== "SEED_FAILED") {
      console.error("[seed] timed out waiting for completion");
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`[seed] ${listExistingAtlases().length} atlas page(s) on disk`);
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(`[error] ${err.message}`);
  process.exit(1);
});
