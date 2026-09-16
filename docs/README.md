# Citizen Development Portal — docs

This repo holds both halves of the **citizen app playground**:

- the **scaffold skill** that generates a conforming app — guidance the developer can
  edit, and
- the **infrastructure** the apps deploy to — with gates that reject an app that does not
  follow that guidance. The skill suggests; the infrastructure enforces.

```
citizen-development-portal/
  docs/                      # these documents; environments/ holds gitignored specifics
  .claude/skills/
    new-citizen-app/         # ✓ build: conforming project + its GitHub repo
    deploy-citizen-app/      # ✓ deploy: push, follow the run, gate results in plain words
                             #   (admission is a manual operator step; D19 distribution open)
  templates/react-app/       # ✓ the one template (Vite + React, Azure Functions handlers)
  scripts/                   # ✓ new-citizen-app.mjs, write-registry.mjs
  infra/gates/               # ✓ the rule engine, Node built-ins only, 7 rules, 16 tests
  infra/terraform/           # ✓ environment + modules/app + app-<name>.tf; state in Azure
  infra/registry/            # ✓ per-app records the deploy job reads (none yet)
  .github/workflows/         # ✓ build-and-deploy.yml, the reusable workflow
```

**Status 2026-09-16: thin slice built and deployed once.** The environment and the first
app (`hello-citizen`) exist in Azure; a push to its repo ran the reusable workflow end to
end (gates, tests, package, OIDC deploy, anonymous probe refused) on the second attempt.
Sign-in by a real user is the next thing to prove. [12-known-gaps.md](12-known-gaps.md)
says exactly what is aspirational.

Each document marks what is **decided**, what is **built** (✓ / ◐ partial / ○ planned),
what is an **assumption** (a sensible default taken from ref-arch-agent, the one earlier
project these docs borrow from), and what is an **open decision** (listed in
[04-decisions.md](04-decisions.md)). The hosting runtime changed on 2026-09-16 from
Container Apps to Azure Functions Flex Consumption (D30); pages were rewritten to match.

| Doc | What it answers |
|-----|-----------------|
| [01-vision.md](01-vision.md) | What the playground is, who it is for, why TypeScript/React |
| [02-hosting-contract.md](02-hosting-contract.md) | What the platform provides, and what an app must look like to be hosted on it (Azure Functions, D30) |
| [03-skills.md](03-skills.md) | The two skills: build a conforming app in GitHub, and deploy it with GitHub hidden |
| [04-decisions.md](04-decisions.md) | Open decisions, options, and the recommended default for each |
| [05-platform-gates.md](05-platform-gates.md) | Where each contract rule is actually enforced, and what `infra/` contains |
| [06-health-dashboard.md](06-health-dashboard.md) | Fleet and per-app health view; platform tooling, deliberately not a playground app |
| [07-deploy-credential-flow.md](07-deploy-credential-flow.md) | Who holds which credential at each step of a deploy, and the five details that keep the gates real |
| [08-data.md](08-data.md) | The `data/` folder: PostgreSQL tiers, Drizzle schema, migrations applied by the platform at deploy |
| [09-fabric.md](09-fabric.md) | Fabric as a second `data/` target: per-app workspace, items published at deploy, deterministic data checks, ML model construction |
| [10-netlify-comparison.md](10-netlify-comparison.md) | Could Netlify host this? Feature-by-feature check against Netlify's docs and plan tiers, 2026-09-10, plus what an internal Enterprise account actually does; verdict: no |
| [11-deployment-notes.md](11-deployment-notes.md) | What building and deploying taught us: backend auth, provider sources, Flex quirks, OIDC subjects, the release-age rule refusing its own template |
| [12-known-gaps.md](12-known-gaps.md) | Where the work as built could mislead: no end-to-end deploy yet, health gate proves only the locked door, no rollback, manual admission, operator credential |
| [environments/](environments/README.md) | Identifying values per environment; `dev.md` is gitignored, `example.md` shows the shape |

**Diagrams.** `diagrams/architecture.drawio` is the architecture diagram in draw.io XML,
which Lucidchart imports as editable shapes (More menu → File → Import → Import documents,
drop the file). It is in draw.io's compressed form; `architecture.uncompressed.drawio` is the
same diagram uncompressed, for diffing and as a fallback if the importer rejects one form.
`gen_drawio.py` regenerates both; `architecture-preview.png` is an approximate
render for readers without Lucidchart. Annotated: skill-to-gate match, the open question of
creating the GitHub repo at scaffold time or at first push, the credential split, and the two
data targets. `architecture.lucid` is the same content as a Lucid Standard Import file; that
format is accepted only by Lucid's REST API, not the in-app import menu.

Rule for these docs, borrowed from ref-arch-agent: do not let "designed" drift into
"built". If something is a plan, it says so. Validate diagrams with the design-docs skill's
`validate-mermaid.sh`; run its `check-specifics.sh` with the identifiers in
`environments/dev.md` before committing.
