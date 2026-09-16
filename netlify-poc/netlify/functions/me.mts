import type { Config, Context } from "@netlify/functions";
import { requireUser, json } from "../shared/identity.mts";

export default async (req: Request, context: Context) => {
  const who = await requireUser(req, context);
  return who instanceof Response ? who : json(who);
};

export const config: Config = { path: "/api/me" };
