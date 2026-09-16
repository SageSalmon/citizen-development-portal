// Local development server. Runs the SAME handler functions without the Functions host,
// on plain node:http. Node 24+ strips TypeScript types natively, so: `node server/local.ts`.
// Differences from the platform, deliberately: no Entra in front (a fake principal is
// injected from .env), no scale-to-zero, no host.json routing. Everything else is the same code.
import { createServer } from "node:http";
import { HttpRequest, InvocationContext } from "@azure/functions";
import { healthz } from "./handlers/healthz.ts";
import { me } from "./handlers/me.ts";
import { staticSite } from "./handlers/static-site.ts";
import { log } from "./log.ts";

const port = Number(process.env.PORT ?? 7071);
const fakeUser = process.env.LOCAL_USER_EMAIL
  ? Buffer.from(JSON.stringify({ auth_typ: "aad", name_typ: "preferred_username", claims: [
      { typ: "http://schemas.microsoft.com/identity/claims/objectidentifier", val: "00000000-0000-0000-0000-000000000001" },
      { typ: "preferred_username", val: process.env.LOCAL_USER_EMAIL },
      { typ: "name", val: process.env.LOCAL_USER_NAME ?? "Local Developer" },
    ] })).toString("base64")
  : null;

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  if (fakeUser && !headers.has("x-ms-client-principal")) headers.set("x-ms-client-principal", fakeUser);
  const hreq = new HttpRequest({ method: req.method ?? "GET", url: url.toString(), headers: Object.fromEntries(headers) });
  const ctx = new InvocationContext({ functionName: "local" });
  const handler = url.pathname === "/api/healthz" ? healthz : url.pathname === "/api/me" ? me : staticSite;
  const out = await handler(hreq, ctx);
  res.statusCode = out.status ?? 200;
  for (const [k, v] of Object.entries(out.headers ?? {})) res.setHeader(k, String(v));
  if (out.jsonBody !== undefined) { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(out.jsonBody)); }
  else res.end(out.body as Buffer | string | undefined);
}).listen(port, () => log("info", "local.listening", { port, fakeUser: !!fakeUser }));
