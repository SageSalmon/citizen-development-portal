import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serveStatic } from "../static.ts";

// dist/server/handlers/ -> dist/web  (compiled)   |   server/handlers/ -> dist/web  (local, via tsx-less node)
const here = dirname(fileURLToPath(import.meta.url));
const webRoot = here.includes(`${"dist"}/server`) ? join(here, "..", "..", "web") : join(here, "..", "..", "dist", "web");

export async function staticSite(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  return serveStatic(webRoot, new URL(req.url).pathname);
}
