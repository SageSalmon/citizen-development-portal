# __APP_NAME__

__DESCRIPTION__

A citizen app on the playground. Owner: __OWNER_EMAIL__. Sign-in is enforced by the
platform for members of `__ACCESS_GROUP__`; this code never handles a password or a token.

## Three commands

```bash
npm run dev      # API on :7071 with the same handlers as production, Vite on :5173
npm run check    # the platform's rules, locally, same messages
npm test         # handler tests (node --test)
```

Deploy = push to `main`. The platform builds, checks, and deploys; say "deploy" to Claude
and it will walk you through what happened.

## Layout

| Folder | Runs where | Rules |
|--------|-----------|-------|
| `web/` | the browser | never sees a secret; asks `server/` who the user is |
| `server/` | Azure Functions (Flex Consumption) | reads config from env; trusts only the platform's identity headers; logs JSON to stdout |

`app.yaml` is the one file the platform reads about this app. `scripts/check.mjs` is a
copy of the platform's rules for fast local feedback; the platform runs its own copy.

## Local identity

Locally there is no Entra in front. `npm run dev` injects a fake signed-in user from
`.env` (copy `.env.example`). On the playground the platform sets the real identity
headers before any request reaches this code, and you never set them yourself.
