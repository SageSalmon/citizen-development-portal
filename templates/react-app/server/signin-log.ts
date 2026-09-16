import { log } from "./log.ts";
import type { Principal } from "./identity.ts";

/**
 * Contract rule 8: one `user.signin` event per session, with only the three identity
 * fields. Functions instances are stateless, so "session" here means "first time this
 * instance sees this user"; a new instance logs the user again. The dashboard treats
 * repeats as one session. Never log a token, a cookie, or any other header.
 */
const seen = new Set<string>();

export function recordSignin(p: Principal, path: string): boolean {
  const key = p.oid || p.upn;
  if (seen.has(key)) return false;
  seen.add(key);
  log("info", "user.signin", { oid: p.oid, upn: p.upn, name: p.name, path });
  return true;
}

/** For tests only: forget everyone this instance has seen. */
export function resetSeen(): void { seen.clear(); }
