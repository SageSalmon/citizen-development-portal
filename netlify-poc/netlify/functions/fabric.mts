import type { Config } from "@netlify/functions";
import sql from "mssql";
import { json } from "../shared/identity.mts";
import { env } from "../shared/env.mts";
import { log } from "../shared/log.mts";

/**
 * Read from a Fabric Lakehouse/Warehouse SQL analytics endpoint over TDS, authenticating
 * as a service principal whose secret lives in Netlify env vars.
 *
 * THIS IS THE CLAIM UNDER TEST: on Netlify the app reaches Fabric with a credential the
 * author stored, with whatever workspace access the author gave it, re-verified by nobody.
 * Contrast: the playground design reads Fabric as the signed-in user (OBO) or with a
 * managed identity capped at the owner's workspace role.
 *
 * Prereqs (README): Fabric tenant setting "Service principals can use Fabric APIs" on;
 * the SP added to the workspace (Viewer is enough to read).
 */
export default async (req: Request) => {
  // Team login already gated this request at the edge; nothing identifies the caller here.

  const endpoint = env("FABRIC_SQL_ENDPOINT");
  const database = env("FABRIC_DATABASE");
  if (!endpoint || !database) return json({ error: "FABRIC_SQL_ENDPOINT / FABRIC_DATABASE not set" }, 503);

  const t0 = Date.now();
  const pool = new sql.ConnectionPool({
    server: endpoint,
    database,
    port: 1433,
    options: { encrypt: true, trustServerCertificate: false },
    authentication: {
      type: "azure-active-directory-service-principal-secret",
      options: {
        tenantId: env("AZURE_TENANT_ID"),
        clientId: env("AZURE_CLIENT_ID"),
        clientSecret: env("AZURE_CLIENT_SECRET"),
      },
    },
  });

  try {
    await pool.connect();
    const tables = await pool.request().query("SELECT count(*) AS n FROM INFORMATION_SCHEMA.TABLES");
    let rows: number | null = null;
    const table = env("FABRIC_TABLE");
    if (/^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/.test(table)) {           // fixed identifier, not user input
      const r = await pool.request().query(`SELECT count_big(*) AS n FROM ${table}`);
      rows = Number(r.recordset[0].n);
    }
    const ms = Date.now() - t0;
    log("info", "fabric.query", { by: "unknown (team login forwards no identity)", ms });
    return json({ endpoint, database, tables: tables.recordset[0].n, rows, ms });
  } catch (e) {
    log("error", "fabric.error", { message: String(e) });
    return json({ error: String(e) }, 502);
  } finally {
    await pool.close().catch(() => {});
  }
};

export const config: Config = { path: "/api/fabric" };
