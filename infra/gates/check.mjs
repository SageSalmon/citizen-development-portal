#!/usr/bin/env node
// The playground's rule engine. Node built-ins only, no dependencies.
//
//   node check.mjs [--app <dir>] [--online] [--json]
//
// The skill vendors this file (with lib/, rules/, platform.json, allowlist.json) into
// generated apps as scripts/check.mjs so developers see the same messages locally. The
// platform pipeline runs its own copy from this repo; that copy is the one that bites
// (05-platform-gates.md).
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildContext } from "./lib/context.mjs";

const here = dirname(fileURLToPath(import.meta.url));

export async function runChecks(appDir, opts = {}) {
  const ctx = buildContext(resolve(appDir), opts);
  const findings = [];
  const ruleFiles = readdirSync(join(here, "rules")).filter(f => f.endsWith(".mjs")).sort();
  for (const file of ruleFiles) {
    const rule = await import(pathToFileURL(join(here, "rules", file)).href);
    if (opts.rules && !opts.rules.includes(rule.id)) continue;
    try {
      const out = await rule.run(ctx);
      findings.push(...(out ?? []).map(x => ({ gate: rule.gate, ...x })));
    } catch (e) {
      findings.push({ gate: rule.gate, rule: rule.id, severity: "block", message: `rule crashed: ${e.message}` });
    }
  }
  const counts = { block: 0, warn: 0, info: 0 };
  for (const x of findings) counts[x.severity] = (counts[x.severity] ?? 0) + 1;
  return { appDir: ctx.appDir, app: ctx.appYaml?.name ?? null, ok: counts.block === 0, counts, findings };
}

function format(report) {
  const lines = [];
  const order = { block: 0, warn: 1, info: 2 };
  const sorted = [...report.findings].sort((a, b) => order[a.severity] - order[b.severity]);
  for (const x of sorted) {
    const tag = x.severity === "block" ? "✖ BLOCK" : x.severity === "warn" ? "▲ warn " : "· info ";
    lines.push(`${tag} [${x.rule}] ${x.message}${x.file ? `  (${x.file})` : ""}`);
  }
  lines.push("");
  lines.push(report.ok
    ? `check: OK — ${report.counts.warn} warning(s), ${report.counts.info} note(s). The platform would accept this app.`
    : `check: REFUSED — ${report.counts.block} blocking problem(s), ${report.counts.warn} warning(s). Fix the ✖ lines; the platform will refuse the same way.`);
  return lines.join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const get = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const appDir = get("--app") ?? process.cwd();
  const report = await runChecks(appDir, { online: args.includes("--online") });
  if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else console.log(format(report));
  process.exit(report.ok ? 0 : 1);
}
