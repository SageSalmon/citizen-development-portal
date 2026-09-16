# 04 — Open decisions

Each entry: the question, the options, the recommended default, and what it changes.
When a decision is made, record the answer and date here and update the doc it affects.
Nothing here is decided until it says so.

## D1 — Hosting runtime

**Decided 2026-09-03: Azure Container Apps.** Scale to zero, built-in Entra auth,
per-app revisions, cheap when idle. App Service was the alternative (Easy Auth is what
ref-arch-agent uses) but its per-plan cost model punishes many small apps.

**Superseded 2026-09-16 by D30 (Azure Functions Flex Consumption).**

## D2 — Language and templates

**Decided 2026-09-03: TypeScript and React only.** Two templates, `react-app` (default)
and `react-fullstack`. Reasoning in [01-vision.md](01-vision.md). Python is not a
template and is not planned.

**Amended 2026-09-08 by D27.** Python is permitted inside Fabric notebooks, which run in
Fabric's Spark runtime and never in the container or on the platform. The app itself is
unchanged.

## D3 — Where the pipeline lives

**Decided 2026-09-03: central.** The gates must be the platform's, not the developer's
([05-platform-gates.md](05-platform-gates.md)). App repos carry a one-line workflow that
calls a reusable workflow in this repo; the deploy identity's federated credential is
scoped to that reusable workflow, so no other workflow can deploy. Central logic,
local trigger. **Built 2026-09-16** as `.github/workflows/build-and-deploy.yml`; first
end-to-end run pending. Consequence discovered while building: the platform repo must be
**public** (or the app repos need a token to read it), because the reusable workflow
checks out `infra/gates` from this repo with the app repo's default token. The docs
already forbid identifying values in committed files, so public is safe.

## D4 — Approved data stores

**Decided in part 2026-09-03.** Relational data is provided by the platform: PostgreSQL,
declared in the app's `data/` folder, in a shared tier (database + role per app) or a
dedicated tier for apps that qualify. Details in [08-data.md](08-data.md) and D25.

**Decided 2026-09-08 (D26).** A Fabric workspace is the second declared target, for
analytics, ML model construction, and data checks. [09-fabric.md](09-fabric.md).

**Still open.** Anything else non-relational — blob storage, queues, search, Cosmos —
stays a request with a reason. Revisit once three apps have asked for the same thing.

**Affects.** `data/config.yaml`; the contract's statelessness rule.

## D5 — Skill names

**Decided 2026-09-03: two skills**, build and deploy, because they are used at
different moments and deploy carries the platform conversation. Names:
`citizen-app-new-custom` and `citizen-app-deploy-custom`. Unambiguous when several skills are loaded,
and they read as verbs.

## D6 — Tenant and account for the first build-out

**Question.** Build the platform half against the personal training tenant first (as
ref-arch-agent did, because it needs tenant admin for groups and app registrations), or
go straight to the corporate tenant through identity-team requests?

**Decided 2026-09-16: personal tenant (sage-salmon) first**, with every identifying value
in gitignored local files (`docs/environments/dev.md`, `infra/terraform/local.auto.tfvars`,
`envs/dev.backend.hcl`) and `<REPLACE_*>` tokens committed, as ref-arch-agent does. The
operator is Owner on the subscription and Global Administrator in the tenant, so Terraform
creates the Entra objects (app registration, group, federated credentials) that a corporate
identity team would own. The contract and skill are tenant-agnostic; only the platform half moves.

**Added 2026-09-08 (D26).** Fabric needs tenant settings that let service principals use
Fabric APIs and hold workspace roles, and a capacity the platform owns. In the personal
tenant that is a trial capacity and a checkbox; in the corporate tenant it is an
identity-team request that should go in early.

**Affects.** Nothing in the skill. Everything in the not-yet-written platform infra.

## D7 — Data classification gate

**Question.** Is `data.classification: regulated` rejected outright in v1, or accepted
and flagged for review?

