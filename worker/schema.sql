-- Better Auth schema for Cloudflare D1
-- https://www.better-auth.com/docs/adapters/cloudflare-d1

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL DEFAULT 0,
  "image" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "expiresAt" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TEXT,
  "refreshTokenExpiresAt" TEXT,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

-- App-specific: track free-tier usage + plan
CREATE TABLE IF NOT EXISTS "profile" (
  "userId" TEXT PRIMARY KEY NOT NULL,
  "plan" TEXT NOT NULL DEFAULT 'free',       -- 'free' (unauth-equivalent) | 'pro'
  "totalSecondsTranscribed" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "session_userId" ON "session"("userId");
CREATE INDEX IF NOT EXISTS "account_userId" ON "account"("userId");
CREATE INDEX IF NOT EXISTS "verification_identifier" ON "verification"("identifier");

-- Admin key/value config (e.g. engine_models JSON)
CREATE TABLE IF NOT EXISTS "admin_config" (
  "key" TEXT PRIMARY KEY NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

-- Engine job log: every transcription/analyze/chat run is recorded so the
-- admin dashboard can monitor app processes, status and conditions.
CREATE TABLE IF NOT EXISTS "job" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "type" TEXT NOT NULL,                 -- 'transcribe' | 'analyze' | 'chat'
  "userId" TEXT,                        -- null for anonymous/free-tier
  "status" TEXT NOT NULL,               -- 'queued' | 'running' | 'done' | 'error'
  "model" TEXT,                         -- model used for this run
  "durationSeconds" INTEGER,            -- media length (transcribe)
  "frames" INTEGER,                     -- frame count (analyze)
  "error" TEXT,                         -- error message if failed
  "createdAt" TEXT NOT NULL,
  "finishedAt" TEXT
);

CREATE INDEX IF NOT EXISTS "job_type" ON "job"("type");
CREATE INDEX IF NOT EXISTS "job_status" ON "job"("status");
CREATE INDEX IF NOT EXISTS "job_createdAt" ON "job"("createdAt");
