import { test } from "node:test";
import assert from "node:assert/strict";
import { HttpRequest, InvocationContext } from "@azure/functions";
import { healthz } from "../server/handlers/healthz.ts";
import { me } from "../server/handlers/me.ts";
import { resetSeen } from "../server/signin-log.ts";

const ctx = () => new InvocationContext({ functionName: "test" });
const principal = (claims: Record<string, string>) => Buffer.from(JSON.stringify({
  auth_typ: "aad", name_typ: "preferred_username",
  claims: Object.entries(claims).map(([typ, val]) => ({ typ, val })),
})).toString("base64");

test("GET /api/healthz returns the contract shape", async () => {
  const res = await healthz(new HttpRequest({ method: "GET", url: "http://x/api/healthz" }), ctx());
  assert.equal(res.status, 200);
  const b = res.jsonBody as Record<string, unknown>;
  assert.equal(b.status, "ok");
  assert.equal(typeof b.commit, "string");
  assert.equal(typeof b.startedAt, "string");
  assert.equal(typeof b.upstreams, "object");
});

test("GET /api/me without identity headers is 401", async () => {
  const res = await me(new HttpRequest({ method: "GET", url: "http://x/api/me" }), ctx());
  assert.equal(res.status, 401);
});

test("GET /api/me reads the platform principal and logs one user.signin per user", async () => {
  resetSeen();
  const lines: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => { lines.push(String(s)); return true; };
  try {
    const headers = { "x-ms-client-principal": principal({
      "http://schemas.microsoft.com/identity/claims/objectidentifier": "oid-1", preferred_username: "a@example.org", name: "A Person" }) };
    const r1 = await me(new HttpRequest({ method: "GET", url: "http://x/api/me", headers }), ctx());
    const r2 = await me(new HttpRequest({ method: "GET", url: "http://x/api/me", headers }), ctx());
    assert.deepEqual(r1.jsonBody, { oid: "oid-1", upn: "a@example.org", name: "A Person" });
    assert.equal(r2.status, 200);
  } finally { process.stdout.write = orig; }
  const events = lines.map(l => JSON.parse(l)).filter(e => e.event === "user.signin");
  assert.equal(events.length, 1, "exactly one user.signin per user per instance");
  assert.deepEqual(Object.keys(events[0]).sort(), ["app", "event", "level", "name", "oid", "path", "ts", "upn"]);
  assert.equal(events[0].oid, "oid-1");
});
