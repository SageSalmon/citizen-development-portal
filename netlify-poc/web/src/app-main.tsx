import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { identity, apiGet } from "./identity";

type Me = { id: string; email: string; roles: string[] };
type Health = { status: string; commit: string; startedAt: string; upstreams: Record<string, string> };
type Db = { visits: number; branch: string };
type Fabric = { endpoint: string; database: string; tables: number; rows: number | null; ms: number };

function Panel({ title, load }: { title: string; load: () => Promise<unknown> }) {
  const [state, setState] = useState<{ ok?: unknown; err?: string }>({});
  useEffect(() => { load().then(ok => setState({ ok })).catch(e => setState({ err: String(e) })); }, []);
  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 6, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
      <h2 style={{ margin: "0 0 .5rem", fontSize: 16 }}>{title}</h2>
      {state.err ? <pre style={{ color: "#b42318", whiteSpace: "pre-wrap" }}>{state.err}</pre>
        : state.ok ? <pre style={{ margin: 0 }}>{JSON.stringify(state.ok, null, 2)}</pre>
        : <em>loading…</em>}
    </section>
  );
}

function App() {
  const user = identity.currentUser();
  if (!user) { window.location.assign("/"); return null; }
  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 720, margin: "3rem auto", lineHeight: 1.5 }}>
      <h1>netlify-poc — app</h1>
      <p>Signed in as <b>{user.email}</b> · <button onClick={() => identity.logout()}>Sign out</button></p>
      <Panel title="GET /api/me — who the function thinks I am (bearer verified server-side)" load={() => apiGet<Me>("/api/me")} />
      <Panel title="GET /api/healthz — heartbeat shape" load={() => apiGet<Health>("/api/healthz")} />
      <Panel title="GET /api/db — Netlify DB (Neon Postgres) visit counter" load={() => apiGet<Db>("/api/db")} />
      <Panel title="GET /api/fabric — Fabric SQL endpoint via service principal held in env vars" load={() => apiGet<Fabric>("/api/fabric")} />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
