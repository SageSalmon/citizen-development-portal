## One citizen app: Azure Functions Flex Consumption, built-in Entra auth with no client
## secret, three narrowly scoped identities, everything tagged for cost. Decided 2026-09-16
## (D30). Mirrors the proven ref-arch-agent pattern in this tenant (azapi for Flex).

locals {
  tags = merge(var.tags, {
    app            = var.name
    owner          = var.owner_email
    area           = var.area
    classification = var.classification
  })
  storage_name = substr(replace("st${var.name}${random_string.suffix.result}", "-", ""), 0, 24)
  func_name    = "${var.name}-${random_string.suffix.result}"
  issuer       = "https://login.microsoftonline.com/${var.tenant_id}/v2.0"
  roles = {
    blob_owner       = "b7e6dc6d-f1e8-4753-8033-0f276bb0955b" # Storage Blob Data Owner
    blob_contributor = "ba92f5b4-2d11-453d-a403-e96b0029c9fe" # Storage Blob Data Contributor
    queue            = "974c5e8b-45b9-4653-ba55-5f855dd0fb88" # Storage Queue Data Contributor
    table            = "0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3" # Storage Table Data Contributor
    website_contrib  = "de139f84-1756-47ae-9be6-808fbbe84772" # Website Contributor
  }
}

resource "random_string" "suffix" {
  length  = 5
  special = false
  upper   = false
}

## Three identities, three jobs. None is shared with any other app.
##   runtime  the app's own identity: its storage, later its Key Vault secrets and DB role
##   auth     used ONLY as the client assertion for Easy Auth (secretless sign-in)
##   deploy   what the platform's reusable workflow becomes via GitHub OIDC
resource "azapi_resource" "identity" {
  for_each               = toset(["runtime", "auth", "deploy"])
  type                   = "Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31"
  name                   = "id-${var.name}-${each.key}"
  parent_id              = var.resource_group_id
  location               = var.location
  tags                   = local.tags
  response_export_values = ["properties.principalId", "properties.clientId"]
}

## Storage: required by Functions, reached by managed identity only (no account keys).
resource "azapi_resource" "storage" {
  type      = "Microsoft.Storage/storageAccounts@2023-05-01"
  name      = local.storage_name
  parent_id = var.resource_group_id
  location  = var.location
  tags      = local.tags
  body = {
    kind = "StorageV2"
    sku  = { name = "Standard_LRS" }
    properties = {
      minimumTlsVersion        = "TLS1_2"
      allowBlobPublicAccess    = false
      allowSharedKeyAccess     = false
      supportsHttpsTrafficOnly = true
    }
  }
}

resource "azapi_resource" "deploy_container" {
  type      = "Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01"
  name      = "app-package"
  parent_id = "${azapi_resource.storage.id}/blobServices/default"
  body      = { properties = { publicAccess = "None" } }
}

resource "azapi_resource" "storage_role" {
  for_each = {
    runtime_blob  = { id = "runtime", role = local.roles.blob_owner }
    runtime_queue = { id = "runtime", role = local.roles.queue }
    runtime_table = { id = "runtime", role = local.roles.table }
    deploy_blob   = { id = "deploy", role = local.roles.blob_contributor }
  }
  type      = "Microsoft.Authorization/roleAssignments@2022-04-01"
  name      = uuidv5("url", "${azapi_resource.storage.id}/${each.key}")
  parent_id = azapi_resource.storage.id
  body = {
    properties = {
      roleDefinitionId = "/subscriptions/${var.subscription_id}/providers/Microsoft.Authorization/roleDefinitions/${each.value.role}"
      principalId      = azapi_resource.identity[each.value.id].output.properties.principalId
      principalType    = "ServicePrincipal"
    }
  }
}

## Flex Consumption plan: one app per plan is a platform rule, so one plan per app.
resource "azapi_resource" "plan" {
  type      = "Microsoft.Web/serverfarms@2023-12-01"
  name      = "plan-${local.func_name}"
  parent_id = var.resource_group_id
  location  = var.location
  tags      = local.tags
  body = {
    kind       = "functionapp"
    sku        = { name = "FC1", tier = "FlexConsumption" }
    properties = { reserved = true }
  }
}

