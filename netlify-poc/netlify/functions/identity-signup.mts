import type { Handler } from "@netlify/functions";

/**
 * Identity event trigger (legacy handler signature is what Identity triggers use).
 * Runs when a user completes signup / accepts an invite; grants the `member` role that
 * the Role= redirects in netlify.toml look for.
 */
export const handler: Handler = async (event) => {
  const body = JSON.parse(event.body ?? "{}") as { user?: { email?: string } };
  console.log(JSON.stringify({ app: "netlify-poc", ts: new Date().toISOString(), level: "info", event: "identity.signup", upn: body.user?.email }));
  return { statusCode: 200, body: JSON.stringify({ app_metadata: { roles: ["member"] } }) };
};
