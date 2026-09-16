---
name: deploy-citizen-app
description: Deploy a citizen app to the playground and explain what the platform decided in plain language — run the checks locally, confirm the app is admitted, push to main, follow the build-and-deploy run, and translate gate results. Use when someone says "deploy", "ship it", "put this on the playground", "why did my deploy fail", or asks whether their app is live.
---

# deploy-citizen-app — deploy

Everything between "my code works locally" and "my colleagues can open it". The developer
never reads a workflow log; they hear what the platform decided and why.

## Procedure

1. **Is this a playground app?** `app.yaml` exists, `.github/workflows/deploy.yml` calls
   `SageSalmon/citizen-development-portal/.github/workflows/build-and-deploy.yml@main`,
   and `git remote get-url origin` is in `SageSalmon`. If not, say what is missing and stop.
2. **Run the check locally:** `node scripts/check.mjs --online`. If it refuses, show the
   ✖ lines verbatim (every message is written for this reader) and stop. The platform
   would say the same thing, minutes later.
3. **Is the app admitted?** Read `app.yaml` `name`, then:
   `gh api repos/SageSalmon/citizen-development-portal/contents/infra/registry/<name>.json --jq .name`
   - 404: not admitted. Tell the developer: "The platform team needs to admit your app
     before its first deploy. I've noted what they need." Then tell **the platform
     operator** (today: Bill) to add `infra/terraform/app-<name>.tf`, apply, run
     `node scripts/write-registry.mjs`, commit. **Aspirational:** the skill opening that
     admission PR itself (03-skills.md); not built.
   - found: continue.
4. **Commit and push.** Show the diff summary, propose a message, commit with the
   developer's identity, `git push origin main`.
5. **Follow the run:** `gh run watch --exit-status` (or `gh run list --limit 1` then
   `gh run view <id> --log-failed`). Translate:
   - Gate 2 block lines → "The playground checked your app. N things need fixing:" then the
     messages verbatim.
   - deploy job skipped → "It built, but only <deployers from app.yaml> may deploy. You
     pushed as <actor>."
   - "not admitted" → step 3 wording.
   - success → "It's live at https://<hostname>, behind sign-in for members of
     <access.group>." Read the hostname from the run summary or the registry file.
6. **Idempotent.** Nothing to push and nothing running: report the URL and the last deploy
   from `gh run list --limit 1`, and stop.

## What it never does

- Change `owner`, `identity`, or `access` in app.yaml on the developer's behalf.
- Bypass a refusal. There is no `--force`.
- Run Terraform or touch Azure. It pushes to GitHub; the platform does the rest.
- Publish anything to a Fabric workspace (09).

## What is real and what is not (2026-09-16)

Real: steps 1, 2, 4, 5, 6 with the reusable workflow as built. Admission (step 3) is a
manual operator step, not a PR the skill opens. Health after deploy is verified only as
"anonymous request is refused", not as an authenticated 200 (12-known-gaps.md).
