# __APP_NAME__

__DESCRIPTION__

Hosted on Netlify, team `__NETLIFY_TEAM__`. Owner: __OWNER_EMAIL__. Area: __AREA__.

## Three commands

```bash
npm run dev       # Vite + functions locally (netlify dev)
npm run check     # TypeScript
npm test          # function tests
```

Deploy: say "deploy" to Claude, or `npm run deploy` from a laptop signed in to Netlify.

## Layout

| Folder | Runs where | Notes |
|--------|-----------|-------|
| `web/` | the browser | React + Vite; edit `web/src/App.tsx` |
| `netlify/functions/` | Netlify Functions (Node) | `healthz`, `me`; add more `*.mts` files with a `config.path` |

## What this app does not do

- **Log anyone in.** Access is whatever the Netlify team enforces. On an Enterprise team
  that is SSO team login, before any request reaches this code.
- **Know who you are.** Team login forwards no identity to the functions. `/api/me` shows
  exactly what arrives: the team that owns the site, not the person.
- **Hold credentials safely.** Any backend that needs a key gets it from a Netlify
  environment variable the author set. That is the trade this platform makes.

This is a comparison template for the citizen playground design
(`docs/10-netlify-comparison.md` in the platform repo).