**Recommended.** Rejected by `check` in v1 with a message pointing to the review path.
Easier to relax later than to retrofit.

**Affects.** Contract; `check` rules.

## D8 — Minimum release age for dependencies

**Question.** How long must a package version have been published before the playground
accepts it?

**Recommended.** 7 days. Long enough that most compromised releases have been reported
and pulled; short enough not to block security patches unreasonably. Enforced by
Renovate's `minimumReleaseAge` in every generated repo and by `check` comparing the
lockfile against registry publish dates.

**Affects.** Contract "Dependencies"; `renovate.json`; `check`.

## D9 — Server runtime: Node or Deno

**Decided 2026-09-16 by D30: Node 24.** Flex Consumption runs Node 22 or 24; Deno is not
a Functions runtime. Node 24 also strips TypeScript types natively, which is what lets the
template run locally with no build step and no extra dependency.

**Question.** The container needs a small server. Node LTS is the default. Deno offers a
permission model (a dependency cannot read the filesystem or open a socket unless
granted), first-class TypeScript, and a smaller dependency story — all attractive for
the supply-chain goal.

| Option | For | Against |
|--------|-----|---------|
| **Node LTS** *(recommended for v1)* | What developers and tooling expect; Vite and Renovate are native to it; least surprise. | No runtime permission model; the supply-chain controls are all install-time. |
| Deno | Runtime permissions per dependency; `deno.lock` with integrity; built-in lint, fmt, test. | Fewer citizen developers know it; some npm packages behave differently; adds a second thing to learn. |

Hono was chosen for the server precisely so this can be revisited: the same server
code runs on either. Revisit after the first three apps ship.

**Affects.** Dockerfile base image; `package.json` vs `deno.json`; the `check` rules.

## D10 — Package manager

**Question.** npm or pnpm?

**Recommended.** npm for v1. It ships with Node, so there is nothing to install, and
`npm ci` with a committed lockfile and `ignore-scripts` covers the essentials. pnpm's
`minimumReleaseAge` setting is attractive and is the reason to revisit; for now the
same control lives in Renovate (D8).

**Affects.** `.npmrc`; lockfile format; `check` rules.

## D11 — Egress control

**Question.** Should hosted apps be allowed arbitrary outbound internet access?

A compromised dependency's payload almost always needs to call out. Blocking that is the
runtime backstop for every install-time control. But it requires a VNet-integrated
Container Apps environment with a firewall, which is real cost and operational weight,
and citizen apps legitimately call external APIs.

**Recommended.** Defer to v2. In v1, log all egress destinations (Log Analytics) so the
allow-list can be built from observed behaviour rather than guessed. Record this as a
known gap in the rule-to-gate map.

**Affects.** `infra/terraform/environment`; cost; the contract's promise about
dependencies.

## D12 — Grace period after a new critical CVE

**Question.** When a weekly rescan finds a fixable critical in a running app, how long
before the platform deactivates it?

**Recommended.** 14 days, with an issue opened on the app repo on day 0 and a reminder
on day 7. Owners are not on call; two weeks is a fair ask for a `npm update` and a push.

**Affects.** `infra/workflows/rescan.yml`; the owner-facing README in templates.

## D13 — Health dashboard implementation

**Question.** Azure Monitor Workbook, or a custom web app?

**Decided 2026-09-03 in part:** the dashboard is **platform tooling, never a playground
app**, because it needs fleet-wide reader roles that the citizen identity must never
hold. Open: Workbook versus custom app.

| Option | For | Against |
|--------|-----|---------|
| **Workbook** *(recommended for v1)* | All data already in Azure; native RBAC; no code, identity, or hosting to run; a Terraform resource like the rest. | Azure-portal look and feel; owners need portal access to view it. |
| Custom app, platform-hosted | Friendlier for owners; can shape the gate feed and messages. | A privileged component to build, host, and keep patched; a second environment. |

Build the Workbook, run the playground with it, revisit when owners ask for something it
cannot show. See [06-health-dashboard.md](06-health-dashboard.md).

