import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

const startedAt = new Date().toISOString(); // per instance start; there is no long-lived process

/** Contract rule 3: 200 with a small JSON body when ready. No side effects. The platform authenticates it, not this code. */
export async function healthz(_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  return {
    status: 200,
    jsonBody: {
      status: "ok",
      commit: process.env.COMMIT_REF ?? "local",
      startedAt,
      upstreams: {}, // add one entry per configured upstream the app can or cannot reach
    },
  };
}
