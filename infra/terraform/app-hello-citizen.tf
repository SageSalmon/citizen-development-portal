## Admitted app: hello-citizen. One block per app; identifying values come from
## local.auto.tfvars. In the full design this file is generated from app.yaml by the
## admission PR (Gate 1); today it is written by hand.
variable "hello_citizen_owner_email" { type = string }
variable "hello_citizen_owner_object_id" { type = string }
variable "hello_citizen_github_repo_id" { type = string }
variable "hello_citizen_github_org_id" { type = string }

module "app_hello_citizen" {
  source = "./modules/app"

  name              = "hello-citizen"
  owner_email       = var.hello_citizen_owner_email
  owner_object_id   = var.hello_citizen_owner_object_id
  area              = "platform"
  description       = "First app on the playground: proves the path from repo to running, signed-in app."
  classification    = "internal"
  access_group_name = "app-hello-citizen-users"
  node_version      = "24"

  # The exact subject GitHub presents, read from the token on the first deploy (2026-09-16):
  # the repo part is ID-qualified (immutable subject), the job_workflow_ref part is plain.
  # Only this one form is trusted (07, detail 1; D33).
  github_oidc_subjects = [
    "repo:${var.github_org}@${var.hello_citizen_github_org_id}/hello-citizen@${var.hello_citizen_github_repo_id}:job_workflow_ref:${var.github_org}/${var.platform_repo}/${var.platform_workflow_path}@refs/heads/main",
  ]

  location                         = var.location
  resource_group_id                = azapi_resource.rg.id
  resource_group_name              = azapi_resource.rg.name
  tenant_id                        = var.tenant_id
  subscription_id                  = var.subscription_id
  appinsights_connection_string    = azapi_resource.appinsights.output.properties.ConnectionString
  monitoring_identity_principal_id = azapi_resource.monitoring_identity.output.properties.principalId
  tags                             = local.platform_tags
}

output "hello_citizen" { value = module.app_hello_citizen.registry }
