## Everything the reusable workflow needs, none of it secret. Written to
## infra/registry/<name>.json by scripts/write-registry.mjs after apply.
output "registry" {
  value = {
    name             = var.name
    owner            = var.owner_email
    hostname         = azapi_resource.func.output.properties.defaultHostName
    resource_group   = var.resource_group_name
    function_app     = local.func_name
    subscription_id  = var.subscription_id
    tenant_id        = var.tenant_id
    deploy_client_id = azapi_resource.identity["deploy"].output.properties.clientId
    auth_client_id   = azuread_application.app.client_id
    access_group_id  = azuread_group.access.object_id
    oidc_subjects    = var.github_oidc_subjects
  }
}
