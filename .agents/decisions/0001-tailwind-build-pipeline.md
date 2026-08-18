# Replace Tailwind CDN with a real build pipeline

**Status:** Proposed (pending implementation)
**Date:** 2026-08-18

## Considered options
- **Keep `cdn.tailwindcss.com`** — rejected: not production-safe (FOUC, no purge, large
  runtime), explicitly discouraged by Tailwind.
- **Tailwind v3 (postcss + autoprefixer)** — viable, well-documented, stable.
- **Tailwind v4 (`@tailwindcss/vite`)** — modern, simpler config, fewer deps; chosen
  default unless v3 compatibility is required.
- **Precompiled plain CSS** — rejected: loses utility workflow the codebase relies on.

Decision: adopt a real Tailwind build (v4 preferred). Move `neo-*` color/shadow tokens
into the theme config. Remove the CDN `<script>` from `index.html`.