**Affects.** `infra/terraform/environment`; what the workflows log to Log Analytics.

## D14 — Permission ceiling: how "subset of the owner" is computed

**Decided 2026-09-03 in principle:** an app can do nothing its owner cannot do; the
default app identity holds nothing; roles are declared, verified against the owner at
admission, and re-verified continuously; elevation primitives are never grantable.

**Open: the mechanism.** Reading a user's *effective* permissions means combining
direct assignments, group-inherited assignments, and PIM-eligible roles.

| Option | For | Against |
|--------|-----|---------|
| **Direct + group-inherited active assignments, via Resource Graph and Graph API** *(recommended)* | Deterministic, auditable, no PIM dependency. | Ignores PIM-eligible roles: an owner who *could* activate a role does not count as holding it. That is arguably correct. |
| Include PIM-eligible | Matches how admins think about "what I can do". | An app with a standing role the owner only holds transiently is exactly the elevation we are preventing. |

Take the strict reading: active assignments only.

**Affects.** Gate 1 admission check; the monthly re-check; `app.yaml` `identity.roles`.

## D15 — Mapping the GitHub actor to an Entra user

**Interim 2026-09-16.** `app.yaml` carries `github.deployers`, a list of GitHub logins;
the reusable workflow deploys only when `github.actor` is in it. Verifying those logins
against Entra users is not done. The options below remain the real decision.

**Question.** Gate 2 deploys only when the pusher is the owner or a maintainer. The
pusher is a GitHub account; the owner is an Entra user. How are they linked?

| Option | For | Against |
|--------|-----|---------|
| **GitHub Enterprise with Entra SSO / EMU** *(recommended if available)* | The mapping is the identity provider's, not ours. | Requires enterprise plan and admin work on the corporate side. |
| `github` field per person in `app.yaml`, verified at admission by the platform team | Works on any plan. | A human check; a mistaken mapping is a weak point until the SSO option exists. |
| GitHub environment protection with required reviewers = owner | Native to Actions. | Reviewer lists are GitHub users too; same mapping problem, one level down. |

For the personal-tenant prototype (D6) the second option is the only one available.
Record the mapping in `infra/apps/<name>.tf`, not in the app repo, so the developer
cannot edit it.

**Affects.** Gate 2; admission; `infra/apps/`.

## D16 — Heartbeat cadence and thresholds

**Decided 2026-09-03:** every 15 minutes from outside as the platform monitoring
identity; one or two consecutive failures is *degraded* (dashboard only); three is
*down* (dashboard red, owner and platform team alerted).

**Open: scale-to-zero interaction.** An idle app scaled to zero takes several seconds to
wake; the first heartbeat after idling may be slow or time out. Options: a generous
check timeout (30 s) so the wake-up counts as a slow success; `min_replicas: 1` for
apps that opt in, at their cost; or treat a timeout-then-success pair as *healthy*. Take
the generous timeout and record latency so the dashboard shows cold starts honestly.

**Affects.** `infra/workflows/heartbeat.yml`; the health-state derivation; alert rules.

## D17 — Retention of user sign-in events

**Question.** `user.signin` events name real people. How long are they kept, and who
sees them?

**Recommended.** 90 days in Log Analytics, visible to the app's owner and the platform
team only. That is long enough to answer "who used this last quarter" and to notice an
unexpected user, and short enough not to become an HR record. Longer retention for a
specific app is a request, with a reason, not a setting the owner flips.

**Affects.** Log Analytics table retention; dashboard RBAC; the contract's rule 8 text.

## D18 — All apps authenticated, no exceptions

**Decided 2026-09-03.** There is no public app and no anonymous path. The `app.yaml`
schema has no field to turn authentication off, so the question cannot be asked. The
only anonymous surface is the platform login page. An app that wants the widest
audience names an "all staff" group.

## D19 — How citizen developers get the skills

