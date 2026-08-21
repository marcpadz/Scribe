import { Hono } from "hono";
import { createAuth } from "./auth";
import {
  DEFAULT_MODELS,
  EngineModels,
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
  ADMIN_KEY: string; // bearer token for the admin dashboard
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

const app = new Hono<{ Bindings: Env }>();

// --- Feature gating: enforced server-side (never trust the client) ---
const FREE_TIER_SECONDS = 120; // 2-minute cap for unauthenticated users
const ADMIN_CONFIG_KEY = "engine_models";

// Credentialed CORS — MUST be mounted BEFORE the /api/auth/* route, otherwise
// Hono runs the auth handler (a route) ahead of this middleware and the
// preflight OPTIONS response ships without CORS headers, blocking cross-origin
// auth calls. Only allow the Scribe front-end + local dev, echo credentials so
// auth cookies survive cross-origin.
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
    c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Key");
    c.header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  }
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }
  await next();
});

// --- Better Auth handler (mounted after CORS so preflight passes) ---
app.all("/api/auth/*", async (c) => {
  const auth = await createAuth(c.env.DB, c.env);
  return auth.handler(c.req.raw);
});

// --- Engine model config (admin-configurable, DB-backed with DEFAULT_MODELS fallback) ---
async function loadModels(db: D1Database): Promise<EngineModels> {
  const row = await db.prepare(`SELECT value FROM admin_config WHERE key = ?`)
    .bind(ADMIN_CONFIG_KEY).first<{ value: string }>();
  if (!row?.value) return DEFAULT_MODELS;
  try {
    const parsed = JSON.parse(row.value) as Partial<EngineModels>;
    return {
      transcription: parsed.transcription ?? DEFAULT_MODELS.transcription,
      videoAnalysis: parsed.videoAnalysis ?? DEFAULT_MODELS.videoAnalysis,
      chat: parsed.chat ?? DEFAULT_MODELS.chat,
    };
  } catch {
    return DEFAULT_MODELS;
  }
}

// The Gemini API key lives in the Worker secret by default, but the admin can
// override it at runtime via admin_config (key "gemini_api_key") — e.g. to swap
// keys without redeploying. The secret always wins as the source of truth if no
// override is stored.
const API_KEY_CONFIG_KEY = "gemini_api_key";
async function loadApiKey(db: D1Database, secretKey: string): Promise<string> {
  const row = await db.prepare(`SELECT value FROM admin_config WHERE key = ?`)
    .bind(API_KEY_CONFIG_KEY).first<{ value: string }>();
  return row?.value?.trim() ? row.value.trim() : secretKey;
}

function newId(): string {
  return crypto.randomUUID();
}
function nowIso(): string {
  return new Date().toISOString();
}

