import type { Config } from "@netlify/functions";
import { env } from "../shared/env.mts";
import { json } from "../shared/identity.mts";

const startedAt = new Date().toISOString(); // per cold start; illustrates "no long-lived process"

export default async () =>
  json({
    status: "ok",
    commit: env("COMMIT_REF", "local"),
    startedAt,
    upstreams: {
      netlifyDb: env("NETLIFY_DATABASE_URL") ? "configured" : "not configured",
      fabric: env("FABRIC_SQL_ENDPOINT") ? "configured" : "not configured",
    },
  });

export const config: Config = { path: "/api/healthz" };
