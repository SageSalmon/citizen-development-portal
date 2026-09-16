import type { Context } from "@netlify/functions";
import { log } from "./log.mts";

export type Principal = { id: string; email: string; roles: string[] };

/**
 * Verify the caller's Netlify Identity bearer token by asking the site's own Identity
 * service for the user. This is the server-side check; the edge Role= redirects in
 * netlify.toml are the first line, this is the second.
 */
export async function requireUser(req: Request, context: Context): Promise<Principal | Response> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return json({ error: "missing bearer token" }, 401);

  const base = context.site?.url ?? new URL(req.url).origin;
  const res = await fetch(`${base}/.netlify/identity/user`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return json({ error: "invalid token" }, 401);

  const u = (await res.json()) as { id: string; email: string; app_metadata?: { roles?: string[] } };
  const principal: Principal = { id: u.id, email: u.email, roles: u.app_metadata?.roles ?? [] };

  // Contract rule 8 analogue. Functions are stateless, so this is per request, not per
  // session. Note that difference in findings.md.
  log("info", "user.signin", { oid: principal.id, upn: principal.email, path: new URL(req.url).pathname });
  return principal;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
