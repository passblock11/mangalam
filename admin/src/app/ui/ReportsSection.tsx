"use client";

import { useEffect, useState } from "react";
import { Eye, Ban, RefreshCw, ShieldCheck, ShieldX, X, ZoomIn, Flag } from "lucide-react";
import {
  fetchReportsWithContext,
  setReportStatus,
  banUser,
  updateReport,
} from "../actions";
import { Avatar, Badge, Button, Card, EmptyState, fmtDateTime, timeAgo, Modal } from "./shared";
import { UserDetailDrawer } from "./UserDetailDrawer";

type Report = {
  id: string;
  reporter_id: string;
  reported_profile_id: string;
  title: string | null;
  description: string | null;
  category: string;
  screenshot_urls: string[];
  reason: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  admin_notes: string | null;
  resolution: string | null;
  reported_name: string | null;
  reported_phone: string | null;
  reported_photo: string | null;
  reported_banned: boolean;
  reported_verified: boolean;
  reporter_name: string | null;
  reporter_phone: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  scam_fraud: "Scam / Fraud",
  harassment: "Harassment",
  fake_profile: "Fake profile",
  inappropriate: "Inappropriate content",
  illegal: "Illegal / Harmful",
  other: "Other",
};

export function ReportsSection() {
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "reviewing" | "closed" | "actioned">("open");
  const [selected, setSelected] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [detail, setDetail] = useState<Report | null>(null);
  const [banFor, setBanFor] = useState<Report | null>(null);
  const [banReason, setBanReason] = useState("");
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

  async function setStatus(id: string, status: "open" | "reviewing" | "closed" | "actioned") {
    setBusy(id);
    const out = await setReportStatus(id, status);
    setBusy(null);
    if (!out.ok) setError(out.error);
    else await load();
  }

  async function doBan(report: Report, reason: string) {
    setBusy(report.id);
    const trimmed = reason.trim();
    const out = await banUser(report.reported_profile_id, true, trimmed || undefined);
    setBusy(null);
    if (!out.ok) {
      setError(out.error);
      return;
    }
    await updateReport(report.id, {
      status: "actioned",
      resolution: `Banned${trimmed ? ": " + trimmed : ""}`,
    });
    setBanFor(null);
    setBanReason("");
    await load();
  }

  async function unban(report: Report) {
    if (!confirm("Unban this user? They will be able to log in again.")) return;
    setBusy(report.id);
    const out = await banUser(report.reported_profile_id, false);
    setBusy(null);
    if (!out.ok) setError(out.error);
    else await load();
  }

  const filtered = items.filter((r) => filter === "all" || r.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">Reports</h2>
          <p className="text-sm text-[var(--muted)]">
            Member-submitted complaints. Investigate evidence and take action.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap rounded-lg border border-[var(--border)] bg-white p-0.5">
            {(["open", "reviewing", "actioned", "closed", "all"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                  filter === f ? "bg-[var(--maroon)] text-white" : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState>No {filter === "all" ? "" : filter} reports.</EmptyState>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-start gap-4">
                <Avatar name={r.reported_name} photoUrl={r.reported_photo} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-[var(--ink)]">
                      {r.reported_name ?? "Unnamed"}
                    </p>
                    <Badge tone={r.reported_banned ? "red" : r.reported_verified ? "green" : "neutral"}>
                      {r.reported_banned ? "Banned" : r.reported_verified ? "Verified" : "Unverified"}
                    </Badge>
                    <Badge
                      tone={
                        r.status === "open" ? "red" : r.status === "reviewing" ? "amber" : r.status === "actioned" ? "green" : "neutral"
                      }
                    >
                      {r.status}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-[var(--muted)]">{r.reported_phone ?? "no phone"}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Reported by {r.reporter_name ?? "a member"} · {timeAgo(r.created_at)}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-lg bg-rose-50/60 p-3">
                <div className="flex items-center gap-2">
                  <Flag size={13} className="text-[var(--maroon)]" />
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--maroon)]">
                    {CATEGORY_LABELS[r.category] ?? r.category}
                  </span>
                </div>
                {r.title && <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{r.title}</p>}
                <p className="mt-1 text-sm text-[var(--ink)] whitespace-pre-wrap">
                  {r.description ?? r.reason}
                </p>
              </div>

              {r.screenshot_urls && r.screenshot_urls.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.screenshot_urls.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightbox(url)}
                      className="relative h-20 w-20 overflow-hidden rounded-lg border border-[var(--border)]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Evidence ${i + 1}`} className="h-full w-full object-cover" />
                      <span className="absolute bottom-0 right-0 rounded-tl bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                        <ZoomIn size={11} className="inline" />
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {r.resolution && (
                <div className="mt-2 text-xs text-[var(--muted)]">
                  <span className="font-semibold">Resolution:</span> {r.resolution}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                <Button variant="secondary" size="sm" onClick={() => setDetail(r)}>
                  <Eye size={14} /> Full details
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setSelected(r.reported_profile_id)}>
                  <Eye size={14} /> View profile
                </Button>
                {r.status !== "closed" && r.status !== "actioned" && (
                  <>
                    {r.status !== "reviewing" && (
                      <Button variant="ghost" size="sm" disabled={busy === r.id} onClick={() => void setStatus(r.id, "reviewing")}>
                        Mark reviewing
                      </Button>
                    )}
                    {!r.reported_banned ? (
                      <Button variant="danger" size="sm" disabled={busy === r.id} onClick={() => { setBanReason(""); setBanFor(r); }}>
                        <Ban size={14} /> Ban user
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" disabled={busy === r.id} onClick={() => void unban(r)}>
                        <ShieldX size={14} /> Unban
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" disabled={busy === r.id} onClick={() => void setStatus(r.id, "closed")}>
                      Dismiss
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setLightbox(null)}>
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Evidence" className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl" />
        </div>
      )}

      {/* Full detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Complaint details">
        {detail && (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto">
            <Field label="Category">{CATEGORY_LABELS[detail.category] ?? detail.category}</Field>
            <Field label="Title">{detail.title ?? "—"}</Field>
            <Field label="Description">
              <span className="whitespace-pre-wrap">{detail.description ?? detail.reason}</span>
            </Field>
            <Field label="Reported user">
              <div>
                <p className="font-semibold text-[var(--ink)]">{detail.reported_name ?? "Unnamed"}</p>
                <p className="text-xs text-[var(--muted)]">{detail.reported_phone ?? "no phone"}</p>
                <p className="text-xs text-[var(--muted)]">
                  Status: {detail.reported_banned ? "Banned" : detail.reported_verified ? "Verified" : "Active"}
                </p>
              </div>
            </Field>
            <Field label="Reporter">
              <div>
                <p className="font-semibold text-[var(--ink)]">{detail.reporter_name ?? "Unnamed"}</p>
                <p className="text-xs text-[var(--muted)]">{detail.reporter_phone ?? "no phone"}</p>
              </div>
            </Field>
            <Field label="Submitted">{fmtDateTime(detail.created_at)}</Field>
            {detail.screenshot_urls && detail.screenshot_urls.length > 0 && (
              <Field label="Evidence">
                <div className="flex flex-wrap gap-2">
                  {detail.screenshot_urls.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightbox(url)}
                      className="h-24 w-24 overflow-hidden rounded-lg border border-[var(--border)]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Evidence ${i + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </Field>
            )}
            {detail.resolution && <Field label="Resolution">{detail.resolution}</Field>}
            {detail.admin_notes && <Field label="Admin notes">{detail.admin_notes}</Field>}
          </div>
        )}
      </Modal>

      {/* Ban modal */}
      <Modal open={!!banFor} onClose={() => setBanFor(null)} title="Ban user">
        {banFor && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted)]">
              Banning <span className="font-semibold text-[var(--ink)]">{banFor.reported_name ?? "this user"}</span> will
              sign them out immediately and prevent login until you revert the ban.
            </p>
            <textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Ban reason (shown to the user). e.g. Fake profile — submitted fraudulent photos."
              rows={3}
              maxLength={500}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--maroon)]"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setBanFor(null)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" disabled={busy === banFor.id} onClick={() => void doBan(banFor, banReason)}>
                <Ban size={14} /> Ban & close report
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <UserDetailDrawer profileId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <div className="mt-1 text-sm text-[var(--ink)]">{children}</div>
    </div>
  );
}
