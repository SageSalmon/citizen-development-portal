import { finding } from "../lib/context.mjs";
export const id = "dependencies";
export const gate = "build";
const EXACT = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

export function run(ctx) {
  const f = [];
  if (!ctx.pkg) return [finding(id, "block", "package.json is missing or unreadable.", "package.json")];
  if (!ctx.lock) f.push(finding(id, "block", "package-lock.json is missing. Commit it: the platform installs exactly what you tested, with `npm ci`.", "package-lock.json"));
  else if ((ctx.lock.lockfileVersion ?? 0) < 2) f.push(finding(id, "block", "package-lock.json is lockfileVersion 1. Regenerate it with a current npm.", "package-lock.json"));

  const direct = { ...(ctx.pkg.dependencies ?? {}), ...(ctx.pkg.devDependencies ?? {}) };
  for (const [name, ver] of Object.entries(direct)) {
    if (!EXACT.test(String(ver))) f.push(finding(id, "block", `"${name}": "${ver}" is a version range or non-registry source. Pin an exact version (\`npm install ${name}@<version> --save-exact\`).`, "package.json"));
    if (!ctx.allowlist.packages.includes(name)) f.push(finding(id, "warn", `"${name}" is not on the platform allow-list. It can still deploy, but a reviewer will be asked to acknowledge it.`, "package.json"));
  }
  const n = Object.keys(direct).length;
  const { warn, block } = ctx.platform.dependencyBudget;
  if (n > block) f.push(finding(id, "block", `${n} direct dependencies is over the hard budget of ${block}. Size is the risk.`, "package.json"));
  else if (n > warn) f.push(finding(id, "warn", `${n} direct dependencies is over the soft budget of ${warn}. Do you need them all?`, "package.json"));

  const npmrc = ctx.exists(".npmrc") ? ctx.read(".npmrc") : "";
  if (!/^\s*ignore-scripts\s*=\s*true\s*$/m.test(npmrc)) f.push(finding(id, "block", ".npmrc must contain `ignore-scripts=true`. Install scripts are the main execution vector in registry compromises; the platform installs with them disabled regardless.", ".npmrc"));
  if (!/^\s*save-exact\s*=\s*true\s*$/m.test(npmrc)) f.push(finding(id, "warn", ".npmrc should contain `save-exact=true` so future installs stay pinned.", ".npmrc"));

  const engines = ctx.pkg.engines?.node;
  if (!engines) f.push(finding(id, "warn", "package.json has no `engines.node`. Set it to match runtime.node in app.yaml.", "package.json"));

  const start = ctx.pkg.scripts?.start ?? "";
  if (/\bnpx\b/.test(start)) f.push(finding(id, "block", "`scripts.start` uses npx, which fetches code at runtime. The deployed package must be complete at build time.", "package.json"));
  return f;
}
