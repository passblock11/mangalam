"use client";

import { useCallback, useEffect, useState } from "react";

import {
  fetchProfiles,
  fetchReports,
  setContactCredits,
  setReportStatus,
  setProfileVerified,
  fetchPendingVerifications,
  reviewVerification,
} from "../actions";

export function AdminDashboard() {
  const [tab, setTab] = useState<"reports" | "users" | "verifications">("reports");
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
  const [verifications, setVerifications] = useState<
    {
      id: string;
      display_name: string | null;
      phone: string | null;
      whatsapp_number: string | null;
      selfie_url: string | null;
      govt_id_url: string | null;
      verification_status: string;
      verification_submitted_at: string | null;
      verification_note: string | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    const res = await fetchReports();
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setError(null);
    setReports(res.data);
    return true;
  }, []);

  const loadProfiles = useCallback(async () => {
    const res = await fetchProfiles(search);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setError(null);
    setProfiles(res.data);
    return true;
  }, [search]);

  const loadVerifications = useCallback(async () => {
    const res = await fetchPendingVerifications();
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setError(null);
    setVerifications(res.data);
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      const rep = await fetchReports();
      if (cancelled) return;
      if (!rep.ok) {
        setError(rep.error);
        setLoading(false);
        return;
      }
      setReports(rep.data);
      const prof = await fetchProfiles("");
      if (cancelled) return;
      if (!prof.ok) {
        setError(prof.error);
        setLoading(false);
        return;
      }
      setProfiles(prof.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
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
            <button
              type="button"
              className={`border-b-2 px-3 py-2 text-sm font-medium ${
                tab === "verifications"
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-500"
              }`}
              onClick={() => {
                setTab("verifications");
                void loadVerifications();
              }}
            >
              Verifications
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
                                void (async () => {
                                  const out = await setReportStatus(r.id, "closed");
                                  if (!out.ok) {
                                    setError(out.error);
                                    return;
                                  }
                                  await loadReports();
                                })()
                              }
                            >
                              Close
                            </button>
                            <button
                              type="button"
                              className="text-xs font-medium text-emerald-700 underline"
                              onClick={() =>
                                void (async () => {
                                  const out = await setProfileVerified(r.reported_profile_id, true);
                                  if (!out.ok) {
                                    setError(out.error);
                                    return;
                                  }
                                  await loadReports();
                                })()
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
                                void (async () => {
                                  const out = await setProfileVerified(p.id, !p.is_verified);
                                  if (!out.ok) {
                                    setError(out.error);
                                    return;
                                  }
                                  await loadProfiles();
                                })()
                              }
                            >
                              Toggle verify
                            </button>
                            <CreditsForm
                              profileId={p.id}
                              onApply={async (n) => {
                                const out = await setContactCredits(p.id, n);
                                if (!out.ok) {
                                  setError(out.error);
                                  return;
                                }
                                await loadProfiles();
                              }}
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

          {tab === "verifications" && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-medium">Verification queue</h2>
                <button
                  type="button"
                  className="text-sm text-zinc-600 underline"
                  onClick={() => void loadVerifications()}
                >
                  Refresh
                </button>
              </div>
              {verifications.length === 0 ? (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
                  No verification submissions yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {verifications.map((v) => (
                    <div
                      key={v.id}
                      className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
                    >
                      <div className="flex flex-wrap items-start gap-4 border-b border-zinc-100 p-4">
                        <div className="flex-1 min-w-[200px]">
                          <p className="font-medium text-zinc-900">
                            {v.display_name ?? "—"}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            ID: <span className="font-mono">{v.id}</span>
                          </p>
                          <p className="text-xs text-zinc-600">
                            Phone: {v.phone ?? "—"}
                          </p>
                          <p className="text-xs text-zinc-600">
                            WhatsApp: {v.whatsapp_number ?? "—"}
                          </p>
                          <p className="text-xs text-zinc-600">
                            Submitted:{" "}
                            {v.verification_submitted_at
                              ? new Date(v.verification_submitted_at).toLocaleString()
                              : "—"}
                          </p>
                          <p className="mt-1">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                v.verification_status === "pending"
                                  ? "bg-amber-100 text-amber-800"
                                  : v.verification_status === "approved"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {v.verification_status}
                            </span>
                          </p>
                          {v.verification_note && (
                            <p className="mt-1 text-xs text-zinc-500">
                              Note: {v.verification_note}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-3">
                          <div>
                            <p className="mb-1 text-xs font-medium text-zinc-600">
                              Selfie
                            </p>
                            {v.selfie_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={v.selfie_url}
                                alt="selfie"
                                className="h-32 w-32 rounded-lg border border-zinc-200 object-cover"
                              />
                            ) : (
                              <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-xs text-zinc-400">
                                No selfie
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-medium text-zinc-600">
                              Govt ID
                            </p>
                            {v.govt_id_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={v.govt_id_url}
                                alt="govt id"
                                className="h-32 w-32 rounded-lg border border-zinc-200 object-cover"
                              />
                            ) : (
                              <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-xs text-zinc-400">
                                No ID
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 bg-zinc-50 px-4 py-3">
                        <button
                          type="button"
                          className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white"
                          onClick={() =>
                            void (async () => {
                              const out = await reviewVerification(v.id, true);
                              if (!out.ok) {
                                setError(out.error);
                                return;
                              }
                              await loadVerifications();
                            })()
                          }
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white"
                          onClick={() =>
                            void (async () => {
                              const note = window.prompt("Reason for rejection (optional):") ?? undefined;
                              const out = await reviewVerification(v.id, false, note);
                              if (!out.ok) {
                                setError(out.error);
                                return;
                              }
                              await loadVerifications();
                            })()
                          }
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
