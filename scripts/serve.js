import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".webmanifest": "application/manifest+json",
};
export function serve(port = 8766) {
  const server = http.createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      res.writeHead(400).end();
      return;
    }
    const target = path.resolve(
      root,
      "." + pathname + (pathname.endsWith("/") ? "index.html" : ""),
    );
    if (
      !target.startsWith(root + path.sep) ||
      pathname.includes("/.") ||
      pathname.includes("/node_modules/") ||
      pathname.includes("/tmp/")
    ) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(target, (err, data) => {
      if (err) {
        res.writeHead(404).end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type":
          mime[path.extname(target)] || "application/octet-stream",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(data);
    });
  });
  server.listen(port, "127.0.0.1");
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = serve(Number(process.env.PORT) || 8766);
  server.on("listening", () =>
    console.log(`Oly Tracker: http://127.0.0.1:${server.address().port}`),
  );
}
