# Scribe (NeoScriber)

A neo-brutalist audio/video transcription web app, powered by Google's Gemma 4.

Record from your mic, upload a file, paste a link, or import from Google Drive — then chat with an AI assistant about your transcript.

## Quick Start

```bash
npm install
cp .env.example .env.local
# Fill in GEMINI_API_KEY and GOOGLE_CLIENT_ID in .env.local
npm run dev
```

Open http://localhost:5173 (or the port Vite prints).

> **Without a valid `GEMINI_API_KEY` in `.env.local`, transcription/chat will fail with
> "API Key is missing" and the workspace shows a red model indicator.** The Google Drive
> "Continue with Google" button stays disabled until `GOOGLE_CLIENT_ID` is set.

### Getting the credentials
- `GEMINI_API_KEY` — free key from https://aistudio.google.com/app/apikey
- `GOOGLE_CLIENT_ID` — create an **OAuth 2.0 Client ID** (Web application) at
  https://console.cloud.google.com/apis/credentials. Add your dev origin
  (e.g. `http://localhost:5173`) to the authorized JavaScript origins.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Yes | Google AI Studio API key (free tier). Get one at https://aistudio.google.com/app/apikey |
| `GOOGLE_CLIENT_ID` | ✅ For Drive features | OAuth 2.0 Client ID from [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Must include authorized origins. |

See `.env.example` for the template.

## Models

Transcription, video analysis, and chat all use **Gemma 4 31B** (`gemma-4-31b-it`) via the `@google/genai` client — a verified Google AI Studio model ([docs](https://ai.google.dev/gemma/docs/core)).

## Features

- **Record** from your microphone
- **Upload** audio/video files (WAV, MP3, MP4, MOV)
- **Import from URL** — direct links to media files; YouTube/TikTok/IG/Twitter/X via the proxy
- **Google Drive** — save/open projects and import media from your Drive
- **Chunked transcription** — 10-minute chunks with progress tracking
- **Video frame analysis** — extract frames and ask the AI about visuals
- **AI Chat** — ask Gemini about your transcript
- **Bookmarks** — mark important moments
- **Clip export** — export a WAV segment as audio
- **Dark mode** — toggle from the bottom-left button

## Deploy to Cloudflare Pages

1. Build: `npm run build`
2. Push to Cloudflare Pages (or `wrangler pages deploy dist`)
3. The Pages Function at `functions/proxy.ts` will run automatically

## Tech Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v3 (PostCSS build, no CDN)
- `@google/genai` for transcription / chat / analysis
- Cloudflare Pages for hosting
- `lucide-react` for icons