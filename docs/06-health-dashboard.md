# 06 — Health dashboard

**Status 2026-09-16: not built.** Every app writes to Application Insights and Log
Analytics, and every resource carries the tags this page relies on, so the data exists.
The Workbook, the gate-result table, the heartbeat rows, and the cost export do not. This
page is the specification.

The platform team needs one place to see the health of every deployed app. Owners need
to see their own.

## Where it lives, and where it does not

**Not on the playground.** The dashboard reads every app's health probes, deployments,
dependency scan results, build status, and cost. That requires reader roles across every
function app in the resource group, Log Analytics, and Cost Management. No citizen
app holds any of those; the default citizen identity holds *nothing* beyond its own Key
Vault secrets. Hosting the dashboard as "just another app" would put a privileged
identity inside the fleet, make it the one app the gates treat differently, and set a
precedent that some apps get platform permissions. The trust boundary is the whole
design; the dashboard sits on the platform side of it.

**It is platform tooling**, owned and operated by the platform team, with its own
identity and its own deployment path, in `infra/`.

## What it shows

### Fleet view (platform team)

A header strip with the platform-wide facts every app depends on: wildcard certificate
days to expiry, DNS zone health, environment status, last successful cert renewal.

One row per admitted app:

| Column | Source |
|--------|--------|
| Name, owner, area, classification | `app.yaml` via tags on the resource |
| Health now | Healthy / Degraded / Down / Unknown, from the last three 15-minute heartbeats, plus the last deployment's status |
| Last heartbeat | Time, latency, and the body or error returned |
| Availability, last 7 days | Share of heartbeats that returned 200 |
| Users, last 30 days | Distinct users from `user.signin` events; last-seen time |
| Sign-in logging | OK, or "traffic without sign-in events" when the app has stopped logging users |
| Last deploy: when, by whom, which commit | Gate 2 records the pushing person, mapped to their Entra display name and UPN (D15), and the workflow writes it as a deployment tag and a Log Analytics row. The dashboard shows the person's name, not a GitHub handle. |
| Open vulnerabilities (critical / high, fixable) | Latest image rescan result stored with the image |
| Days since image rescan | Same |
| Dependency compliance | Last Gate 2 result: over budget, off-allow-list, release-age waivers |
| Database | Tier, size, connections now; "—" for stateless apps |
| Data checks | Last run: passed / failed / warned counts, and the newest failing check's name; "—" for apps without `fabric:` |
| Fabric | Items managed, items unmanaged, capacity units yesterday; "—" for apps without `fabric:` |
| Cost this month | Cost Management, filtered by the `app` tag, month to date, refreshed daily. |
| Cost last month | Same, previous calendar month, for comparison. |
| Owner status | Last owner-liveness check |

Sorted by "worst first": failing health, then critical CVEs, then stale owners. A
column header click re-sorts by cost, so the most expensive apps are one click away.

**What per-app cost means here.** Every resource the app module creates — the function
app, its Key Vault secrets, its budget alert — carries the `app` tag, so consumption
attributed to the app is exact. Shared platform costs (the environment, Log Analytics,
the registry, the certificate, DNS) are *not* divided among apps; they appear as one
"platform" row at the top so the total is honest and no app owner is charged for
infrastructure they cannot influence. If the shared row grows past the sum of the apps,
that is a platform problem, not an app problem. Fabric capacity is one of those shared
costs for now: it is billed per capacity, not per tagged resource, so it sits on the
platform row while the per-workspace usage share is shown in the Fabric column (D28).

### App view (owner and platform team)

The same row expanded, plus the heartbeat history as a strip (one cell per 15-minute
check for the last 24 hours), recent gate results with the developer-facing message,
recent request and error counts, and the last 50 log lines.

**Deployment history.** One row per deploy: when, who (display name and UPN), commit,
gate outcome, and whether that package is still the one serving traffic. This is the
answer to "who changed this and when" without anyone opening GitHub.

**Migration history.** (apps with data) Each migration: file, applied when, by which
deploy, by whom, duration. A failed migration shows here with its error.

**Data check history.** (apps with `fabric:`) Each check run, deploy-time or scheduled:
check name, expected, actual, pass or fail, duration. A failing blocking check at deploy
shows here next to the deploy it stopped. Items published per deploy, and any workspace
items the repo does not manage, are listed alongside.

**Cost history.** Daily cost for the last 90 days as a bar strip, with deploy markers on
it so a cost jump can be tied to the deploy that caused it.

**Who has used this app.** A table of distinct users from the app's `user.signin`
events: display name, UPN, first seen, last seen, session count. This is the owner's
view of their own access group in practice — the people who actually show up, which is
usually a shorter list than the group, and occasionally contains a name that should not
be there. Retention is a decision (D17). Owners see only apps where
`owner` is them or they are in the app's access group. That authorization is by Entra
group at the dashboard's door, not by a filter in the dashboard code — the same rule we
hold citizen apps to.

### Gate feed (platform team)

A time-ordered list of gate rejections across the fleet: which app, which gate, which
rule. This is how we learn which rules are noisy and which templates need fixing.

## How it is built

**Recommended (D13): an Azure Monitor Workbook first.** Every column above already
exists in Azure: Resource Graph for the resources and tags, Log Analytics for probes,
requests, logs, and the gate results the workflow writes there, Defender for the image
findings, Cost Management for spend. A Workbook is queries over those with native Azure
RBAC, no code to host, no identity to manage, and lives in `infra/terraform/environment`
as a resource like everything else. It is not pretty. It is enough to run the playground
from day one, and it tells us which views people actually use.

**A custom web dashboard is v2, if the Workbook proves insufficient** — for example if
owners need a friendlier view than the Azure portal allows. If built, it is still
platform tooling: a separate function app or App Service in the
platform resource group, a managed identity with the reader roles listed above and
nothing more, Entra sign-in restricted to the platform team group plus app owners. It
can reuse the skill's `react-app` template as a *starting point* for the code, but it is
admitted through none of the citizen gates and is documented as a platform component.

## What the platform writes so the dashboard can read

The dashboard is only as good as what the gates and workflows record. Each of these is a
requirement on `infra/`, not on apps:

- Heartbeat results, every 15 minutes per app: status, latency, body or error.
- Gate 2 and Gate 3 results, per run, as a structured row in a Log Analytics custom table
  (app, gate, rule, pass/fail, message, commit, **deployed-by UPN and display name**).
- The same deployed-by identity and commit as tags on the function app's deployment, so
  the running thing and the log agree about who put it there.
- A daily cost export by tag into the same workspace, so cost and deploys can be
  joined on app and date.
- Nothing extra for users: the `user.signin` events arrive through the ordinary stdout
  log collection, which is why the contract requires them to be JSON.
- Deployment tags carrying the commit SHA and the build run id.
- Rescan results stored as an artifact on the image and mirrored to Log Analytics.
- Owner-liveness results to the same table.
- Fabric publish and check results per deploy and per scheduled run, to the same table;
  a daily workspace inventory and capacity-units row per app.
- Cost export by tag, daily.

## Out of scope

- Alerting rules. The dashboard is for looking; alerts to owners (failing health,
  critical CVE, cost) are configured in `infra/terraform/modules/app` and documented in
  [05-platform-gates.md](05-platform-gates.md).
- Anything an app developer would use to debug their own code locally. That is
  `npm run dev` and their own logs.
