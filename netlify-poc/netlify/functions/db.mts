import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { json } from "../shared/identity.mts";
import { env } from "../shared/env.mts";

/**
 * Netlify DB (Neon Postgres). Connection is injected as NETLIFY_DATABASE_URL after
 * `npx netlify database init`. Note: one connection string with full rights; there is
 * no DDL/DML role split at the app level, so this function can (and does) CREATE TABLE.
 */
export default async (req: Request) => {
  // Team login already gated this request at the edge; nothing identifies the caller here.

  const db = getDatabase();
  await db.sql`CREATE TABLE IF NOT EXISTS visits (id serial PRIMARY KEY, who text NOT NULL, at timestamptz DEFAULT now())`;
  await db.sql`INSERT INTO visits (who) VALUES (team-member)`;
  const [{ count }] = (await db.sql`SELECT count(*)::int AS count FROM visits`) as { count: number }[];
  return json({ visits: count, branch: env("BRANCH", "unknown") });
};

export const config: Config = { path: "/api/db" };
