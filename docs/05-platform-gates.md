# 05 — Platform gates (the teeth)

The skill in this repo *suggests*. Everything it generates — the `check` script, the
pinned versions, the `.npmrc`, the `host.json` — lives in the developer's repo,
and the developer can change it. That is fine. It is guidance.

The **infrastructure** in `infra/` is where the same rules are *enforced*, by code the
developer cannot edit, at points the developer cannot skip. An app that does not follow
the practices does not get built, does not get deployed, or does not keep running. This
document says which rule bites where.

## Status, 2026-09-16

The gate engine, the reusable workflow, and the per-app Terraform are **built**. This page
now marks each rule **✓ built**, **◐ partial**, or **○ planned**. "Built" means the code
exists and passes its tests; the first end-to-end deploy through the pipeline is still
pending, so nothing on this page has bitten a real push yet. Rules that referred to
containers were rewritten for Azure Functions (D30).

## Principle

> One rule implementation, two owners. The skill vendors a copy so developers see
> failures early. The platform runs the authoritative copy. The platform's copy wins.

The rule engine is `infra/gates/`: Node built-ins only, no dependencies, so the gate
itself is not a supply-chain surface. It has its own YAML subset parser for the same
reason. The scaffold copies it into generated projects as `scripts/check.mjs`. The
platform pipeline runs it from *this* repo, never from the app repo, so an edited copy in
an app changes nothing; the pipeline diffs the two and warns the developer when they differ.
Seven rules exist (`app-yaml`, `dependencies`, `release-age`, `audit`, `secrets`,
`functions-app`, `workflow`), with 16 tests over a passing fixture generated from the template.

## The four gates

### Gate 1 — Admission

*When:* an app is registered with the playground. The deploy skill opens a pull request
to this repo adding `infra/apps/<name>.tf`, generated from the app's `app.yaml`; the
developer never sees the PR mechanics.
*Enforced by:* PR checks on this repo; a human from the platform team merges.
**Status: ○ manual.** There is no admission PR yet. The operator writes
`infra/terraform/app-<name>.tf` by hand, applies, and runs `scripts/write-registry.mjs`
to publish `infra/registry/<name>.json`, which is what the deploy job checks. The
`app-yaml` rule validates the schema (✓); every check below that needs Entra is ○.

Rejects when:
- `app.yaml` fails schema validation.
- `owner` is not a real, enabled Entra user.
- `access.group` does not exist or the owner is not one of its owners.
- `data.classification` is `regulated` (D7).
- `name` collides with an existing app or a reserved word.
- The source repo is not in the allowed GitHub organization.
- Any `maintainers` entry is not a real, enabled Entra user.
- **`identity.roles` is not a subset of what the owner already holds**, at that scope
  or narrower; or names a never-grantable role or a scope above resource group
  ([02-hosting-contract.md](02-hosting-contract.md), "Identity and permissions").
- `identity.delegated_scopes` includes an application permission or a scope outside
  the allowed delegated list.
- `data/config.yaml` asks for `postgres-dedicated` without `confidential` classification
  or a stated reason.
- `data/config.yaml` declares `fabric:` and any OneLake shortcut in `data/fabric/items/`
  points at data the owner cannot read ([09-fabric.md](09-fabric.md), "Identity").

Admission produces the per-app infrastructure (a Terraform module instance), the
app's managed identity with exactly the verified roles, the built-in auth
configuration allowing the app's group plus the platform monitoring identity, and the
federated identity that lets *only the platform's workflow* deploy this app. If
`fabric:` is declared, it also produces the app's Fabric workspace with the owner and
maintainers as Admins and the deploy identity as Contributor.

### Gate 2 — Build

*When:* every push to the app's main branch and every PR.
*Enforced by:* a **reusable GitHub workflow owned by this repo**. The app repo's
workflow is a one-line call to it. The deploy identity's federated credential is scoped
to the reusable workflow's `job_workflow_ref`, so a developer who replaces the workflow
with their own has a workflow that cannot deploy.

