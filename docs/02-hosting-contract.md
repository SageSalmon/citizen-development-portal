# 02 — Hosting contract

The contract is the whole design. If an app meets it, the platform hosts it with no
app-specific work. If the platform provides everything listed, the developer never
needs to know what is underneath.

**Decided 2026-09-16 (D30, supersedes D1):** the runtime unit is *one Azure Functions
app per citizen app, on the Flex Consumption plan*, fronted by the platform's built-in
Entra sign-in. Apps are TypeScript and React (see [01-vision.md](01-vision.md)); the
server half runs as Functions handlers on Node 24. The earlier container design (D1) is
recorded in [04-decisions.md](04-decisions.md); the contract below is the Functions one.

**Status 2026-09-16.** Built and exercised locally: the template, the gate engine, the
reusable workflow, the Terraform. Not yet proven: a deploy through the pipeline to a
running, signed-in app. [12-known-gaps.md](12-known-gaps.md) lists what is aspirational.

## What the platform provides

| Concern | Platform behaviour |
|---------|--------------------|
| Build | On every push, the platform's reusable workflow installs with `npm ci --ignore-scripts`, runs the gate rules, tests, builds `web/` with Vite and `server/` with `tsc`, and zips the result with production dependencies only. **Built.** |
| Run | Uploads the zip to the app's Function App (Flex Consumption). The Functions host loads `dist/server/index.js`; instances scale from zero per request. **Built; first real deploy pending.** |
| URL and TLS | `https://<function-app-hostname>.azurewebsites.net` with Azure's certificate. **Aspirational:** `https://<app-name>.citizenappjhc.com` under one platform wildcard certificate (D22). No DNS zone exists yet. |
| Sign-in | **Every app is authenticated. There is no public app.** Built-in auth (Easy Auth) enforces Entra sign-in *before* any request reaches the code; anonymous browsers are redirected to sign in. The app registration requires assignment, and only the app's access group and the platform monitoring identity are assigned. No client secret exists: the app's own managed identity is the federated credential. **Built in Terraform; sign-in not yet exercised.** |
| Identity to the app | Forwards the signed-in user's identity as request headers (`X-MS-CLIENT-PRINCIPAL-*`, the Easy Auth convention). The app trusts these headers because only the platform can set them. |
| Configuration | Environment variables from the app's metadata file. **Partly built:** the platform sets `APP_NAME`, `APP_OWNER`, `LOG_LEVEL`; `env:` from app.yaml is not yet copied into app settings. Secrets as vault references: **aspirational**, no Key Vault exists yet (D23). |
| Logs | stdout goes to Application Insights, backed by the platform's Log Analytics workspace. **Built.** Searchable dashboard: aspirational (06). |
| Health | Probes `GET /healthz` inside the environment, and calls it from outside as the platform monitoring identity **every 15 minutes**. Three consecutive misses or errors mark the app down on the dashboard and alert the owner. Never anonymous. |
| Usage | Collects the sign-in events the app logs (below) so the dashboard can show who has used each app and when. |
| Database | **Aspirational.** If `data/` declares one: a PostgreSQL database and role of its own, schema applied at deploy by the platform, runtime access DML-only. See [08-data.md](08-data.md). |
| Fabric | **Aspirational.** If `data/` declares one: a Fabric workspace of its own, items published from the repo at deploy, deterministic data checks run at deploy and on a schedule. The app reads results as the signed-in user. See [09-fabric.md](09-fabric.md). |
| App identity | **Built for `user` mode only, and the on-behalf-of token store is enabled but unused.** Nothing by default. In `user` mode, a per-request token for the signed-in user. In `app` mode, a managed identity with declared roles that are verified to be a subset of the owner's. |
| Cost | Every resource tagged `app=<name>`, `owner=<email>`, `area=<business-area>`, `classification`. **Built.** Flex Consumption bills execution time only; a tiny storage account per app is the only idle cost. |
| Retirement | Deleting the app's infrastructure definition removes everything it created. |

## What an app must do

