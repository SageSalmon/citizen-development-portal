import { useEffect, useState } from "react";

type Whoami = { authenticatedBy: string; knownToApp: boolean; userIdentityHeaders: string[]; platformMetadataHeaders: string[]; note: string };
type Health = { status: string; commit: string; startedAt: string };

/**
 * __APP_NAME__ — __DESCRIPTION__
 *
 * Edit this component freely. The two panels below are the platform comparison points and
 * are worth keeping: /api/me shows what Netlify tells the app about the user (nothing),
 * /api/healthz is the heartbeat shape the custom playground also uses.
 */
export function App() {
  const [me, setMe] = useState<Whoami | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/me").then(r => r.json()).then(setMe).catch(e => setErr(String(e)));
    fetch("/api/healthz").then(r => r.json()).then(setHealth).catch(e => setErr(String(e)));
  }, []);
  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 640, margin: "3rem auto", lineHeight: 1.5 }}>
      <h1>__APP_NAME__</h1>
      <p>__DESCRIPTION__</p>
      <p style={{ color: "#666", fontSize: 13 }}>Owner: __OWNER_EMAIL__ · Area: __AREA__ · Hosted on Netlify (team: __NETLIFY_TEAM__)</p>

      <section style={{ border: "1px solid #ddd", borderRadius: 6, padding: "0.75rem 1rem", margin: "1rem 0" }}>
        <h2 style={{ margin: "0 0 .5rem", fontSize: 16 }}>Who does the app think you are?</h2>
        {me ? (
          <>
            <p style={{ margin: 0 }}>{me.knownToApp ? "Known to the app." : "Unknown to the app."} {me.note}</p>
            <p style={{ margin: 0, color: "#666", fontSize: 13 }}>Authenticated by: {me.authenticatedBy}</p>
          </>
        ) : <em>loading…</em>}
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 6, padding: "0.75rem 1rem", margin: "1rem 0" }}>
        <h2 style={{ margin: "0 0 .5rem", fontSize: 16 }}>Heartbeat</h2>
        {health ? <pre style={{ margin: 0 }}>{JSON.stringify(health, null, 2)}</pre> : <em>loading…</em>}
      </section>

      {err && <p style={{ color: "#b42318" }}>{err}</p>}
    </main>
  );
}
