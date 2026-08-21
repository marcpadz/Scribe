import { Hono } from "hono";
import { createAuth } from "./auth";
import {
  transcribeAudio,
  analyzeVideoFrames,
  chatWithGemini,
} from "./gemini";
import type { D1Database } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  GEMINI_API_KEY: string;
  RESEND_API_KEY: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

const app = new Hono<{ Bindings: Env }>();

// --- Better Auth handler (mounted at /api/auth/*) ---
app.all("/api/auth/*", async (c) => {
  const auth = createAuth(c.env.DB, c.env);
  return auth.handler(c.req.raw);
});

// --- Feature gating: enforced server-side (never trust the client) ---
const FREE_TIER_SECONDS = 120; // 2-minute cap for unauthenticated users

// Credentialed CORS: only allow the Scribe front-end and local dev, and echo
// credentials so auth cookies survive cross-origin. Refuse anonymous origins.
const ALLOWED_ORIGINS = new Set([
  "https://marcpadz.github.io",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8787",
]);

app.use("*", async (c, next) => {
  const origin = c.req.header("Origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }
  await next();
});

app.get("/api/me", async (c) => {
  const auth = createAuth(c.env.DB, c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ authenticated: false, limitSeconds: FREE_TIER_SECONDS }, 200);
  }
  const profile = await c.env.DB.prepare(
    `SELECT plan FROM profile WHERE userId = ?`
  ).bind(session.user.id).first<{ plan: string }>();
  const isPro = profile?.plan === "pro";
  return c.json({
    authenticated: true,
    email: session.user.email,
    emailVerified: session.user.emailVerified,
    plan: profile?.plan ?? "free",
    limitSeconds: isPro ? Number.MAX_SAFE_INTEGER : FREE_TIER_SECONDS,
  }, 200);
});

// --- Gemma 31B engine: audio transcription ---
// Key stays server-side; gating enforced here. No OAuth required for the engine.
app.post("/api/transcribe", async (c) => {
  const auth = createAuth(c.env.DB, c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  const body = await c.req
    .json<{ audioBase64: string; mimeType?: string; durationSeconds?: number }>()
    .catch(() => null);
  if (!body?.audioBase64) {
    return c.json({ error: "Missing audio" }, 400);
  }

  const isAuthed = Boolean(session?.user);
  const duration = Number(body.durationSeconds ?? 0);
  if (!isAuthed && duration > FREE_TIER_SECONDS) {
    return c.json(
      { error: "Free tier limited to 2 minutes. Sign up to unlock full length." },
      402
    );
  }

  try {
    const result = await transcribeAudio(
      c.env.GEMINI_API_KEY,
      body.audioBase64,
      body.mimeType ?? "audio/wav"
    );
    return c.json({ ...result, authed: isAuthed }, 200);
  } catch (err: any) {
    console.error("Transcription failed:", err);
    return c.json({ error: "Transcription failed. Please try again." }, 502);
  }
});

// --- Gemma 31B engine: video understanding (frame analysis) ---
app.post("/api/analyze", async (c) => {
  const auth = createAuth(c.env.DB, c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Sign in to use video understanding." }, 401);
  }

  const body = await c.req
    .json<{ frames: string[]; prompt?: string }>()
    .catch(() => null);
  if (!body?.frames?.length) {
    return c.json({ error: "Missing frames" }, 400);
  }

  try {
    const result = await analyzeVideoFrames(
      c.env.GEMINI_API_KEY,
      body.frames,
      body.prompt
    );
    return c.json({ analysis: result }, 200);
  } catch (err: any) {
    console.error("Video analysis failed:", err);
    return c.json({ error: "Video analysis failed. Please try again." }, 502);
  }
});

// --- Gemma 31B engine: transcript-grounded chat ---
app.post("/api/chat", async (c) => {
  const auth = createAuth(c.env.DB, c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Sign in to use the assistant." }, 401);
  }

  const body = await c.req
    .json<{
      history: { role: string; parts: { text: string }[] }[];
      message: string;
      context: string;
    }>()
    .catch(() => null);
  if (!body?.message) {
    return c.json({ error: "Missing message" }, 400);
  }

  try {
    const reply = await chatWithGemini(
      c.env.GEMINI_API_KEY,
      body.history ?? [],
      body.message,
      body.context ?? ""
    );
    return c.json({ reply }, 200);
  } catch (err: any) {
    console.error("Chat failed:", err);
    return c.json({ error: "Chat failed. Please try again." }, 502);
  }
});

export default app;
