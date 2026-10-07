import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import process from "node:process";

const root = resolve(process.argv[2] || process.env.CEAC_SITE_DIR || "dist");
const port = Number(process.env.PORT || process.argv[3] || 4173);
const types = { ".css":"text/css; charset=utf-8", ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8", ".png":"image/png", ".svg":"image/svg+xml", ".webmanifest":"application/manifest+json", ".webp":"image/webp" };

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const requested = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  let file = join(root, requested === "/" ? "index.html" : requested);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, "index.html");
  response.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Cache-Control", file.endsWith("sw.js") || file.endsWith("index.html") ? "no-cache, no-store, must-revalidate" : "public, max-age=31536000, immutable");
  createReadStream(file).pipe(response);
}).listen(port, "0.0.0.0", () => console.log(`CEAC prebuilt frontend available on port ${port}`));
