# netlify-poc

A proof of concept, built 2026-09-11, to test whether Netlify's **Free plan** can host a
citizen-style app the way the playground design (this repo, `docs/`) describes, and to
check the claims in `docs/10-netlify-comparison.md` against a running system instead of
documentation. It is a comparison artifact, not part of the platform.

It is one small React app with four functions:

| Route | What it proves |
|-------|----------------|
| `/` | Landing page; reachable only after Netlify's SSO team login |
| `/app/` | The panels; same protection |
| `GET /api/healthz` | Heartbeat shape from the design's contract (status, commit, startedAt, upstreams) |
| `GET /api/me` | Reports what the platform told the app about the user: on this team, nothing |
| `GET /api/db` | Netlify DB (Neon Postgres) read/write with the injected connection string |
| `GET /api/fabric` | Reads a Fabric SQL analytics endpoint over TDS with a **service principal secret held in env vars** |

**Deployed 2026-09-17** into the LT-POC Enterprise team as `citizen-poc-netlify`, from a
laptop with `netlify deploy --prod`. Netlify Identity was removed the same day: the team's
SSO team login already gates every site, and no Identity instance exists here. Record what
you observe in [docs/findings.md](docs/findings.md).

## Prerequisites

- Node 22 or later, npm, `git`, `gh` signed in.
- `npm audit` reports high findings inside `netlify-cli` (an image-processing dependency of its dev server). They are dev-tooling only and do not ship to the site. Recorded here so nobody is surprised.
- A Netlify account. Free plan, no card. <https://app.netlify.com/signup>
- For `/api/fabric` only: a Fabric workspace you can add a service principal to, and rights
  to create an Entra app registration.

## 1. Local

```bash
npm ci
npm run check      # tsc
npm test           # vitest: healthz shape
npm run build      # vite -> dist/
```

`npm run dev` runs `netlify dev` (Vite plus functions at `/api/*`). Identity and Netlify DB
only work locally once the project is linked to a Netlify site (step 2), because both are
site-scoped services.

## 2. Create and link the Netlify site

```bash
npx netlify login
npx netlify sites:create --name netlify-poc-<yourname>    # or: npx netlify init --manual
npx netlify link                                          # writes .netlify/state.json (gitignored)
```

Then in the Netlify UI for the new project:

1. **Identity.** Project configuration → Identity → **Enable Identity**. Under Registration
   choose **Invite only**. Invite yourself by email. Accepting the invite fires
   `netlify/functions/identity-signup.mts`, which grants the `member` role.
2. **Stop Netlify's own builds.** Project configuration → Build & deploy → Continuous
   deployment → Build settings → **Stop builds**. Without this, any push to the repo (once
   connected) deploys directly and the two-job pipeline is decorative. If you created the
   site with `sites:create` it has no linked repo and this step is already true.
3. **Environment variables** for the app name:

```bash
npx netlify env:set APP_NAME netlify-poc
```

## 3. Netlify DB

```bash
npx netlify database init     # interactive: choose "direct SQL", skip Drizzle
```

This provisions a Neon Postgres database for the site and injects `NETLIFY_DATABASE_URL`.
Free plan limits per the docs on 2026-09-11: 5 GB, 3 databases. Storage is free until
2026-07-01 pricing is announced; compute and bandwidth consume credits.

## 4. Fabric read (optional, but it is the interesting part)

1. **App registration.** Entra → App registrations → New. Note the tenant ID and client ID.
   Certificates & secrets → New client secret. Note the value.
2. **Fabric tenant setting.** Fabric admin portal → Tenant settings → Developer settings →
   **Service principals can use Fabric APIs** → enabled (for a security group containing
   the SP, or the whole org). This needs a Fabric admin.
3. **Workspace access.** Open the workspace → Manage access → add the app registration as
   **Viewer**.
4. **Connection string.** Open the Lakehouse's SQL analytics endpoint (or a Warehouse) →
   Settings → SQL endpoint → copy the **SQL connection string**. It looks like
   `<id>.datawarehouse.fabric.microsoft.com`. The **database name** is the item's name.
5. Set the variables (values never go in the repo):

```bash
npx netlify env:set FABRIC_SQL_ENDPOINT "<id>.datawarehouse.fabric.microsoft.com"
npx netlify env:set FABRIC_DATABASE "<lakehouse or warehouse name>"
npx netlify env:set FABRIC_TABLE "dbo.<table>"
npx netlify env:set AZURE_TENANT_ID "<guid>"
npx netlify env:set AZURE_CLIENT_ID "<guid>"
npx netlify env:set AZURE_CLIENT_SECRET "<secret>" --secret
```

Observe, while doing this, who chose what the app can read and who would notice if the
person who created the secret left. That is the finding.

## 5. GitHub and the pipeline

**Note, 2026-09-16:** this folder now lives inside the platform repo, so its
`.github/workflows/deploy.yml` is inert (GitHub runs workflows only from a repo's root). To
demo the two-job pipeline, either give the POC its own repo again (`git subtree split` or a
copy) or add a root-level workflow in the platform repo scoped with `paths: [netlify-poc/**]`.
Direct deploys from a laptop (step 2) work regardless.

```bash
gh repo create <org-or-user>/netlify-poc --private --source=. --push
gh secret set NETLIFY_SITE_ID --body "$(jq -r .siteId .netlify/state.json)"   # written by `netlify link`
gh secret set NETLIFY_AUTH_TOKEN   # paste a token from Netlify: User settings → Applications → Personal access tokens
```

Create a `production` environment in the repo settings if you want an approval step on
job B. Push to `main`; the `build-and-deploy` workflow runs. Job A never sees the token.

## 6. What to test, in order

1. Open the site root anonymously. Then open `/app/`. Expect a redirect back to `/`.
2. `curl -i https://<site>/api/fabric` anonymously. Expect **401** from the edge rule.
3. Sign in with the invited account. Open `/app/`. All four panels should load.
4. Look at the function logs in the Netlify UI. Expect JSON lines with `user.signin`.
5. Push a commit that breaks `/api/healthz` (return 500). Watch whether anything stops it
   reaching production. Nothing will; that is the rollout-safety finding.
6. Rotate the Fabric client secret in Entra. The app breaks until someone updates the env
   var. Nothing tells the owner. Record how you found out.
7. Remove the SP from the Fabric workspace. Same observation.
8. Netlify UI → Usage & billing. Try to find this site's cost separately from the team's.

## What this deliberately does not try

- Okta or Entra as the JWT issuer for edge role redirects. That is Enterprise-only
  (external JWT providers). Netlify Identity is the Free-plan stand-in and is a separate
  user store from Entra by design.
- Log drains to Azure Monitor. Enterprise-only.
- Per-team billing through an Organization. Enterprise-only.

## Layout

```
web/                    React, two entry pages (/ public, /app/ protected)
netlify/functions/      healthz, me, db, fabric, identity-signup
netlify/shared/         env, log (JSON lines), identity (bearer verification)
tests/                  vitest
netlify.toml            build, functions, edge Role= redirects
.github/workflows/      two-job build-and-deploy
docs/findings.md        fill in as you test
```
