# 13 — Demo runbook: new app, deploy, sign in

The steps to show the playground working end to end with the two skills, as built on
2026-09-16. Every step here has run at least once, except where marked **first time**.
Budget about 25 minutes plus one Terraform apply by the operator. Environment values are in
`environments/dev.md` (gitignored); this page uses `<placeholders>`.

## Roles in the demo

| Role | Who, in the dev environment | Does |
|------|-----------------------------|------|
| Citizen developer | the presenter, in Claude Code | says "new app" and "deploy"; never touches Azure |
| Platform operator | the presenter, in a terminal | admits the app: one Terraform file, one apply, one commit |
| User | the presenter, in a browser | signs in as a member of the app's access group |

In the dev environment all three are the same person. Say so out loud; the design keeps
them separate and the demo collapses them for convenience.

## 0. Before the audience arrives

Run these in the platform repo checkout. Each should print the value shown.

```bash
azctx sage                      # Azure context: personal tenant (D6)
az account show --query user.name -o tsv          # <operator email in the personal tenant>
gh api user --jq .login                            # <gh login that is a member of the org>
gh api -i user 2>/dev/null | grep -i x-oauth-scopes   # must include: repo, workflow
gh api orgs/SageSalmon/memberships/$(gh api user --jq .login) --jq .state   # active
node --version                                     # v24 or later
cd infra/terraform && terraform plan -var-file=envs/dev.tfvars -input=false | tail -1
                                                   # No changes. Your infrastructure matches the configuration.
```

Pick the demo app name now. It must be lowercase letters, digits, hyphens, 2 to 32
characters, and not already a repo in the org. This page uses `demo-notes`.

Optional but worth it: open `https://<hello-citizen hostname>/` in a browser and sign in
once, so the audience can see a finished app before the new one exists.

## 1. New app (skill: `citizen-app-new-custom`)

In Claude Code, from the platform repo, say:

> New app called demo-notes for the finance area. One line: "Shared notes for the finance
> team." Owner is me.

What the skill does, and what to point at while it runs:

1. Checks Node, `git`, and that `gh` is signed in to a member of the org. If the token
   lacks the `workflow` scope it stops here and tells you the `gh auth refresh` command.
2. Runs `scripts/citizen-app-new-custom.mjs`. Show the output: template copied, tokens
   substituted, gate engine vendored to `scripts/check.mjs`, `npm install --ignore-scripts`,
   then the check, which should end `check: OK`.
3. **First time through the script:** `git init`, first commit, `gh repo create
   SageSalmon/demo-notes --private`, push, and the OIDC subject template. If any of these
   fail, the same commands run by hand worked for `hello-citizen`; do that and note it in
   [12-known-gaps.md](12-known-gaps.md).
4. Reports the three commands and the repo URL.

Show the result:

```bash
cd ../demo-notes
cat app.yaml                                   # the one file the platform reads
npm run check                                  # the platform's rules, locally
npm run dev                                    # API on :7071, web on :5173
```

Open `http://localhost:5173`. The page greets the fake local user from `.env.example`
(copy it to `.env` first if you want a name to appear). Say: locally there is no Entra in
front; on the platform there is, and the app cannot tell the difference because it only
reads identity headers.

Open `https://github.com/SageSalmon/demo-notes/actions`. The push already triggered the
platform workflow. Job A (build and gates) should be green. Job B is **skipped** on a
non-owner push or fails with **"demo-notes is not admitted"** on an owner push. That
message is the demo's pivot: the platform has never heard of this app.

## 2. Admit the app (operator, manual today)

This is Gate 1 as it exists: a person, one Terraform file, one apply. Say that the design
generates this from `app.yaml` in a pull request and that it is not built yet.

```bash
cd ~/code/citizen-development-portal/infra/terraform
cp app-hello-citizen.tf app-demo-notes.tf
```

Edit `app-demo-notes.tf`: replace every `hello_citizen` with `demo_notes` and every
`hello-citizen` with `demo-notes`; set `area = "finance"` and the description. Then add the
four identifying values to `local.auto.tfvars` (gitignored):

```bash
REPO_ID=$(gh api repos/SageSalmon/demo-notes --jq .id)
ORG_ID=$(gh api orgs/SageSalmon --jq .id)
cat >> local.auto.tfvars <<EOT
demo_notes_owner_email     = "<owner email>"
demo_notes_owner_object_id = "<owner object id>"      # az ad signed-in-user show --query id -o tsv
demo_notes_github_repo_id  = "$REPO_ID"
demo_notes_github_org_id   = "$ORG_ID"
EOT
terraform plan -var-file=envs/dev.tfvars -input=false -out=dev.tfplan | tail -1
                                                   # Plan: 26 to add, 0 to change, 0 to destroy.
terraform apply -parallelism=1 dev.tfplan          # 2 to 3 minutes; -parallelism=1 because of the credential writes
cd ../.. && node scripts/write-registry.mjs        # wrote infra/registry/demo-notes.json
git add -A && git commit -m "Admit demo-notes" && git push
```

