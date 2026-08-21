// Admin dashboard API client. Talks to the Worker's /api/admin/* endpoints,
// authenticated with the admin key (stored locally after first login).

const WORKER_URL =
  (import.meta.env.VITE_AUTH_URL as string | undefined) || "http://localhost:8787";

const KEY_STORAGE = "scribe_admin_key";

export const getAdminKey = (): string | null =>
  localStorage.getItem(KEY_STORAGE);
export const setAdminKey = (k: string): void =>
  localStorage.setItem(KEY_STORAGE, k);
export const clearAdminKey = (): void => localStorage.removeItem(KEY_STORAGE);

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = getAdminKey();
  if (!key) throw new Error("Admin key required");
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      "Content-Type": "application/json",
      "X-Admin-Key": key,
    },
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const d = (await res.json()) as { error?: string };
      if (d?.error) msg = d.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export interface EngineModels {
  transcription: string;
  videoAnalysis: string;
  chat: string;
}
export interface Health {
  status: string;
  models: EngineModels;
  freeTierSeconds: number;
  counts: { users: number; totalJobs: number; running: number; errors: number };
  generatedAt: string;
}
export interface JobRow {
  id: string;
  type: string;
  userId: string | null;
  status: string;
  model: string | null;
  durationSeconds: number | null;
  frames: number | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}
export interface TableData {
  table: string;
  rows: Record<string, unknown>[];
  total: number;
}

export const adminApi = {
  verifyKey: async (key: string): Promise<Health> => {
    const res = await fetch(`${WORKER_URL}/api/admin/health`, {
      headers: { "X-Admin-Key": key },
    });
    if (!res.ok) throw new Error("Invalid admin key");
    return res.json() as Promise<Health>;
  },
  health: () => adminFetch<Health>("/api/admin/health"),
  getConfig: () => adminFetch<{ models: EngineModels; defaults: EngineModels; apiKey: { set: boolean; overridden: boolean }; resendKey: { set: boolean; overridden: boolean } }>("/api/admin/config"),
  saveConfig: (models: EngineModels) =>
    adminFetch<{ models: EngineModels }>("/api/admin/config", {
      method: "PUT",
      body: JSON.stringify(models),
    }),
  getApiKey: () => adminFetch<{ set: boolean; overridden: boolean }>("/api/admin/apikey"),
  saveApiKey: (key: string) =>
    adminFetch<{ overridden: boolean; message: string }>("/api/admin/apikey", {
      method: "PUT",
      body: JSON.stringify({ key }),
    }),
  getResendKey: () => adminFetch<{ set: boolean; overridden: boolean }>("/api/admin/resendkey"),
  saveResendKey: (key: string) =>
    adminFetch<{ overridden: boolean; message: string }>("/api/admin/resendkey", {
      method: "PUT",
      body: JSON.stringify({ key }),
    }),
  listModels: () => adminFetch<{ models: string[]; error?: string }>("/api/admin/models"),
  tables: () => adminFetch<{ tables: string[] }>("/api/admin/db/tables"),
  table: (name: string, limit = 100, offset = 0) =>
    adminFetch<TableData>(
      `/api/admin/db/table/${encodeURIComponent(name)}?limit=${limit}&offset=${offset}`
    ),
  jobs: (limit = 100) =>
    adminFetch<{ jobs: JobRow[]; stats: { status: string; n: number }[]; byType: { type: string; n: number }[] }>(
      `/api/admin/jobs?limit=${limit}`
    ),
};