resource "azapi_resource" "func" {
  type      = "Microsoft.Web/sites@2023-12-01"
  name      = local.func_name
  parent_id = var.resource_group_id
  location  = var.location
  tags      = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azapi_resource.identity["runtime"].id, azapi_resource.identity["auth"].id]
  }

  body = {
    kind = "functionapp,linux"
    properties = {
      serverFarmId = azapi_resource.plan.id
      reserved     = true
      httpsOnly    = true
      functionAppConfig = {
        deployment = {
          storage = {
            type  = "blobContainer"
            value = "https://${local.storage_name}.blob.core.windows.net/app-package"
            authentication = {
              type                           = "UserAssignedIdentity"
              userAssignedIdentityResourceId = azapi_resource.identity["runtime"].id
            }
          }
        }
        runtime = { name = "node", version = var.node_version }
        scaleAndConcurrency = {
          maximumInstanceCount = 40
          instanceMemoryMB     = 512
        }
      }
      siteConfig = {
        ftpsState     = "Disabled"
        minTlsVersion = "1.2"
        appSettings = [
          { name = "AzureWebJobsStorage__accountName", value = local.storage_name },
          { name = "AzureWebJobsStorage__credential", value = "managedidentity" },
          { name = "AzureWebJobsStorage__clientId", value = azapi_resource.identity["runtime"].output.properties.clientId },
          { name = "APPLICATIONINSIGHTS_CONNECTION_STRING", value = var.appinsights_connection_string },
          # Secretless Easy Auth: the auth identity's client id is the client assertion.
          { name = "OVERRIDE_USE_MI_FIC_ASSERTION_CLIENTID", value = azapi_resource.identity["auth"].output.properties.clientId },
          { name = "WEBSITE_AUTH_AAD_ALLOWED_TENANTS", value = var.tenant_id },
          { name = "APP_NAME", value = var.name },
          { name = "APP_OWNER", value = var.owner_email },
          { name = "LOG_LEVEL", value = "info" },
        ]
      }
    }
  }
  response_export_values = ["properties.defaultHostName"]
  depends_on             = [azapi_resource.storage_role, azapi_resource.deploy_container]
}

## The app registration Easy Auth signs users in against. Holds no credential: the auth
## managed identity is trusted as a federated credential instead of a client secret.
resource "azuread_application" "app" {
  display_name     = "citizen-app-${var.name}"
  sign_in_audience = "AzureADMyOrg"
  web {
    redirect_uris = ["https://${azapi_resource.func.output.properties.defaultHostName}/.auth/login/aad/callback"]
    implicit_grant { id_token_issuance_enabled = true }
  }
  tags = ["citizen-playground", var.name]
  lifecycle { ignore_changes = [identifier_uris] } # managed by azuread_application_identifier_uri below
}

resource "azuread_application_identifier_uri" "app" {
  application_id = azuread_application.app.id
  identifier_uri = "api://${azuread_application.app.client_id}"
}

resource "azuread_application_federated_identity_credential" "easy_auth" {
  application_id = azuread_application.app.id
  display_name   = "easy-auth-managed-identity"
  issuer         = local.issuer
  subject        = azapi_resource.identity["auth"].output.properties.principalId
  audiences      = ["api://AzureADTokenExchange"]
}

## Assignment required: only members of the access group (and the platform monitoring
## identity) get a token for this app. Everyone else stops at Entra.
resource "azuread_service_principal" "app" {
  client_id                    = azuread_application.app.client_id
  app_role_assignment_required = true
  tags                         = ["citizen-playground", var.name]
}

resource "azuread_group" "access" {
  display_name     = var.access_group_name
  security_enabled = true
  description      = "May sign in to citizen app ${var.name}. Owner: ${var.owner_email}."
  members          = [var.owner_object_id]
}

