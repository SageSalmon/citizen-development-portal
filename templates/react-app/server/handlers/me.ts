import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { principalFrom } from "../identity.ts";
import { recordSignin } from "../signin-log.ts";

/** The identity headers as JSON, for the browser. Also where the sign-in is logged. */
export async function me(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  const p = principalFrom(req);
  if (!p) return { status: 401, jsonBody: { error: "no identity headers present" } };
  recordSignin(p, new URL(req.url).pathname);
  return { status: 200, jsonBody: p };
}
