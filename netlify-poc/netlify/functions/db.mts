import type { Config, Context } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { requireUser, json } from "../shared/identity.mts";
import { env } from "../shared/env.mts";

/**
 * Netlify DB (Neon Postgres). Connection is injected as NETLIFY_DATABASE_URL after
 * `npx netlify database init`. Note: one connection string with full rights; there is
 * no DDL/DML role split at the app level, so this function can (and does) CREATE TABLE.
 */
export default async (req: Request, context: Context) => {
  const who = await requireUser(req, context);
  if (who instanceof Response) return who;

  const db = getDatabase();
  await db.sql`CREATE TABLE IF NOT EXISTS visits (id serial PRIMARY KEY, who text NOT NULL, at timestamptz DEFAULT now())`;
  await db.sql`INSERT INTO visits (who) VALUES (${who.email})`;
  const [{ count }] = (await db.sql`SELECT count(*)::int AS count FROM visits`) as { count: number }[];
  return json({ visits: count, branch: env("BRANCH", "unknown") });
};

export const config: Config = { path: "/api/db" };
