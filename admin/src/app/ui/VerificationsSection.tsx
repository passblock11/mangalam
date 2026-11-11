"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Clock, Check, X, ZoomIn, RefreshCw } from "lucide-react";
import { fetchPendingVerifications, reviewVerification } from "../actions";
import { Avatar, Badge, Button, Card, EmptyState, fmtDateTime, Modal } from "./shared";

type Verification = {
  id: string;
  display_name: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  selfie_url: string | null;
  govt_id_url: string | null;
  verification_status: string;
  verification_submitted_at: string | null;
  verification_note: string | null;
};

export function VerificationsSection() {
  const [items, setItems] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetchPendingVerifications();
    if (!res.ok) setError(res.error);
    else setItems(res.data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function approve(id: string) {
    setBusy(id);
    const out = await reviewVerification(id, true);
    setBusy(null);
    if (!out.ok) {
      setError(out.error);
      return;
    }
    await load();
  }

  async function reject(id: string, note?: string) {
    setBusy(id);
    const out = await reviewVerification(id, false, note);
    setBusy(null);
    if (!out.ok) {
      setError(out.error);
      return;
    }
    setRejectFor(null);
    setRejectNote("");
    await load();
  }

  const filtered = items.filter((v) => filter === "all" || v.verification_status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">
            Verification queue
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Review selfies & government IDs. Approving marks the member as verified.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[var(--border)] bg-white p-0.5">
            {(["pending", "approved", "rejected", "all"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                  filter === f
                    ? "bg-[var(--maroon)] text-white"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
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
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState>No {filter === "all" ? "" : filter} verifications.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => (
            <Card key={v.id} className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-[var(--border)] p-4">
                <Avatar name={v.display_name} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[var(--ink)]">
                    {v.display_name ?? "Unnamed"}
                  </p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {v.phone ?? "no phone"}
                  </p>
                </div>
                <Badge
                  tone={
                    v.verification_status === "approved"
                      ? "green"
                      : v.verification_status === "pending"
                        ? "amber"
                        : "red"
                  }
                >
                  {v.verification_status === "approved" && <Check size={11} />}
                  {v.verification_status === "pending" && <Clock size={11} />}
                  {v.verification_status === "rejected" && <X size={11} />}
                  {v.verification_status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4">
                <DocTile
                  label="Selfie"
                  url={v.selfie_url}
                  onOpen={() => v.selfie_url && setLightbox({ url: v.selfie_url, alt: "Selfie" })}
                />
                <DocTile
                  label="Govt ID"
                  url={v.govt_id_url}
                  onOpen={() => v.govt_id_url && setLightbox({ url: v.govt_id_url, alt: "Government ID" })}
                />
              </div>

              <div className="px-4 pb-3 text-xs text-[var(--muted)]">
                Submitted {fmtDateTime(v.verification_submitted_at)}
                {v.whatsapp_number && <> · WhatsApp {v.whatsapp_number}</>}
              </div>

              {v.verification_note && (
                <div className="mx-4 mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Note: {v.verification_note}
                </div>
              )}

              {v.verification_status === "pending" && (
                <div className="flex gap-2 border-t border-[var(--border)] bg-zinc-50/60 p-3">
                  <Button
                    variant="success"
                    size="sm"
                    className="flex-1"
                    disabled={busy === v.id}
                    onClick={() => void approve(v.id)}
                  >
                    <ShieldCheck size={14} /> Approve
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="flex-1"
                    disabled={busy === v.id}
                    onClick={() => setRejectFor(v.id)}
                  >
                    <ShieldAlert size={14} /> Reject
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={lightbox.alt}
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}

      {/* Reject modal */}
      <Modal
        open={!!rejectFor}
        onClose={() => setRejectFor(null)}
        title="Reject verification"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            The member will see this note and can re-submit with corrected documents.
          </p>
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="e.g. ID photo is blurry. Please re-upload a clear photo."
            rows={4}
            className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--maroon)]"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRejectFor(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={busy === rejectFor}
              onClick={() => rejectFor && void reject(rejectFor, rejectNote.trim() || undefined)}
            >
              Reject
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function DocTile({
  label,
  url,
  onOpen,
}: {
  label: string;
  url: string | null;
  onOpen: () => void;
}) {
  if (!url) {
    return (
      <div>
        <p className="mb-1 text-xs font-semibold text-[var(--muted)]">{label}</p>
        <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-zinc-50 text-xs text-[var(--muted)]">
          No {label.toLowerCase()}
        </div>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-[var(--muted)]">{label}</p>
      <button
        type="button"
        onClick={onOpen}
        className="group relative block aspect-square w-full overflow-hidden rounded-xl border border-[var(--border)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className="h-full w-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
          <ZoomIn size={22} className="text-white" />
        </div>
      </button>
    </div>
  );
}