Builds for everyone; **deploys only when the pushing person is listed in app.yaml
`github.deployers`** (✓, interim D15; mapping to Entra users is ○). Rejects when any of
these fail:
- ✓ Lockfile missing, or `npm ci` cannot satisfy it.
- ✓ Any dependency has a version range instead of an exact version.
- ✓ `ignore-scripts` is not set in `.npmrc`; the install runs with `--ignore-scripts` regardless.
- ✓ Any direct dependency version is younger than the minimum release age (D8), checked
  against the registry's publish time. This refused the template itself on day one.
- ✓ Direct dependencies over the hard budget (25); over the soft budget (15) is a warning.
- ✓ A direct dependency is not on the allow-list (warning; the "reviewer acknowledgement" is ○).
- ✓ `npm audit --omit=dev` reports high or critical.
- ◐ Secret scan finds a credential-shaped string in the working tree (nine patterns, plus
  a committed `.env` without a `.gitignore` entry). Scanning **history** is ○.
- ✓ `host.json` missing or not a 2.0 host with a 4.x extension bundle; `package.json`
  `main` not under `dist/server/`; no function registers `api/healthz`; no `user.signin`
  emitted; `console.*` used outside the logger (warning). A Dockerfile is a warning: unused.
- ✓ The workflow does not call `SageSalmon/citizen-development-portal/.github/workflows/build-and-deploy.yml@main`,
  or pins it to another ref.
- ◐ The vendored `scripts/rules` differ from the platform copy: a warning annotation on
  the run, so the developer knows their local check is stale.
- ○ Image scan, SBOM, provenance report: no image exists; SBOM from the lockfile is planned.
- A migration violates the rules in [08-data.md](08-data.md): edited history,
  schema drift, unacknowledged destructive change, privilege statements.
- A Fabric item or check violates the rules in [09-fabric.md](09-fabric.md): item type
  off the allow-list, malformed `.platform`, `Environment` libraries unpinned or
  off-list, notebook outputs committed, a credential in a definition, a check that is
  not a single `SELECT` or whose `expect` keys do not match its columns.

Produces (✓): a zip of `host.json`, `package.json`, the lockfile, `dist/` and production
`node_modules`, as a workflow artifact, plus the gate report in the run summary. The
record of **who deployed** is the GitHub actor in the run summary (◐); the Entra name,
Log Analytics row, and dashboard are ○.

### Gate 3 — Deploy

*When:* after a successful build on main.
*Enforced by:* the same reusable workflow. Azure Policy is ○.

Runs first, when the app has a database: unapplied migrations, applied by the platform's
migration identity in transactions, **before** the package upload. A failed migration
stops the deploy here; the previous revision keeps serving.

Runs next, when the app declares `fabric:`: the platform's checks runner and then every
item in `data/fabric/items/` is published to the app's workspace, and the checks marked
`deploy` are run. A publish error or a failing `block` check stops the deploy here, same
as a migration ([09-fabric.md](09-fabric.md), "How changes reach the workspace").

What is built (✓): the deploy job checks out only the platform registry, refuses if
`infra/registry/<name>.json` is absent ("not admitted"), signs in via OIDC as the app's
deploy identity, uploads the package with `az functionapp deployment source config-zip`,
and then asks for `/api/healthz` anonymously, expecting **302 or 401**. A 200 would mean
auth is off; a 5xx or timeout means the app is not serving. Either fails the job.

Rejects when:
- ✓ The app is not admitted (no registry entry).
- ✓ The anonymous probe is not refused with 302 or 401 within a minute.
- ○ Migrations (08) and Fabric publish/checks (09).
- ○ Any environment variable value looks like a secret rather than a Key Vault reference.
- ○ An **authenticated** probe returning 200 with a well-formed body. The deploy identity
  has no token for the app's audience yet. Until it does, a package that deploys but crashes
  on request would pass this gate.
- ○ Rollback. Flex Consumption has no revisions; a bad deploy takes traffic. Recovery is
  redeploying the previous package (the artifact is kept 14 days).
- ○ Drift checks against Terraform, Azure Policy on tags and settings.

### Gate 4 — Runtime

*When:* continuously.
*Enforced by:* Terraform-managed configuration the app cannot see, Azure Policy, and
scheduled jobs in this repo.

- ✓ **Ingress requires authentication.** Built-in auth is configured by the platform module
  with `requireAuthentication` and `RedirectToLoginPage`; the app registration requires
  assignment, and only the app's access group and the monitoring identity are assigned.
  There is no anonymous path; the app does not get a say. (Configured; sign-in not yet exercised.)
