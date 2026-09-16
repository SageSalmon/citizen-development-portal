import type { HttpRequest } from "@azure/functions";

/** Who the platform says is calling. Only the platform can set these headers. */
export type Principal = { oid: string; upn: string; name: string };

const CLAIM_OID = "http://schemas.microsoft.com/identity/claims/objectidentifier";
const CLAIM_NAME = "name";
const CLAIM_UPN = ["preferred_username", "upn", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"];

/**
 * Reads the Easy Auth identity headers. Contract rule 6: trust these and nothing else.
 * Returns null when no principal is present, which behind the platform never happens
 * because unauthenticated requests never reach the code.
 */
export function principalFrom(req: HttpRequest): Principal | null {
  const encoded = req.headers.get("x-ms-client-principal");
  if (encoded) {
    try {
      const p = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as { claims?: { typ: string; val: string }[]; name_typ?: string };
      const claims = new Map((p.claims ?? []).map(c => [c.typ, c.val]));
      const oid = claims.get(CLAIM_OID) ?? claims.get("oid") ?? req.headers.get("x-ms-client-principal-id") ?? "";
      const upn = CLAIM_UPN.map(k => claims.get(k)).find(Boolean) ?? (p.name_typ ? claims.get(p.name_typ) : undefined) ?? req.headers.get("x-ms-client-principal-name") ?? "";
      const name = claims.get(CLAIM_NAME) ?? upn;
      if (oid || upn) return { oid, upn, name };
    } catch { /* fall through to the simple headers */ }
  }
  const id = req.headers.get("x-ms-client-principal-id");
  const nm = req.headers.get("x-ms-client-principal-name");
  return id || nm ? { oid: id ?? "", upn: nm ?? "", name: nm ?? "" } : null;
}
