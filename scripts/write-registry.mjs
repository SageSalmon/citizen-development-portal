#!/usr/bin/env node
// After `terraform apply`, write infra/registry/<name>.json for every app output. These
// files are what the reusable workflow's deploy job reads. Nothing in them is secret.
//   node scripts/write-registry.mjs   (run from the repo root; needs terraform on PATH)
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const tf = spawnSync("terraform", ["output", "-json"], { cwd: "infra/terraform", encoding: "utf8" });
if (tf.status !== 0) { console.error(tf.stderr); process.exit(1); }
const outputs = JSON.parse(tf.stdout);
mkdirSync("infra/registry", { recursive: true });
let n = 0;
for (const [k, v] of Object.entries(outputs)) {
  const val = v.value;
  if (val && typeof val === "object" && val.name && val.deploy_client_id) {
    writeFileSync(join("infra/registry", `${val.name}.json`), JSON.stringify(val, null, 2) + "\n");
    console.log(`wrote infra/registry/${val.name}.json`); n++;
  }
}
if (!n) console.log("no app outputs found");
