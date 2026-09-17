// On the LT-POC Enterprise team the site is protected by Netlify's SSO team login: a
// visitor must be a Netlify team member and signs in through the organisation's identity
// provider before ANY request reaches this page or the functions. That handshake tells the
// app nothing about who the user is. There is no Netlify Identity instance on this site
// (2026-09-17), so the earlier Identity-widget login was removed.

/** Who does the app think you are? Nothing arrives, so the honest answer is: unknown. */
export type Whoami = { authenticatedBy: string; knownToApp: boolean; identityHeadersSeen: string[] };

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}
