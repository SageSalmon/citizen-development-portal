// Registers the app's HTTP functions with the Azure Functions host (Flex Consumption, Node).
// authLevel is `anonymous` on purpose: the platform's built-in Entra auth sits in front of
// every request; function keys are a shared secret and are not how the playground works.
import { app } from "@azure/functions";
import { healthz } from "./handlers/healthz.ts";
import { me } from "./handlers/me.ts";
import { staticSite } from "./handlers/static-site.ts";

app.http("healthz", { route: "api/healthz", methods: ["GET"], authLevel: "anonymous", handler: healthz });
app.http("me", { route: "api/me", methods: ["GET"], authLevel: "anonymous", handler: me });
app.http("static", { route: "{*path}", methods: ["GET", "HEAD"], authLevel: "anonymous", handler: staticSite });
