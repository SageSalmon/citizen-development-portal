---
name: citizen-app-new-netlify
description: Build a new citizen-style app hosted on Netlify for comparison with the custom playground — scaffold a TypeScript/React project with Netlify Functions from the netlify-app template, customize it to what the developer wants, create the site in a Netlify team, and deploy it from the laptop. Use when someone says "new netlify app", "netlify version", "scaffold on netlify", or wants to demo the Netlify side.
---

# citizen-app-new-netlify — build on Netlify

The Netlify counterpart of `citizen-app-new-custom`. Same inputs, same developer-facing
tone. What is different is what is **absent**: no GitHub repo, no admission, no gate
engine, no OIDC, no identity reaching the code. Name each absence when it comes up; they are
the comparison.

## 0. Where to start

Run from a checkout of the platform repo; the template and scaffold script are here. The
developer does **not** create a directory. The script creates the target (default: a
sibling of this repo named after the app) and refuses one that already exists.

## 1. Prerequisites (stop if any is missing)

- Node 22+: `node --version`
- Netlify CLI signed in: `npx netlify api getCurrentUser --data '{}' | head -c 200`. If not,
  the developer runs `npx netlify login` (opens a browser; on an Enterprise team this is the
  organization's SSO).
- The team to deploy into: `npx netlify api listAccountsForUser | node -pe 'JSON.parse(require("fs").readFileSync(0)).map(a=>a.slug+" ("+a.type_name+", "+a.members_count+" members)").join("\n")'`.
  **Ask which team.** On a team that belongs to another group, get their say-so first; a
  site in their team draws on their usage allocation and appears in their site list.
- This platform repo checked out locally.

## 2. Gather inputs, once

| Input | Ask as | Default |
|---|---|---|
| App name | "What should the app be called? Lowercase, hyphens. It becomes `<name>.netlify.app`, so it must be unique across all of Netlify." | — |
| Owner email | detect from `git config user.email`; confirm | current user |
| Business area | "Which team or business area is this for?" | — |
| One-line description | "Describe the app in one line." | "A citizen app on Netlify." |
| Netlify team | from the list above | — |
| Target directory | only if not obvious | sibling of this repo, named after the app |
| **What the app should do** | "What should the page show or do?" | the two comparison panels only |

## 3. Scaffold

```bash
node scripts/citizen-app-new-netlify.mjs --name <name> --owner <email> --area <area> \
  --description "<one line>" --team <team slug> [--dir <target>] [--no-deploy]
```

Copies `templates/netlify-app`, substitutes inputs, `npm install --ignore-scripts`, `check`,
`test`, `build`, then creates the site in the team, sets `APP_NAME`, and deploys. Use
`--no-deploy` to customize first and deploy afterwards with `citizen-app-deploy-netlify`.

## 4. Customize to what the developer asked for

Edit `web/src/App.tsx` in the new app: add the content, forms, or panels they described.
Keep the two comparison panels (who the app thinks you are; heartbeat) unless asked to
remove them. New API routes are new `netlify/functions/<name>.mts` files with a
`config.path`. If a route needs a backend credential, it can only come from
`npx netlify env:set <NAME> <value> --secret`. State that the credential now lives in
Netlify's environment with whatever reach the author gave it; that is the comparison's
central point. Re-run `npm run check && npm test && npm run build`, then deploy.

## 5. Report, in the developer's words

- "Your app is live at https://<name>.netlify.app. Who can open it is whatever the
  `<team>` team enforces; on this team that is the organization's SSO login for team members."
- "The app cannot tell who you are; the first panel shows why."
- "There is no repo. It was deployed from this laptop. To deploy again, say 'deploy'."
- The three commands: `npm run dev`, `npm run check`, `npm test`.

## What this skill must not do

- Create a site in a team the developer did not name.
- Implement a login inside the app or fake an identity.
- Put a credential anywhere but a Netlify environment variable, and never silently.
- Touch an existing directory or site.

## What is real and what is not (2026-09-17)

Real: the template, the scaffold script through `build` (run on a fixture). The site-create
and deploy steps use the same commands that deployed `citizen-poc-netlify` by hand on
2026-09-17; **the script's own path through them is unexercised** until a scaffold runs
without `--no-deploy`. Not built: linking a GitHub repo for deploy previews; Netlify Identity
(dropped: redundant behind team login and no instance on the team's sites).