async function logJob(
  db: D1Database,
  job: {
    type: string;
    userId?: string | null;
    status: string;
    model?: string;
    durationSeconds?: number;
    frames?: number;
    error?: string;
    finishedAt?: boolean;
  }
): Promise<string> {
  const id = newId();
  await db.prepare(
    `INSERT INTO job (id, type, userId, status, model, durationSeconds, frames, error, createdAt, finishedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      job.type,
      job.userId ?? null,
      job.status,
      job.model ?? null,
      job.durationSeconds ?? null,
      job.frames ?? null,
      job.error ?? null,
      nowIso(),
      job.finishedAt ? nowIso() : null
    )
    .run();
  return id;
}

app.get("/api/me", async (c) => {
  const auth = await createAuth(c.env.DB, c.env);
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

// --- Gemma / Gemini engine: audio transcription ---
app.post("/api/transcribe", async (c) => {
  const auth = await createAuth(c.env.DB, c.env);
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

  const models = await loadModels(c.env.DB);
  const apiKey = await loadApiKey(c.env.DB, c.env.GEMINI_API_KEY);
  const jobId = await logJob(c.env.DB, {
    type: "transcribe",
    userId: session?.user?.id,
    status: "running",
    model: models.transcription,
    durationSeconds: duration,
  });

  try {
    const result = await transcribeAudio(
      apiKey,
      models,
      body.audioBase64,
      body.mimeType ?? "audio/wav"
    );
    await c.env.DB.prepare(`UPDATE job SET status = 'done', finishedAt = ? WHERE id = ?`)
      .bind(nowIso(), jobId).run();
    return c.json({ ...result, authed: isAuthed }, 200);
  } catch (err: any) {
    console.error("Transcription failed:", err);
    await c.env.DB.prepare(`UPDATE job SET status = 'error', error = ?, finishedAt = ? WHERE id = ?`)
      .bind(String(err?.message || err).slice(0, 500), nowIso(), jobId).run();
    return c.json({ error: "Transcription failed. Please try again." }, 502);
  }
});

// --- Engine: video understanding (frame analysis) ---
app.post("/api/analyze", async (c) => {
  const auth = await createAuth(c.env.DB, c.env);
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

  const models = await loadModels(c.env.DB);
  const apiKey = await loadApiKey(c.env.DB, c.env.GEMINI_API_KEY);
  const jobId = await logJob(c.env.DB, {
    type: "analyze",
    userId: session.user.id,
    status: "running",
    model: models.videoAnalysis,
    frames: body.frames.length,
  });

  try {
    const result = await analyzeVideoFrames(
      apiKey,
      models,
      body.frames,
      body.prompt
    );
    await c.env.DB.prepare(`UPDATE job SET status = 'done', finishedAt = ? WHERE id = ?`)
      .bind(nowIso(), jobId).run();
    return c.json({ analysis: result }, 200);
  } catch (err: any) {
    console.error("Video analysis failed:", err);
    await c.env.DB.prepare(`UPDATE job SET status = 'error', error = ?, finishedAt = ? WHERE id = ?`)
      .bind(String(err?.message || err).slice(0, 500), nowIso(), jobId).run();
    return c.json({ error: "Video analysis failed. Please try again." }, 502);
  }
});

// --- Engine: transcript-grounded chat ---
app.post("/api/chat", async (c) => {
  const auth = await createAuth(c.env.DB, c.env);
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

  const models = await loadModels(c.env.DB);
  const apiKey = await loadApiKey(c.env.DB, c.env.GEMINI_API_KEY);
  const jobId = await logJob(c.env.DB, {
    type: "chat",
    userId: session.user.id,
    status: "running",
    model: models.chat,
  });

  try {
    const reply = await chatWithGemini(
      apiKey,
      models,
      body.history ?? [],
      body.message,
      body.context ?? ""
    );
    await c.env.DB.prepare(`UPDATE job SET status = 'done', finishedAt = ? WHERE id = ?`)
      .bind(nowIso(), jobId).run();
    return c.json({ reply }, 200);
  } catch (err: any) {
    console.error("Chat failed:", err);
    await c.env.DB.prepare(`UPDATE job SET status = 'error', error = ?, finishedAt = ? WHERE id = ?`)
      .bind(String(err?.message || err).slice(0, 500), nowIso(), jobId).run();
    return c.json({ error: "Chat failed. Please try again." }, 502);
  }
});

// ============ ADMIN DASHBOARD (protected by X-Admin-Key header) ============
const requireAdmin = async (c: any, next: any) => {
  const key = c.req.header("X-Admin-Key") || c.req.query("adminKey");
  if (!key || key !== c.env.ADMIN_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
};

// Config: current engine models + api key status
app.get("/api/admin/config", requireAdmin, async (c) => {
  const models = await loadModels(c.env.DB);
  const keyRow = await c.env.DB.prepare(`SELECT value FROM admin_config WHERE key = ?`)
    .bind(API_KEY_CONFIG_KEY).first<{ value: string }>();
  const keyOverride = Boolean(keyRow?.value?.trim());
  const resendRow = await c.env.DB.prepare(`SELECT value FROM admin_config WHERE key = ?`)
    .bind("resend_api_key").first<{ value: string }>();
  const resendOverride = Boolean(resendRow?.value?.trim());
  return c.json({
    key: ADMIN_CONFIG_KEY,
    models,
    defaults: DEFAULT_MODELS,
    apiKey: { set: Boolean(c.env.GEMINI_API_KEY), overridden: keyOverride },
    resendKey: { set: Boolean(c.env.RESEND_API_KEY), overridden: resendOverride },
  }, 200);
});

// Config: update engine models
app.put("/api/admin/config", requireAdmin, async (c) => {
  const body = await c.req.json<EngineModels>().catch(() => null);
  if (!body || !body.transcription || !body.videoAnalysis || !body.chat) {
    return c.json({ error: "transcription, videoAnalysis and chat are required" }, 400);
  }
  await c.env.DB.prepare(
    `INSERT INTO admin_config (key, value, updatedAt) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`
  ).bind(ADMIN_CONFIG_KEY, JSON.stringify(body), nowIso()).run();
  return c.json({ models: body }, 200);
});

// API key: get current (returns only whether a key is configured, never the secret)
app.get("/api/admin/apikey", requireAdmin, async (c) => {
  const row = await c.env.DB.prepare(`SELECT value FROM admin_config WHERE key = ?`)
    .bind(API_KEY_CONFIG_KEY).first<{ value: string }>();
  return c.json({ set: Boolean(c.env.GEMINI_API_KEY), overridden: Boolean(row?.value?.trim()) }, 200);
});

// API key: set/override (stored in admin_config; empty body clears the override)
app.put("/api/admin/apikey", requireAdmin, async (c) => {
  const body = await c.req.json<{ key?: string }>().catch(() => ({}));
  const value = (body.key ?? "").trim();
  if (!value) {
    await c.env.DB.prepare(`DELETE FROM admin_config WHERE key = ?`).bind(API_KEY_CONFIG_KEY).run();
    return c.json({ overridden: false, message: "Reverted to Worker secret key" }, 200);
  }
  await c.env.DB.prepare(
    `INSERT INTO admin_config (key, value, updatedAt) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`
  ).bind(API_KEY_CONFIG_KEY, value, nowIso()).run();
  return c.json({ overridden: true, message: "API key override saved" }, 200);
});

// --- Resend (email) API key: same override pattern as the Gemini key ---
const RESEND_KEY_CONFIG_KEY = "resend_api_key";

// Resend key: get current (returns only whether a key is configured, never the secret)
app.get("/api/admin/resendkey", requireAdmin, async (c) => {
  const row = await c.env.DB.prepare(`SELECT value FROM admin_config WHERE key = ?`)
    .bind(RESEND_KEY_CONFIG_KEY).first<{ value: string }>();
  return c.json({ set: Boolean(c.env.RESEND_API_KEY), overridden: Boolean(row?.value?.trim()) }, 200);
});

// Resend key: set/override (stored in admin_config; empty body clears the override).
// NOTE: we don't test-send here — verification emails are sent on sign-up/sign-in
// via Better Auth, which reads this override at request time in auth.ts.
app.put("/api/admin/resendkey", requireAdmin, async (c) => {
  const body = await c.req.json<{ key?: string }>().catch(() => ({}));
  const value = (body.key ?? "").trim();
  if (!value) {
    await c.env.DB.prepare(`DELETE FROM admin_config WHERE key = ?`).bind(RESEND_KEY_CONFIG_KEY).run();
    return c.json({ overridden: false, message: "Reverted to Worker secret key" }, 200);
  }
  await c.env.DB.prepare(
    `INSERT INTO admin_config (key, value, updatedAt) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`
  ).bind(RESEND_KEY_CONFIG_KEY, value, nowIso()).run();
  return c.json({ overridden: true, message: "Resend key override saved" }, 200);
});

// Available Gemini models (for the dropdown). Fetched from the live API so the
// list is always current. Audio-capable models are flagged for the transcription
// dropdown; Gemma models are excluded from transcription (no audio modality).
app.get("/api/admin/models", requireAdmin, async (c) => {
  try {
    const apiKey = await loadApiKey(c.env.DB, c.env.GEMINI_API_KEY);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { headers: { "x-goog-api-key": apiKey } }
    );
    const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    const names = (data.models ?? [])
      .map((m) => m.name.replace(/^models\//, ""))
      .filter((n) => /gemini|gemma/i.test(n))
      .sort();
    return c.json({ models: names }, 200);
  } catch (err: any) {
    return c.json({ models: [], error: String(err?.message || err).slice(0, 200) }, 200);
  }
});

// DB viewer: list tables (safe, read-only metadata)
app.get("/api/admin/db/tables", requireAdmin, async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name`
  ).all<{ name: string }>();
  return c.json({ tables: rows.results.map((r) => r.name) }, 200);
});

