import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// The root is reachable only after Netlify's team login; there is nothing to "log in" to
// here any more. It just points at the app.
function Landing() {
  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 560, margin: "4rem auto", lineHeight: 1.5 }}>
      <h1>citizen-poc-netlify</h1>
      <p>You reached this page, so Netlify's team login already let you in through the organisation's identity provider.</p>
      <p><a href="/app/">Open the app</a></p>
      <p style={{ color: "#666", fontSize: 13 }}>Comparison artefact for the citizen playground design. Not a production system.</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Landing /></StrictMode>);
