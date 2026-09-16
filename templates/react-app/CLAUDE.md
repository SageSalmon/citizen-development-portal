# __APP_NAME__ — context for Claude

This is a **citizen app on the playground**. The hosting contract is enforced by the
platform; these are the rules that bite. Full text lives in the platform repo
(SageSalmon/citizen-development-portal, docs/02-hosting-contract.md).

- **Never implement login.** The platform's Entra sign-in runs before any request reaches
  this code. Read who the user is from `server/identity.ts` and nothing else.
- **Never store or read a secret in the repo.** Config comes from env; secrets are vault
  references declared in `app.yaml` `secrets:`.
- **Dependencies:** exact versions only, `ignore-scripts=true`, stay under 15 direct
  dependencies, prefer the allow-list. `npm run check` tells you before the platform does.
- **Logging:** use `server/log.ts`. One JSON line per event with `app, ts, level, event`.
  Emit exactly one `user.signin` per session (already done in `server/handlers/me.ts`).
- **Routes:** `/api/healthz` must stay. It is how the platform knows the app is alive.
- **Where code runs:** `web/` in the browser, `server/` on Azure Functions. Anything that
  needs a secret or the user's token belongs in `server/`.
- **Local dev:** `npm run dev`. There is no Functions host locally; `server/local.ts`
  runs the same handlers on node:http with a fake identity from `.env`.
- **Deploy:** push to `main`. Do not edit `.github/workflows/deploy.yml`; a changed
  workflow cannot deploy.
