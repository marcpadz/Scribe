# Tailwind loaded via CDN — not production-safe

**Status:** Open (confirmed)
**Created:** 2026-08-18
**Tags:** #styling #perf #shipping

## Symptoms
- First paint shows unstyled flash (FOUC) before Tailwind CDN script runs.
- Larger bundle; no unused-CSS purge.
- Tailwind docs explicitly warn against `cdn.tailwindcss.com` in production.

## Root Cause
`index.html` includes `<script src="https://cdn.tailwindcss.com"></script>` plus an inline
`tailwind.config`. This is the JIT CDN build meant for prototyping only.

## Resolution
- Install `tailwindcss` + `postcss` + `autoprefixer` (or Tailwind v4 `@tailwindcss/vite`).
- Move `neo-*` color/shadow tokens into `tailwind.config` / CSS `@theme`.
- Build real CSS; remove the CDN `<script>`.

## Prevention
- [ ] Never ship `cdn.tailwindcss.com` in a production build.
