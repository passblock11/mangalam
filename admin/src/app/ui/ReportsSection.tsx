"use client";

import { useEffect, useState } from "react";
import { Eye, BadgeCheck, Ban, RefreshCw } from "lucide-react";
import {
  fetchReportsWithContext,
  setReportStatus,
  setProfileVerified,
  banUser,
} from "../actions";
import { Avatar, Badge, Button, Card, EmptyState, fmtDateTime, timeAgo } from "./shared";
import { UserDetailDrawer } from "./UserDetailDrawer";

type Report = {
  id: string;
  reporter_id: string;
  reported_profile_id: string;
  reason: string;
  status: string;
  created_at: string;
  reported_name: string | null;
  reported_phone: string | null;
  reporter_name: string | null;
};

export function ReportsSection() {
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetchReportsWithContext();
    if (!res.ok) setError(res.error);
    else setItems(res.data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function setStatus(id: string, status: "open" | "reviewing" | "closed") {
    setBusy(id);
    const out = await setReportStatus(id, status);
    setBusy(null);
    if (!out.ok) setError(out.error);
    else await load();
  }

  async function verify(report: Report) {
    setBusy(report.id);
    const out = await setProfileVerified(report.reported_profile_id, true);
    setBusy(null);
    if (!out.ok) setError(out.error);
    else await setStatus(report.id, "closed");
  }

  async function ban(report: Report) {
    if (!confirm("Ban this reported user? They will be signed out and unable to log in.")) return;
    setBusy(report.id);
    const out = await banUser(report.reported_profile_id, true);
    setBusy(null);
    if (!out.ok) setError(out.error);
    else await setStatus(report.id, "closed");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">Reports</h2>
          <p className="text-sm text-[var(--muted)]">
            Member-submitted reports. Investigate and take action.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState>No reports.</EmptyState>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex min-w-[220px] flex-1 items-start gap-3">
                  <Avatar name={r.reported_name} size={44} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-[var(--ink)]">
                        {r.reported_name ?? "Unnamed"}
                      </p>
                      <Badge
                        tone={
                          r.status === "open" ? "red" : r.status === "reviewing" ? "amber" : "neutral"
                        }
                      >
                        {r.status}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {r.reported_phone ?? "no phone"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Reported by {r.reporter_name ?? "a member"} · {timeAgo(r.created_at)}
                    </p>
                  </div>
                </div>
                <div className="min-w-[200px] flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Reason
                  </p>
                  <p className="mt-1 text-sm text-[var(--ink)]">{r.reason}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{fmtDateTime(r.created_at)}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                <Button variant="secondary" size="sm" onClick={() => setSelected(r.reported_profile_id)}>
                  <Eye size={14} /> View profile
                </Button>
                {r.status !== "closed" && (
                  <>
                    {r.status !== "reviewing" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy === r.id}
                        onClick={() => void setStatus(r.id, "reviewing")}
                      >
                        Mark reviewing
                      </Button>
                    )}
                    <Button
                      variant="success"
                      size="sm"
                      disabled={busy === r.id}
                      onClick={() => void verify(r)}
                    >
                      <BadgeCheck size={14} /> Verify & close
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busy === r.id}
                      onClick={() => void ban(r)}
                    >
                      <Ban size={14} /> Ban & close
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy === r.id}
                      onClick={() => void setStatus(r.id, "closed")}
                    >
                      Close
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <UserDetailDrawer profileId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