resource "azuread_app_role_assignment" "group" {
  app_role_id         = "00000000-0000-0000-0000-000000000000" # default access
  principal_object_id = azuread_group.access.object_id
  resource_object_id  = azuread_service_principal.app.object_id
}

resource "azuread_app_role_assignment" "monitoring" {
  app_role_id         = "00000000-0000-0000-0000-000000000000"
  principal_object_id = var.monitoring_identity_principal_id
  resource_object_id  = azuread_service_principal.app.object_id
}

## Easy Auth. Runs before any function code; anonymous browsers are redirected to sign in.
## authsettingsV2 exists on every site from creation, so this is an update, not a create.
resource "azapi_update_resource" "auth" {
  type        = "Microsoft.Web/sites/config@2023-12-01"
  resource_id = "${azapi_resource.func.id}/config/authsettingsV2"
  body = {
    properties = {
      platform = { enabled = true, runtimeVersion = "~1" }
      globalValidation = {
        requireAuthentication       = true
        unauthenticatedClientAction = "RedirectToLoginPage"
        redirectToProvider          = "azureactivedirectory"
      }
      identityProviders = {
        azureActiveDirectory = {
          enabled = true
          registration = {
            openIdIssuer            = local.issuer
            clientId                = azuread_application.app.client_id
            clientSecretSettingName = "OVERRIDE_USE_MI_FIC_ASSERTION_CLIENTID"
          }
          validation = {
            allowedAudiences = ["api://${azuread_application.app.client_id}", azuread_application.app.client_id]
          }
        }
      }
      login = {
        tokenStore = { enabled = true } # for on-behalf-of later (user mode)
      }
    }
  }
  depends_on = [azuread_application_federated_identity_credential.easy_auth]
}

## The deploy identity trusts exactly one GitHub subject: this repo running the platform's
## reusable workflow on main. Anything else that asks for a token gets nothing.
##
## Written ONE AFTER THE OTHER: Azure rejects concurrent federated credential writes on a
## single managed identity (409 ConcurrentFederatedIdentityCredentialsWritesForSingleManagedIdentity).
## GitHub presents `repo:<org>@<orgId>/<repo>@<repoId>:job_workflow_ref:<org>/<platform-repo>/<path>@refs/heads/main`
## (confirmed from the token on 2026-09-16, D33). The list form remains so a second subject
## can be trusted briefly during a rename or a workflow move.
resource "azapi_resource" "deploy_fic" {
  count     = length(var.github_oidc_subjects)
  type      = "Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31"
  name      = "github-platform-workflow-${count.index}"
  parent_id = azapi_resource.identity["deploy"].id
  body = {
    properties = {
      issuer    = "https://token.actions.githubusercontent.com"
      subject   = var.github_oidc_subjects[count.index]
      audiences = ["api://AzureADTokenExchange"]
    }
  }
  # serialize: each waits for the previous one via a null dependency chain
  depends_on = [terraform_data.deploy_fic_serialiser, azapi_resource.storage_role]
}

# Terraform cannot express "element N depends on element N-1" inside one resource, so the
# credentials are applied with -parallelism=1 for this module in practice; this marker
# documents the constraint and keeps them after the identity's role assignments.
resource "terraform_data" "deploy_fic_serialiser" {
  input = azapi_resource.identity["deploy"].id
}

## The deploy identity may push a package to THIS app and nothing else.
resource "azapi_resource" "deploy_website_role" {
  type      = "Microsoft.Authorization/roleAssignments@2022-04-01"
  name      = uuidv5("url", "${azapi_resource.func.id}/deploy/website-contributor")
  parent_id = azapi_resource.func.id
  body = {
    properties = {
      roleDefinitionId = "/subscriptions/${var.subscription_id}/providers/Microsoft.Authorization/roleDefinitions/${local.roles.website_contrib}"
      principalId      = azapi_resource.identity["deploy"].output.properties.principalId
      principalType    = "ServicePrincipal"
    }
  }
}
