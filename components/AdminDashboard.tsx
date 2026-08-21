import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import {
  Activity,
  Database,
  Cpu,
  KeyRound,
  RefreshCw,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { adminApi, getAdminKey, setAdminKey, clearAdminKey, Health, JobRow, EngineModels, TableData } from "../services/adminApi";

const STATUS_COLOR: Record<string, string> = {
  done: "#22c55e",
  running: "#eab308",
  error: "#ef4444",
  queued: "#64748b",
};

const AdminLogin: React.FC<{ onAuthed: () => void }> = ({ onAuthed }) => {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await adminApi.verifyKey(key.trim());
      setAdminKey(key.trim());
      onAuthed();
    } catch (err: any) {
      setError(err?.message || "Invalid admin key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0b0f19] via-[#121a2e] to-[#0b0f19] text-white">
      <form onSubmit={submit} className="w-full max-w-sm backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-6 h-6 text-[#FFE900]" />
          <h1 className="text-2xl font-black uppercase tracking-tighter">Admin<span className="text-[#FFE900]">Console</span></h1>
        </div>
        <p className="text-sm text-white/60 mb-4">Enter the admin key to view the database, engine config and process monitor.</p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="admin key"
          className="w-full px-3 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#FFE900] outline-none"
          required
        />
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <button disabled={loading} className="mt-4 w-full py-3 rounded-lg bg-[#FFE900] text-black font-bold disabled:opacity-60 flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Unlock
        </button>
      </form>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; tone?: string }> = ({
  label,
  value,
  icon,
  tone = "text-white",
}) => (
  <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
    <div className={`${tone}`}>{icon}</div>
    <div>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs uppercase tracking-wide text-white/50">{label}</div>
    </div>
  </div>
);

const AdminDashboard: React.FC = () => {
  const [health, setHealth] = useState<Health | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [jobStats, setJobStats] = useState<{ status: string; n: number }[]>([]);
  const [byType, setByType] = useState<{ type: string; n: number }[]>([]);
  const [models, setModels] = useState<EngineModels | null>(null);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [apiKeySet, setApiKeySet] = useState(false);
  const [apiKeyOverridden, setApiKeyOverridden] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [resendKeyOverridden, setResendKeyOverridden] = useState(false);
  const [resendKeyValue, setResendKeyValue] = useState("");
  const [tables, setTables] = useState<string[]>([]);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [keyMsg, setKeyMsg] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, j, t, m, ak, rk] = await Promise.all([
        adminApi.health(),
        adminApi.jobs(150),
        adminApi.tables(),
        adminApi.listModels(),
        adminApi.getApiKey(),
        adminApi.getResendKey(),
      ]);
      setHealth(h);
      setJobs(j.jobs);
      setJobStats(j.stats);
      setByType(j.byType);
      setModels(h.models);
      setTables(t.tables);
      setModelOptions(m.models);
      setApiKeySet(ak.set);
      setApiKeyOverridden(ak.overridden);
      setResendKeyOverridden(rk.overridden);
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadTable = useCallback(async (name: string) => {
    setActiveTable(name);
    setLoading(true);
    try {
      const d = await adminApi.table(name, 100, 0);
      setTableData(d);
    } catch (err: any) {
      setError(err?.message || "Failed to load table");
    } finally {
      setLoading(false);
    }
  }, []);

  const saveConfig = async () => {
    if (!models) return;
    setSaving(true);
    setError(null);
    try {
      await adminApi.saveConfig(models);
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const saveKey = async () => {
    setKeyMsg(null);
    setError(null);
    try {
      const res = await adminApi.saveApiKey(apiKeyValue);
      setKeyMsg(res.message);
      setApiKeyValue("");
      setApiKeyOverridden(res.overridden);
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to save key");
    }
  };

  const clearKey = async () => {
    setKeyMsg(null);
    try {
      const res = await adminApi.saveApiKey("");
      setKeyMsg(res.message);
      setApiKeyOverridden(false);
    } catch (err: any) {
      setError(err?.message || "Failed to clear key");
    }
  };

  const saveResendKey = async () => {
    setResendMsg(null);
    setError(null);
    try {
      const res = await adminApi.saveResendKey(resendKeyValue);
      setResendMsg(res.message);
      setResendKeyValue("");
      setResendKeyOverridden(res.overridden);
    } catch (err: any) {
      setError(err?.message || "Failed to save Resend key");
    }
  };

  const clearResendKey = async () => {
    setResendMsg(null);
    try {
      const res = await adminApi.saveResendKey("");
      setResendMsg(res.message);
      setResendKeyOverridden(false);
    } catch (err: any) {
      setError(err?.message || "Failed to clear Resend key");
    }
  };

  // Gemma models have no audio modality, so exclude them from the transcription
  // dropdown (they can't transcribe audio).
  const transcriptionOptions = useMemo(
    () => modelOptions.filter((m) => !/^gemma/i.test(m)),
    [modelOptions]
  );
  const visionOptions = modelOptions;

  const logout = () => {
    clearAdminKey();
    window.location.reload();
  };

  // Build a table from the job rows for the process monitor
  const jobColumnHelper = createColumnHelper<JobRow>();
  const jobColumns = useMemo<ColumnDef<JobRow>[]>(
    () => [
      jobColumnHelper.accessor("type", { header: "Type" }),
      jobColumnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const s = info.getValue();
          return (
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[s] || "#64748b" }} />
              {s}
            </span>
          );
        },
      }),
      jobColumnHelper.accessor("model", { header: "Model" }),
      jobColumnHelper.accessor("durationSeconds", {
        header: "Duration (s)",
        cell: (info) => info.getValue() ?? "—",
      }),
      jobColumnHelper.accessor("frames", {
        header: "Frames",
        cell: (info) => info.getValue() ?? "—",
      }),
      jobColumnHelper.accessor("error", {
        header: "Error",
        cell: (info) => (info.getValue() ? <span className="text-red-400 text-xs">{String(info.getValue()).slice(0, 60)}</span> : "—"),
      }),
      jobColumnHelper.accessor("createdAt", {
        header: "Created",
        cell: (info) => new Date(info.getValue() as string).toLocaleString(),
      }),
    ],
    [jobColumnHelper]
  );

  const jobTable = useReactTable({ data: jobs, columns: jobColumns, getCoreRowModel: getCoreRowModel() });

  const pieData = jobStats.map((s) => ({ name: s.status, value: s.n, color: STATUS_COLOR[s.status] || "#64748b" }));

  if (error && !health) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-[#0b0f19] p-4">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-300">{error}</p>
          <button onClick={refresh} className="mt-4 px-4 py-2 rounded-lg bg-white/10">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">NeoScriber <span className="text-[#FFE900]">Admin</span></h1>
            <p className="text-sm text-white/50">Database · Engine config · Process monitor</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} disabled={loading} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 flex items-center gap-2 text-sm disabled:opacity-60">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <button onClick={logout} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 flex items-center gap-2 text-sm">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>
        )}

        {/* Health stat cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Users" value={health?.counts.users ?? "—"} icon={<Database className="w-6 h-6 text-[#4ECDC4]" />} />
          <StatCard label="Total jobs" value={health?.counts.totalJobs ?? "—"} icon={<Activity className="w-6 h-6 text-[#FFE900]" />} />
          <StatCard label="Running" value={health?.counts.running ?? "—"} icon={<Loader2 className="w-6 h-6 text-yellow-400" />} tone="text-yellow-400" />
          <StatCard label="Errors" value={health?.counts.errors ?? "—"} icon={<AlertTriangle className="w-6 h-6 text-red-400" />} tone="text-red-400" />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Process status pie */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-[#FFE900]" /> Job status</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label>
                  {pieData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Jobs by type */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide mb-3 flex items-center gap-2"><Cpu className="w-4 h-4 text-[#4ECDC4]" /> Jobs by type</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byType}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                <XAxis dataKey="type" tick={{ fontSize: 11, fill: "#aaa" }} />
                <YAxis tick={{ fontSize: 11, fill: "#aaa" }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="n" fill="#FFE900" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Engine config + API key */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide mb-3 flex items-center gap-2"><Cpu className="w-4 h-4 text-[#FFE900]" /> Engine models</h2>
            {models && (
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs uppercase text-white/50">transcription</span>
                  <select
                    value={models.transcription}
                    onChange={(e) => setModels({ ...models, transcription: e.target.value })}
                    className="w-full mt-1 px-2 py-2 text-sm rounded-lg bg-white/5 border border-white/10 focus:border-[#FFE900] outline-none font-mono"
                  >
                    {transcriptionOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs uppercase text-white/50">videoAnalysis</span>
                  <select
                    value={models.videoAnalysis}
                    onChange={(e) => setModels({ ...models, videoAnalysis: e.target.value })}
                    className="w-full mt-1 px-2 py-2 text-sm rounded-lg bg-white/5 border border-white/10 focus:border-[#FFE900] outline-none font-mono"
                  >
                    {visionOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs uppercase text-white/50">chat</span>
                  <select
                    value={models.chat}
                    onChange={(e) => setModels({ ...models, chat: e.target.value })}
                    className="w-full mt-1 px-2 py-2 text-sm rounded-lg bg-white/5 border border-white/10 focus:border-[#FFE900] outline-none font-mono"
                  >
                    {visionOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <button onClick={saveConfig} disabled={saving} className="w-full py-2 rounded-lg bg-[#FFE900] text-black font-bold text-sm disabled:opacity-60">
                  {saving ? "Saving…" : "Save config"}
                </button>
                <p className="text-[11px] text-white/40">Free tier cap: {health?.freeTierSeconds ?? 120}s. Changes apply to new jobs immediately.</p>
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-white/10">
              <h3 className="text-sm font-bold uppercase tracking-wide mb-2 flex items-center gap-2"><KeyRound className="w-4 h-4 text-[#4ECDC4]" /> Gemini API key</h3>
              <p className="text-[11px] text-white/40 mb-2">
                Source: {apiKeyOverridden ? "admin override (stored)" : "Worker secret"}. The secret value is never shown.
              </p>
              <input
                type="password"
                value={apiKeyValue}
                onChange={(e) => setApiKeyValue(e.target.value)}
                placeholder="paste a new key to override"
                className="w-full px-2 py-2 text-sm rounded-lg bg-white/5 border border-white/10 focus:border-[#FFE900] outline-none font-mono"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={saveKey} disabled={!apiKeyValue} className="flex-1 py-2 rounded-lg bg-[#FFE900] text-black font-bold text-sm disabled:opacity-60">
                  Save key
                </button>
                {apiKeyOverridden && (
                  <button onClick={clearKey} className="px-3 py-2 rounded-lg bg-white/10 text-sm hover:bg-white/20">
                    Revert
                  </button>
                )}
              </div>
              {keyMsg && <p className="text-[11px] text-green-400 mt-2">{keyMsg}</p>}
            </div>

            <div className="mt-5 pt-4 border-t border-white/10">
              <h3 className="text-sm font-bold uppercase tracking-wide mb-2 flex items-center gap-2"><KeyRound className="w-4 h-4 text-[#4ECDC4]" /> Resend API key</h3>
              <p className="text-[11px] text-white/40 mb-2">
                Used to send email verification. Source: {resendKeyOverridden ? "admin override (stored)" : "Worker secret"}. Invalid key blocks verification emails.
              </p>
              <input
                type="password"
                value={resendKeyValue}
                onChange={(e) => setResendKeyValue(e.target.value)}
                placeholder="paste a valid Resend key"
                className="w-full px-2 py-2 text-sm rounded-lg bg-white/5 border border-white/10 focus:border-[#FFE900] outline-none font-mono"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={saveResendKey} disabled={!resendKeyValue} className="flex-1 py-2 rounded-lg bg-[#FFE900] text-black font-bold text-sm disabled:opacity-60">
                  Save key
                </button>
                {resendKeyOverridden && (
                  <button onClick={clearResendKey} className="px-3 py-2 rounded-lg bg-white/10 text-sm hover:bg-white/20">
                    Revert
                  </button>
                )}
              </div>
              {resendMsg && <p className="text-[11px] text-green-400 mt-2">{resendMsg}</p>}
            </div>
          </div>
        </div>

        {/* Process monitor table */}
        <section className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wide mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-[#4ECDC4]" /> Process monitor (engine jobs)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {jobTable.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="text-left text-white/50 border-b border-white/10">
                    {hg.headers.map((h) => (
                      <th key={h.id} className="px-3 py-2 font-medium">{flexRender(h.column.columnDef.header, h.getContext())}</th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {jobTable.getRowModel().rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-white/40">No jobs yet.</td></tr>
                ) : (
                  jobTable.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b border-white/5 hover:bg-white/5">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-2">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Database viewer */}
        <section className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide mb-3 flex items-center gap-2"><Database className="w-4 h-4 text-[#FFE900]" /> Database viewer</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {tables.map((t) => (
              <button
                key={t}
                onClick={() => loadTable(t)}
                className={`px-3 py-1.5 rounded-lg text-sm border ${
                  activeTable === t ? "bg-[#FFE900] text-black border-[#FFE900]" : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {tableData && (
            <div className="overflow-x-auto">
              <p className="text-xs text-white/40 mb-2">{tableData.total} rows total (showing {tableData.rows.length})</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-white/50 border-b border-white/10">
                    {tableData.rows[0] ? Object.keys(tableData.rows[0]).map((k) => (
                      <th key={k} className="px-2 py-2 font-medium whitespace-nowrap">{k}</th>
                    )) : null}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((r, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                      {Object.values(r).map((v, j) => (
                        <td key={j} className="px-2 py-1.5 max-w-[280px] truncate" title={String(v ?? "")}>
                          {v === null ? <span className="text-white/30">null</span> : String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-8 text-center text-xs text-white/30">
          {health?.generatedAt ? `Snapshot: ${new Date(health.generatedAt).toLocaleString()}` : ""} · Admin key stored locally in your browser only.
        </footer>
      </div>
    </div>
  );
};

const AdminApp: React.FC = () => {
  const [authed, setAuthed] = useState<boolean>(Boolean(getAdminKey()));
  return authed ? <AdminDashboard /> : <AdminLogin onAuthed={() => setAuthed(true)} />;
};

export default AdminApp;
