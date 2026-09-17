# Findings

Fill in as tested. Each row is a claim from `citizen-development-portal/docs/10-netlify-comparison.md`
or from the challenge discussion on 2026-09-10. Record what actually happened, with the date.

| # | Claim under test | How to test | Observed | Date |
|---|------------------|-------------|----------|------|
| 1 | Identity can be enforced at the edge before any code runs (Free plan, Netlify Identity roles) | Anonymous `/app/` and `/api/fabric` | Deployed into the LT-POC Enterprise team, not Free. Every path, including the public login page, returned **401** with Netlify's edge-access login redirect, before our `Role=` rules were reached. The team-level **SSO team login** protection applied to the new site automatically. So on this team, only Netlify team members can open any site; our Identity-based role rules are moot unless team login is turned off for the site. | 2026-09-17 |
| 2 | Netlify Identity is a separate user store from Entra; invite-only limits who can register | Invite flow; try self-signup | | |
| 3 | The app reaches Fabric with a credential the author stored; nothing re-verifies it | Steps 4, 6, 7 in README | | |
| 4 | Netlify DB: migrations/DDL run with the same connection the app uses; no DDL/DML split | Read `/api/db` code; check Neon roles | | |
| 5 | Two-job deploy keeps the token out of the job that runs app code, but the token is long-lived | Inspect workflow; try deploying from a fork/branch | | |
| 6 | A bad deploy reaches production; nothing gates on a health check | README step 5 | | |
| 7 | `user.signin` can only be per request, not per session, in stateless functions | Function logs after a few clicks | | |
| 8 | Cost cannot be attributed per site on the team dashboard | README step 8 | | |
| 9 | Deploy previews exist for free and are useful | Open a PR; check the preview URL and DB branch | Not testable: the POC folder lives inside the platform repo, so no Netlify-linked repo and no PR previews. Deploy was `netlify deploy --prod` from a laptop, the same path the LT-POC team uses. | 2026-09-17 |
| 10 | Function cold start and Fabric TDS connect time | `ms` field in `/api/fabric`; repeat after idle | | |

## Things that surprised us

- `netlify sites:create` in an Enterprise team inherits the team's access default. Our site was closed to non-members before we configured anything. Good for the team, but it means the Free-plan identity story (Netlify Identity + roles) cannot be demonstrated here without loosening the site.
- `has_database: true` on the site immediately after `sites:create`, before `netlify database init` ran. Whether that is a team default or a flag on every new site is unverified.

## What this changes in the comparison page

-
