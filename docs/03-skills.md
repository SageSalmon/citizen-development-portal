# 03 — The skills

Two Claude Code skills in this repo, under `.claude/skills/`. How they reach a citizen
developer's machine is an open issue (D19); they are written to run from anywhere.
Names per D5:

| Skill | Verb | What the developer says |
|-------|------|-------------------------|
| `new-citizen-app` | **Build.** Create a conforming project *and its GitHub repo*, ready to run locally. | "new app", "start an app", "make me a dashboard for…" |
| `deploy-citizen-app` | **Deploy.** Get the current state of the app onto the playground, and explain what happened in plain language. | "deploy", "ship it", "put this on the playground", "why did my deploy fail" |

They are separate because they are used at different moments by the same person, and
because deploy is the one that talks to the platform and needs the most careful
explanation when something is refused.

## GitHub is part of the skill, not a prerequisite

**Decided 2026-09-03: every app lives in its own GitHub repository, in the playground's
GitHub organization, and the skill creates it.** Most citizen developers will not know
what a repository, a branch, a commit, or a pull request is, and they should not have to.
The skills use `git` and `gh` on the developer's behalf and speak in the developer's
terms:

| What the skill does | What the developer hears |
|---------------------|--------------------------|
| `git init`, first commit, `gh repo create <org>/<name> --private`, push | "Your app is saved and backed up. It has a home at github.com/<org>/<name>." |
| Commit and push to `main` | "Saving your changes and sending them to the playground." |
| Open the admission PR to this repo (`infra/apps/<name>.tf` from `app.yaml`) | "Asking the platform team to admit your app. They will confirm the owner and access group." |
| Poll the workflow run; read gate results | "The playground checked your app. Two things need fixing before it can run: …" |
| A gate rule's developer message | Shown verbatim; every rule in `infra/gates/rules/` is written for this reader. |

The one thing the developer must have is a GitHub account in the organization and a
signed-in `gh`. The build skill checks for both first, and if either is missing, walks
through `gh auth login` step by step and stops there until it is done. No other GitHub
concept is required to use the playground.

Both skills are safe to run repeatedly. `new-citizen-app` refuses to touch an existing
directory or repo; `deploy-citizen-app` is idempotent — running it with nothing changed
reports the current state and stops.

**Status 2026-09-16.** Both skills exist in `.claude/skills/` of this repo and are
exercised from a checkout of it. `new-citizen-app` runs `scripts/new-citizen-app.mjs`,
which is built and tested. `deploy-citizen-app` is procedural instructions over `gh`; the
admission step is a manual operator action, not a PR the skill opens. D19 (how developers
get the skills without this repo) is open.

## `new-citizen-app` — build

A citizen developer, or Claude working with one, says "new app" and gets a directory
that:

- runs locally with one command,
- passes the contract check with one command,
- is already in GitHub, with the one-line deploy workflow in place,
- and contains nothing the developer must understand before editing app code.

The skill is the *developer* half of the design. The hosting infrastructure in `infra/`
is the *platform* half. The skill must work against the contract, not against knowledge
of how the platform is built, so that the platform can change underneath it.

**Everything the skill generates is advisory.** A developer can edit or delete any of
it. The rules only have force at the platform gates
([05-platform-gates.md](05-platform-gates.md)). The point of the skill is that a
developer who keeps what it generated never meets a gate failure for the first time in
CI.

### Procedure

1. Check prerequisites: Node 24+, `git`, `gh` signed in to a member of the `SageSalmon`
   organization (D31). No Docker: there is no container (D30). Fix or stop; never proceed
   half-ready.
2. Gather inputs (below). Detect everything detectable; ask the rest once.
3. Create the directory and fill the template.
4. `npm ci`, then `npm run check`. If the generated project does not pass its own
   check, the skill has a bug; report it, do not hand the project over.
5. `git init`, commit, `gh repo create SageSalmon/<name> --private`, push (D32: at
   scaffold). Set the repo's OIDC subject template to include `job_workflow_ref` (07,
   detail 1). Branch protection (D20): not done.
6. Report: where the app is, the three commands, and that "deploy" is the next word.

