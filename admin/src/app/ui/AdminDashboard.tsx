"use client";

import { useCallback, useState } from "react";

import {
  fetchProfiles,
  fetchReports,
  setContactCredits,
  setReportStatus,
  setProfileVerified,
} from "../actions";

export function AdminDashboard() {
  const [secret, setSecret] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"reports" | "users">("reports");
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState<
    {
      id: string;
      reporter_id: string;
      reported_profile_id: string;
      reason: string;
      status: string;
      created_at: string;
    }[]
  >([]);
  const [profiles, setProfiles] = useState<
    {
      id: string;
      display_name: string | null;
      phone: string | null;
      city: string | null;
      state: string | null;
      is_verified: boolean;
      created_at: string;
    }[]
  >([]);

  const loadReports = useCallback(async () => {
    const rows = await fetchReports(secret);
    setReports(rows as typeof reports);
  }, [secret]);

  const loadProfiles = useCallback(async () => {
    const rows = await fetchProfiles(secret, search);
    setProfiles(rows as typeof profiles);
  }, [secret, search]);

  const unlock = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadReports();
      await fetchProfiles(secret, "").then((rows) =>
        setProfiles(rows as typeof profiles)
      );
      setUnlocked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setUnlocked(false);
    } finally {
      setLoading(false);
    }
  }, [secret, loadReports]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-medium">Access</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Set{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">
            ADMIN_DASHBOARD_SECRET
          </code>{" "}
          on Vercel, then enter the same value here. Replace with Supabase Auth
          for production.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium text-zinc-700">Secret</span>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-900"
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            onClick={() => void unlock()}
            disabled={loading || !secret}
            className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Loading…" : "Unlock"}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </section>

      {unlocked && (
        <>
          <div className="flex gap-2 border-b border-zinc-200">
            <button
              type="button"
              className={`border-b-2 px-3 py-2 text-sm font-medium ${
                tab === "reports"
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-500"
              }`}
              onClick={() => setTab("reports")}
            >
              Reports
            </button>
            <button
              type="button"
              className={`border-b-2 px-3 py-2 text-sm font-medium ${
                tab === "users"
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-500"
              }`}
              onClick={() => {
                setTab("users");
                void loadProfiles();
              }}
            >
              Users
            </button>
          </div>

          {tab === "reports" && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-medium">Reports</h2>
                <button
                  type="button"
                  className="text-sm text-zinc-600 underline"
                  onClick={() => void loadReports()}
                >
                  Refresh
                </button>
              </div>
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 font-medium">Created</th>
                      <th className="px-4 py-3 font-medium">Reported profile</th>
                      <th className="px-4 py-3 font-medium">Reason</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                          No reports yet.
                        </td>
                      </tr>
                    ) : (
                      reports.map((r) => (
                        <tr key={r.id} className="border-b border-zinc-100">
                          <td className="px-4 py-3 text-zinc-600">
                            {new Date(r.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {r.reported_profile_id}
                          </td>
                          <td className="max-w-xs truncate px-4 py-3">{r.reason}</td>
                          <td className="px-4 py-3">{r.status}</td>
                          <td className="space-x-2 px-4 py-3">
                            <button
                              type="button"
                              className="text-xs font-medium text-zinc-900 underline"
                              onClick={() =>
                                setReportStatus(secret, r.id, "closed").then(() =>
                                  loadReports()
                                )
                              }
                            >
                              Close
                            </button>
                            <button
                              type="button"
                              className="text-xs font-medium text-emerald-700 underline"
                              onClick={() =>
                                setProfileVerified(secret, r.reported_profile_id, true).then(
                                  () => loadReports()
                                )
                              }
                            >
                              Verify profile
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === "users" && (
            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1 text-sm">
                  <span className="mb-1 block font-medium text-zinc-700">Search</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name, phone, city"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-900"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void loadProfiles()}
                  className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white"
                >
                  Search
                </button>
              </div>
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Phone</th>
                      <th className="px-4 py-3 font-medium">Location</th>
                      <th className="px-4 py-3 font-medium">Verified</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                          No profiles.
                        </td>
                      </tr>
                    ) : (
                      profiles.map((p) => (
                        <tr key={p.id} className="border-b border-zinc-100">
                          <td className="px-4 py-3">{p.display_name ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{p.phone ?? "—"}</td>
                          <td className="px-4 py-3">
                            {p.city ?? ""}
                            {p.city && p.state ? ", " : ""}
                            {p.state ?? ""}
                          </td>
                          <td className="px-4 py-3">{p.is_verified ? "Yes" : "No"}</td>
                          <td className="space-x-2 px-4 py-3">
                            <button
                              type="button"
                              className="text-xs font-medium text-emerald-700 underline"
                              onClick={() =>
                                setProfileVerified(secret, p.id, !p.is_verified).then(() =>
                                  loadProfiles()
                                )
                              }
                            >
                              Toggle verify
                            </button>
                            <CreditsForm
                              profileId={p.id}
                              onApply={(n) =>
                                setContactCredits(secret, p.id, n).then(() => loadProfiles())
                              }
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-zinc-500">
                Sets wallet contact credits (creates wallet row if missing).
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function CreditsForm({
  profileId,
  onApply,
}: {
  profileId: string;
  onApply: (n: number) => Promise<void>;
}) {
  const [value, setValue] = useState("5");
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-14 rounded border border-zinc-300 px-1 py-0.5 text-xs"
        aria-label={`Credits for ${profileId}`}
      />
      <button
        type="button"
        className="text-xs font-medium text-zinc-900 underline"
        onClick={() => void onApply(Number(value))}
      >
        Set credits
      </button>
    </span>
  );
}
