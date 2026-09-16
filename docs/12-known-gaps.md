# 12 — Known gaps

Where the work as built could mislead someone about what has been proven. Each gap: what,
why it matters, what exists today, what closing it takes. Written 2026-09-16, before the
first end-to-end deploy.

## The pipeline has deployed once; sign-in has not been exercised

**What.** On 2026-09-16 `hello-citizen` went from push to a running Function App through
the reusable workflow: gates, tests, package, OIDC deploy, anonymous probe refused. Nobody
has yet signed in to it.
**Why it matters.** The ✓ marks in [05](05-platform-gates.md) for Gates 2 and 3 are now
"bit a real push". The secretless Easy Auth login (D33) and the identity headers reaching
`/api/me` are still unproven.
**Today.** Easy Auth redirects browsers to Entra with the right client id; `/.auth/me` is
401 anonymously; the access group has one member.
**Closing it.** A member of the group opens the app, `/api/me` shows them, and
`user.signin` appears in Application Insights. Record it in [11](11-deployment-notes.md).

## The deploy health gate proves only that the door is locked

**What.** Job B checks that an anonymous request is refused (302/401). It does not prove
the app answers 200 to a signed-in caller.
**Why it matters.** A package that deploys but crashes on every request passes Gate 3.
**Today.** The monitoring identity exists and is assigned to every app's registration.
**Closing it.** In job B, obtain a token for the app's audience (the deploy identity would
need assignment too, or use the monitoring identity), call `/api/healthz`, require 200 and
the body shape.

## No rollback

**What.** Flex Consumption has no revisions or slots. A bad package takes traffic.
**Why it matters.** This was Container Apps' strongest protection and D30 gave it up.
**Today.** The artifact is kept 14 days; recovery is a manual redeploy of the previous zip.
**Closing it.** A `rollback` workflow that redeploys the previous successful artifact, or
Flex rolling updates once they leave preview and can be gated on a health check.

## Admission is a person editing Terraform

**What.** Gate 1 is described as a PR generated from `app.yaml`. Today the operator writes
`app-<name>.tf` by hand, applies from a laptop, and commits `infra/registry/<name>.json`.
**Why it matters.** The owner/group/role checks that admission is supposed to make happen
in the operator's head, not in code.
**Today.** The `app-yaml` rule validates the schema. Nothing verifies the owner is a real
user, the group exists, or roles are a subset of the owner's.
**Closing it.** A script that renders `app-<name>.tf` from `app.yaml`, a PR check that runs
the Entra lookups, and a platform identity that applies from the platform repo's `main`.

## The widest credential is a person's laptop

**What.** Terraform runs as the operator: Owner on the subscription, Global Administrator
in the tenant.
**Why it matters.** [07](07-deploy-credential-flow.md) promises no step where a broad
credential is in reach of code that is not the platform's. The apply step is that step.
**Today.** Personal tenant, one operator, gitignored values.
**Closing it.** An OIDC-federated platform identity for the platform repo's workflow with
Contributor plus RBAC Administrator on the resource group, as ref-arch-agent did.

## The platform repo is not protected

**What.** No CODEOWNERS, no required reviews, direct pushes to `main`, Actions pinned to
major tags.
**Why it matters.** Whoever can push to this repo controls every gate for every app.
**Closing it.** Branch protection, SHA pins, Dependabot for Actions. All GitHub settings.

## Who deployed is a GitHub handle

**What.** `github.deployers` in `app.yaml` decides who may deploy; the run summary records
the actor. Neither is verified against Entra.
**Why it matters.** The dashboard promise is a person's name; a stolen `gh` token deploys
as its owner.
**Closing it.** D15.

## The sign-in log is per instance, not per session

**What.** `user.signin` fires once per user per Functions instance.
**Why it matters.** Users show up more than once per session in the logs.
**Closing it.** Define "session" in the dashboard query as the first event per user per
day, or persist seen-users somewhere shared.

## Sign-in has not been exercised

**What.** Easy Auth with a managed identity as client assertion (D33) is configured in
Terraform from Microsoft's documentation, not from a working login.
**Why it matters.** If it fails, the fallback is a client secret in an app setting, which
contradicts the "no secret anywhere" claim until Key Vault references exist.
**Closing it.** Apply, open the app in a browser as a member of the access group, record
the result in [11](11-deployment-notes.md).

## Not built at all

Custom domain and certificate (D22), Key Vault and `secrets:` (D23), `env:` from app.yaml
into app settings, on-behalf-of calls in `user` mode, `app` mode identities and the
permission ceiling (D14), PostgreSQL (08), Fabric (09), the dashboard (06), heartbeat,
rescans, owner liveness, egress control (D11), SBOM and provenance, the
`react-fullstack` template, Renovate on the org, skill distribution (D19).
