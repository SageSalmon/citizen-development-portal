import type { Config } from "@netlify/functions";
import { env } from "../shared/env.mts";
import { getConnectionString } from "@netlify/database";
import { json } from "../shared/identity.mts";

const startedAt = new Date().toISOString(); // per cold start; illustrates "no long-lived process"

export default async () =>
  json({
    status: "ok",
    commit: env("COMMIT_REF", "local (laptop deploy, no linked repo)"),
    startedAt,
    upstreams: {
      // @netlify/database resolves its own connection; the env var alone under-reports
      netlifyDb: (() => { try { return getConnectionString() ? "configured" : "not configured"; } catch { return env("NETLIFY_DATABASE_URL") ? "configured" : "not configured"; } })(),
      fabric: env("FABRIC_SQL_ENDPOINT") ? "configured" : "not configured",
    },
  });

export const config: Config = { path: "/api/healthz" };
