# 07 — Deploy credential flow

Who holds what, at every step from "deploy" on a laptop to a new revision serving
traffic. The design goal: **no long-lived credential anywhere, and no step where the
developer's code runs with a credential in reach.**

## The chain

```
developer laptop            GitHub                              Azure
───────────────             ──────                              ─────
gh token (developer)  ──►  push to app repo main
                           app workflow: one line, calls
                           platform reusable workflow
                             job A  build+test  ── no token ──►  (nothing)
                             job B  deploy ──── OIDC JWT ─────►  federated identity
                                                                 for THIS app only
                                                                 ──► short-lived token
                                                                 ──► upload zip package
                                                                     to the function app
```

| Step | Credential in play | Who holds it | Lifetime | Can reach Azure? |
|------|--------------------|--------------|----------|------------------|
| Laptop: `deploy-citizen-app` | The developer's own `gh` login | Developer, OS keyring | GitHub-managed | **No.** No Azure CLI, no Azure identity, nothing to install. |
| Push to `main` | Same | Same | — | No |
| Reusable workflow, job A (build, test, `check`, scan) | **None.** `id-token: write` is *not* granted to this job. | — | — | **No.** This is the job that runs the app's code. |
| Reusable workflow, job B (deploy) | GitHub OIDC JWT, exchanged for an Azure access token by `azure/login` | The runner, in memory | Minutes | Yes, as the app's deploy identity (a user-assigned managed identity), narrowly. |
| Terraform apply | **Today:** the operator's own `az login` (Owner, Global Administrator) from a laptop. **Aspirational:** a platform identity, OIDC-federated, only from the platform repo's `main`. | Operator | Interactive session | Yes: everything. This is the widest credential in the system and it is a person's. |
| Runtime | The app's `runtime` managed identity | Azure Functions | Rotated by Azure | Its own storage account today; later its Key Vault secrets and database role. |
| Sign-in | The app's `auth` managed identity, as Easy Auth's client assertion (D33) | Azure Functions | Rotated by Azure | Nothing but "prove to Entra that this app is this app". No client secret exists. |

There is no secret in any GitHub repo, no service-principal password, no publish
profile, no `MICROSOFT_PROVIDER_AUTHENTICATION_SECRET`, no `AZURE_CREDENTIALS` variable.
The storage account behind each app refuses shared-key access, so there is no account key
to leak either.

What *is* committed, deliberately, is `infra/registry/<app>.json`: hostname, resource
group, function app name, deploy identity client id, tenant id, subscription id. The deploy
job reads them from this repo and has no other source. They are identifiers. Holding them
grants nothing without a token from the one federated subject. If a GitHub organization is
fully exported tomorrow, nothing in it grants Azure access.

## How the OIDC handshake is scoped

GitHub issues a signed JWT to a workflow run with claims describing *what is running*:
the repository, the branch, the actor, and `job_workflow_ref` — the exact reusable
workflow file and ref being executed. Azure's federated identity credential says which
claim values it trusts. The exchange fails unless they match exactly.

The platform sets the trusted subject to include **both** the app repository and the
platform's reusable workflow:

```
repo:<org>/<app-repo>:job_workflow_ref:<org>/citizen-development-portal/.github/workflows/build-and-deploy.yml@refs/heads/main
```

Consequences, all deliberate:

- A developer who replaces the one-line workflow with their own gets a workflow whose
  `job_workflow_ref` is their file. No match, no token, no deploy.
- Pinning the reusable workflow to an old commit changes the ref in the claim. No match.
  Apps always run the *current* platform workflow, so a gate rule change reaches every
  app on its next deploy.
- A deploy identity trusts exactly one app repo, so a compromised app repo cannot
  deploy a different app.
- **Subject format, open (D33).** ref-arch-agent found that GitHub presents ID-qualified
  subjects (`repo:owner@ownerId/repo@repoId:...`), which the classic documentation does not
  show. The module trusts both the name form and the ID form until the first deploy's
  token shows which one arrives; then the other is removed.

