## The playground environment: what every app shares. One resource group, one Log
## Analytics workspace, one Application Insights, one monitoring identity. Everything
## per app lives in modules/app and is instantiated from app-<name>.tf files.

locals {
  base = "${var.name_prefix}-${var.environment}"
  platform_tags = merge(var.tags, {
    environment = var.environment
    platform    = "citizen-playground"
    app         = "platform" # the shared row on the dashboard (06)
  })
}

resource "azapi_resource" "rg" {
  type     = "Microsoft.Resources/resourceGroups@2021-04-01"
  name     = "rg-${local.base}"
  location = var.location
  tags     = local.platform_tags
}

resource "azapi_resource" "logs" {
  type      = "Microsoft.OperationalInsights/workspaces@2023-09-01"
  name      = "log-${local.base}"
  parent_id = azapi_resource.rg.id
  location  = var.location
  tags      = local.platform_tags
  body = {
    properties = {
      sku             = { name = "PerGB2018" }
      retentionInDays = var.log_retention_days
    }
  }
}

resource "azapi_resource" "appinsights" {
  type      = "Microsoft.Insights/components@2020-02-02"
  name      = "appi-${local.base}"
  parent_id = azapi_resource.rg.id
  location  = var.location
  tags      = local.platform_tags
  body = {
    kind = "web"
    properties = {
      Application_Type    = "web"
      WorkspaceResourceId = azapi_resource.logs.id
      IngestionMode       = "LogAnalytics"
    }
  }
  response_export_values = ["properties.ConnectionString"]
}

## The platform monitoring identity (02, Heartbeat). Created now so every app's auth
## configuration can admit it; the heartbeat workflow that uses it is not built yet.
resource "azapi_resource" "monitoring_identity" {
  type                   = "Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31"
  name                   = "id-${local.base}-monitoring"
  parent_id              = azapi_resource.rg.id
  location               = var.location
  tags                   = local.platform_tags
  response_export_values = ["properties.principalId", "properties.clientId"]
}
