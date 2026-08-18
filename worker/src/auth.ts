import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Resend } from "resend";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import type { D1Database } from "@cloudflare/workers-types";
import type { Env } from "./index";

/**
 * Builds the Better Auth instance backed by Cloudflare D1 (via drizzle).
 * Email verification is REQUIRED: a user cannot sign in until verified.
 */
export function createAuth(db: D1Database, env: Env) {
  const resend = new Resend(env.RESEND_API_KEY);
  const orm = drizzle(db, { schema });

  return betterAuth({
    database: drizzleAdapter(orm, {
      provider: "sqlite",
      usePlural: true, // tables: user -> users, session -> sessions, etc.
    }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true, // account unusable until verified
      sendVerificationEmail: async ({ user, url }: { user: { email: string; name?: string }; url: string }) => {
        await resend.emails.send({
          from: "NeoScriber <onboarding@resend.dev>",
          to: user.email,
          subject: "Verify your NeoScriber account",
          html: `
            <h2>Welcome to NeoScriber</h2>
            <p>Confirm your email to activate your account:</p>
            <p>
              <a href="${url}" style="background:#FFE900;color:#1A1A1A;padding:10px 18px;border:2px solid #1A1A1A;text-decoration:none;font-weight:700;display:inline-block;">
                Verify my email
              </a>
            </p>
            <p style="color:#666;font-size:13px;">If the button doesn't work, copy this link: ${url}</p>
          `,
        });
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
    },

    socialProviders: {
      // Google OAuth deferred until the app is registered with Google.
      // Uncomment + add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET secrets when ready.
      // google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! },
    },

    basePath: "/api/auth",
  });
}

export type Auth = ReturnType<typeof createAuth>;
