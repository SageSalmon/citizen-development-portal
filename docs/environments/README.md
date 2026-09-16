# Environments

Everything that identifies a specific tenant, subscription, person, storage account, or
repository lives here, in one Markdown file per environment, **gitignored**. Committed
pages use `<placeholders>` and point here. `example.md` shows the shape.

| File | Committed? | Holds |
|------|-----------|-------|
| `README.md` | yes | this page |
| `example.md` | yes | the shape, with `<REPLACE_*>` tokens |
| `dev.md` | **no** | the real sage-salmon dev values |

The Terraform equivalents are `infra/terraform/local.auto.tfvars` and
`infra/terraform/envs/<env>.backend.hcl`, both gitignored, both with committed `.example`
files. Run `scripts/check-specifics.sh` (from the design-docs skill) with the identifiers in
`dev.md` before committing to confirm nothing leaked.