**Open.** Citizen developers never clone this repo, so project-scoped skills here serve
only our own development. How the two skills, the templates, and the vendored gate
engine reach a citizen developer's machine — and stay at the version matching the
platform — is not decided. Options include a Claude Code plugin from this repo (direct
install or a private marketplace), a global skill install script, or a bootstrapping
repo the developer opens once. Nothing in the skills' design depends on the answer;
they are written to run from any location.

**Affects.** Repo packaging; a release process tying skill version to `infra/gates/`.

## D20 — Repo settings the build skill applies

**Question.** Branch protection on `main` (require the check workflow to pass before
merge) is the right default, but GitHub's Free plan does not offer it on private repos —
the same problem ref-arch-agent recorded.

**Recommended.** Apply protection when the plan allows; otherwise record in the repo
that it is absent. The platform gates do not depend on it: Gate 2 runs on every push to
`main` regardless, so an unprotected branch means a developer can push a broken commit
and be refused, not that they can deploy one.

**Affects.** `citizen-app-new-custom` step 5.

## D21 — GitHub organization

**Decided 2026-09-16 (D31): `SageSalmon`** for the platform repo and every citizen app
repo, using the personal GitHub account that is admin of that org. This is the
personal-tenant build-out; a corporate org is a later, separate decision.

**Decided 2026-09-03:** every app is its own private repo in the playground's GitHub
organization, created by the build skill. Admission is a PR to this repo's `infra/apps/`,
opened by the deploy skill. Open: which organization for the prototype (a personal org)
versus the corporate one; and whether developers are added to the org by the platform
team on request or via SSO (D15).

## D22 — Domain and wildcard certificate

**Decided 2026-09-03:** every app is `https://<name>.citizenappjhc.com`, served under
one wildcard certificate for `*.citizenappjhc.com` that the platform holds. Apps never
see certificates or DNS.

**Amended 2026-09-16 (D30).** The mechanism below assumed Container Apps. On Azure Functions
Flex Consumption certificates are *site-scoped*: each app needs its own hostname binding
and certificate, which Terraform can automate but which is more per-app work than one
environment-level suffix. No DNS zone exists yet; apps use `*.azurewebsites.net`. Open.

**Original mechanism (D1 era).** Azure Container Apps supports a *custom DNS suffix on the environment*:
the environment is given the suffix `citizenappjhc.com` and the wildcard certificate,
and every app in it is addressable as `<app>.citizenappjhc.com` with no per-app domain
binding. DNS needs an A record for `*.citizenappjhc.com` to the environment's static IP
and one TXT record (`asuid`) proving ownership. Both live in `infra/terraform/dns/` as an
Azure DNS zone. Built-in auth redirect URIs use the same hostnames; Terraform sets them
per app at admission.

**Open: how the certificate is obtained and renewed.** Container Apps does not issue
managed wildcard certificates; the platform must bring one.

