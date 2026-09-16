# 08 — Data

An app that needs to keep data declares it in a `data/` folder. The platform provisions
the store, applies the schema at deploy, and keeps the app's runtime identity from ever
being able to change that schema. Decided in part 2026-09-03 (D4, D25).

**Status 2026-09-16: not built.** No PostgreSQL server, no migration identity, no
`data/` folder in the template. This page is the specification.

This page is the relational half. Since 2026-09-08 (D26) `data/` also declares a
**Fabric workspace** for analytics, ML model construction, and data checks; that half is
[09-fabric.md](09-fabric.md). The two are independent: an app may have either, both, or
neither.

## One engine: PostgreSQL, everywhere

Local development, the shared tier, and the dedicated tier all speak the same SQL.

- **Locally:** PGlite — PostgreSQL compiled to WebAssembly, running inside the Node
  process, persisting to `data/.local/`. No Docker, no install, no service to start.
  `npm run dev` brings it up with the migrations applied.
- **Hosted:** Azure Database for PostgreSQL Flexible Server, with Entra authentication.
  The app never holds a database password; its managed identity *is* its database role.

**SQLite was considered and is not offered for hosted apps.** Container Apps are stateless
and may run more than one replica; the only persistent disk is Azure Files, where
SQLite's file locking is unreliable and corruption is the documented outcome. It is also a
different dialect from anything we would run in Azure, so local and hosted schemas would
drift. PGlite gives the "small embedded database" experience locally without that cost.

**Azure SQL serverless** is the alternative engine if the organization prefers SQL Server.
It auto-pauses when idle, but it is a second dialect with a weaker TypeScript ecosystem.
One engine keeps the templates, the gate rules, and the developer's knowledge single-track.

## Tiers

| `data/config.yaml` `store:` | What the platform provides | Isolation | Cost (order of magnitude; check current pricing) |
|---|---|---|---|
| `none` *(default)* | Nothing. The app is stateless. | — | 0 |
| `postgres` | One database and one role on the **shared platform server** (Flexible Server, burstable B1ms, 32 GB). The role owns only its database; `CONNECT` on every other database is revoked. | Logical, by database and role. Noisy neighbours share CPU. | ~$15–20/month for the whole fleet; per app ≈ 0 |
| `postgres-dedicated` | Its own Flexible Server. Requires `data.classification: confidential` or a written reason, approved at admission. | Physical. | ~$15–20/month per app; more with HA |

A Fabric workspace is not a tier of this table; it is declared by a separate `fabric:`
block in the same file ([09-fabric.md](09-fabric.md)). Anything else — Cosmos, blob
storage, a queue — is not a tier. It is a request, per D4.

## The `data/` folder

```
data/
  config.yaml            # store: postgres | postgres-dedicated | none
                         # fabric: { ... }  optional; see 09-fabric.md
  schema.ts              # Drizzle schema: the tables, in TypeScript, typed for the app
  migrations/
    0001_init.sql        # generated from schema.ts by `npm run db:generate`; committed;
    0002_add_status.sql  #   forward-only; numbered; reviewed like code
    meta/                # Drizzle's snapshot, so the next diff is computed correctly
  seed.sql               # optional: rows for local dev and first deploy only
  fabric/                # optional: Fabric items and checks; layout in 09-fabric.md
  README.md              # template-provided: how to change the schema safely
```

**Why Drizzle.** The developer describes tables in TypeScript and gets typed queries in
the app for free — a citizen developer's most common bug is a column name typo, and this
removes it. The migrations it generates are plain SQL files, so what runs in production
is readable, diffable, and lintable by the gate without executing anything. Drizzle adds
two direct dependencies (`drizzle-orm`, `drizzle-kit`) and both are on the allow-list.
Prisma was the alternative; it has a larger dependency tree and a binary engine, which
the supply-chain rules count against.

## How schema changes reach production

1. Developer edits `schema.ts`, runs `npm run db:generate`. A new numbered `.sql` file
   appears. `npm run dev` applies it to PGlite; the app is tested against it locally.
2. `npm run check` lints the migration (rules below) and verifies the SQL matches the
   schema — a hand-edited migration that drifts from `schema.ts` fails here.
3. Deploy. In the reusable workflow's **deploy job** (the one with credentials, which
   never runs app code — [07-deploy-credential-flow.md](07-deploy-credential-flow.md)),
   the platform's **migration identity** connects with DDL rights and applies any
   unapplied migrations, each in a transaction, recording them in a `_migrations` table.
   This happens *before* the new revision takes traffic, and before any Fabric items are
   published ([09-fabric.md](09-fabric.md), "How changes reach the workspace").
4. If a migration fails, the deploy stops. The previous revision keeps serving against
   the schema it already knows. The developer sees the SQL error in plain terms.
5. The new revision starts. Its **runtime identity** has `SELECT/INSERT/UPDATE/DELETE`
   on the app's tables and nothing else. It cannot `CREATE`, `ALTER`, or `DROP`. A
   compromised app can corrupt its own rows; it cannot change its own shape or reach
   another app's database.

**Old and new code overlap** briefly during a rollout: on Flex Consumption (D30) instances
are replaced, not switched, so old code may run for seconds after the migration. A
migration that removes or renames a column breaks it while it still serves. The template README teaches the
expand-then-contract pattern: add the new column in one deploy, move the code, remove the
old column in a later deploy. The gate enforces the safe half of that with the
destructive-change rules.

## Gate rules for migrations

| Rule | Severity | Rationale |
|------|----------|-----------|
| Files are numbered, contiguous, and never modified after commit (hash recorded) | block | An edited historical migration means production and history disagree. |
| Generated SQL matches `schema.ts` | block | Drift between what the app thinks and what exists. |
| `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, column type narrowing | block unless the file's first line is `-- destructive: <reason>` **and** the owner has acknowledged on the admission record | Data loss should be deliberate and attributable. |
| `ALTER ROLE`, `GRANT`, `CREATE EXTENSION`, anything touching other schemas or databases | block, no override | Privilege changes are the platform's, not the app's. |
| Migration over 10,000 lines or containing `COPY`/data dumps | warn | Data belongs in `seed.sql` or in the app, not in schema history. |
| No migrations folder when `store` is not `none` | block | An app with a database and no schema is a mistake. |

## Backups and restore

Flexible Server point-in-time restore, seven days retained by default, is the backup.
The platform team restores on request to a new database and points the app at it. An
owner who needs longer retention says so with a reason; it is a server setting, not an
app one. Dedicated-tier apps can set up to 35 days.

## What the platform records for the dashboard

Database size, connection count, and storage cost per app join the fleet view; the
app view shows migration history: which migration, when, by which deploy, by whom.

## Not covered, on purpose

- Cross-app data sharing. Two apps that need the same data are one app, or one of them
  is an API the other calls as the signed-in user. The one exception is a OneLake
  shortcut to data the owner can already read ([09-fabric.md](09-fabric.md)).
- Read replicas, HA, geo-redundancy. Dedicated tier can add HA at cost; nothing else.
- NoSQL, search, caching, queues. Requests under D4.
- Analytics, ML, data checks. Not Postgres's job; see [09-fabric.md](09-fabric.md).
