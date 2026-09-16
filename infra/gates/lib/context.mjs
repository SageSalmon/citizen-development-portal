import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "./yaml.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const platform = JSON.parse(readFileSync(join(here, "..", "platform.json"), "utf8"));
export const allowlist = JSON.parse(readFileSync(join(here, "..", "allowlist.json"), "utf8"));

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".netlify", ".terraform", "coverage"]);

/** Everything a rule needs to know about the app directory, computed once. */
export function buildContext(appDir, opts = {}) {
  const files = [];
  (function walk(dir) {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (ent.isDirectory()) { if (!SKIP_DIRS.has(ent.name)) walk(join(dir, ent.name)); }
      else files.push(relative(appDir, join(dir, ent.name)));
    }
  })(appDir);

  const ctx = {
    appDir, files, online: !!opts.online, platform, allowlist,
    exists: p => existsSync(join(appDir, p)),
    isDir: p => existsSync(join(appDir, p)) && statSync(join(appDir, p)).isDirectory(),
    read: p => readFileSync(join(appDir, p), "utf8"),
    json: p => JSON.parse(readFileSync(join(appDir, p), "utf8")),
    appYaml: null, appYamlError: null, pkg: null, lock: null,
  };
  if (ctx.exists("app.yaml")) {
    try { ctx.appYaml = parseYaml(ctx.read("app.yaml")); } catch (e) { ctx.appYamlError = e.message; }
  }
  if (ctx.exists("package.json")) { try { ctx.pkg = ctx.json("package.json"); } catch (e) { ctx.pkgError = e.message; } }
  if (ctx.exists("package-lock.json")) { try { ctx.lock = ctx.json("package-lock.json"); } catch (e) { ctx.lockError = e.message; } }
  return ctx;
}

export function finding(rule, severity, message, file) {
  return file ? { rule, severity, message, file } : { rule, severity, message };
}
