# 10 — Netlify as an alternative host

Whether Netlify could host the playground instead of Azure Container Apps, checked
feature by feature against Netlify's own docs and pricing page on 2026-09-10. Written so
the question does not have to be re-researched the next time it comes up. Nothing here is
a decision; D1 (Container Apps) stands.

**The comparison app** lives in this repo at `netlify-poc/`: a small React site with four
functions (health, identity, Netlify DB, a Fabric read through a stored service-principal
secret) and a two-job GitHub Actions deploy. Its README is the setup; `netlify-poc/docs/findings.md`
is the checklist being filled in. **Deployed 2026-09-17** into the LT-POC Enterprise team as
`citizen-poc-netlify`, by `netlify deploy --prod` from a laptop. First finding: the team's
SSO team-login default closed the whole site, including its public login page, to non-members
before anything was configured. Netlify Identity was then removed from the POC: a second
login was redundant and no Identity instance exists on the site. **Second finding:** team
login authenticates the visitor but forwards nothing about them to the functions, so the app
cannot say who is using it, log a sign-in, or act on the user's behalf. The only headers
Netlify adds name the team that owns the site (`x-nf-account-id`, `x-nf-account-tier`). The
same door on the playground hands the code the user's object id, UPN, and display name.
**Third finding:** Netlify DB answered on first use with no init step and no visible
connection string; the SDK resolves the credential itself, and the same connection does
DDL and DML.

## Netlify plan tiers, 2026-09-10

| Plan | Price | Credits per month | Notes |
|------|-------|-------------------|-------|
| Free | $0 | 300 | Custom domains with SSL, functions |
| Personal | $9/month | 1,000 | Adds smart secret detection |
| Pro | $20/month flat | 3,000 to 20,000 | Unlimited team members since 2026-04-14; private org repos, shared env vars, 3+ concurrent builds, 30-day analytics |
| Enterprise | custom | custom | SSO and SCIM, log drains, role-based access control, team login protection, 99.99% SLA, organization management |

Credits are spent on production deploys, compute, bandwidth, web requests, and AI
inference. Usage is reported per team, not per project.

## Feature comparison

Each row is a requirement of this design, what Netlify offers for it, the plan that
offers it, and the verdict. "No equivalent" means no tier provides it.

| Design requirement | Netlify offering | Plan | Verdict |
|--------------------|------------------|------|---------|
| Entra sign-in enforced before any request reaches app code; identity headers passed in ([02](02-hosting-contract.md)) | Visitor access is a shared password, team login, SSO for Netlify team members only ("only members of your Netlify team can use your team login"), or role-based JWT redirects | Password: Pro. Team login, SSO, JWT: Enterprise | **No equivalent.** None admits arbitrary Entra users from an access group. |
| Fronting Entra through the role-based JWT feature | Netlify verifies JWTs with an HS256 shared secret set in the UI. Entra signs RS256 | Enterprise | **Cannot directly.** Something would have to mint Netlify's tokens after an Entra login; that is the app implementing login, which the contract forbids. |
| Netlify Identity as the login | Supported; a 2026-02-19 update reversed an earlier deprecation: "Netlify Identity will continue as a supported authentication option." | All plans | **Not acceptable** for a different reason: it is a login the app runs itself, and its user store is not Entra. |
| One container per app, Dockerfile, `$PORT`, `HEALTHCHECK`, non-root, startup budget ([02](02-hosting-contract.md)) | Serverless functions with a 60-second synchronous limit and background functions to 15 minutes. Custom containers requested in 2022; Netlify staff: "not in our current roadmap" | All plans | **No equivalent.** The Hono server becomes functions; about a third of the contract rules have nothing to attach to. |
| Per-app cloud identity whose roles are verified to be a subset of the owner's ([02](02-hosting-contract.md), D14) | Functions run with no cloud identity | — | **No equivalent.** Anything reaching Azure needs a stored key, which also breaks "no long-lived credential anywhere". |
| Only the platform's reusable workflow can deploy, enforced by OIDC subject ([07](07-deploy-credential-flow.md)) | Netlify builds from the developer's repo with the developer's build settings. Deploying from GitHub Actions uses a Netlify personal access token stored as a repo secret | All plans | **No equivalent.** No OIDC federation for Netlify deploys was found; its absence could not be proven. |
| Job A runs app code with no token; job B holds the token and runs no app code ([07](07-deploy-credential-flow.md)) | One build runs the developer's code and holds whatever credentials the deploy needs | All plans | **No equivalent.** |
| PostgreSQL with Entra auth; migration identity DDL, app identity DML only ([08](08-data.md)) | Netlify DB (Neon Postgres, resold). Built-in migrations "applied at the right point in the deploy lifecycle". Access control is by Netlify team role, with a read-only connection string for Developers. Apps connect with a connection string | Credit-based plans | **Partial.** Migrations at deploy exist. Identity-based auth and an app-level DDL/DML split do not. |
| Fabric workspace, publisher, checks runner, shortcut rule ([09](09-fabric.md)) | Nothing | — | **No path.** |
| Runtime gate: Azure Policy on registries and tags, weekly image rescans, heartbeat as a monitoring identity ([05](05-platform-gates.md)) | No images to scan or restrict. External uptime monitoring is possible but has no platform identity to authenticate with | — | **No equivalent.** |
| Cost by `app`, `owner`, `area` tags ([06](06-health-dashboard.md)) | "Usage is calculated for all web projects on your team." Breakdown is by meter, not by project | All plans | **No equivalent.** |
| Logs to Log Analytics; dashboard as a Workbook ([06](06-health-dashboard.md)) | Log drains to Azure Monitor, Datadog, New Relic, Axiom, Sumo Logic, Splunk, Logflare, S3, or a generic HTTP endpoint | Enterprise | **Partial.** Logs can reach Azure Monitor. The Workbook would be rebuilt over drained data. |
| Secret scan at build ([05](05-platform-gates.md)) | Smart secret detection fails the build when a secret is found | Personal and above | **Equivalent** on paid plans. |
| `https://<app>.citizenappjhc.com` under one wildcard certificate ([02](02-hosting-contract.md), D22) | Automatic deploy subdomains under a custom domain, with wildcard DNS and certificates generated by Netlify | Pro and above | **Equivalent or better.** Netlify handles DNS and certificates itself. |
| Scale to zero, cheap when idle (D1) | Serverless by nature | All plans | **Equivalent.** |
| Preview environments | Deploy previews per pull request, each with its own database branch on Netlify DB | All plans | **Better than the design**, which has no preview deploys. |

