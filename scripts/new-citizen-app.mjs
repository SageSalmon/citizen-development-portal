#!/usr/bin/env node
// Scaffold a conforming citizen app from templates/react-app, vendor the gate engine,
// install, check, and (unless --no-git) create its GitHub repo in the playground org.
//
//   node scripts/new-citizen-app.mjs --name <app> --owner <email> --area <area> \
//        --description "<one line>" --group <entra-group> --github-login <login> \
//        [--dir <target>] [--no-git] [--no-install]
//
// Node built-ins only. Used by the new-citizen-app skill (03-skills.md).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const platformRoot = resolve(here, "..");
const platform = JSON.parse(readFileSync(join(platformRoot, "infra/gates/platform.json"), "utf8"));

const args = process.argv.slice(2);
const opt = (k, def) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : def; };
const flag = (k) => args.includes(`--${k}`);
const name = opt("name"); const owner = opt("owner"); const area = opt("area");
const description = opt("description", "A citizen app."); const group = opt("group", name ? `app-${name}-users` : undefined);
const login = opt("github-login"); const target = resolve(opt("dir", name ? join(platformRoot, "..", name) : "."));

function die(msg) { console.error(`new-citizen-app: ${msg}`); process.exit(1); }
if (!name || !/^[a-z][a-z0-9-]{1,31}$/.test(name)) die("--name must be lowercase letters, digits, hyphens; 2-32 chars; start with a letter");
if (!owner || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner)) die("--owner must be an email address");
if (!area) die("--area is required (business area, for cost reporting)");
if (!login) die("--github-login is required (the GitHub login allowed to deploy; interim D15)");
if (existsSync(target)) die(`${target} already exists; this tool only creates new directories`);

const tokens = { __APP_NAME__: name, __OWNER_EMAIL__: owner, __AREA__: area, __DESCRIPTION__: description, __ACCESS_GROUP__: group, __GITHUB_LOGIN__: login };

// 1. copy template and substitute tokens in text files
cpSync(join(platformRoot, "templates/react-app"), target, { recursive: true });
(function walk(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) { if (ent.name !== "node_modules") walk(p); continue; }
    if (!/\.(m?[jt]sx?|json|ya?ml|md|html|css|example|npmrc|nvmrc|gitignore)$/.test(ent.name) && !ent.name.startsWith(".")) continue;
    let t = readFileSync(p, "utf8"); let changed = false;
    for (const [k, v] of Object.entries(tokens)) if (t.includes(k)) { t = t.split(k).join(v); changed = true; }
    if (changed) writeFileSync(p, t);
  }
})(target);

// 2. vendor the gate engine (advisory copy; the platform runs its own)
mkdirSync(join(target, "scripts"), { recursive: true });
for (const f of ["check.mjs", "platform.json", "allowlist.json"]) cpSync(join(platformRoot, "infra/gates", f), join(target, "scripts", f));
cpSync(join(platformRoot, "infra/gates/lib"), join(target, "scripts/lib"), { recursive: true });
cpSync(join(platformRoot, "infra/gates/rules"), join(target, "scripts/rules"), { recursive: true });
writeFileSync(join(target, "scripts/README.md"), `check.mjs and its lib/, rules/, platform.json, allowlist.json are a vendored copy of the\nplatform's gate engine (${platform.org}/${platform.platformRepo}, infra/gates). Edit freely; the platform\nruns its own copy and reports if the two disagree. Regenerate with the new-citizen-app skill.\n`);

const run = (cmd, a, opts = {}) => { const r = spawnSync(cmd, a, { cwd: target, stdio: "inherit", ...opts }); if (r.status !== 0) die(`${cmd} ${a.join(" ")} failed`); };

// 3. install (creates the lockfile) and check
if (!flag("no-install")) {
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"]);
  const r = spawnSync(process.execPath, ["scripts/check.mjs"], { cwd: target, stdio: "inherit" });
  if (r.status !== 0) die("the generated project fails its own check; that is a bug in the template, not in your inputs");
}

// 4. git init, first commit, GitHub repo in the playground org
if (!flag("no-git")) {
  const gh = spawnSync("gh", ["api", "user", "--jq", ".login"], { encoding: "utf8" });
  const active = (gh.stdout || "").trim();
  if (gh.status !== 0) die("gh is not signed in. Run `gh auth login` first.");
  const member = spawnSync("gh", ["api", `orgs/${platform.org}/memberships/${active}`, "--jq", ".state"], { encoding: "utf8" });
  if ((member.stdout || "").trim() !== "active") die(`gh is signed in as ${active}, who is not a member of ${platform.org}. Run \`gh auth switch\` to the account that is.`);
  run("git", ["init", "-q", "-b", "main"]);
  run("git", ["add", "-A"]);
  run("git", ["-c", `user.name=${owner.split("@")[0]}`, "-c", `user.email=${owner}`, "commit", "-q", "-m", `Scaffold ${name} from the playground template`]);
  run("gh", ["repo", "create", `${platform.org}/${name}`, "--private", "--source", ".", "--remote", "origin", "--push"]);
  // OIDC subject must include job_workflow_ref (07, detail 1); needs repo admin
  const sub = spawnSync("gh", ["api", "-X", "PUT", `repos/${platform.org}/${name}/actions/oidc/customization/sub`, "-F", "use_default=false", "-f", "include_claim_keys[]=repo", "-f", "include_claim_keys[]=job_workflow_ref"], { encoding: "utf8" });
  if (sub.status !== 0) console.warn(`warning: could not set the OIDC subject template (${(sub.stderr || "").trim()}). The platform team must set it at admission or the deploy identity will not trust this repo.`);
}

console.log(`\n${name} is ready at ${target}\n` +
  `  npm run dev     start locally\n  npm run check   the platform's rules\n  npm test        handler tests\n` +
  (flag("no-git") ? "" : `  home: https://github.com/${platform.org}/${name}\n`) +
  `\nNext: say "deploy". The first deploy needs admission by the platform team (infra/registry/${name}.json).`);
