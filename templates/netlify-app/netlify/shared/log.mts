/** One JSON line per event on stdout: app, ts, level, event, plus fields. Same shape as the custom playground. */
const APP = () => (globalThis as unknown as { Netlify?: { env: { get(k: string): string | undefined } } }).Netlify?.env.get("APP_NAME") ?? process.env.APP_NAME ?? "__APP_NAME__";
export function log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ app: APP(), ts: new Date().toISOString(), level, event, ...fields }));
}