// DB viewer: read rows from a table (read-only, capped)
app.get("/api/admin/db/table/:name", requireAdmin, async (c) => {
  const name = c.req.param("name");
  // strict allow-list to avoid touching Better Auth internals accidentally
  const allowed = new Set([
    "user", "session", "account", "verification", "profile",
    "admin_config", "job",
  ]);
  if (!allowed.has(name)) {
    return c.json({ error: "Table not viewable" }, 403);
  }
  const limit = Math.min(Number(c.req.query("limit") ?? 100), 500);
  const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);
  const data = await c.env.DB.prepare(
    `SELECT * FROM "${name}" ORDER BY rowid DESC LIMIT ? OFFSET ?`
  ).bind(limit, offset).all<any>();
  const count = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).first<{ n: number }>();
  return c.json({ table: name, rows: data.results, total: count?.n ?? 0 }, 200);
});

// Process monitor: recent engine jobs (status/condition)
app.get("/api/admin/jobs", requireAdmin, async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 100), 500);
  const rows = await c.env.DB.prepare(
    `SELECT * FROM job ORDER BY createdAt DESC LIMIT ?`
  ).bind(limit).all<any>();
  const stats = await c.env.DB.prepare(
    `SELECT status, COUNT(*) AS n FROM job GROUP BY status`
  ).all<{ status: string; n: number }>();
  const byType = await c.env.DB.prepare(
    `SELECT type, COUNT(*) AS n FROM job GROUP BY type`
  ).all<{ type: string; n: number }>();
  return c.json({ jobs: rows.results, stats: stats.results, byType: byType.results }, 200);
});

// Overall health snapshot for the dashboard
app.get("/api/admin/health", requireAdmin, async (c) => {
  const models = await loadModels(c.env.DB);
  const users = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM user`).first<{ n: number }>();
  const jobs = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM job`).first<{ n: number }>();
  const running = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM job WHERE status = 'running'`
  ).first<{ n: number }>();
  const errors = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM job WHERE status = 'error'`
  ).first<{ n: number }>();
  return c.json({
    status: "ok",
    models,
    freeTierSeconds: FREE_TIER_SECONDS,
    counts: {
      users: users?.n ?? 0,
      totalJobs: jobs?.n ?? 0,
      running: running?.n ?? 0,
      errors: errors?.n ?? 0,
    },
    generatedAt: nowIso(),
  }, 200);
});

export default app;
