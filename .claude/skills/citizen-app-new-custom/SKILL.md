---
name: citizen-app-new-custom
description: Build a new citizen app for the playground — scaffold a conforming TypeScript/React project on Azure Functions, vendor the platform's checks, create its GitHub repo in the playground org, and hand the developer three commands. Use when someone says "new app", "start an app", "scaffold", "create a citizen app", or asks how to get an app onto the playground.
---

# citizen-app-new-custom — build

You are helping a citizen developer, who may not know git, GitHub, or Azure. Speak in
their terms. Never ask them to run git or gh commands; you run them.

## 1. Prerequisites (stop if any is missing)

- Node 24+: `node --version`
- `gh` signed in to an account that is a member of the playground GitHub org
  (`SageSalmon`): `gh api user --jq .login` then `gh api orgs/SageSalmon/memberships/<login> --jq .state`
  must print `active`. If not: walk them through `gh auth login` (or `gh auth switch`)
  and stop until it is done. This is the one hard prerequisite (D24).
- This platform repo checked out locally (the scaffold script lives here; D19 is open).

## 2. Gather inputs, once

Ask only what cannot be detected. Defaults in brackets.

| Input | Ask as | Default |
|---|---|---|
| App name | "What should the app be called? Lowercase, hyphens, under 32 characters. It becomes the web address." | — |
| Owner email | detect: `gh api user --jq .email`, or `git config user.email`; confirm | current user |
| Business area | "Which team or business area is this for? (for cost reporting)" | — |
| One-line description | "Describe the app in one line." | "A citizen app." |
| Access group | "Who may sign in? I'll create a group called app-<name>-users with you in it." | `app-<name>-users` |
| Target directory | only if not obvious | sibling of this repo, named after the app |

The GitHub login allowed to deploy is the signed-in `gh` user.

## 3. Run the scaffold

```bash
node scripts/citizen-app-new-custom.mjs --name <name> --owner <email> --area <area> \
  --description "<one line>" --group <group> --github-login <gh login> [--dir <target>]
```

It copies `templates/react-app`, substitutes the inputs, vendors `infra/gates` as
`scripts/check.mjs`, runs `npm install --ignore-scripts`, runs the check, makes the first
commit, creates `SageSalmon/<name>` (private) and pushes, and sets the repo's OIDC subject
template. If the check fails, the template has a bug: report it, do not hand over.

## 4. Report, in the developer's words

- "Your app is saved and backed up. It has a home at github.com/SageSalmon/<name>."
- The three commands: `npm run dev`, `npm run check`, `npm test`.
- "The first deploy needs the platform team to admit the app. Say 'deploy' when you're ready and I'll start that."

## What this skill must not do

- Ask for anything infrastructure-shaped (subscription, resource group, region).
- Offer a public page, a role the owner does not hold, or a secret in the repo.
- Touch an existing directory or repo. It creates new ones only.

## What is real and what is not (2026-09-16)

Real and exercised: template copy, token substitution, vendored check, install, check
(both scaffolds so far passed). Written but **not yet run through this script**: `git init`,
commit, `gh repo create`, push, and the OIDC subject template. For `hello-citizen` those
were done by hand with the same commands and worked; the script's own path is unproven
until a scaffold runs without `--no-git`. Not built: distribution without this repo (D19),
Renovate enablement, the `react-fullstack` template.
