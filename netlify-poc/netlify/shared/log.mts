import { APP } from "./env.mts";

/** One JSON line per event on stdout: app, ts, level, event, plus fields. */
export function log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ app: APP(), ts: new Date().toISOString(), level, event, ...fields }));
}