1. **Be an Azure Functions app.** `host.json` at the repo root (version 2.0, extension
   bundle 4.x, empty route prefix); `package.json` `main` pointing at the compiled server
   entry under `dist/server/`; handlers registered with the `@azure/functions` v4
   programming model at `authLevel: anonymous` because the platform, not a function key,
   authenticates. Node 24. No Dockerfile; there is no container.
2. **Serve `web/` from the app itself.** One catch-all function returns the Vite build
   from `dist/web` with an SPA fallback. No CDN, no storage website, one front door.
3. **Serve the heartbeat, `GET /api/healthz`.** Returns `200` and a small JSON body
   (`status`, `commit`, `startedAt`, and one entry per configured upstream it can or
   cannot reach) when ready to take traffic. No side effects, under one second. The
   server code does not authenticate it; the platform does — see "Heartbeat" below.
   There is no anonymous path to it from outside.
4. **Read all configuration from environment variables.** No config files with
   environment-specific values checked in. `.env` files are for local runs only and are
   gitignored.
5. **Never store a secret in the repo.** The scaffold ships a pre-commit secret scan;
   the platform build rejects known secret patterns.
6. **Trust the platform's identity headers and nothing else** for who the user is. Do
   not implement your own login. Do not accept a user id from a query string or form.
   To call anything on the user's behalf, use the platform-provided user token (see
   "Identity and permissions"); never a credential the app holds.
7. **Log to stdout**, one event per line, as JSON. Every line carries `app`, `ts`,
   `level`, `event`. Plain text lines are accepted but do not reach the dashboard.
8. **Log every authenticated user.** When the server first sees a signed-in principal
   for a session, it logs one `user.signin` event with the user's object id, UPN, and
   display name as the platform's headers present them, plus the app name and the
   first path requested. One event per session, not per request. Functions instances are
   stateless, so the template logs once per user per instance and the dashboard is to
   treat repeats as one session. Never log a token,
   a cookie, or a header value beyond those three identity fields. This is what lets
   the dashboard answer "who has used this app, and when", and it is how an owner
   finds out that someone unexpected is in the access group.
9. **Be stateless between requests.** Local disk is scratch and may vanish on restart.
   Persistent data goes to the database the app declares in `data/`
   ([08-data.md](08-data.md)) or to an approved external service reached with a
   declared secret. Nothing else.
10. **Carry an `app.yaml` at the repo root** — the metadata file, schema below. This is
   the one file the developer edits that the platform reads.
11. **Initialise in under 30 seconds.** The Flex Consumption host times out app
   initialisation at 30 seconds and the limit is not configurable. There is no
   long-lived process to shut down.

## Heartbeat — how the platform checks an app

The platform checks `/healthz` two ways, and neither is anonymous:

1. **After a deploy, from the pipeline.** The deploy job asks for `/api/healthz`
   anonymously and expects to be *refused* (302 or 401): proof that auth is in front and
   the app is serving. **Built.** An authenticated probe that proves a 200 is aspirational
   because the deploy identity holds no token for the app's audience yet
   ([12-known-gaps.md](12-known-gaps.md)). There are no revisions on Flex Consumption, so
   nothing keeps a bad package off traffic; recovery is redeploying the previous package (D30).
2. **From outside, as the platform, every 15 minutes.** A scheduled check in `infra/`
   calls each app's public URL with a token for the app's audience, issued to the
   **platform monitoring identity**. Built-in auth on every app allows that one identity
   in addition to the app's user group. **The identity exists and is assigned to every
   app; the scheduled check that uses it is not built.** Each result — status, latency, body, or the
   error — is written to Log Analytics. This is the check the dashboard and
   availability figures come from, and it proves the whole path — DNS, TLS, ingress,
   auth, function host — not just the process.

   Health state is derived from the last few results, so a single blip does not page
   anyone:

   | State | Meaning |
   |-------|---------|
   | Healthy | Last check returned 200 with a well-formed body. |
   | Degraded | One or two consecutive misses or non-200s, or a 200 reporting an unreachable upstream. Shown on the dashboard; no alert yet. |
   | Down | Three consecutive misses or errors (about 45 minutes). Dashboard red; owner and platform team alerted. |
   | Unknown | Admitted but never successfully checked, or scaled to zero and the wake-up exceeded the check timeout (D16). |

