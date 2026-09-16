variable "subscription_id" { type = string }
variable "tenant_id" { type = string }
variable "location" {
  type    = string
  default = "eastus2" # must support Flex Consumption: az functionapp list-flexconsumption-locations
}
variable "environment" {
  type    = string
  default = "dev"
}
variable "name_prefix" {
  type    = string
  default = "citizen"
}
variable "github_org" {
  type        = string
  description = "GitHub organization holding the platform repo and every citizen app repo (D31)."
}
variable "platform_repo" {
  type    = string
  default = "citizen-development-portal"
}
variable "platform_workflow_path" {
  type    = string
  default = ".github/workflows/build-and-deploy.yml"
}
variable "log_retention_days" {
  type    = number
  default = 30
}
variable "tags" {
  type    = map(string)
  default = {}
}
variable "platform_repo_id" {
  type        = string
  description = "Numeric GitHub id of the platform repo, for ID-qualified OIDC subjects. gh api repos/<org>/<repo> --jq .id"
  default     = "0"
}
