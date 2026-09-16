import { spawnSync } from "node:child_process";
import { finding } from "../lib/context.mjs";
export const id = "audit";
export const gate = "build";

export function run(ctx) {
  if (!ctx.pkg || !ctx.lock) return [];
  if (!ctx.online) return [finding(id, "info", "npm audit not run (offline). Run with --online.")];
  const r = spawnSync("npm", ["audit", "--omit=dev", "--json", "--ignore-scripts"], { cwd: ctx.appDir, encoding: "utf8" });
  let report; try { report = JSON.parse(r.stdout || "{}"); } catch { return [finding(id, "warn", `npm audit output could not be parsed: ${(r.stderr || "").slice(0, 200)}`)]; }
  if (report.error) return [finding(id, "warn", `npm audit could not run: ${report.error.summary ?? report.error.code}`)];
  const v = report.metadata?.vulnerabilities ?? {};
  const bad = (v.high ?? 0) + (v.critical ?? 0);
  if (bad > 0) {
    const names = Object.values(report.vulnerabilities ?? {}).filter(x => ["high", "critical"].includes(x.severity)).map(x => `${x.name} (${x.severity})`).slice(0, 8);
    return [finding(id, "block", `npm audit reports ${bad} high/critical finding(s) in production dependencies: ${names.join(", ")}. Update or replace them.`, "package-lock.json")];
  }
  return [finding(id, "info", `npm audit: no high or critical findings in production dependencies (${v.moderate ?? 0} moderate, ${v.low ?? 0} low).`)];
}
