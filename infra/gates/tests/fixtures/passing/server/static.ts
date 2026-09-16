import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import type { HttpResponseInit } from "@azure/functions";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".map": "application/json", ".txt": "text/plain; charset=utf-8",
};

/** Serves the built web/ from dist/web with an SPA fallback. Never leaves that directory. */
export async function serveStatic(webRoot: string, urlPath: string): Promise<HttpResponseInit> {
  const root = resolve(webRoot);
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  let file = resolve(join(root, clean));
  if (!file.startsWith(root)) return { status: 404 };
  try {
    const s = await stat(file);
    if (s.isDirectory()) file = join(file, "index.html");
  } catch {
    file = join(root, "index.html"); // SPA fallback
  }
  try {
    const body = await readFile(file);
    const type = TYPES[extname(file)] ?? "application/octet-stream";
    const cache = /\/assets\//.test(file) ? "public, max-age=31536000, immutable" : "no-cache";
    return { status: 200, body, headers: { "content-type": type, "cache-control": cache } };
  } catch {
    return { status: 404, body: "not found" };
  }
}
