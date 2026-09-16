import { useEffect, useState } from "react";

type Me = { oid: string; upn: string; name: string };

/**
 * Browser code never sees a secret and never calls a downstream API directly; it calls
 * server/. Who the user is comes from /api/me, which reads the platform's identity headers.
 */
export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/me").then(async r => { if (!r.ok) throw new Error(`${r.status}`); setMe(await r.json()); }).catch(e => setErr(String(e)));
  }, []);
  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 560, margin: "4rem auto", lineHeight: 1.5 }}>
      <h1>passing-app</h1>
      <p>Gate engine passing fixture</p>
      {me ? <p>Hello, <b>{me.name || me.upn}</b>. You are signed in as {me.upn}.</p>
        : err ? <p style={{ color: "#b42318" }}>Could not read identity: {err}</p>
        : <p>Loading…</p>}
      <p style={{ color: "#666", fontSize: 13 }}>Sign-in is the platform's job. This page only asks who you are.</p>
    </main>
  );
}
