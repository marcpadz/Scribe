# Gemma 4 models have NO audio modality — can't transcribe

**Status:** Resolved (architecture split)
**Created:** 2026-08-21
**Tags:** #gemini #gemma #transcription #architecture

## Symptoms
- `gemma-4-31b-it` (and `gemma-4-26b-a4b-it`) returns 400 "Audio input modality is
  not enabled for this model" when you send `inlineData` with `audio/*`.
- User originally wanted Gemma 31B to be "the video understanding AND audio
  transcription engine." Audio half is impossible on Gemma.

## Root Cause
Gemma open-weight models only accept **image** input. Their `generateContent`
errors on audio. Confirmed live against the key on `gemma-4-31b-it` / `-26b-`.

Meanwhile Gemini Flash **does** accept audio + returns structured JSON:
- `gemini-flash-latest` => OK (transcription)
- `gemini-3-flash-preview` => OK (transcription)
- `gemini-2.5-flash` (and older `gemini-2.0-flash`) => 404 "no longer available to new use"

## Resolution (engine split, server-provisioned via Cloudflare Worker)
- `transcription: "gemini-flash-latest"` (audio-capable, structured JSON)
- `videoAnalysis: "gemma-4-31b-it"` (Gemma — image only, its strength)
- `chat:        "gemma-4-31b-it"`
- All calls happen in `worker/src/gemini.ts` using `c.env.GEMINI_API_KEY`.
  The SPA (`services/geminiService.ts`) only POSTs to the Worker — key never
  reaches the browser bundle. No OAuth for the engine; auth (Better Auth) is
  only for feature gating.

## Prevention
- Don't assume a model handles audio just because it handles images — verify
  the modality against the live endpoint before wiring it for transcription.
- Keep model role selection centralized in the `MODELS` object with a comment
  on why each was chosen.
