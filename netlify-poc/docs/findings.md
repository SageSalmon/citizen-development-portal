# Findings

Fill in as tested. Each row is a claim from `citizen-development-portal/docs/10-netlify-comparison.md`
or from the challenge discussion on 2026-09-10. Record what actually happened, with the date.

| # | Claim under test | How to test | Observed | Date |
|---|------------------|-------------|----------|------|
| 1 | Identity can be enforced at the edge before any code runs (Free plan, Netlify Identity roles) | Anonymous `/app/` and `/api/fabric` | | |
| 2 | Netlify Identity is a separate user store from Entra; invite-only limits who can register | Invite flow; try self-signup | | |
| 3 | The app reaches Fabric with a credential the author stored; nothing re-verifies it | Steps 4, 6, 7 in README | | |
| 4 | Netlify DB: migrations/DDL run with the same connection the app uses; no DDL/DML split | Read `/api/db` code; check Neon roles | | |
| 5 | Two-job deploy keeps the token out of the job that runs app code, but the token is long-lived | Inspect workflow; try deploying from a fork/branch | | |
| 6 | A bad deploy reaches production; nothing gates on a health check | README step 5 | | |
| 7 | `user.signin` can only be per request, not per session, in stateless functions | Function logs after a few clicks | | |
| 8 | Cost cannot be attributed per site on the team dashboard | README step 8 | | |
| 9 | Deploy previews exist for free and are useful | Open a PR; check the preview URL and DB branch | | |
| 10 | Function cold start and Fabric TDS connect time | `ms` field in `/api/fabric`; repeat after idle | | |

## Things that surprised us

-

## What this changes in the comparison page

-
