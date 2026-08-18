# Unverified Gemini model name `gemini-3-pro-preview`

**Status:** Open (verify)
**Created:** 2026-08-18
**Tags:** #gemini #config #bug

## Symptoms
- "Analyze Visuals" button yields no result / 500.
- Chatbot ("Ask Gemini") returns "Error: Could not connect to Gemini."

## Root Cause
`geminiService.ts` uses `gemini-3-pro-preview` for `analyzeVideoFrames` and
`chatWithGemini`. If that exact model string is not live/available on the API key,
requests fail.

## Resolution
- Verify current available model names in Google AI Studio / `gemini-2.5-pro` etc.
- Replace with a confirmed-available model; centralize model names in one constant.

## Prevention
- [ ] Keep all model IDs in a single `MODELS` config object, not hardcoded per function.
- [ ] Add a startup "model ping" check in dev to fail fast on bad names.
