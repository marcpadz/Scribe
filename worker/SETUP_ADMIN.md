# Admin Dashboard

The admin console lets you view the database, configure the transcription /
video-understanding / chat models, and monitor engine jobs (status + condition).

## URL
`https://marcpadz.github.io/Scribe/#/admin` (or `http://localhost:3000/#/admin` in dev).

## Access
Protected by a bearer key (`X-Admin-Key`) stored in the Worker secret `ADMIN_KEY`.
The key is entered once in the admin login screen and kept in your browser's
`localStorage` only — it is never committed.

### Rotate / set the key
```bash
cd worker
printf '%s' "sk_admin_$(python3 -c 'import secrets;print(secrets.token_urlsafe(24))')" \
  | npx wrangler secret put ADMIN_KEY --config ./wrangler.toml
```
Then redeploy: `npx wrangler deploy --config ./wrangler.toml`.

## What you can do
- **Database viewer** — read-only browse of `user`, `session`, `account`,
  `verification`, `profile`, `admin_config`, `job` (strict allow-list; capped at 500 rows).
- **Engine config** — edit the three model roles live; persisted in `admin_config`
  (`engine_models` key) and applied to new jobs immediately.
- **Process monitor** — every transcription / analyze / chat run is logged to the
  `job` table with status (`queued`/`running`/`done`/`error`), model, duration,
  frame count and error message, plus status/type charts.

## Endpoints (all require `X-Admin-Key`)
- `GET  /api/admin/health`
- `GET  /api/admin/config` · `PUT /api/admin/config`
- `GET  /api/admin/db/tables` · `GET /api/admin/db/table/:name`
- `GET  /api/admin/jobs`
