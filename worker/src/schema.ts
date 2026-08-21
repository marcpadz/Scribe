import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Better Auth expects these exact field names. `usePlural` in the adapter
// maps them to users / sessions / accounts / verifications tables.
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // D1 rejects boolean bind params, so model emailVerified as integer (0/1).
  // Better Auth binds the value by the column type; integer -> numeric 0/1.
  emailVerified: integer("emailVerified").notNull().default(0),
  image: text("image"),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: text("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  // Required by Better Auth v1.7 — identifies the auth provider issuer.
  issuer: text("issuer").notNull().default(""),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: text("accessTokenExpiresAt"),
  refreshTokenExpiresAt: text("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: text("expiresAt").notNull(),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

// App-specific profile (plan + usage tracking)
export const profile = sqliteTable("profile", {
  userId: text("userId")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  plan: text("plan").notNull().default("free"), // 'free' | 'pro'
  totalSecondsTranscribed: integer("totalSecondsTranscribed").notNull().default(0),
  createdAt: text("createdAt").notNull(),
});

// Admin key/value config (e.g. engine_models JSON)
export const adminConfig = sqliteTable("admin_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

// Engine job log: every transcription/analyze/chat run is recorded so the
// admin dashboard can monitor app processes, status and conditions.
export const job = sqliteTable("job", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // 'transcribe' | 'analyze' | 'chat'
  userId: text("userId"), // null for anonymous/free-tier
  status: text("status").notNull(), // 'queued' | 'running' | 'done' | 'error'
  model: text("model"), // model used for this run
  durationSeconds: integer("durationSeconds"), // media length (transcribe)
  frames: integer("frames"), // frame count (analyze)
  error: text("error"), // error message if failed
  createdAt: text("createdAt").notNull(),
  finishedAt: text("finishedAt"),
});