- ○ **Egress is allow-listed** (deferred; D11, now cheaper on Flex): outbound to the public internet only
  via the environment's firewall rules, so a compromised dependency cannot call home.
- ○ **Dependencies are rescanned** weekly against the committed lockfile (replaces image rescans). A new critical with a fix opens an issue on the app
  repo; after the grace period the revision is deactivated.
- ○ **Heartbeat from outside, every 15 minutes.** The monitoring identity exists and is admitted by every app's auth config; the scheduled workflow is not written. The platform monitoring identity calls
  each app's `/healthz` through the front door with a real token and records the
  result. Three consecutive misses or errors mark the app *down*: dashboard red, owner
  and platform team alerted. One or two mark it *degraded* on the dashboard only. This
  is the only identity other than the app's own group that built-in auth admits.
- ○ **Sign-in logging is checked, not trusted.** The dashboard compares each app's
  request volume (from ingress logs) with its `user.signin` events. An app taking
  traffic while emitting no sign-in events has removed or broken the logging; it is
  flagged on the dashboard and the owner is told. This cannot be a hard gate at build
  time — the code can be edited after `check` — so it is a runtime signal instead.
- ○ **Owner liveness.** Monthly, every owner is checked against Entra. A disabled owner
  triggers a 30-day retirement clock unless reassigned.
- ○ **Permission ceiling.** Monthly and on every deploy, each `app`-mode identity's roles
  are re-checked against the owner's current effective permissions. Any role the owner
  no longer holds is removed from the app the same day and the owner is told which.
- ○ **Scheduled data checks.** Daily by default, checks marked `scheduled` run in each
  app's Fabric workspace. A failing `block` check marks the app *degraded* and tells the
  owner; nothing is deactivated. Workspace items with no counterpart in the repo are
  flagged as unmanaged. Shortcut targets are re-checked against the owner monthly with
  the permission ceiling.
- ◐ **Cost.** Tags are on every resource (✓). Per-app budget alerts to the owner and the platform team. Fabric capacity
  usage per workspace is recorded but not yet attributed as cost (D28).
- ○ **Certificate.** No custom domain exists yet (D22). The wildcard for `*.citizenappjhc.com` is one shared dependency of
  every app. Its expiry is checked daily; renewal is automated (D22) and its failure is
  a platform-team alert at 21 days remaining, escalating at 7. The heartbeat also
  validates the chain, so a bad certificate shows every app degraded at once, which is
  the honest picture.

## Rule-to-gate map

