import { Hono } from "hono";
import { createAuth } from "./auth";
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

// --- Transcribe proxy: key stays server-side; gating enforced here ---
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

  // TODO: call Google GenAI with c.env.GEMINI_API_KEY here.
  // The key never reaches the browser bundle.
  return c.json(
    { message: "Transcription endpoint ready (wire Gemini call here).", authed: isAuthed },
    200
  );
});

// CORS for local dev (in prod, Pages + Worker share the same domain)
app.use("*", async (c, next) => {
  await next();
  c.header("Access-Control-Allow-Origin", "*");
});

export default app;
