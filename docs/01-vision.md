# 01 — Vision

## The problem

People across the organization build useful small apps: a dashboard, a form that
writes to a spreadsheet, an internal directory, a calculator with a nice front end. Today each one is hosted somewhere different, has its own login (or
none), stores secrets in the repo, and dies when its author changes roles.

"Citizen development" means those authors are not professional developers and do not
have a platform team on call. The hosting situation has to do the hard parts for them.

## What we want

A **citizen app playground** — the platform side — that makes hosting a small internal
app boring:

1. **One way in.** An app is a repo that meets a small, written contract
   ([02-hosting-contract.md](02-hosting-contract.md)). If it meets the contract, the
   platform can build, run, secure, and observe it without app-specific work.
2. **Identity is the platform's job.** Every app sits behind organization sign-in
   (Entra). The app receives who the user is and, if it needs to act for them, a token
   the platform obtained. It never handles passwords and never holds a credential of
   its own by default.
3. **An app cannot outrank its owner.** Deploying an app is never a way to reach data or
   actions the deployer could not reach themselves. The app either acts as the
   signed-in user, or holds a standing identity capped at what its owner already has
   and re-checked continuously.
4. **Secrets are the platform's job.** Apps read configuration from environment
   variables. Secrets are injected from a vault. Nothing sensitive lives in a repo.
5. **Observability is free.** Logs to stdout become searchable logs. A health endpoint
   becomes an availability signal. Every resource is tagged with the app and owner for
   cost reporting.
6. **Ownership is explicit.** Every app has a named owner and a business area recorded
   in the repo, so orphaned apps can be found and retired.

And a **scaffold skill** — the developer side, and what this repo actually contains — so
that a citizen developer (or Claude working with them) can say "new app" and get a
project that already satisfies the contract, runs locally with one command, and deploys
with one command ([03-skills.md](03-skills.md)).

## One language: TypeScript and React

**Decided 2026-09-03.** Playground apps are TypeScript with React. Reasons:

- **One stack to review.** Every app looks the same, so a reviewer, a scanner, and the
  skill's own `check` all learn one shape. Mixed languages multiply the audit surface.
- **Supply-chain inspectability.** The npm ecosystem is the *riskiest* mainstream
  registry for compromised packages, which is exactly why the contract pins how
  dependencies are chosen and installed ([02-hosting-contract.md](02-hosting-contract.md),
  "Dependencies"). A tiny, allow-listed, exactly-pinned, lockfile-committed dependency
  set in a language people can read is easier to inspect than a large one in any
  language. The templates are built with a dependency budget for that reason.
- **Citizen developers already know it.** Browser-side JavaScript is the most widely
  understood language among non-professional developers; TypeScript adds the checks
  they would not write themselves.
- **Python was the alternative.** It is a fine language, but Streamlit-style apps pull
  in very large dependency trees, and a two-ecosystem playground doubles every control.
  What other teams in the organization write in is unknown at the time of writing and
  is not a factor here. If a real need for Python appears, it is a separate decision,
  not a quiet addition. One has been made: Python runs inside Fabric notebooks, never in
  an app or on the platform (D27, [09-fabric.md](09-fabric.md)).

## Who this is for

| Person | What they do here |
|--------|-------------------|
| Citizen developer | Runs the scaffold skill, writes app code, pushes. Never touches infra. |
| Platform owner (us) | Owns the contract, the templates, the hosting infrastructure, the skill. |
| Security / identity | Approves the identity model once, not per app. |
| Finance / IT leadership | Reads cost by app and owner from tags. |

## Out of scope, deliberately

- **Not a low-code tool.** This hosts code people already wrote. Power Platform and
  similar are a different answer to a different problem.
- **Not a general PaaS.** The contract is narrow on purpose. An app that needs a
  database cluster, a message bus, or a custom network topology is a real project and
  goes through the normal engineering path.
- **Not a container platform.** Apps run as Azure Functions (D30, 2026-09-16); there is
  no Dockerfile in a citizen app. The first design used Container Apps (D1) and the
  decision log says why it changed.
- **Not production for regulated data.** *Assumption to confirm:* the first version
  hosts internal tools on synthetic or non-sensitive data. Anything touching PHI or
  PII needs a separate review before it is allowed on the platform, and the contract
  should make that a declared field, not a discovery.

## Success looks like

- A new app goes from "nothing" to "running behind sign-in at a URL" in under an hour,
  with the developer having edited only app code and one metadata file.
- The platform owner can list every hosted app, its owner, its cost, and its last
  successful health check from one place.
- Retiring an app is deleting one directory of infrastructure, not a scavenger hunt.