| Option | For | Against |
|--------|-----|---------|
| **ACME (Let's Encrypt) via DNS-01 against Azure DNS, automated, into Key Vault** *(recommended)* | Free; renewal is a scheduled workflow that is tested every 60 days by construction; nothing to remember. | 90-day lifetime means the automation must work; a broken renewal takes every app down at once. Mitigated by the expiry alerts at 21 and 7 days. |
| Purchased wildcard, 1 year, uploaded manually | Familiar to corporate IT; long lifetime. | A yearly manual step that someone forgets; the outage when they do is fleet-wide. |
| Azure App Service Certificate (wildcard) | Azure-native purchase, Key Vault integrated. | Paid; still a yearly renewal, though Azure can auto-renew. Reasonable corporate fallback. |

**Open: who owns the domain.** `citizenappjhc.com` carries the company's name. For the
personal-tenant prototype (D6), either register it under corporate control from the start
and delegate the DNS zone to the prototype subscription, or prototype on a throwaway
domain and switch the suffix later — the suffix is one Terraform variable. Recommend the
throwaway for the prototype; a company-named domain should not be registered on a
personal account.

**Affects.** `infra/terraform/environment`, `infra/terraform/dns`, `cert-renew.yml`; the
heartbeat's chain validation; `app.yaml` name rules (already hostname-safe).

## D23 — How secrets get into Key Vault

**Question.** The developer has no Azure access. An app that needs an external API key
has to get it into Key Vault somehow ([07-deploy-credential-flow.md](07-deploy-credential-flow.md)).

| Option | For | Against |
|--------|-----|---------|
| **Platform team enters it on request** *(recommended for v1)* | Zero new surface; a human sees who asked for what. | A ticket in the path; secret transits a request channel unless done in a call or via a one-time link. |
| Deploy skill sends it once to a platform endpoint | Developer-only flow; no ticket. | A new authenticated endpoint that accepts secrets is exactly the kind of component we said the platform should be slow to add. |
| Platform-owned form on the platform side | Friendlier than a ticket. | Same as above with a UI. |

Start with the request path; count how often it is used before building anything.

**Affects.** `app.yaml` `secrets`; the deploy skill's message when a declared secret is
not yet present.

## D24 — Who pushes to GitHub

**Reaffirmed 2026-09-16.** The scaffold script commits as the owner and pushes with the
developer's own `gh`; no bot identity anywhere.

**Decided 2026-09-03: developers push directly, with their own GitHub accounts.** A
platform broker that commits on their behalf (authored as the developer, committed and
signed by a platform bot) was considered and rejected: it adds a privileged component
holding a GitHub App key and a signing key, and replaces GitHub's own audit trail with
ours. The skills hide git and GitHub mechanics from citizen developers; they do not
replace the developer's identity in the chain.

**What is kept from the idea.** The build skill configures the app repo's git identity
to the developer's corporate email and display name (confirmed once, from `gh`'s
verified email where available), so every commit's *author* is the real person and the
history reads correctly. Attribution beyond that comes from GitHub: the pusher and, where
the plan allows, verified commit signatures. D15 (mapping the GitHub actor to an Entra
user) therefore stays open and is the path to making the dashboard's "deployed by"
authoritative.

**Consequence.** Every citizen developer needs a GitHub account in the organization and
a signed-in `gh`. The build skill treats that as its one hard prerequisite and walks the
developer through it; [03-skills.md](03-skills.md) already says so.

## D25 — Database engine, tiers, and migration tooling

**Decided 2026-09-03:**

- **Engine: PostgreSQL only.** Azure Database for PostgreSQL Flexible Server hosted;
  PGlite (Postgres in WebAssembly, in-process, no Docker) locally. One dialect end to end.
  SQLite rejected for hosted use: Container Apps have no safe persistent disk for it and
  it would be a second dialect. Azure SQL serverless rejected as a second dialect with a
  weaker TypeScript ecosystem; revisit only if the organization mandates SQL Server.
- **Tiers:** `none` (default), `postgres` (shared server, one database and one role per
  app, logical isolation), `postgres-dedicated` (own server; needs `confidential`
  classification or a reason, approved at admission).
- **Schema in TypeScript with Drizzle; migrations as generated, committed SQL.** Typed
  queries for the developer, readable SQL for the gate. Prisma rejected on dependency
  tree and binary engine.
- **Platform applies migrations**, with a DDL-capable migration identity, in the deploy
  job, before the revision switch, in transactions; failure stops the deploy. The app's
  runtime identity is DML-only.
- **Destructive changes** need an explicit marker in the file and owner acknowledgement.

**Open.**
- Shared-server sizing and when to split the fleet across a second server (suggest: at
  25 databases or sustained 70% CPU).
- Whether `seed.sql` runs only on first deploy (recommended) or is re-runnable.
- Point-in-time restore retention beyond the 7-day default for the shared tier.

**Affects.** [08-data.md](08-data.md); `infra/terraform/modules/postgres`; gate rules;
both templates.

## D26 — Fabric as a declared data target

