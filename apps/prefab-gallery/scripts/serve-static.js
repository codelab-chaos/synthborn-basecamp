#!/usr/bin/env node

const fs = require("fs");
const http = require("http");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const port = Number(process.argv[3] || 8877);
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

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, `http://${host}`).pathname);
  const target = path.resolve(root, urlPath === "/" ? "index.html" : `.${urlPath}`);
  if (!target.startsWith(root)) {
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
    res.writeHead(200, { "Content-Type": types[path.extname(target).toLowerCase()] || "application/octet-stream" });
    res.end(bytes);
  });
}).listen(port, host, () => {
  console.log(`prefab gallery http://${host}:${port}/`);
});