## The Okta question: can the app use the user's permissions and hold no credentials?

The most common question about Netlify here is whether, since it is fronted by Okta, an
app can be written so that it reaches backend services with the signed-in user's own
permissions and no credential is ever stored in Netlify's systems. **Yes, for backends that
accept the user's token, and that condition is where the answer stops being about Netlify.**

**The pattern.**

1. The browser signs the user in with Okta directly (OpenID Connect, authorization code
   with PKCE). No client secret exists; a browser app is a public client.
2. The browser calls a Netlify function with the Okta access token as a bearer header.
3. The function validates the token against Okta's public keys and forwards it, or
   exchanges it for one scoped to the backend (Okta supports the token exchange grant).
4. The backend validates the token and authorizes **the user**. If the user cannot read a
   record in the source system, neither can the app on their behalf.

Nothing is stored. The only environment values are the Okta issuer URL and client id, both
public. Tokens pass through the function runtime for the life of one request, which is true
on any host, including Azure Functions. What Netlify never has is a standing credential that
works when no user is present. This is the same principle as the playground's `user` mode.

**What it requires of the backends.**

| Backend | Works with the user's Okta token? |
|---------|------------------------------------|
| An internal API with an Okta authorization server in front | Yes, directly |
| Microsoft services: Graph, SharePoint, Fabric SQL endpoints, Azure resources | No. They accept only Entra tokens. The path is Okta federated to Entra, so the user signs in through Okta but the app requests Entra tokens, and the app is then an Entra client registered in the Entra tenant. Whether that federation exists is an identity-team fact, not an app decision. |
| Anything with no user-level identity: a database password, a third-party API key | No. Someone must hold the key, and on Netlify that is an environment variable. This is the case that breaks the goal, and the honest options are "do not connect it from Netlify" or "accept the stored secret". |

**What the pattern cannot give.**

- **Unattended work.** Nothing runs when no user is signed in: no scheduled refresh, no
  background job. That needs a standing identity, which is the playground's `app` mode with
  a managed identity capped at the owner. Netlify has no identity to cap.
- **Policy beyond the user.** The app's reach is exactly the user's. That is a feature, and
  the playground defaults to it too; the playground can additionally grant and verify a
  bounded standing identity, Netlify cannot.

**Verdict.** An app that only reads and writes what its user may already read and write,
through backends that accept the user's token, can be built on Netlify with zero credentials
in Netlify's hands. The gaps appear exactly where the playground added machinery:
Microsoft-backed services need Entra, unattended work needs a standing identity, and shared
keys need a vault. On Netlify each of those is a stored environment variable or is not possible.

