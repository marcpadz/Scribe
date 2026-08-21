# Admin dashboard: DB viewer + engine config + process monitor

**Status:** Resolved
**Created:** 2026-08-21
**Tags:** #admin #d1 #dashboard #cloudflare

## Goal
Owner wanted to (a) hide Google OAuth, (b) switch engine to gemini-3.5/3.1
flash-lite, (c) build an admin dashboard to view the DB, configure the
transcription/video/chat models, and monitor app processes + their status.

## What was built
- **Engine split verified**: `gemini-3.5-flash-lite` (transcription) + `gemini-3.1-flash-lite`
  (videoAnalysis, chat) both accept AUDIO + IMAGE. Confirmed live before wiring.
- **Models are now configurable**: `worker/src/gemini.ts` exposes `DEFAULT_MODELS`;
  `worker/src/index.ts` `loadModels()` reads `admin_config` (key `engine_models`),
  falling back to defaults. Admin can change them at runtime via `PUT /api/admin/config`.
- **Job logging**: every transcribe/analyze/chat run inserts a `job` row (status,
  model, duration, frames, error) → the "process monitor".
- **Admin API** (all behind `X-Admin-Key` header = Worker secret `ADMIN_KEY`):
  `/api/admin/health`, `/config` (GET/PUT), `/db/tables`, `/db/table/:name`
  (allow-listed, read-only, capped 500), `/jobs`.
- **Admin UI** (`components/AdminDashboard.tsx`) at `#/admin` route (hash route in
  `index.tsx`, lazy-loaded). Uses **@tanstack/react-table** (DB/job grids) and
  **recharts** (status pie + jobs-by-type bar) — both free/open-source, no from-scratch
  build. Code-split so normal users don't download them.
- **Google OAuth hidden**: `AuthGate.tsx` `GOOGLE_OAUTH_ENABLED = false` gates the
  button; handler retained for later.

## Key/security notes
- `ADMIN_KEY` is a Worker secret (set once: `wrangler secret put ADMIN_KEY`). Dashboard
  stores it in browser localStorage only. Rotating = re-`put` + redeploy.
- DB viewer is allow-listed to app tables; never raw SQL from the client.
- Jobs table logs `error` (truncated to 500 chars) — good for monitoring failures.

## Prevention
- Keep admin endpoints behind `requireAdmin`; never expose `X-Admin-Key` via CORS
  preflight to untrusted origins.
- When adding engine roles, update BOTH `DEFAULT_MODELS` and `admin_config` validation.
