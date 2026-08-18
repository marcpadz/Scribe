# Switch transcription model to gemma-4-31b-it

**Status:** Completed
**Date:** 2026-08-18

## Considered options
- **Keep `gemini-2.5-flash` for transcription** — verified, well-performing, but the user specifically wants Gemma 4.
- **Use `gemma-4-31b-it`** — larger, more capable reasoning model; available on Google AI Studio; same `@google/genai` client works (same API surface).

Decision: use `gemma-4-31b-it` for all roles (transcription, chat, video analysis). Model name confirmed via https://ai.google.dev/gemma/docs/core.

## Addendum
The model path is `models/gemma-4-31b-it` in the AI Studio UI but the API accepts just `gemma-4-31b-it` as the model parameter (consistent with how other `gemini-*` models are addressed).