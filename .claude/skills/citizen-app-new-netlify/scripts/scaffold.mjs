#!/usr/bin/env node
// Scaffold a Netlify-hosted citizen-style app from the template beside this script, install,
// check, test, build, create the Netlify site in the chosen team, and deploy it.
//
//   node <skill dir>/scripts/scaffold.mjs --name <app> --owner <email> \
//        --description "<one line>" --team <netlify team slug> [--area <area>] [--dir <target>] [--no-deploy]
//
// Self-contained: the template lives in ../template, so this works from a globally
// installed copy of the skill (~/.claude/skills/citizen-app-new-netlify) with no repo
// checkout. Default target is <cwd>/<name>. Node built-ins only. There is no admission,
// no gate engine, and no OIDC here: that absence is what the comparison is about.
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(here, "..");
const args = process.argv.slice(2);
const opt = (k, def) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : def; };
const flag = (k) => args.includes(`--${k}`);
const name = opt("name"); const owner = opt("owner");
const area = opt("area", "unspecified"); // a cost tag on Azure; on Netlify it is README text only, so optional
const description = opt("description", "A citizen app on Netlify."); const team = opt("team");
const target = resolve(opt("dir", name ? join(process.cwd(), name) : "."));

function die(msg) { console.error(`citizen-app-new-netlify: ${msg}`); process.exit(1); }
if (!name || !/^[a-z][a-z0-9-]{1,62}$/.test(name)) die("--name must be lowercase letters, digits, hyphens; start with a letter");
if (!owner || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner)) die("--owner must be an email address");
if (!team) die("--team is required (Netlify team slug; `npx netlify api listAccountsForUser` lists yours)");
if (existsSync(target)) die(`${target} already exists; this tool only creates new directories`);

const tokens = { __APP_NAME__: name, __OWNER_EMAIL__: owner, __AREA__: area, __DESCRIPTION__: description, __NETLIFY_TEAM__: team };

cpSync(join(skillRoot, "template"), target, { recursive: true });
(function walk(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) { if (ent.name !== "node_modules") walk(p); continue; }
    let t = readFileSync(p, "utf8"); let changed = false;
    for (const [k, v] of Object.entries(tokens)) if (t.includes(k)) { t = t.split(k).join(v); changed = true; }
    if (changed) writeFileSync(p, t);
  }
})(target);

const run = (cmd, a, opts = {}) => { const r = spawnSync(cmd, a, { cwd: target, stdio: "inherit", ...opts }); if (r.status !== 0) die(`${cmd} ${a.join(" ")} failed`); return r; };
const out = (cmd, a) => { const r = spawnSync(cmd, a, { cwd: target, encoding: "utf8" }); if (r.status !== 0) die(`${cmd} ${a.join(" ")} failed: ${(r.stderr || "").trim()}`); return r.stdout; };

run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"]);
run("npm", ["run", "check"]);
run("npm", ["test"]);
run("npm", ["run", "build"]);

if (!flag("no-deploy")) {
  // signed in?
  const who = spawnSync("npx", ["netlify", "api", "getCurrentUser"], { cwd: target, encoding: "utf8" });
  if (who.status !== 0) die("netlify CLI is not signed in. Run `npx netlify login` first.");
  // member of the team?
  const accts = JSON.parse(out("npx", ["netlify", "api", "listAccountsForUser"]));
  if (!accts.some(a => a.slug === team)) die(`you are not a member of Netlify team "${team}". Teams: ${accts.map(a => a.slug).join(", ")}`);
  run("npx", ["netlify", "sites:create", "--account-slug", team, "--name", name]);
  run("npx", ["netlify", "env:set", "APP_NAME", name]);
  run("npx", ["netlify", "deploy", "--prod", "--dir=dist", "--functions=netlify/functions", "--message", "first deploy from citizen-app-new-netlify"]);
}

console.log(`\n${name} is ready at ${target}\n  npm run dev · npm run check · npm test · npm run deploy\n` +
  (flag("no-deploy") ? "" : `  live: https://${name}.netlify.app  (access = whatever team "${team}" enforces)\n`) +
  `\nNo repo was created: Netlify deploys from the laptop. Nothing records which source produced the running code.`);
