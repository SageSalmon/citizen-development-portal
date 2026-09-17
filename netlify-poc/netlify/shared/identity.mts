import { log } from "./log.mts";

/**
 * What does the app know about the caller? On this team, Netlify's SSO team login has
 * already authenticated them before the request arrives, but it forwards no identity to
 * the function: no principal header, no token, no name. So the app cannot say who is here,
 * cannot log a user.signin, and cannot act on the user's behalf. Contrast the playground,
 * where Easy Auth forwards x-ms-client-principal with object id, UPN, and display name.
 *
 * This function is deliberately generous in what it LOOKS for, so that if Netlify does
 * forward something, it shows up in `identityHeadersSeen` rather than being missed.
 */
export function whoami(req: Request) {
  const seen: string[] = [];
  for (const [k] of req.headers) {
    if (/principal|identity|x-nf-.*(user|account|member)|authorization|x-forwarded-user|remote-user/i.test(k)) seen.push(k);
  }
  const knownToApp = seen.length > 0;
  log("info", knownToApp ? "user.signin" : "user.unknown", { path: new URL(req.url).pathname, identityHeadersSeen: seen });
  return { authenticatedBy: "Netlify SSO team login (organisation IdP), before any code ran", knownToApp, identityHeadersSeen: seen };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