## Inputs the skill gathers

Asked once, up front. Anything with an obvious default is not asked.

| Input | How gathered | Default |
|-------|--------------|---------|
| App name | Ask | — (validated against the `app.yaml` rules) |
| Identity mode | Ask, one line each: "acts as the signed-in user" (default) or "needs its own identity, capped at yours" | `user` |
| Needs a database? | *(Aspirational, 08.)* Ask yes/no; if yes, `postgres` on the shared server unless classification is confidential | `none` |
| Needs Fabric? | *(Aspirational, 09.)* Ask yes/no, described as "analytics, ML, or data checks on data already in Fabric"; if yes, `fabric:` in `data/config.yaml` and an empty `data/fabric/` with the README ([09-fabric.md](09-fabric.md)) | no |
| Template | Only `react-app` exists; `react-fullstack` is planned | `react-app` |
| Owner email | Detect from git config; confirm | current git user |
| Business area | Ask | — |
| Data classification | Ask, with the three accepted options explained in one line each; `regulated` is refused (D7) | `internal` |
| GitHub login allowed to deploy | detect: the signed-in `gh` user (interim D15) | current `gh` user |
| Target directory | Ask only if not obvious | sibling of the current repo, named after the app |

## Templates (D2)

**Decided 2026-09-03, amended 2026-09-16 (D30):** TypeScript and React; the server half
is Azure Functions handlers on Node 24. Two templates were planned; one is built.

| Template | For | Direct deps (target) |
|----------|-----|----------------------|
| `react-app` | A front end that talks only to the platform (identity) and, later, to external APIs via handlers that inject secrets. **Default. Built.** | **9:** react, react-dom, @azure/functions; vite, @vitejs/plugin-react, typescript, and three type packages. Tests use `node --test`, no test framework. |
| `react-fullstack` | Same, plus a real API layer: typed routes, request validation, business logic that must not run in the browser. **Not built.** | react-app plus zod. |

The front end is **Vite**. The server is **plain `@azure/functions` v4 handlers**, no web
framework: Hono was the plan under D1, but on Functions it would need a third-party
adapter, which is an off-list dependency for no gain. The server's job is small: serve
the built static assets from one catch-all function, expose `/api/healthz`, expose
`/api/me` (the identity headers as JSON) and log the sign-in there, and later proxy calls
that need a secret. Browser code never sees a secret.

**Local development without the Functions host.** `server/local.ts` runs the same handler
functions on `node:http`, using the real `HttpRequest` and `InvocationContext` classes
from `@azure/functions`, with a fake signed-in user from `.env`. Node 24 strips TypeScript
types natively, so `npm run dev` needs no Docker, no Core Tools, and no extra dependency.
What differs from the platform is deliberate and listed in the template README: no Entra
in front, no scale-to-zero, no `host.json` routing.

**What the templates deliberately do not include:** a UI component library, a state
management library, a CSS framework, an ORM. Each is a real dependency-tree decision
the developer makes knowingly, and the allow-list tells them which ones are pre-approved.

**Python and other languages** are not templates and not planned. See
[01-vision.md](01-vision.md) for the reasoning.

## The file structure comes first

The first thing the skill produces, before any template code, is the *shape* of a
playground app. Two top-level folders separate what runs in the browser from what runs
on Azure Functions, because the security rules for the two are different and a developer
should never wonder which side a file is on:

| Folder | What it is | Rules that apply |
|--------|------------|------------------|
| `web/` | Everything the browser downloads and runs: React, TypeScript, styles, static assets. Built by Vite into static files. | Never sees a secret. Never talks to a downstream API directly; it calls `server/`. Trusts nothing about who the user is except what `/me` says. |
| `server/` | Everything that runs on Azure Functions: the handlers that serve `web/`'s build output, answer `/api/healthz` and `/api/me`, log each signed-in user, and will hold every call that needs a secret or the user's token. | Reads config from env. Emits the `user.signin` event. Will hold the on-behalf-of exchange and Key Vault-sourced values (aspirational). |

