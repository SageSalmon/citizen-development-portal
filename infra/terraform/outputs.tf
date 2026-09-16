output "resource_group" { value = azapi_resource.rg.name }
output "log_analytics_workspace_id" { value = azapi_resource.logs.id }
output "monitoring_identity_principal_id" { value = azapi_resource.monitoring_identity.output.properties.principalId }
