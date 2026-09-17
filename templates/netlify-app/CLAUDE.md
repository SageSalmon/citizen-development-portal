# __APP_NAME__ — context for Claude

A citizen-style app hosted on **Netlify** (team `__NETLIFY_TEAM__`), built from the
playground's `netlify-app` template for comparison with the custom playground.

- **Do not implement login.** The Netlify team's protection is the door. There is no user
  identity available to the code; `/api/me` reports that truthfully. Do not fake one.
- **Keep `/api/healthz` and `/api/me`.** They are the comparison points.
- **Functions:** `netlify/functions/*.mts`, default export `(req: Request) => Response`,
  `export const config = { path: "/api/..." }`. Log with `netlify/shared/log.mts`.
- **Secrets:** only as Netlify environment variables (`npx netlify env:set X --secret`).
  Never in the repo. When adding one, state where it now lives; it is the point of the comparison.
- **Dependencies:** exact versions, `ignore-scripts=true`. There is no gate enforcing this
  on Netlify; it is convention only.
- **Deploy:** `npm run deploy` from a laptop, or the `citizen-app-deploy-netlify` skill.
