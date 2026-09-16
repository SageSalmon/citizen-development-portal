# 11 — Deployment notes

What was learned building and deploying the thin slice (2026-09-16 onward). Each note is
a fact plus the consequence of not knowing it. Environment specifics are in
`environments/dev.md` (gitignored).

## Terraform and Azure

- **The state storage account refuses key auth.** `terraform init` failed with
  `KeyBasedAuthenticationNotPermitted`. The backend needs `use_azuread_auth = true` and the
  operator needs Storage Blob Data Owner or Contributor on the account, which Owner on the
  subscription does not imply. Now in `envs/dev.backend.hcl.example`.
- **Child modules default to `hashicorp/*` providers.** The `azapi` provider is
  `azure/azapi`; without a `required_providers` block in `modules/app`, init tried to fetch
  `hashicorp/azapi` and failed. Every module that touches azapi needs its own `versions.tf`.
- **Flex Consumption is configured through `functionAppConfig`, not `linuxFxVersion` or
  `FUNCTIONS_*` app settings.** azapi with `Microsoft.Web/sites@2023-12-01` is the proven
  path in this tenant (ref-arch-agent); the azurerm 5.x resource exists but was not used.
- **A user-assigned identity for storage needs `AzureWebJobsStorage__clientId`** in
  addition to `__accountName` and `__credential=managedidentity`, or the host cannot pick
  which identity to use.
- **`authsettingsV2` is an update, never a create.** It exists on every site from the
  moment the site does.
- **Secretless Easy Auth (D33)** is `clientSecretSettingName = "OVERRIDE_USE_MI_FIC_ASSERTION_CLIENTID"`
  plus that app setting holding the auth identity's client id plus a federated credential
  on the app registration whose subject is the identity's principal id. Documented by
  Microsoft for App Service and Functions; **not yet exercised here.**
- **Federated credentials on one managed identity cannot be written concurrently.** The
  first apply created two in parallel and Azure returned 409
  `ConcurrentFederatedIdentityCredentialsWritesForSingleManagedIdentity`. They are now two
  resources with `depends_on` between them. 26 of 27 resources succeeded on the first apply;
  the second apply added the one credential.
- **Easy Auth answers 401, not 302, to a non-browser client** even with
  `RedirectToLoginPage`: the redirect is sent only when the request accepts `text/html`.
  `curl` without an Accept header gets 401. The deploy probe accepts either, correctly. The
  empty Function App, before any package was uploaded, already returned 401 anonymously:
  the door was locked before there was a room behind it.
- **Resource provider `Microsoft.App` is not registered** in the subscription. It is only
  needed for Flex VNet integration (D11), so it was left alone.
- **`terraform apply` cannot run from the assistant's auto mode**; the harness classifier
  refuses unattended applies. Plans are saved with `-out=dev.tfplan` and applied by the
  operator: `terraform apply dev.tfplan`.

## GitHub

- **The SSH key on this machine maps to the work GitHub account**, which is not in
  `SageSalmon`. Pushes must go over HTTPS with the personal account's `gh` token, and that
  token needs the `workflow` scope to push `.github/workflows/*`. `gh auth refresh -s workflow`.
- **The reusable workflow checks out this repo from the app repo's run** using the app
  repo's default token. That only works if this repo is public (or the org allows it and a
  token is supplied). Decided: public (D3).
- **OIDC subjects ARE ID-qualified.** Setting the per-repo subject template returned
  `"use_immutable_subject": true` and `"sub_claim_prefix": "repo:<org>@<orgId>/<repo>@<repoId>"`.
  So the `repo` part of the subject carries numeric ids, as ref-arch-agent found. Whether the
  `job_workflow_ref` part is also ID-qualified is not shown by that API; the module trusts
  three forms until the first token arrives, then keeps one (D33). The template must include
  `job_workflow_ref`; the scaffold sets it per repo. An org-wide template needs `admin:org`.
- **Federated credentials on one identity are serialised**, and Terraform's `count` cannot
  chain element N on N-1, so the module documents `-parallelism=1` for applies that add
  more than one credential to the same identity. Two ran in parallel once and one failed
  with 409; the retry succeeded.
- **`azuread_application` and `azuread_application_identifier_uri` fight** unless the
  application ignores `identifier_uris`: the second apply "modified" the application and
  dropped the URI, and the third plan wanted to recreate it. `lifecycle { ignore_changes }`
  on the application settles it.

## Template and gates

- **The minimum release age refused the template on day one.** Every pin was the latest
  release, under seven days old. Pins are now the newest release at least seven days old,
  chosen by a small registry query. The abbreviated registry document
  (`application/vnd.npm.install-v1+json`) has no `time` field; the rule fetches the full one.
- **First real run failed on `node --test tests/`.** Node 26 (laptop) treats a directory
  argument as "run the tests in here"; Node 24 (the runner, and the Functions runtime) treats
  it as a module path and fails with MODULE_NOT_FOUND. The template now uses an explicit
  glob, `node --test "tests/**/*.test.ts"`, which both accept. Gate 2 had already passed on
  the real runner before this; the test step was the first laptop-versus-runner difference.
- **`node --test <dir>` recurses into fixtures.** The gate tests must be invoked as
  `node --test infra/gates/tests/*.test.mjs` or they run the fixture app's tests too.
- **A route "exists" only if it is registered.** The healthz rule first matched the string
  in `server/local.ts`; it now requires `route: "api/healthz"` in a registration.
- **Node 24 strips types natively**, so `server/local.ts` and the tests run with no build
  and no test framework. The Functions host still loads compiled JavaScript from
  `dist/server`, so `tsc` runs at build with `rewriteRelativeImportExtensions`.

## The first deploys, 2026-09-16

- **Run 1** failed at `npm test`: Node 24 does not accept a directory for `--test` (above).
  Gate 2 had already passed on the real runner, including the online release-age and
  audit rules.
- **Run 2** succeeded end to end: build, gates, package, OIDC sign-in as the deploy identity
  on the first attempt (three subject forms trusted), `config-zip` reported
  "Deployment was successful", and the anonymous probe got 401. The Functions host indexed
  `healthz`, `me`, and `static` with the declared routes; the catch-all did not shadow the
  API routes.
- **Run 3** printed the OIDC subject: repo ID-qualified, workflow reference plain. The
  module now trusts only that form.
- **Easy Auth redirect needs a browser User-Agent.** With `Accept: text/html` alone, curl
  still got 401; with a Mozilla User-Agent as well, it got the 302 to
  `login.microsoftonline.com` with the app's client id. `/.auth/login/aad` redirects
  regardless. So the deploy probe's "302 or 401" is right, and a monitoring check that wants
  the redirect must send browser headers.
- **`az functionapp deployment source config-zip` works for Flex Consumption.** No blob
  upload or trigger sync was needed.

## Not yet learned

- What the first real sign-in looks like with the secretless configuration: whether a
  member of the access group reaches `/api/me` and whether `user.signin` lands in
  Application Insights.
