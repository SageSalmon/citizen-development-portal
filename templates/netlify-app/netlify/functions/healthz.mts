import type { Config } from "@netlify/functions";
import { json } from "../shared/identity.mts";

const startedAt = new Date().toISOString(); // per cold start
const env = (k: string) => (globalThis as unknown as { Netlify?: { env: { get(k: string): string | undefined } } }).Netlify?.env.get(k) ?? process.env[k];

export default async () => json({ status: "ok", commit: env("COMMIT_REF") ?? "unknown (laptop deploy, no linked repo)", startedAt });
export const config: Config = { path: "/api/healthz" };
