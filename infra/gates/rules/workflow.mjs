import { finding } from "../lib/context.mjs";
export const id = "workflow";
export const gate = "build";

export function run(ctx) {
  const f = [];
  const wf = ctx.files.filter(p => /^\.github\/workflows\/.*\.ya?ml$/.test(p));
  const expected = `${ctx.platform.org}/${ctx.platform.platformRepo}/${ctx.platform.reusableWorkflow}@main`;
  if (wf.length === 0) return [finding(id, "block", `No workflow under .github/workflows/. The app needs the one-line workflow that calls ${expected}; without it nothing deploys.`, ".github/workflows")];
  let found = false;
  for (const p of wf) {
    const t = ctx.read(p);
    if (t.includes(`uses: ${expected}`)) found = true;
    if (/^\s*steps\s*:/m.test(t)) f.push(finding(id, "warn", `${p} defines its own steps. Only the platform's reusable workflow can deploy; extra steps run but change nothing about the deploy.`, p));
    const m = t.match(new RegExp(`uses: ${ctx.platform.org}/${ctx.platform.platformRepo}/[^\\s@]+@(\\S+)`));
    if (m && m[1] !== "main") f.push(finding(id, "block", `${p} pins the platform workflow to "${m[1]}". Apps must call it at @main so gate changes reach every app; a pinned ref will not match the deploy identity's trust and cannot deploy.`, p));
  }
  if (!found) f.push(finding(id, "block", `No workflow calls the platform's reusable workflow (uses: ${expected}). That call is the only path that can deploy.`, ".github/workflows"));
  return f;
}
