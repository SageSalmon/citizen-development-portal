# 14 — Demo runbook (Netlify): new app, deploy, sign in

The Netlify half of the demo, to run beside [13-demo-runbook-custom.md](13-demo-runbook-custom.md).
Same shape, same two skills by name, so the audience sees what is missing rather than
being told. Every step here has run at least once except where marked **first time**.
Budget 10 minutes. Team and site values are in `environments/dev.md` (gitignored).

## Roles

| Role | Who | Does |
|------|-----|------|
| Citizen developer | the presenter, in Claude Code | says "new netlify app" and "deploy" |
| Platform operator | nobody | there is no admission step |
| User | the presenter, in a browser | signs in through the Netlify team's SSO |

Say the middle row aloud. It is the demo.

## 0. Before the audience arrives

```bash
npx netlify api getCurrentUser --data '{}' | head -c 120       # signed in
npx netlify api listAccountsForUser | node -pe 'JSON.parse(require("fs").readFileSync(0)).map(a=>a.slug).join(" ")'   # includes the demo team
node --version                                                  # v22 or later
```

Confirm with the owners of the demo team that a throwaway site there is fine. Pick a name
unique across Netlify (it becomes `<name>.netlify.app`); this page uses `demo-notes-netlify`.

Optional: have `citizen-poc-netlify` open in a browser already signed in.

## 1. New app (skill: `citizen-app-new-netlify`)

In Claude Code, from the platform repo, say:

> New netlify app called demo-notes-netlify for the finance area, in team <slug>. One line:
> "Shared notes for the finance team." Owner is me.

What to point at while it runs:

1. Prerequisites: Node, Netlify signed in, team membership. No `gh`, no `git`.
2. Scaffold: template copied, `npm install --ignore-scripts`, `check`, `test`, `build`.
3. **First time through the script:** `sites:create` in the team, `env:set APP_NAME`,
   `netlify deploy --prod`. The same three commands deployed `citizen-poc-netlify` by hand.
4. Report: the live URL, "who can open it is whatever the team enforces", "there is no repo".

Elapsed: about two minutes from sentence to live URL. Compare with the custom runbook, where
the same sentence ends at "not admitted" and a Terraform apply stands between the developer
and a running app. Both facts are true; say which one you want.

## 2. Customise

Ask for something visible:

> Add a panel listing three sample notes with a title and a date.

The skill edits `web/src/App.tsx`, re-runs check, test, build. If the audience asks for
something that needs a backend key, let the skill say where the key would go. That sentence
is the point of the comparison.

## 3. Deploy (skill: `citizen-app-deploy-netlify`)

> Deploy.

Check, test, build, `netlify deploy --prod`, one to two minutes. What to narrate:

- The checks are advisory. Nothing on Netlify's side runs them.
- No pipeline, no gates, no OIDC, no artifact. The laptop is the deploy path, and the
  laptop's Netlify token is the credential.
- `/api/healthz` reports `commit: unknown`: nothing records which source is running.

## 4. Sign in (user)

Open the URL in a **normal** browser window (not private; the edge-access handshake needs
cookies and JavaScript):

1. Netlify's team login redirects to the organisation's identity provider. Expect two
   prompts: one for `app.netlify.com`, one for the site's edge-access handshake. Sign in.
2. The page loads. The first panel says the app does **not** know who you are, and lists the
   only headers Netlify added: the team that owns the site.
3. In a terminal, show the closed door:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://demo-notes-netlify.netlify.app/api/healthz    # 401
```

4. Anyone not on the Netlify team, including any employee, is refused at the edge. Say what
   that means for the audience of a citizen app: viewers must be Netlify team members.

## 5. What to say is not real

- No source control. Deploys come from a laptop; the running code has no provenance.
- No admission, no owner, no access group. Who can view is the Netlify team, all or nothing.
- No identity reaches the app: no `user.signin`, no acting on the user's behalf, no
  on-behalf-of to Microsoft services.
- Credentials for any backend are environment variables an author set; nobody re-verifies them.
- No Netlify Identity: redundant behind team login, and no instance exists on this team's sites.
- The functions run on AWS Lambda (observed in a stack trace, 2026-09-17), outside the
  organisation's Azure tenant.

The comparison page [10-netlify-comparison.md](10-netlify-comparison.md) has the evidence
for each line.

## 6. Tear down

In the Netlify UI: Project configuration, General, Danger zone, Delete project. Or:

```bash
cd ../demo-notes-netlify && npx netlify sites:delete --force
```

Also `citizen-poc-netlify` when the comparison work is finished; it is in another team's list.

## If something goes wrong

| Symptom | Cause | Fix |
|---------|-------|-----|
| `sites:create` fails: name taken | `.netlify.app` names are global | choose another name |
| Page is blank with "enable JavaScript" | the 401 page's redirect is script-driven | disable blockers for the site |
| 401 loops after signing in | third-party cookies blocked | normal window, cookies allowed for `netlify.app` and `app.netlify.com` |
| Deploy succeeds, functions 500 | esbuild bundling a native dependency | check the function log link in the deploy output |
| "Failed to load settings from /.netlify/identity" | old template with the Identity widget | this template has no Identity; rebuild from it |
