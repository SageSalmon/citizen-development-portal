import netlifyIdentity from "netlify-identity-widget";

// Netlify Identity: the platform's OWN user store (not Entra). Registration should be
// set to invite-only in the Netlify UI so only invited staff can sign in.
netlifyIdentity.init({ APIUrl: `${window.location.origin}/.netlify/identity` });

/** Make sure the nf_jwt cookie is present so edge role redirects can see the login. */
function syncCookie() {
  const user = netlifyIdentity.currentUser();
  const token = user?.token?.access_token;
  if (token) {
    document.cookie = `nf_jwt=${token}; path=/; secure; samesite=lax`;
  } else {
    document.cookie = "nf_jwt=; path=/; max-age=0";
  }
}

netlifyIdentity.on("login", () => { syncCookie(); window.location.assign("/app/"); });
netlifyIdentity.on("logout", () => { syncCookie(); window.location.assign("/"); });
syncCookie();

export const identity = netlifyIdentity;

export async function bearer(): Promise<string | null> {
  const user = netlifyIdentity.currentUser();
  if (!user) return null;
  return user.jwt(); // refreshes if needed
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = await bearer();
  const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}
