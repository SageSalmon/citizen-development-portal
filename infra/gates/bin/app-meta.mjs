#!/usr/bin/env node
// Print selected app.yaml fields as JSON for the workflow: node app-meta.mjs [--app <dir>]
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseYaml } from "../lib/yaml.mjs";
const args = process.argv.slice(2); const i = args.indexOf("--app");
const dir = resolve(i >= 0 ? args[i + 1] : process.cwd());
const a = parseYaml(readFileSync(join(dir, "app.yaml"), "utf8"));
console.log(JSON.stringify({ name: a.name, owner: a.owner, area: a.area, deployers: a.github?.deployers ?? [], node: String(a.runtime?.node ?? "24") }));
