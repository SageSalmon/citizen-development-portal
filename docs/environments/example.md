# Environment: <name>

Copy to `<name>.md` (gitignored) and fill in. Never commit the filled copy.

## Azure

| Item | Value |
|------|-------|
| Context (`azctx`) | `<REPLACE_sage|jhc>` |
| Account | `<REPLACE_WITH_LOGIN_EMAIL>` |
| Tenant id | `<REPLACE_WITH_TENANT_GUID>` |
| Subscription | `<REPLACE_WITH_SUBSCRIPTION_NAME>` (`<REPLACE_WITH_SUBSCRIPTION_GUID>`) |
| Region | `<REPLACE_WITH_REGION>` |
| Resource group | `rg-citizen-<env>` |
| Terraform state | `<REPLACE_WITH_TFSTATE_RG>` / `<REPLACE_WITH_TFSTATE_STORAGE_ACCOUNT>` / `tfstate` / `citizen-development-portal.<env>.tfstate` |

## GitHub

| Item | Value |
|------|-------|
| Organization | `<REPLACE_WITH_ORG>` (id `<REPLACE_WITH_ORG_ID>`) |
| gh account | `<REPLACE_WITH_GH_LOGIN>` |
| Platform repo | `<org>/citizen-development-portal` (id `<REPLACE>`) |

## Admitted apps

| App | Owner | Repo id | Function app | Hostname | Access group |
|-----|-------|---------|--------------|----------|--------------|
| `<name>` | `<REPLACE_WITH_OWNER_EMAIL>` | `<REPLACE>` | `<name>-<suffix>` | `<REPLACE>.azurewebsites.net` | `app-<name>-users` |

## People

| Role | Person | Object id |
|------|--------|-----------|
| Platform operator | `<REPLACE>` | `<REPLACE_WITH_OBJECT_ID>` |