## The five details that make or break it

### 1. The OIDC subject must be customized to include `job_workflow_ref`

GitHub's *default* subject is `repo:<org>/<repo>:ref:refs/heads/main`. It says nothing
about which workflow is running. With the default, **any** workflow in the app repo on
`main` would match, and a developer could write a workflow that skips every gate and
deploys directly. The platform must set the subject claim template per repo to include `job_workflow_ref`;
`scripts/new-citizen-app.mjs` does this with `PUT /repos/{org}/{repo}/actions/oidc/customization/sub`
right after creating the repo (✓). An organization-wide template needs `admin:org` and is
not set. Verifying the setting at admission is ○. This one setting is the difference between
"the gates are enforced" and "the gates are a suggestion".

### 2. The job that runs the app's code never has a token

Job A runs `npm ci`, the tests, `check`, and the image build. Even with install scripts
disabled, tests and the app's own build tooling execute the developer's code. If that
job also held the Azure token, a malicious or compromised dependency could read it from
the environment and push whatever image it liked. So job A has no `id-token` permission
and no network path to Azure; it produces the built image as an artifact with its digest.
Job B, which holds the token, does not execute app code: it downloads the artifact job A
produced and uploads it with `az functionapp deployment source config-zip`. Job B checks
out only `infra/registry` from the platform repo, never the app repo. (Verifying the
artifact's digest between the two jobs is ○; today the artifact store is trusted.)

### 3. One deploy identity per app

Not one shared identity for the fleet. Azure limits federated credentials per identity
anyway, but the reason is blast radius: if the scoping in (1) ever fails for one app,
the damage is one app. The deploy identity's roles are Storage Blob Data Contributor on **that** app's storage
account and Website Contributor on **that** function app; when the app declares `fabric:`,
Contributor on **that** Fabric workspace ([09-fabric.md](09-fabric.md), ○). It cannot
create role assignments, change built-in auth, or read Key Vault. Website Contributor is
wider than "upload a package": it can also change app settings. A custom role limited to
deployment is ○. Those belong to the platform
identity in the next point.

### 4. The platform repo is the crown jewel

The reusable workflow, the gate engine, and the Terraform that assigns roles all live
here. Whoever can merge to this repo's `main` controls every gate. So this repo **should** have
required reviews from a small platform-team CODEOWNERS list, no direct pushes to `main`,
all Actions pinned to commit SHAs, Dependabot on the Actions, and its own Terraform apply
gated on a protected environment. **Today it has none of these**: one operator, direct
pushes, Actions pinned to major tags, Terraform applied from a laptop. This repo is also
public so app repos can read the gate rules (D3). The gate engine's rules protect the apps; these
settings protect the gate engine.

### 5. The developer's GitHub account is the root of "who deployed"

The deployer recorded on the dashboard is the GitHub actor, mapped to an Entra user
(D15). That is accurate about the *account*, not necessarily the human: a stolen `gh`
token deploys as its owner. Mitigations, in order of value: SSO/EMU so GitHub identity
*is* Entra identity and inherits its conditional access; organization-wide required 2FA;
`gh` tokens scoped to `repo` only, which the build skill checks. None of this is unique to
the playground; it is the same trust the organization already places in GitHub for
source code.

## What the developer's laptop never needs

- Azure CLI, an Azure login, a subscription, a resource group name.
- Any secret value. Secrets go into Key Vault by another path (D23) and the app reads
  them at runtime through its own identity.
- Docker, for deploying. Job A builds the image. (Docker is useful for local testing and
  the build skill offers it, but a developer without it can still deploy.)

## Open: how secrets get into Key Vault (D23)

The developer has no Azure access, by design, so they cannot put an API key into Key
Vault themselves. Options: the platform team does it on request through a ticket; the
deploy skill accepts a value once, sends it over a platform endpoint that writes it and
never logs it; or a small platform-owned form. This is the one place the "no Azure on the
laptop" rule creates friction and it needs a decision before the first app that talks to
an external API.
