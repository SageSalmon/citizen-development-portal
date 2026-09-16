import { finding } from "../lib/context.mjs";
export const id = "functions-app";
export const gate = "build";

export function run(ctx) {
  const f = [];
  if (!ctx.exists("host.json")) f.push(finding(id, "block", "host.json is missing. The app runs on Azure Functions (Flex Consumption); host.json pins the runtime configuration.", "host.json"));
  else {
    let h; try { h = ctx.json("host.json"); } catch (e) { return [finding(id, "block", `host.json is not valid JSON: ${e.message}`, "host.json")]; }
    if (h.version !== "2.0") f.push(finding(id, "block", `host.json version must be "2.0" (got ${JSON.stringify(h.version)}).`, "host.json"));
    const bundle = h.extensionBundle?.version ?? "";
    if (!/^\[4\./.test(bundle)) f.push(finding(id, "block", `host.json extensionBundle.version must be in the 4.x range, e.g. "[4.*, 5.0.0)" (got ${JSON.stringify(bundle)}). Flex Consumption requires it.`, "host.json"));
    if (h.extensions?.http?.routePrefix !== "") f.push(finding(id, "warn", 'host.json should set extensions.http.routePrefix to "" so routes are exactly what the code declares (/api/healthz, not /api/api/healthz).', "host.json"));
  }
  if (ctx.pkg) {
    const main = ctx.pkg.main ?? "";
    if (!/^dist\/server\//.test(main)) f.push(finding(id, "block", `package.json \`main\` must point at the compiled server entry under dist/server/ (got ${JSON.stringify(main)}). The Functions host loads it.`, "package.json"));
  }
  if (!ctx.isDir("web")) f.push(finding(id, "block", "web/ is missing. Browser code lives in web/, container-side code in server/ (03-skills.md).", "web"));
  if (!ctx.isDir("server")) f.push(finding(id, "block", "server/ is missing. The Functions handlers, /api/healthz, and identity handling live there.", "server"));
  if (ctx.exists("Dockerfile")) f.push(finding(id, "warn", "A Dockerfile is present but the platform does not build containers any more (D30). It is ignored; remove it to avoid confusion.", "Dockerfile"));

  const serverSrc = ctx.files.filter(p => p.startsWith("server/") && /\.[mc]?[jt]s$/.test(p)).map(p => ctx.read(p)).join("\n");
  // the route must be REGISTERED with the Functions host, not merely mentioned somewhere
  if (!/route\s*:\s*["'`]api\/healthz["'`]/.test(serverSrc)) f.push(finding(id, "block", "No function registers the route `api/healthz` (app.http(..., { route: \"api/healthz\" })). Contract rule 3: the heartbeat must exist.", "server"));
  if (!/user\.signin/.test(serverSrc)) f.push(finding(id, "block", "server/ never emits a `user.signin` event. Contract rule 8: log every authenticated user once per session.", "server"));
  const consoleUses = ctx.files.filter(p => p.startsWith("server/") && /\.[mc]?[jt]s$/.test(p) && !/log\.[mc]?[jt]s$/.test(p) && !/local\.[mc]?[jt]s$/.test(p) && /console\.(log|info|warn|error)\(/.test(ctx.read(p)));
  for (const p of consoleUses) f.push(finding(id, "warn", `${p} uses console.* directly. Use the JSON logger so the line reaches the dashboard (contract rule 7).`, p));
  return f;
}
