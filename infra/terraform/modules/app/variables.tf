variable "name" { type = string }
variable "owner_email" { type = string }
variable "owner_object_id" {
  type        = string
  description = "Entra object id of the owner. Made a member of the access group so the owner can sign in to their own app."
}
variable "area" { type = string }
variable "description" { type = string }
variable "classification" { type = string }
variable "access_group_name" {
  type        = string
  description = "Display name of the Entra group whose members may sign in. Created here on the personal tenant (D6); in a corporate tenant it would be looked up, not created."
}
variable "node_version" {
  type    = string
  default = "24"
}
variable "github_oidc_subjects" {
  type        = list(string)
  description = "OIDC subjects GitHub may present for this app's deploy job (07, detail 1). Each must include job_workflow_ref. Several are listed because GitHub ID-qualifies subjects (owner@id/repo@id) and the exact form is confirmed on the first deploy."
}
variable "location" { type = string }
variable "resource_group_id" { type = string }
variable "resource_group_name" { type = string }
variable "tenant_id" { type = string }
variable "subscription_id" { type = string }
variable "appinsights_connection_string" { type = string }
variable "monitoring_identity_principal_id" { type = string }
variable "tags" { type = map(string) }
