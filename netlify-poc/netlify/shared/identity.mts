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
  const userIdentity: string[] = [];   // anything that names the PERSON
  const platformMetadata: string[] = []; // Netlify's own headers about the site/team, not the user
  for (const [k] of req.headers) {
    if (/^x-nf-/i.test(k)) { platformMetadata.push(k); continue; }
    if (/principal|identity|authorization|x-forwarded-user|remote-user|x-user|x-email/i.test(k)) userIdentity.push(k);
  }
  const knownToApp = userIdentity.length > 0;
  log("info", knownToApp ? "user.signin" : "user.unknown", { path: new URL(req.url).pathname, userIdentity, platformMetadata });
  return {
    authenticatedBy: "Netlify SSO team login (organisation IdP), before any code ran",
    knownToApp,
    userIdentityHeaders: userIdentity,
    platformMetadataHeaders: platformMetadata,
    note: knownToApp ? "the app can identify the user" : "x-nf-account-* name the Netlify team that owns the site, not the person; nothing identifies the user",
  };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