| Contract rule | Skill (`check`, advisory) | Gate 1 Admission | Gate 2 Build | Gate 3 Deploy | Gate 4 Runtime |
|---------------|:---:|:---:|:---:|:---:|:---:|
| `app.yaml` valid, owner real, group exists | ✓ schema only | **✓** | | | |
| Classification allowed | ✓ | **✓** | | | |
| Dockerfile non-root, approved base, `HEALTHCHECK` | ✓ | | **✓** | | |
| Listens on `$PORT`, `/healthz` works | ✓ (local run) | | | **✓** | ✓ probes |
| No secrets in repo | ✓ pre-commit | | **✓** | | |
| Secrets only as vault refs | ✓ | | | **✓** | |
| Lockfile, exact pins, ignore-scripts | ✓ | | **✓** | | |
| Minimum release age | ✓ | | **✓** | | |
| Dependency budget and allow-list | ✓ | | **✓** | | |
| Audit / image scan clean | ✓ audit | | **✓** | | **✓** rescan |
| Image from platform registry | | | | **✓** policy | ✓ policy |
| Ingress authenticated, no public app | — (not the app's job) | ✓ no opt-out in schema | | ✓ auth config | **✓** |
| Sign-in events logged | ✓ test | | | | **✓** traffic-vs-signins signal |
| Heartbeat every 15 min, 3 misses = down | — | | | | **✓** |
| Migrations: forward-only, no drift, destructive changes acknowledged, no privilege SQL | ✓ | ✓ dedicated needs reason | **✓** | **✓** applies, stops on failure | |
| App runtime identity is DML-only on its own database | — | | | ✓ Terraform grants | **✓** re-check |
| Fabric items: allowed types, valid definitions, pinned environment libraries, no outputs, no credentials | ✓ | | **✓** | **✓** publishes, stops on failure | ✓ unmanaged items flagged |
| Fabric checks: single `SELECT`, deterministic, `expect` matches columns | ✓ | | **✓** | **✓** `deploy` checks block | **✓** `scheduled` checks degrade |
| OneLake shortcuts point only at data the owner can read | ✓ (syntax only) | **✓** | | | **✓** re-check |
| Served under `*.citizenappjhc.com`, valid chain | — | ✓ name is hostname-safe | | ✓ environment, not app | **✓** expiry watch, heartbeat validates |
| Tags present | | ✓ | | **✓** policy | ✓ policy |
| Resource bounds | ✓ | | | **✓** | ✓ |
| Owner still valid | | ✓ | | | **✓** |
| App roles ⊆ owner's permissions; no never-grantable roles | ✓ (knows the deny-list) | **✓** | | ✓ drift | **✓** re-check |
| Deployer is owner or maintainer | | ✓ verified users | **✓** | | |
| Heartbeat reachable only authenticated | — | ✓ auth config | | | **✓** synthetic check |

Bold marks the gate that actually rejects. Anything with only a skill tick and no bold
is a gap in the teeth and belongs in [04-decisions.md](04-decisions.md).

## What lives in `infra/`

```
infra/
  gates/                 # ✓ the rule engine. Node built-ins only. Single source of truth.
    check.mjs            #   entry point; `runChecks()` exported for tests and the pipeline
    lib/yaml.mjs         #   YAML subset parser (no dependency), lib/context.mjs
    rules/               #   one file per rule: app-yaml, dependencies, release-age, audit,
                         #   secrets, functions-app, workflow — each with the developer's message
    platform.json        #   org, repo, workflow path, budgets, release age, node versions
    allowlist.json       #   approved direct dependencies
    bin/app-meta.mjs     #   app.yaml fields as JSON, for the workflow
    tests/               #   16 tests; fixtures/passing is generated from the template
  terraform/             # ✓ one root module, state in Azure Storage (Entra auth)
    versions.tf, variables.tf, environment.tf, outputs.tf
    environment.tf       #   rg-citizen-<env>, Log Analytics, App Insights, monitoring identity
    modules/app/         #   one instance per admitted app: storage (no keys), FC1 plan, function
                         #   app, three identities, app registration (secretless), group +
                         #   assignment-required, authsettingsV2, GitHub federated credentials,
                         #   role assignments; outputs the registry record
    app-<name>.tf        #   one per admitted app, written by hand today (○ generated at admission)
    envs/dev.tfvars      #   committed, non-identifying;  envs/dev.backend.hcl gitignored
    local.auto.tfvars    #   gitignored identifiers; .example committed
  registry/<name>.json   # ✓ what the deploy job reads: hostname, resource names, deploy client id
.github/workflows/
  build-and-deploy.yml   # ✓ the reusable workflow app repos call (Gates 2 + 3)
  heartbeat.yml          # ○
  rescan.yml             # ○
  owner-liveness.yml     # ○
  fabric-checks.yml      # ○
  cert-renew.yml         # ○ (no domain yet)
scripts/
  citizen-app-new-custom.mjs    # ✓ scaffold: template + vendored gates + install + check + repo
  write-registry.mjs     # ✓ terraform output -> infra/registry/*.json
templates/react-app/     # ✓ the one template
policy/, dashboard/, fabric/   # ○
```

Same conventions as ref-arch-agent: identifying values in gitignored local files,
`<REPLACE_*>` tokens committed, everything tagged for cost, no secrets in variables.
The workflow file lives at the repo root `.github/workflows/`, not under `infra/`, because
GitHub only honours reusable workflows there.

## What is not a gate

- **Code quality.** The platform does not reject ugly code. Linting stays advisory.
- **Authorization inside the app.** The platform proves identity at the door. It cannot
  know whether the app shows the right rows to the right person.
- **Anything the skill invents that this document does not list.** If it is worth
  enforcing, it is listed here first, then implemented in `infra/gates/`, then vendored
  into the skill. Never the other way round.