An unauthenticated request to `/healthz` from the internet gets the login redirect like
any other path. The app never needs to know which caller it is; the server code just
answers.

## Identity and permissions — the app cannot outrank its owner

**Principle.** *An app can do nothing its owner cannot do.* Deploying an app must never
be a way for a person to reach data or actions they could not reach themselves.

The default citizen app identity holds **nothing**: it can read its own secrets from
Key Vault and write logs. Everything beyond that is declared in `app.yaml` and checked.

### Mode `user` (default) — the app acts as the signed-in user

The platform's built-in auth holds a token for the signed-in user and makes it
available to the server through the token store. The server exchanges it on-behalf-of
for the downstream API it needs, with the `delegated_scopes` the app declared. The
downstream resource — SharePoint, a Graph endpoint, an internal API — authorizes the
*user*, not the app. The app has no standing access to any data at all; when nobody is
signed in, it can reach nothing. This is the ref-arch-agent pattern: authorization at
the resource, never in the app, never in the prompt.

For most citizen apps this is the whole answer. A dashboard over a SharePoint list the
team already uses needs no roles anywhere.

### Mode `app` — the app has a standing identity, capped at the owner

Some apps must act when no user is present (a scheduled refresh) or against a resource
that has no user-level concept. Those get a user-assigned managed identity with exactly
the `roles` declared, and **every declared role must be one the owner already holds at
that scope or narrower**. The platform verifies this:

- **At admission (Gate 1):** the owner's effective role assignments are read; the
  requested set must be a subset. Otherwise the app is rejected with the specific
  role named.
- **Continuously (Gate 4):** monthly, and whenever a deployment happens, the check
  reruns. If the owner has lost a permission, the app loses it the same day. If the
  owner leaves, the app's roles are removed with the owner's retirement clock.
- **Never grantable, regardless of what the owner holds:** anything that can create
  or change role assignments (Owner, User Access Administrator, Role Based Access
  Control Administrator, any custom role with `Microsoft.Authorization/*/write`),
  any Entra directory role, any Graph *application* permission, Key Vault access to
  another app's secrets. These are the elevation primitives; the platform does not
  delegate them at any price.
- **Scope ceiling:** resource or resource-group scope only. Never subscription or
  management group.

### Who may deploy

A deployment is an act by a person, and the platform records which one. Pushes to main
by anyone other than the `owner` or a listed `maintainer` build but do not deploy
(Gate 2). Maintainers are verified as enabled Entra users at admission, and the same
"subset of the owner" rule holds: a maintainer can never cause the app to gain a role
the owner lacks, because roles are declared in `app.yaml` and checked against the
owner, not against whoever pushed.

### What the platform's own identities can do

The deploy identity that the reusable workflow uses can push an image to the registry
and upload a package to the function app (Website Contributor, which also reaches app settings; a narrower custom role is ○). It **cannot** create role
assignments, change built-in auth configuration, or touch Key Vault policy. Those are
Terraform's, run by the platform team from `infra/`. So even a fully compromised app
repo and workflow can ship a bad image (which the gates scan) but cannot widen what
the app is allowed to do.

## Dependencies — the supply-chain rules

This is the part of the contract that exists because the apps are JavaScript. Every
rule is checked by the scaffold's `check` and again by the platform build.

