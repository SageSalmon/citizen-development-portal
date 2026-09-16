terraform {
  required_version = ">= 1.9"
  required_providers {
    azapi   = { source = "azure/azapi", version = "~> 2.12" }
    azuread = { source = "hashicorp/azuread", version = "~> 3.9" }
    random  = { source = "hashicorp/random", version = "~> 3.9" }
  }
  # State in the same storage account ref-arch-agent bootstrapped. Values come from
  # envs/<env>.backend.hcl (gitignored; copy the .example):
  #   terraform init -backend-config=envs/dev.backend.hcl
  backend "azurerm" {}
}

provider "azapi" { subscription_id = var.subscription_id }
provider "azuread" { tenant_id = var.tenant_id }