While it applies, show what it is creating: one Function App and plan, one storage
account with no keys, three identities, one app registration with no secret, one Entra
group with the owner in it, and the auth configuration that admits only that group.

## 3. Deploy (skill: `citizen-app-deploy-custom`)

Back in Claude Code, in the `demo-notes` directory, say:

> Deploy.

The skill runs the check, finds `infra/registry/demo-notes.json` in the platform repo, and
either pushes pending changes or, with nothing to push, re-runs the last workflow. To
force a run for the demo, make a visible change first:

```bash
sed -i '' 's/Shared notes for the finance team./Shared notes for the finance team. Deployed live in the demo./' web/src/App.tsx
```

Then "deploy". Follow along in the Actions tab or with `gh run watch`. What to narrate:

- **Job A** has no cloud credentials. It runs the platform's copy of the gates, including
  the online rules: registry publish dates for the seven-day minimum, and `npm audit`.
- **Job B** never checks out the app. It reads the registry record, prints the OIDC
  subject GitHub presented, signs in to Azure as the app's deploy identity for a few
  minutes, uploads the package, and asks for `/api/healthz` anonymously expecting to be
  refused.
- The run summary shows the gate report, the subject, who deployed, and the URL.

Expect two to three minutes. The first request after a deploy is a cold start of a few seconds.

## 4. Sign in (user)

Open the URL from the run summary in a **private browser window**:

1. Entra sign-in page appears. Sign in as the owner, who is in `app-demo-notes-users`.
2. The app loads and greets you by name. Open `/api/me` to show the identity the platform
   handed the code: object id, UPN, display name, nothing else.
3. In a terminal, show that a stranger gets nothing:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<demo-notes hostname>/api/healthz    # 401
```

4. If a second account exists that is **not** in the group, sign in with it in another
   private window. Entra refuses with an assignment error before the app is reached. This
   is the "no public app" rule enforced by Entra, not by code.
5. **Not yet observed:** the `user.signin` event in Application Insights. Run this in
   the `appi-citizen-dev` Logs blade a few minutes after signing in and record the result in
   [11-deployment-notes.md](11-deployment-notes.md):

```kusto
traces
| where message has "user.signin"
| project timestamp, message
| order by timestamp desc
```

## 5. What to say is not real yet

- Admission is a person editing Terraform, not a generated PR.
- The scaffold's repo step runs for the first time in this demo (or was done by hand).
- The health gate proves the door is locked, not that a signed-in user gets a 200.
- No rollback; a bad package takes traffic and is fixed by redeploying the previous one.
- No custom domain, no Key Vault, no database, no dashboard, no heartbeat.
- Terraform runs as the operator's own account, the widest credential in the system.

[12-known-gaps.md](12-known-gaps.md) has the full list with what closing each one takes.

## 6. Tear down (optional, after the demo)

```bash
cd infra/terraform && git rm app-demo-notes.tf && git rm ../registry/demo-notes.json
terraform plan -var-file=envs/dev.tfvars -input=false -out=dev.tfplan | tail -1   # 26 to destroy
terraform apply dev.tfplan
git commit -am "Retire demo-notes" && git push
gh repo delete SageSalmon/demo-notes --yes
```

Remove the four `demo_notes_*` lines from `local.auto.tfvars`. Retirement is one file and
one apply, which is what the vision promised.

## If something goes wrong

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Scaffold stops at prerequisites | `gh` token lacks `workflow`, or wrong account active | `gh auth switch -u <org member>` then `gh auth refresh -h github.com -s repo,workflow,read:org` |
| `check: REFUSED` on a fresh scaffold, release-age rule | a template dependency had a release in the last seven days | pin the previous version in `templates/react-app/package.json`; the rule is doing its job |
| Job B: "not admitted" | registry record not committed to the platform repo's `main` | finish step 2, then re-run |
| Job B: AADSTS700213 on `azure/login` | the OIDC subject does not match the credential | compare the printed `sub` with `terraform output`; the repo id or org id in `local.auto.tfvars` is wrong |
| 409 ConcurrentFederatedIdentityCredentialsWrites | apply without `-parallelism=1` | re-run the apply with it |
| Browser gets 401 instead of a sign-in page | client without a browser User-Agent | use a real browser; curl needs `-A Mozilla/5.0 -H 'Accept: text/html'` |
| Entra: "not assigned to a role for the application" | user is not in the access group | add them to `app-<name>-users` in Entra; propagation takes a minute |
| Cold start over 30 s | first request after deploy on Flex Consumption | wait and retry; the 30 s host limit is Azure's |