| Rule | Why |
|------|-----|
| **Lockfile committed**, install runs in locked mode (`npm ci`). | The build installs exactly what the developer tested. No drift. |
| **Exact versions** in `package.json`; no `^` or `~` ranges. | A range is a promise to install code nobody has reviewed. |
| **Install scripts disabled** (`ignore-scripts=true` in `.npmrc`). | Post-install scripts are the primary execution vector in registry compromises. Anything that needs one is not allowed on the playground. |
| **Minimum release age** for any new version (D8: 7 days recommended). | Compromised releases are usually pulled within days. Waiting is the cheapest defence there is. |
| **Dependency budget.** A template ships with a small direct-dependency list; `check` warns above 15 direct dependencies and fails above 25. | Size is the risk. The number is a forcing function for the conversation "do you really need this?" |
| **Allow-list of known-good packages** maintained in this repo. Anything outside it is a `check` warning that a reviewer must acknowledge. | Most apps need the same twenty packages. Concentrating review there pays off. |
| **Audit gate.** `npm audit` (or an OSV scan) with no high or critical findings at build. | The floor, not the ceiling. |
| **Provenance where available.** Prefer packages that publish npm provenance attestations; `check` reports which direct dependencies do not. *(Aspirational.)* | Ties the tarball to a public build. |
| **SBOM generated at build** and stored with the deployment. *(Aspirational.)* | So a future advisory can be answered with a query, not an archaeology project. |
| **No dependencies fetched at runtime.** The deployed package is complete at build time (production `node_modules` are zipped with it); no CDN script tags, no `npx` in the start command. | The running app must be exactly what was scanned. |

Renovate or Dependabot is configured in every generated repo, grouped weekly, so
pinned versions do not mean frozen versions. *(The template ships `renovate.json`;
enabling Renovate on the organisation is not done.)*

**What the minimum release age did on day one.** The template's first pins were all the
latest releases, under seven days old, and the platform's own check refused the template.
The template now pins each dependency to its newest release at least seven days old.
That is the rule working as designed, and it means "latest" is never the default here.

## `app.yaml` — the metadata file

```yaml
# Identity of the app. Required.
name: expense-tracker          # lowercase, hyphens, <= 32 chars; becomes
                               #   https://expense-tracker.citizenappjhc.com (aspirational, D22;
                               #   today: <function-app-hostname>.azurewebsites.net)
owner: someone@example.org     # a person, not a team alias; accountable for the app
maintainers: []                # people who may also deploy; each verified at admission
area: finance                  # business area, for cost reporting
description: One line for the portal listing.

# Who may sign in. Required. An Entra group the owner controls.
access:
  group: app-expense-tracker-users

# Data classification. Required. Drives review, not enforcement (yet).
data:
  classification: internal     # public | internal | confidential | regulated
  # What the app persists to is declared in data/config.yaml, not here (08-data.md).

# What the app itself may do. See "Identity and permissions".
identity:
  mode: user                   # user (default): the app acts as the signed-in user
                               # app:  the app has its own standing identity, below
  roles: []                    # app mode only. Each entry: {role, scope}. Every one must
                               #   already be held by the owner, and is re-verified.
  delegated_scopes: []         # user mode: Graph/API scopes to request on the user's
                               #   behalf, e.g. Sites.Read.All. Consent is the user's.

# Runtime. Optional; defaults shown.
runtime:
  node: 24                     # Functions runtime version: 22 | 24

# Non-secret configuration, passed as environment variables.
env:
  LOG_LEVEL: info

# Secrets, by vault name. The platform resolves; the app sees an env var. (Aspirational, D23.)
secrets:
  SHEETS_API_KEY: kv/expense-tracker-sheets-key

# Interim (D15): GitHub logins allowed to deploy. Pushes by anyone else build but do not deploy.
github:
  deployers: [some-login]
```

The schema is versioned. Validation runs in the scaffold (`npm run check`)
and again in the platform build, with the same rules, so a developer
never learns about a problem only after pushing.

## What the platform is *not* responsible for

- Correctness or quality of the app's code.
- Authorization *inside* the app (who can see which record). The platform proves who
  the user is; the app decides what they may do. For anything beyond "everyone in the
  group sees everything", the app owner needs a design conversation first.
- Data retention, backups, or recovery of anything the app stores in an approved
  service. Those services carry their own terms.

## Deliberately deferred

- Per-app custom domains other than the platform's (D22, not yet built). One suffix, one
  certificate, one DNS zone is the point.
- Background jobs and schedules (a natural second runtime unit; not in v1).
- Apps that call other hosted apps (service-to-service identity).
- Anything beyond one function app: extra services, queues, databases owned by the app.
