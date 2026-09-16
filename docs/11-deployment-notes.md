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
- **OIDC subjects may be ID-qualified** (`owner@id/repo@id`), per ref-arch-agent's
  AADSTS700213 experience. The module trusts both forms until the first token shows which
  arrives (D33). The subject template must include `job_workflow_ref`, set per repo by the
  scaffold script; an org-wide template needs `admin:org`, which the token lacks.

## Template and gates

- **The minimum release age refused the template on day one.** Every pin was the latest
  release, under seven days old. Pins are now the newest release at least seven days old,
  chosen by a small registry query. The abbreviated registry document
  (`application/vnd.npm.install-v1+json`) has no `time` field; the rule fetches the full one.
- **`node --test <dir>` recurses into fixtures.** The gate tests must be invoked as
  `node --test infra/gates/tests/*.test.mjs` or they run the fixture app's tests too.
- **A route "exists" only if it is registered.** The healthz rule first matched the string
  in `server/local.ts`; it now requires `route: "api/healthz"` in a registration.
- **Node 24 strips types natively**, so `server/local.ts` and the tests run with no build
  and no test framework. The Functions host still loads compiled JavaScript from
  `dist/server`, so `tsc` runs at build with `rewriteRelativeImportExtensions`.

## Not yet learned

- Whether `az functionapp deployment source config-zip` is the right upload for Flex, or
  whether a blob upload plus a sync-triggers call is needed.
- Whether the catch-all `{*path}` route yields to `api/healthz` and `api/me` under the
  Functions host as it does under the local server.
- What the first real sign-in looks like with the secretless configuration.
