// `npm run dev`: the API on :7071 (same handlers as production) and Vite on :5173 with
// /api proxied. Node built-ins only. Loads .env if present.
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
if (existsSync(".env")) for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const run = (cmd, args) => spawn(cmd, args, { stdio: "inherit", env: process.env, shell: process.platform === "win32" });
const api = run(process.execPath, ["--watch", "server/local.ts"]);
const web = run("npx", ["vite"]);
const stop = () => { api.kill(); web.kill(); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
console.log("dev: API http://localhost:7071  ·  web http://localhost:5173 (proxies /api)");