Why these names and not `frontend/` and `backend/`, or `client/` and `api/`:
"frontend/backend" is a role, not a place, and citizen developers do not reliably agree
where the line is. "api" undersells `server/`, which also serves the static build and
the heartbeat. `web/` and `server/` name *where the code runs*, which is exactly the
line the security rules follow. Alternatives are a one-line change in the templates if
we want them.

Shared TypeScript types (the shape of `/me`, of API responses) live in `server/` and are
imported by `web/` at build time, so there is one definition and the browser bundle
never pulls server code.

## What every generated project contains

```
<app-name>/
  app.yaml               # the metadata file, filled from the inputs
  package.json           # exact versions only; scripts: dev, check, build, deploy
  package-lock.json      # committed
  .npmrc                 # ignore-scripts=true, save-exact=true, audit level
  .nvmrc                 # Node major, matching runtime.node in app.yaml (24)
  tsconfig.json          # strict
  host.json              # Functions host: v2.0, extension bundle 4.x, empty route prefix
  .gitignore             # includes .env
  .env.example           # every env var the app reads, with placeholder values
  README.md              # how to run, check, deploy — written for the developer, short
  CLAUDE.md              # project context for future Claude sessions: the contract
                         #   rules in one screen, what not to do (own login, secrets,
                         #   adding a dependency without checking the allow-list)
  data/                  # NOT GENERATED YET (08, 09 are aspirational)
  web/                   # browser: Vite + React; a page that greets the signed-in user
  server/                # Azure Functions: handlers that serve web/'s build, /api/healthz,
    index.ts             #   /api/me; registrations with @azure/functions (authLevel anonymous)
    handlers/            #   healthz.ts, me.ts, static-site.ts
    identity.ts          #   reads the platform headers -> typed principal; nothing else may
    signin-log.ts        #   emits one user.signin JSON event per user per instance (rule 8)
    log.ts               #   the JSON logger every other file uses; no console.log elsewhere
    static.ts            #   serves dist/web with an SPA fallback, never leaves that directory
    local.ts             #   local dev server: same handlers on node:http, fake identity
    tsconfig.json        #   compiles to dist/server (the Functions host loads dist/server/index.js)
  tests/                 # /api/healthz body shape; /api/me 401 without headers; /api/me
                         #   with fake identity headers emits exactly one user.signin with
                         #   only the permitted identity fields  (node --test, no framework)
  scripts/
    check.mjs, lib/, rules/, platform.json, allowlist.json   # vendored copy of infra/gates
    dev.mjs              # `npm run dev`: API on :7071 + Vite on :5173
  renovate.json          # weekly grouped updates, minimum release age (D8); org not yet enabled
  .github/workflows/deploy.yml   # (D3) ONE job that `uses:` the platform's reusable workflow
```

The `CLAUDE.md` matters as much as the code. Future sessions in the generated repo
should know the contract without reading these docs.

## The developer's three commands

Every README documents exactly these three:

| Command | Does |
|---------|------|
| `npm run dev` | Runs server and Vite dev server locally on `$PORT` with fake identity headers so the app behaves as if signed in. Apps with data get a local PGlite database with migrations applied. |
| `npm run check` | Type-check, lint, tests, and the contract validation including the dependency and migration rules. Same rules the platform build uses. |
| `npm run db:generate` | (apps with data) Turn a change to `data/schema.ts` into a new numbered SQL migration. |
| `npm run deploy` | *(v1: prints what the platform will do on push. Later: triggers it.)* |

Local runs must simulate the platform's identity headers, otherwise developers write
code paths for "no user" that never occur in hosting.

## `deploy-citizen-app` — deploy

Everything between "my code works locally" and "my colleagues can open it". The
developer never sees a workflow log; they see what the platform decided and why.

### Procedure

1. Confirm the directory is a playground app (has `app.yaml`, has the deploy workflow,
   remote is in the organization). If not, say what it is missing and stop.
2. Run `npm run check` locally. If it fails, show the messages and stop — the platform
   would refuse anyway, and the local message is the same text, seconds instead of
   minutes.
3. **If the app is not yet admitted** (no `infra/apps/<name>.tf` in the platform repo):
   open the admission PR from `app.yaml`, tell the developer that a person on the
   platform team will review it, and stop. Subsequent runs report "waiting for admission"
   until it merges (Gate 1).
