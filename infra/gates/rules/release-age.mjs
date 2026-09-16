import { finding } from "../lib/context.mjs";
export const id = "release-age";
export const gate = "build";

export async function run(ctx) {
  if (!ctx.pkg) return [];
  if (!ctx.online) return [finding(id, "info", "Minimum release age not checked (offline). Run with --online to query the registry.")];
  const f = [];
  const minDays = ctx.platform.minReleaseAgeDays;
  const direct = { ...(ctx.pkg.dependencies ?? {}), ...(ctx.pkg.devDependencies ?? {}) };
  await Promise.all(Object.entries(direct).map(async ([name, ver]) => {
    try {
      // full document: the abbreviated (install-v1) form omits `time`, which is the whole point
      const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name).replace("%40", "@")}`, { headers: { accept: "application/json" } });
      if (!res.ok) { f.push(finding(id, "warn", `Could not read registry metadata for ${name} (HTTP ${res.status}).`)); return; }
      const meta = await res.json();
      const published = meta.time?.[ver];
      if (!published) { f.push(finding(id, "warn", `Registry has no publish time for ${name}@${ver}.`)); return; }
      const ageDays = (Date.now() - Date.parse(published)) / 86400000;
      if (ageDays < minDays) f.push(finding(id, "block", `${name}@${ver} was published ${ageDays.toFixed(1)} days ago; the playground requires ${minDays} (D8). Compromised releases are usually pulled within days. Wait, or pin the previous version.`, "package.json"));
    } catch (e) { f.push(finding(id, "warn", `Release-age check failed for ${name}: ${e.message}`)); }
  }));
  return f;
}
