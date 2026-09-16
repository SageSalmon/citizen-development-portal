# Dev environment: the values safe to commit. Identifying values (subscription, tenant,
# people, repo ids) live in local.auto.tfvars (gitignored, auto-loaded).
#   terraform plan -var-file=envs/dev.tfvars
location    = "eastus2"
environment = "dev"
name_prefix = "citizen"
github_org  = "SageSalmon"