## Observed in practice, 2026-09-14

A read-only look at an internal organisation's Netlify Enterprise account (details in
`environments/dev.md`, gitignored):

- Two teams in one Netlify Organization; organisation SAML strictly enforced; the user
  managed by directory sync. The "Okta login" is the identity provider in front of Netlify
  itself.
- Every site returned **401 to an anonymous request** and redirected to Netlify's
  edge-access login. That is **team login with SSO** set as a team default: a visitor must
  be a member of the Netlify team. The team had 26 members for nine sites. No site used the
  JWT role-based feature, Netlify Identity, or an external provider.
- All sites were **deployed by upload**, none linked to a Git repository, and the setting
  that blocks non-Git production deploys was off. The inspected content was static decks
  and diagrams; two sites had functions and one a Netlify DB.
- Consequence for this comparison: that organisation solved the front door for a small
  known audience by making viewers team members, and did not use source control or gates
  at all. It does not answer the citizen-app question, whose audience is not a Netlify
  team and whose deploy path must not be a laptop.

## Where Netlify runs

Netlify does not publish a full infrastructure map. Its security page says it "deploys
only to major cloud providers who regularly undergo extensive security audits."

- **Functions.** The first iteration "exposed the API surface of the underlying compute
  provider, AWS Lambda." The current Functions API is Netlify's own; the Lambda handler
  mode is deprecated with deploys refused from 2027-07-01. **Observed 2026-09-17:** a
  function error on the deployed POC printed a stack trace through `/var/task/` and
  `/var/runtime/index.mjs`, the AWS Lambda runtime layout. The modern runtime still executes
  on Lambda, whatever the docs say.
- **Edge Functions.** "A secure runtime based on Deno" at Netlify's edge, not AWS.
- **Netlify DB.** Neon Postgres, operated and resold by Netlify, on Neon's footprint.
- **Compliance listed:** SOC 2 Type 2, ISO 27001 and 27018, PCI DSS v4.0, HIPAA, GDPR
  and CCPA.

Whatever the provider, none of it is inside the organization's Azure tenant.

## Verdict

Netlify would host a citizen app that is only a front end talking to APIs the developer
already holds keys for, and it would do the URL, TLS, and preview parts better than this
design does. It cannot host the playground. Every item that makes the playground safe for
a citizen developer, identity at the door, capped per-app identities, the OIDC-scoped
deploy, and the credential split, either requires Enterprise or has no equivalent at any
tier. On Netlify each of those becomes the app's job again, and the design exists so that
none of them is.

## Not verified

- The exact connection variable Netlify DB exposes, and whether databases must be
  claimed to a Neon account. The reachable docs pages did not say.
- Whether any OIDC path exists for Netlify deploys. None was found.
- Which cloud sits under the modern Functions runtime.

## Sources, read 2026-09-10

- [Netlify pricing](https://www.netlify.com/pricing/)
- [Password protection and visitor access](https://docs.netlify.com/manage/security/secure-access-to-sites/password-protection/)
- [Role-based access control with JWT](https://docs.netlify.com/manage/security/secure-access-to-sites/role-based-access-control/)
- [Role based redirects, HS256 requirement](https://www.netlify.com/blog/2019/01/31/restrict-access-to-your-sites-with-role-based-redirects/)
- [Netlify Identity changes, 2026-02-19 update](https://www.netlify.com/blog/auth0-extension-identity-changes/)
- [Log drains](https://docs.netlify.com/manage/monitoring/log-drains/)
- [Netlify DB overview](https://docs.netlify.com/build/data-and-storage/netlify-database/) and [access control](https://docs.netlify.com/build/data-and-storage/netlify-database/access-control/)
- [Custom Docker containers for functions, support forum](https://answers.netlify.com/t/allow-custom-docker-container-for-netlify-functions/52249)
- [Monitor usage for credit-based plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/monitor-usage-for-credit-based-plans/)
- [Secret scanning](https://docs.netlify.com/manage/security/secret-scanning/)
- [Automatic deploy subdomains](https://www.netlify.com/blog/automatic-deploy-subdomains-ga/)
- [Netlify Functions 2.0](https://www.netlify.com/blog/introducing-netlify-functions-2-0/) and [Lambda compatibility](https://docs.netlify.com/build/functions/lambda-compatibility/)
- [Edge Functions overview](https://docs.netlify.com/build/edge-functions/overview/)
- [Netlify security](https://www.netlify.com/security/)
