---
name: citizen-app-deploy-netlify
description: Deploy a Netlify-hosted citizen-style app from the laptop and explain what happened — check, test, build, netlify deploy --prod, then read the result. Use when someone in a netlify-app project says "deploy", "ship it", "push to netlify", or asks whether the Netlify app is live.
---

# citizen-app-deploy-netlify — deploy on Netlify

The Netlify counterpart of `citizen-app-deploy-custom`, and deliberately shorter, because
there is less between "works locally" and "live": no admission, no gates, no pipeline.
Narrate that.

## Procedure

1. **Is this a netlify-app project?** `netlify.toml` exists, `package.json` has the
   `deploy` script, and `.netlify/state.json` links it to a site. If unlinked, stop:
   `npx netlify link` (interactive) or `citizen-app-new-netlify` to create the site.
2. **Local checks:** `npm run check && npm test && npm run build`. If any fail, show the
   output and stop. **These are advisory.** Nothing on Netlify's side runs them; a developer
   who skips this step deploys anyway. Say so.
3. **Deploy:** `npm run deploy` (`netlify deploy --prod --dir=dist --functions=netlify/functions`).
   Takes one to two minutes. Read the "Production URL" line.
4. **Verify what can be verified:** `curl -s -o /dev/null -w '%{http_code}' https://<name>.netlify.app/api/healthz`.
   On an Enterprise team with team login, expect **401**: the door is closed to anyone
   without a Netlify team session. Open the URL in a browser to see the app.
5. **Report:** the URL, who can open it (whatever the team enforces), that no repo or
   commit is associated with what is running (`/api/healthz` says `commit: unknown`), and
   that the previous deploy can be restored from the Netlify UI's deploy list.

## What it never does

- Change team-level protection (team login, password) on a site in someone else's team.
- Bypass a failing check. There is no gate to bypass; the honest move is to stop and say so.
- Set a credential without saying where it now lives.

## What is real and what is not (2026-09-17)

Real: every command above was run by hand for `citizen-poc-netlify` on 2026-09-17,
three deploys. No script; this is instructions. Nothing verifies who deployed or from what
source; that is the finding, not a gap to close.
