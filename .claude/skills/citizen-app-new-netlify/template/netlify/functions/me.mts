import type { Config } from "@netlify/functions";
import { whoami, json } from "../shared/identity.mts";

export default async (req: Request) => json(whoami(req));
export const config: Config = { path: "/api/me" };
