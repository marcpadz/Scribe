# Scribe (NeoScriber)

> **AGENT DIRECTIVE — Read this first, every session.**
> This document governs how you work in this workspace. Do not skip it.
> Last updated: 2026-08-18

---

## Thinking Chain (run before every task)

1. **Read this file (`AGENTS.md`)** — the canonical glossary, current state, and active
   priorities. This is the single most commonly skipped step and the biggest cause of
   drift. Read it now.
2. **Load the matching playbook** in `.agent-continuity/playbooks/` *before* doing the
   work that playbook governs.
3. **Consult the store before acting** — search `.agent-continuity/learnings/` (and the
   symptom table in `learnings/_index.md`) before tackling a problem; read relevant
   decisions in `.agent-continuity/decisions/` before a cross-cutting choice.
4. **Write back when done** — record what you learned (a new decision, a lesson learned)
   so the next agent inherits it.

Background agents given a task without this context must ask the parent agent for it.

---

## Domain Glossary

| Term | Definition |
|---|---|
| Scribe / NeoScriber | The app — a neo-brutalist AI audio/video transcription tool |
| Transcript | Timed text segments produced by Gemini from media |
| Segment | One transcript line with `start`, `end`, `text` (seconds) |
| Project | A saved unit: transcript + bookmarks + mediaType + sourceType |
| sourceType | `local` (download JSON / localStorage) or `drive` (Google Drive) |
| Relinking | Re-attaching media to a loaded project (blob isn't persisted in JSON) |
| Cobalt | External API (`api.cobalt.tools`) used to extract social-media media URLs |
| Proxy | Cloudflare Worker (`functions/proxy.ts`) that bypasses browser CORS |

---

## Current State

- **Phase:** Assessment complete — functional MVP, **NOT shippable** as-is
- **Blocked by:** Production blockers listed in the Assessment section below
- **Next milestone:** Resolve the 4 shippability blockers, then deploy
- **Active priorities:**
  1. Replace Tailwind CDN with a real build pipeline (perf + no flash)
  2. Wire Google Client ID env so Drive login isn't silently disabled
  3. Fix/verify video transcription (decodeAudioData on mp4 is unreliable)
  4. Replace `gemini-3-pro-preview` with a verified model name

---

## Invariants

- [ ] Transcribe model must be a real, available Gemini model name
- [ ] Google Drive features require `REACT_APP_GOOGLE_CLIENT_ID` + `API_KEY` wired through Vite `define`
- [ ] No CDN Tailwind in production (`cdn.tailwindcss.com`)
- [ ] The CORS proxy must not remain an open, unauthenticated proxy

---

## Shippability Assessment (2026-08-18)

**What works (MVP complete):**
Record · upload · link import · Google Drive import/save · chunked transcription ·
auto-scroll transcript · speed/bookmarks/seek · clip export (WAV) · AI chat on
transcript · video frame analysis · light/dark theme · local save/open (.neoscriber).

**Shippability blockers (must fix):**
1. **Tailwind via CDN** (`index.html` → `cdn.tailwindcss.com`). Not production-grade:
   large runtime, no purge, FOUC flash. Switch to Tailwind build or precompiled CSS.
2. **Google Client ID not wired.** `driveService.ts` reads
   `process.env.REACT_APP_GOOGLE_CLIENT_ID`, but `vite.config.ts` `define` only sets
   `API_KEY` and `GEMINI_API_KEY`. So `REACT_APP_GOOGLE_CLIENT_ID` is `undefined` →
   GIS init is skipped → "Continue with Google" silently never initializes. Confirmed bug.
3. **Video transcription likely broken.** `processAudioBlob` runs `decodeAudioData` on
   the raw blob; for `video/mp4` this is unreliable/throws in most browsers. Even when it
   works, `geminiService.transcribeAudio` always sends `mimeType: "audio/wav"`. Needs a
   robust audio-extraction path (e.g. `<audio>` + `captureStream`, or ffmpeg.wasm).
4. **Unverified model `gemini-3-pro-preview`.** Used by `analyzeVideoFrames` and
   `chatWithGemini`. If the name isn't live, both features 500. Verify/replace.

**Likely bugs / risks:**
- Branding mismatch: login card says "Gemini 2.5 Flash", app badge says "Gemini 3.0 Pro
  Powered", actual transcribe model is `gemini-2.5-flash`. Pick one truth.
- Open CORS proxy (`functions/proxy.ts`) has no auth/rate-limit → abuse vector once deployed.
- Cobalt dependency (`api.cobalt.tools`) is third-party, rate-limited, no key → flaky.
- `transcriptRef` declared in `App.tsx` but never used (dead code).
- `currentSegments` typed `any[]` in `App.tsx` (TS smell).
- `wrangler.json` sets `assets.directory: ./dist` but no Pages/Worker `main`; deploy
  story is ambiguous (Pages `functions/` vs Worker).

**Missing for a clean launch:**
- `.env.example` + full setup docs (Gemini key, Google API key, OAuth Client ID).
- Tests / CI (none today).
- Error states for the Cobalt path, proxy failures, invalid media.
- Privacy/Terms links currently point nowhere real.

---

## Quality Checkpoint Routing

| Work type | Checkpoint | Owner |
|---|---|---|
| Transcription | Verify model name + chunk handling | Self |
| Drive auth | Verify Client ID reaches `tokenClient` | Self |
| Styling | Confirm no CDN Tailwind in prod build | Self |
| Deploy | Dry-run `wrangler` / Pages build | Self |

---

## Knowledge System

All stores live inside the single hidden folder `.agent-continuity/`.

| Store | Path | Purpose | Consult before | Write after |
|---|---|---|---|---|
| `decisions/` | `.agent-continuity/decisions/` | Hard-to-reverse choices | Cross-cutting decisions | Making a hard choice |
| `learnings/` | `.agent-continuity/learnings/` | Solved problems & lessons | Debugging | Fixing a defect |
| `playbooks/` | `.agent-continuity/playbooks/` | Reusable procedures | Recurring work | Establishing a process |
| `templates/` | `.agent-continuity/templates/` | Reusable starting points | Creating new output | Creating a reusable format |

**Agent-local caveat:** Your session scratch (`.agent-continuity/.local/`) is private. Do
not commit it. Copy from `templates/` into your private space; never move private material
into shared stores.

---

## Folder Visibility Note

All agent-continuity scaffolding lives inside a **single hidden folder**:
`.agent-continuity/`. Hidden on macOS (dot-prefix + `chflags hidden`) so the user's
project root stays clean. Reveal with `chflags nohidden .agent-continuity`.

---

## Reference Files

- `package.json` — Vite + React 19, `@google/genai`, `lucide-react`
- `index.html` — import maps (CDN), Tailwind CDN, gapi/gis scripts
- `vite.config.ts` — `define` injects `API_KEY`/`GEMINI_API_KEY`
- `functions/proxy.ts` — Cloudflare CORS + Cobalt proxy
- `wrangler.json` — Cloudflare deploy config (assets `./dist`)

---

## Change Log

| Date | What changed | Agent |
|---|---|---|
| 2026-08-18 | Initial scaffold + shippability assessment | Founding agent |