4. Commit any uncommitted work with a message the developer approves, push to `main`.
5. Follow the workflow run. Translate each gate result. On refusal, list what to fix and
   stop. On success, report the URL, that it is behind sign-in for the app's group, and
   the current health state.
6. Idempotent: with nothing to push and nothing pending, report the live URL, health,
   last deploy time, and stop.
7. **Pull from workspace** (apps with `fabric:`), on request: sign the developer in to
   Fabric as themselves with a device code, list the workspace's items, export the ones
   they choose into `data/fabric/items/`, show the file changes, and continue at step 4.
   This is the only direction a workspace change reaches the repo, and it is always the
   developer's own action ([09-fabric.md](09-fabric.md), "The developer loop").

### What it never does

- Change `app.yaml`'s `owner`, `identity`, or `access` on the developer's behalf. Those
  edits are deliberate and go through admission again.
- Bypass a refusal. There is no `--force`. If a gate says no, the answer is in the
  message.
- Run Terraform or touch Azure directly. It pushes to GitHub; the platform does the rest.
- Publish anything to a Fabric workspace. Pull is the developer's; publish is the
  platform's, in the deploy job.

## What the skills must not do

- Ask for anything infrastructure-shaped (subscription, resource group, region). Those
  belong to the platform, not the app.
- Offer to add a role, a Graph application permission, or a Key Vault reference outside
  the app's own secrets. The skill knows the never-grantable list and says so.
- Offer an unauthenticated app, page, or path. There is no such thing on the playground.
  A request for "a public page" is answered by explaining that the login page is the
  only anonymous surface and that the access group can be as wide as "all staff".
- Generate a project that "works" only after the developer fills in TODOs.
- Embed knowledge of how the platform is built. If the skill needs to know a
  resource name, the contract is leaking.
- Touch any existing directory. It creates new ones only.
- Ask the developer to run a `git` or `gh` command, or to open github.com, to get
  something done. If the skill cannot do it for them, that is a gap to fix in the skill.

## How the skills are built

- Each skill's `SKILL.md` carries its procedure above and the developer-facing phrasing.
  Both share `_common/` for prerequisite checks and the gate-message translation.
- Templates live beside it in `templates/<template-name>/` as real files with a small
  set of `{{placeholders}}`, so they can be tested as projects in their own right.
- The contract validation (`scripts/check.mjs`) is a *vendored copy* of
  `infra/gates/check.mjs`, so a rule change is made once, in the platform's copy, and
  the skill picks it up. It uses only Node built-ins so that the checker itself adds no
  dependencies.
- The package allow-list (`infra/gates/allowlist.json`) is copied into the generated
  project at scaffold time; the platform copy is authoritative at build.
- The generated `.github/workflows/deploy.yml` is a one-line call to the platform's
  reusable workflow. It contains no logic to edit.
- The build skill's own test: generate every template into a scratch directory, run
  each one's `check`, build each, hit `/api/healthz` on the local server. **Today:** done by hand (`node --test infra/gates/tests/*.test.mjs`, then scaffold + `npm test` + `npm run build`); this repo has no CI of its own yet.
- The deploy skill's own test: against a sandbox organization, admit a generated app,
  push a good commit and a bad one, assert the developer-facing messages.

## Verification of the skills (definition of done)

1. Every template generates, builds, and answers `/healthz` locally.
2. Every template shows the fake signed-in user's name on its default page, and emits
   exactly one `user.signin` event for that session, containing no header or token
   values beyond object id, UPN, and display name.
3. `check` fails, with a clear message, on: a bad app name, a missing owner, a
   missing host.json, a secret-looking string in the repo, a workflow pinned to a tag,
   a version range in `package.json`, a missing lockfile, install scripts enabled, a
   high-severity audit finding, and a dependency count over budget.
4. A person who has never seen this repo can go from the skill to a running local app
   without reading anything but the generated README.
5. A person who has never used GitHub can go from "new app" to a live URL on the
   playground using only the two skills and a signed-in `gh`, without being asked to
   run a git command or open github.com.
