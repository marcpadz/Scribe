import { TranscriptData } from "../types";

/**
 * Client-side proxy for the Gemma 4 31B engine.
 *
 * IMPORTANT: The Gemini API key is NEVER present in this bundle. The SPA now
 * calls our Cloudflare Worker (VITE_AUTH_URL), which provisions the model
 * server-side. The engine handles audio transcription, video understanding,
 * and transcript-grounded chat — all via routes that keep the key on our
 * server. No OAuth is required for the engine (auth is only for gating).
 */

// The Worker URL. In production this is set in .env.local / build env as
// VITE_AUTH_URL. Falls back to a local worker for `npm run dev`.
const WORKER_URL =
  (import.meta.env.VITE_AUTH_URL as string | undefined) || "http://localhost:8787";

// Kept for the ModelIndicator badge. Gemma 31B powers video understanding +
// chat; Gemini Flash powers audio transcription (Gemma has no audio modality).
export const MODELS = {
  transcription: "gemini-flash-latest",
  videoAnalysis: "gemma-4-31b-it",
  chat: "gemma-4-31b-it",
} as const;

export const isApiKeyConfigured = (): boolean => true; // key is server-side now

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const transcribeAudio = async (
  base64Audio: string,
  mimeType = "audio/wav",
  durationSeconds?: number
): Promise<TranscriptData> => {
  const data = await postJSON<{ segments: TranscriptData["segments"] }>(
    "/api/transcribe",
    { audioBase64: base64Audio, mimeType, durationSeconds }
  );
  return { segments: data.segments };
};

export const analyzeVideoFrames = async (
  frames: string[],
  prompt?: string
): Promise<string> => {
  const data = await postJSON<{ analysis: string }>("/api/analyze", {
    frames,
    prompt,
  });
  return data.analysis;
};

export const chatWithGemini = async (
  history: { role: string; parts: { text: string }[] }[],
  message: string,
  context: string
): Promise<string> => {
  const data = await postJSON<{ reply: string }>("/api/chat", {
    history,
    message,
    context,
  });
  return data.reply;
};
