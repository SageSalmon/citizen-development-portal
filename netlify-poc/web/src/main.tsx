import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { identity } from "./identity";

function Login() {
  const user = identity.currentUser();
  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 520, margin: "4rem auto", lineHeight: 1.5 }}>
      <h1>netlify-poc</h1>
      <p>Public page. Anyone can see this. Everything under <code>/app/</code> and the data APIs need a signed-in member.</p>
      {user ? (
        <p>Signed in as <b>{user.email}</b>. <a href="/app/">Open the app</a> · <button onClick={() => identity.logout()}>Sign out</button></p>
      ) : (
        <button onClick={() => identity.open("login")}>Sign in with Netlify Identity</button>
      )}
      <p style={{ color: "#666", fontSize: 13 }}>
        Test: with no login, <a href="/app/">/app/</a> must bounce you back here and <a href="/api/fabric">/api/fabric</a> must return 401.
      </p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Login /></StrictMode>);
