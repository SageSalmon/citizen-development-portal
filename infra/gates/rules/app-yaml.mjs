import { finding } from "../lib/context.mjs";
export const id = "app-yaml";
export const gate = "admission";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME = /^[a-z][a-z0-9-]{1,31}$/;
const LOGIN = /^[A-Za-z0-9-]{1,39}$/;

export function run(ctx) {
  const f = [];
  if (!ctx.exists("app.yaml")) return [finding(id, "block", "app.yaml is missing at the repo root. It is the one file the platform reads about your app.", "app.yaml")];
  if (ctx.appYamlError) return [finding(id, "block", `app.yaml could not be read: ${ctx.appYamlError}`, "app.yaml")];
  const a = ctx.appYaml;
  const blk = (m) => f.push(finding(id, "block", m, "app.yaml"));
  const warn = (m) => f.push(finding(id, "warn", m, "app.yaml"));

  if (!a.name || !NAME.test(String(a.name))) blk("`name` must be lowercase letters, digits and hyphens, 2 to 32 characters, starting with a letter. It becomes the app's hostname.");
  if (!a.owner || !EMAIL.test(String(a.owner))) blk("`owner` must be one person's email address. A team alias is not an owner.");
  if (!Array.isArray(a.maintainers ?? [])) blk("`maintainers` must be a list of email addresses (or `[]`).");
  else for (const m of a.maintainers ?? []) if (!EMAIL.test(String(m))) blk(`maintainer "${m}" is not an email address.`);
  if (!a.area || typeof a.area !== "string") blk("`area` (business area, for cost reporting) is required.");
  if (!a.description || typeof a.description !== "string") warn("`description` is empty. One line helps people find your app.");
  if (!a.access || typeof a.access.group !== "string" || !a.access.group) blk("`access.group` must name the Entra group whose members may sign in. There is no public app.");

  const cls = a.data?.classification;
  if (!cls) blk("`data.classification` is required: public | internal | confidential.");
  else if (ctx.platform.rejectedClassifications.includes(cls)) blk(`data.classification "${cls}" is not accepted on the playground (D7). Apps touching regulated data need a separate review before they can be hosted.`);
  else if (!ctx.platform.classifications.includes(cls)) blk(`data.classification "${cls}" is not one of ${ctx.platform.classifications.join(" | ")}.`);

  const mode = a.identity?.mode ?? "user";
  if (!["user", "app"].includes(mode)) blk("`identity.mode` must be `user` (default) or `app`.");
  const roles = a.identity?.roles ?? [];
  if (!Array.isArray(roles)) blk("`identity.roles` must be a list (or `[]`).");
  else if (mode === "user" && roles.length) blk("`identity.roles` only applies when `identity.mode` is `app`.");
  else if (mode === "app" && roles.length) f.push(finding(id, "info", "identity.roles are declared. Each must already be held by the owner; this is verified at admission and re-checked monthly (not by this check).", "app.yaml"));
  if (mode === "app" && !roles.length) warn("`identity.mode: app` with no roles: the app has a standing identity that can reach nothing. Use `user` mode unless a scheduled task needs an identity.");

  const node = String(a.runtime?.node ?? "24");
  if (!ctx.platform.nodeVersions.includes(node)) blk(`runtime.node "${node}" is not supported by the hosting plan. Use one of ${ctx.platform.nodeVersions.join(", ")}.`);

  const deployers = a.github?.deployers ?? [];
  if (!Array.isArray(deployers) || deployers.length === 0) blk("`github.deployers` must list at least one GitHub login allowed to deploy (the owner's). Interim until D15 maps GitHub actors to Entra users automatically.");
  else for (const d of deployers) if (!LOGIN.test(String(d))) blk(`github.deployers entry "${d}" is not a GitHub login.`);

  for (const k of Object.keys(a.env ?? {})) {
    const v = String(a.env[k] ?? "");
    if (/(secret|token|password|key)/i.test(k) || /^[A-Za-z0-9+/]{32,}={0,2}$/.test(v)) warn(`env.${k} looks like a secret. Secrets go under \`secrets:\` as vault references, never as plain values.`);
  }
  return f;
}
