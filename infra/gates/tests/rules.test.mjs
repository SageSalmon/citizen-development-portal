import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { runChecks } from "../check.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const passing = join(here, "fixtures", "passing");

function copy(mutate) {
  const dir = mkdtempSync(join(tmpdir(), "gate-"));
  cpSync(passing, dir, { recursive: true });
  mutate?.(dir);
  return dir;
}
const blocks = (r, rule) => r.findings.filter(x => x.severity === "block" && (!rule || x.rule === rule));
const edit = (dir, file, fn) => writeFileSync(join(dir, file), fn(readFileSync(join(dir, file), "utf8")));

test("the passing fixture passes offline", async () => {
  const r = await runChecks(passing);
  assert.equal(r.ok, true, JSON.stringify(blocks(r), null, 2));
});

test("missing app.yaml blocks", async () => {
  const d = copy(dir => rmSync(join(dir, "app.yaml")));
  const r = await runChecks(d); assert.ok(blocks(r, "app-yaml").length);
});

test("regulated classification blocks (D7)", async () => {
  const d = copy(dir => edit(dir, "app.yaml", t => t.replace("classification: internal", "classification: regulated")));
  const r = await runChecks(d); assert.match(blocks(r, "app-yaml")[0].message, /regulated/);
});

test("no public app: missing access.group blocks", async () => {
  const d = copy(dir => edit(dir, "app.yaml", t => t.replace(/access:\n  group: .*\n/, "")));
  const r = await runChecks(d); assert.match(blocks(r, "app-yaml").map(x => x.message).join(), /access\.group/);
});

test("version range blocks", async () => {
  const d = copy(dir => edit(dir, "package.json", t => t.replace(/"react": "(\d+\.\d+\.\d+)"/, '"react": "^$1"')));
  const r = await runChecks(d); assert.match(blocks(r, "dependencies")[0].message, /range/);
});

test("missing lockfile blocks", async () => {
  const d = copy(dir => rmSync(join(dir, "package-lock.json")));
  const r = await runChecks(d); assert.match(blocks(r, "dependencies")[0].message, /package-lock/);
});

test("ignore-scripts missing blocks", async () => {
  const d = copy(dir => writeFileSync(join(dir, ".npmrc"), "save-exact=true\n"));
  const r = await runChecks(d); assert.match(blocks(r, "dependencies")[0].message, /ignore-scripts/);
});

test("off-allow-list dependency warns, not blocks", async () => {
  const d = copy(dir => edit(dir, "package.json", t => t.replace(/"react": "(\d+\.\d+\.\d+)"/, '"react": "$1", "left-pad": "1.3.0"')));
  const r = await runChecks(d);
  assert.equal(blocks(r, "dependencies").length, 0);
  assert.ok(r.findings.some(x => x.rule === "dependencies" && x.severity === "warn" && /left-pad/.test(x.message)));
});

test("a private key in the repo blocks", async () => {
  const d = copy(dir => writeFileSync(join(dir, "server", "oops.ts"), "const k = `-----BEGIN RSA PRIVATE KEY-----\\nabc`;\n"));
  const r = await runChecks(d); assert.match(blocks(r, "secrets")[0].message, /private key/);
});

test("committed .env without gitignore entry blocks", async () => {
  const d = copy(dir => { writeFileSync(join(dir, ".env"), "X=1\n"); writeFileSync(join(dir, ".gitignore"), "node_modules\n"); });
  const r = await runChecks(d); assert.match(blocks(r, "secrets")[0].message, /\.env/);
});

test("missing healthz route blocks", async () => {
  const d = copy(dir => edit(dir, "server/index.ts", t => t.replace('route: "api/healthz"', 'route: "api/health"')));
  const r = await runChecks(d); assert.match(blocks(r, "functions-app").map(x => x.message).join(), /healthz/);
});

test("wrong extension bundle blocks", async () => {
  const d = copy(dir => edit(dir, "host.json", t => t.replace('"[4.*, 5.0.0)"', '"[3.*, 4.0.0)"')));
  const r = await runChecks(d); assert.match(blocks(r, "functions-app")[0].message, /extensionBundle/);
});

test("workflow not calling the platform workflow blocks", async () => {
  const d = copy(dir => edit(dir, ".github/workflows/deploy.yml", t => t.replace("@main", "@v1")));
  const r = await runChecks(d); assert.ok(blocks(r, "workflow").length);
});

test("Dockerfile only warns", async () => {
  const d = copy(dir => writeFileSync(join(dir, "Dockerfile"), "FROM node:24\n"));
  const r = await runChecks(d);
  assert.equal(blocks(r, "functions-app").length, 0);
  assert.ok(r.findings.some(x => x.rule === "functions-app" && /Dockerfile/.test(x.message)));
});