**Decided 2026-09-08.** An app may declare a Microsoft Fabric workspace in
`data/config.yaml` (`fabric:` block) and keep its Fabric items — lakehouses, notebooks,
environments, pipelines, ML experiments and models — in `data/fabric/items/` in Fabric's
native item-folder format. The platform publishes them to the workspace in the deploy
job through the Fabric REST API, using the app's existing deploy identity, after Postgres
migrations and before the revision switch. Deterministic data checks live in
`data/fabric/checks/`, are run by a platform-owned runner, and a blocking failure stops
the deploy like a failed migration. Full design in [09-fabric.md](09-fabric.md).

**Why.** The analytical data apps want is already in OneLake; the alternative is copying
it into Postgres. Notebooks and pipelines are code and need the same gates as the rest
of the repo. The item format is Fabric's own, so the repo holds exactly what the API
accepts and there is no format of ours to maintain.

**Rejected.** Fabric's built-in Git integration for deploy (needs a stored personal access
token, is bidirectional so portal edits bypass Gate 2, and commits as a connection rather
than the developer — against D24). Treating Fabric as a per-app request under D4 (the
third request would have been the same request).

**Open.** Whether `MLExperiment` and `MLModel` items can be managed through the
definition API by a service principal; real-time inference from the app; whether the
publisher should delete workspace items missing from the repo after a grace period.

**Affects.** [02-hosting-contract.md](02-hosting-contract.md) platform table;
[03-skills.md](03-skills.md) inputs and the pull-from-workspace step;
[05-platform-gates.md](05-platform-gates.md) rules and `infra/` layout;
[06-health-dashboard.md](06-health-dashboard.md) columns; [08-data.md](08-data.md);
D6 (tenant settings for service principals in Fabric).

## D27 — Python inside Fabric notebooks

**Decided 2026-09-08. Amends D2.** Notebooks in `data/fabric/items/` are Python. This
is Fabric's language, not the app's: it runs in Fabric's Spark runtime, never in the
container or on the platform. Dependencies are declared in the `Environment` item and
get the same rules as `package.json`: exact versions, an allow-list, a budget, and the
minimum release age (D8). D2's reasoning against Python *apps* stands; there is still
one app language, one template family, and one dependency shape to review.

**Alternative.** Spark SQL only, no Python. Rejected: ML model construction is the point,
and it is not possible without it.

**Affects.** Gate 2 rules for `Environment` libraries; `infra/gates/allowlist.json` gains
a Python section; [01-vision.md](01-vision.md) reasoning is unchanged.

## D28 — Fabric workspace topology

**Recommended: one workspace per app, on the shared platform capacity.** Fabric
permissions are workspace-scoped; a shared workspace would make every app's data
readable by every other app's owner. Per-app matches the database-per-app isolation of
D25. Owner and maintainers are Admins; the deploy identity is a Contributor on that
workspace only; the platform monitoring identity is a Viewer everywhere.

**Open.** Capacity sizing and when a second capacity is needed. Cost attribution: Fabric
bills by capacity, not by tagged resources, so per-app cost is a usage share from the
Capacity Metrics data, not a dollar figure. Until converted, Fabric cost sits on the
dashboard's shared "platform" row.

**Affects.** `infra/terraform/modules/fabric`; [06-health-dashboard.md](06-health-dashboard.md).

## D29 — Fabric publisher implementation

**Recommended: Node built-ins, in the platform repo, calling the Fabric Items REST API
directly.** Six allowed item types is a bounded job, and it keeps the platform repo's own
dependency tree at zero, which is the rule the gate engine already follows.

**Alternative.** Microsoft's `fabric-cicd` Python library. It knows the item types, their
publish order, and parameter substitution, but puts a Python dependency tree into the one
repo whose supply chain matters most ([07-deploy-credential-flow.md](07-deploy-credential-flow.md),
point 4). It is the fallback if the publisher proves harder than expected, pinned and
hash-locked, in the deploy job only.

