import { log } from "./log.mts";

/**
 * What does the app know about the caller? On an Enterprise team, Netlify's SSO team login
 * authenticates the visitor before any request arrives, but forwards no identity to the
 * function: no principal header, no token, no name. The only Netlify headers name the TEAM
 * that owns the site (x-nf-account-*). So the app cannot say who is here, cannot log a
 * sign-in, and cannot act on the user's behalf. Contrast the custom playground, where Easy
 * Auth forwards x-ms-client-principal with object id, UPN, and display name.
 */
export function whoami(req: Request) {
  const userIdentity: string[] = [];
  const platformMetadata: string[] = [];
  for (const [k] of req.headers) {
    if (/^x-nf-/i.test(k)) { platformMetadata.push(k); continue; }
    if (/principal|identity|authorization|x-forwarded-user|remote-user|x-user|x-email/i.test(k)) userIdentity.push(k);
  }
  const knownToApp = userIdentity.length > 0;
  log("info", knownToApp ? "user.signin" : "user.unknown", { path: new URL(req.url).pathname, userIdentity, platformMetadata });
  return {
    authenticatedBy: "Netlify team login (organisation IdP), before any code ran",
    knownToApp,
    userIdentityHeaders: userIdentity,
    platformMetadataHeaders: platformMetadata,
    note: knownToApp ? "the app can identify the user" : "x-nf-account-* name the Netlify team that owns the site, not the person; nothing identifies the user",
  };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
