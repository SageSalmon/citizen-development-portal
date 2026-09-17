# Findings

Fill in as tested. Each row is a claim from `citizen-development-portal/docs/10-netlify-comparison.md`
or from the challenge discussion on 2026-09-10. Record what actually happened, with the date.

| # | Claim under test | How to test | Observed | Date |
|---|------------------|-------------|----------|------|
| 1 | Identity can be enforced at the edge before any code runs | Anonymous `/app/` and `/api/fabric`; then sign in | **Yes, by Netlify's SSO team login**, applied to the new site by the team default before anything was configured: every path 401 anonymously, two Okta prompts (app.netlify.com, then the site's edge-access handshake), then the page loads. **But the app learns nothing about the user:** no principal header, token, or name reaches the functions. `/api/me` now reports exactly that. Netlify Identity was removed from the POC on 2026-09-17: no Identity instance exists on this site and the team default makes a second login redundant. | 2026-09-17 |
| 2 | Netlify Identity is a separate user store from Entra; invite-only limits who can register | Invite flow; try self-signup | | |
| 3 | The app reaches Fabric with a credential the author stored; nothing re-verifies it | Steps 4, 6, 7 in README | | |
| 4 | Netlify DB: migrations/DDL run with the same connection the app uses; no DDL/DML split | Read `/api/db` code; check Neon roles | Confirmed in passing: the function's `CREATE TABLE IF NOT EXISTS` ran with the same connection as its `INSERT`. The database existed and answered **without `netlify database init` ever being run**: `@netlify/database` resolved a connection on its own, and `NETLIFY_DATABASE_URL` was not in the environment (healthz reported "not configured" while the query executed). Where the credential lives is opaque to the app author. | 2026-09-17 |
| 5 | Two-job deploy keeps the token out of the job that runs app code, but the token is long-lived | Inspect workflow; try deploying from a fork/branch | | |
| 6 | A bad deploy reaches production; nothing gates on a health check | README step 5 | | |
| 7 | `user.signin` can only be per request, not per session, in stateless functions | Function logs after a few clicks | Moot on this team: with team login there is no identity to log. The function emits `user.unknown` with the list of identity-shaped headers seen (none). | 2026-09-17 |
| 8 | Cost cannot be attributed per site on the team dashboard | README step 8 | | |
| 9 | Deploy previews exist for free and are useful | Open a PR; check the preview URL and DB branch | Not testable: the POC folder lives inside the platform repo, so no Netlify-linked repo and no PR previews. Deploy was `netlify deploy --prod` from a laptop, the same path the LT-POC team uses. | 2026-09-17 |
| 10 | Function cold start and Fabric TDS connect time | `ms` field in `/api/fabric`; repeat after idle | | |

## Things that surprised us

- `netlify sites:create` in an Enterprise team inherits the team's access default. Our site was closed to non-members before we configured anything. Good for the team, but it means the Free-plan identity story (Netlify Identity + roles) cannot be demonstrated here without loosening the site.
- `has_database: true` on the site immediately after `sites:create`, and the first `/api/db` call succeeded in reaching Neon without any init step. The database is provisioned on first use and the connection is resolved by the SDK, not by a visible environment variable.
- The only request headers Netlify adds are `x-nf-account-id` and `x-nf-account-tier`: the **team** that owns the site, not the person. The first version of `/api/me` counted those as identity; corrected.
- The 502 stack trace showed `/var/task/` and `/var/runtime/index.mjs`: the AWS Lambda runtime layout. Netlify Functions still execute on Lambda, which the docs no longer state (see docs/10, "Where Netlify runs").
- `commit` reads `local` because a laptop deploy has no linked repo; nothing records which source produced the running code.

## What this changes in the comparison page

-