**Affects.** `infra/fabric/publish.mjs`; `build-and-deploy.yml`.

## D30 — Hosting runtime: Azure Functions Flex Consumption

**Decided 2026-09-16. Supersedes D1.** Each citizen app is one Azure Functions app on the
Flex Consumption plan (one plan per app, Node 24, 512 MB instances, scale to zero), with
built-in Entra authentication in front. The server half of the template is `@azure/functions`
v4 handlers; one catch-all handler serves the Vite build. No Dockerfile, no registry, no
image scanning.

**Why.** Idle cost: Container Apps bills a warm replica at idle rates, and the design's own
15-minute heartbeat would have kept every app awake a third of the time; Flex bills
execution only and the same traffic costs roughly a fifth (worked example in the 2026-09-10
cost note, retail prices East US). VNet integration is included at serverless prices, so
the deferred egress allow-list (D11) becomes a v1 option. Fewer contract rules to enforce:
the container rules go, the runtime pin replaces them.

**What was given up, knowingly.** Revision-based rollout. Container Apps kept a failing
revision off traffic and rolled back in seconds; Flex has no deployment slots, zero-downtime
rolling updates are in public preview, and recovery is redeploying the previous package. The
deploy job today verifies only that auth is in front (302/401 to an anonymous request).
Also: a hard 30-second initialisation timeout; three Azure resources per app (plan, app,
storage) plus three identities; a regional quota of 250 cores across all Flex apps.

**Alternatives.** Keep D1 (rejected on cost and the heartbeat interaction). Static Web Apps
plus Functions (rejected: Standard tier is ~$9/app/month for custom Entra registration,
and two services per app).

**Affects.** [02](02-hosting-contract.md) rules 1, 2, 11 and the platform table;
[03](03-skills.md) template; [05](05-platform-gates.md) Gate 2/3/4 rules and `infra/`
layout; [07](07-deploy-credential-flow.md) deploy identity roles; [08](08-data.md)
revision-overlap paragraph; the architecture diagram.

## D31 — GitHub organization for the build-out

**Decided 2026-09-16: `SageSalmon`.** See D21. Reachable from the operator's personal
GitHub account, which is an org admin. Both the platform repo and app repos live there.

## D32 — When the app's GitHub repo is created

**Decided 2026-09-16: at scaffold.** `citizen-app-new-custom` runs `git init`, commits, and
`gh repo create` before the developer writes any code. The app has a home from minute one
and a signed-in `gh` is the one prerequisite (D24). The alternative, creating the repo on
first deploy so scaffolding needs no `gh`, was considered and not chosen: it moves the
prerequisite rather than removing it, and separates "saved" from "backed up".

## D33 — Secretless sign-in and three identities per app

**Decided 2026-09-16.** Easy Auth uses a **managed identity as the client assertion**
(app setting `OVERRIDE_USE_MI_FIC_ASSERTION_CLIENTID`, a federated identity credential on
the app registration trusting that identity) instead of a client secret. So there is no
`MICROSOFT_PROVIDER_AUTHENTICATION_SECRET`, nothing to rotate, nothing to leak. Each app
gets three user-assigned identities, none shared: **runtime** (its storage; later Key
Vault and the database role), **auth** (used only as that client assertion, per
Microsoft's guidance that it be assigned to nothing else), **deploy** (what the reusable
workflow becomes via GitHub OIDC; Storage Blob Data Contributor on the app's storage and
Website Contributor on the app, nothing else).

**Settled 2026-09-16 from the first deploy's token.** GitHub presents
`repo:<org>@<orgId>/<repo>@<repoId>:job_workflow_ref:<org>/<platform-repo>/<path>@refs/heads/main`:
the repo part ID-qualified (immutable subject), the workflow reference plain. The deploy
job now prints the `sub` claim on every run, and the module trusts only that one form.

**Affects.** `infra/terraform/modules/app`; [07](07-deploy-credential-flow.md).
