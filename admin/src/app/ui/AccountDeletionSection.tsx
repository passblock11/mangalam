"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useAdminRevision } from "./admin-live";
import { Badge, Button, Card, EmptyState, fmtDateTime } from "./shared";
import {
  deleteMemberAccount,
  fetchDeleteAccountCase,
  fetchDeleteAccountRequests,
  type DeleteRequestDetail,
  type DeleteRequestRow,
} from "../account-deletion-actions";

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_you: "Waiting on member",
  resolved: "Resolved",
  closed: "Closed",
};

function money(paise: number): string {
  return `₹${(paise / 100).toFixed(paise % 100 === 0 ? 0 : 2)}`;
}

function photoList(urls: string[]): string[] {
  return urls.filter((url) => url.startsWith("https://"));
}

export function AccountDeletionSection() {
  const [items, setItems] = useState<DeleteRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<DeleteRequestDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const rev = useAdminRevision("support");

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const res = await fetchDeleteAccountRequests();
    if (!res.ok) {
      if (!silent) setError(res.error);
    } else {
      setItems(res.data);
      if (!silent) setError(null);
    }
    if (!silent) setLoading(false);
  }

  async function openCase(ticketId: string, silent = false) {
    setSelected(ticketId);
    const res = await fetchDeleteAccountCase(ticketId);
    if (!res.ok) {
      if (!silent) setDetailError(res.error);
      return;
    }
    setDetail(res.data);
    setDetailError(null);
    if (!silent) {
      setConfirmOpen(false);
      setConfirmEmail("");
    }
  }

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (rev === 0) return;
    void load(true);
    if (selected) void openCase(selected, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev]);

  const openItems = items.filter((row) => row.status === "open" || row.status === "in_progress");
  const visible = openItems.length > 0 ? openItems : items;

  async function confirmDelete() {
    if (!detail) return;
    setDeleting(true);
    setDetailError(null);
    const res = await deleteMemberAccount({
      profileId: detail.ticket.profile_id,
      ticketId: detail.ticket.ticket_id,
      confirmEmail,
    });
    setDeleting(false);
    if (!res.ok) {
      setDetailError(res.error);
      return;
    }
    setConfirmOpen(false);
    setDetail(null);
    setSelected(null);
    await load(true);
  }

  const p = detail?.profile ?? {};
  const name = String(p.display_name ?? detail?.ticket.member_name ?? "Member");
  const email = detail?.email ?? detail?.ticket.member_email ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-[var(--ink)]">
          <Trash2 size={18} className="text-[var(--maroon)]" /> Account deletion
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Tickets where a member asked to delete their account. Review the full record, then delete with confirmation.
          Open memberships are cancelled at Cashfree or Razorpay before the account is removed.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="overflow-hidden">
          {loading && items.length === 0 ? (
            <p className="p-4 text-sm text-[var(--muted)]">Loading…</p>
          ) : visible.length === 0 ? (
            <div className="p-6">
              <EmptyState>No account deletion requests.</EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {visible.map((item) => (
                <li key={item.ticket_id}>
                  <button
                    type="button"
                    onClick={() => void openCase(item.ticket_id)}
                    className={`w-full px-4 py-3 text-left ${
                      selected === item.ticket_id ? "bg-rose-50" : "hover:bg-zinc-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-[var(--ink)]">
                        #{item.ticket_number} {item.member_name ?? "Member"}
                      </p>
                      <Badge tone={item.status === "open" || item.status === "in_progress" ? "amber" : "neutral"}>
                        {STATUS_LABEL[item.status] ?? item.status}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--muted)]">{item.subject}</p>
                    <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                      {item.member_email ?? "No email"} · {fmtDateTime(item.updated_at)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          {!detail ? (
            <p className="text-sm text-[var(--muted)]">Choose a deletion request to review the full account.</p>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[var(--ink)]">{name}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {email || "No email"}
                    {detail.ticket.member_phone ? ` · ${detail.ticket.member_phone}` : ""}
                  </p>
                  <p className="mt-1 font-mono text-xs text-[var(--muted)]">{detail.ticket.profile_id}</p>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Ticket #{detail.ticket.ticket_number} · {detail.ticket.subject}
                  </p>
                </div>
                <Button
                  variant="danger"
                  onClick={() => {
                    setConfirmEmail("");
                    setConfirmOpen(true);
                  }}
                >
                  <Trash2 size={16} /> Delete account
                </Button>
              </div>

              {detailError ? <p className="text-sm text-red-700">{detailError}</p> : null}

              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Profile</h4>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  {(
                    [
                      ["Gender", p.gender],
                      ["Date of birth", p.date_of_birth],
                      ["City", [p.city, p.state].filter(Boolean).join(", ")],
                      ["Community", p.community],
                      ["Phone", p.phone],
                      ["WhatsApp", p.whatsapp_number],
                      ["Verified", p.is_verified === true ? "Yes" : "No"],
                      ["Verification", p.verification_status],
                      [
                        "Created",
                        detail.ticket.created_at
                          ? fmtDateTime(String(p.created_at ?? detail.ticket.created_at))
                          : "—",
                      ],
                    ] as Array<[string, unknown]>
                  ).map(([label, value]) => (
                    <p key={label}>
                      <span className="text-[var(--muted)]">{label}: </span>
                      <span className="font-medium text-[var(--ink)]">{String(value ?? "—")}</span>
                    </p>
                  ))}
                </div>
                {typeof p.bio === "string" && p.bio.trim() ? (
                  <p className="rounded-xl bg-zinc-50 px-3 py-2 text-sm text-[var(--ink)]">{p.bio}</p>
                ) : null}
              </section>

              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Photos & documents</h4>
                <div className="flex flex-wrap gap-2">
                  {photoList(detail.photo_urls).map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt="" className="h-24 w-24 rounded-lg object-cover ring-1 ring-black/10" />
                    </a>
                  ))}
                  {detail.selfie_url ? (
                    <a href={detail.selfie_url} target="_blank" rel="noreferrer">
                      <img
                        src={detail.selfie_url}
                        alt="Selfie"
                        className="h-24 w-24 rounded-lg object-cover ring-1 ring-black/10"
                      />
                    </a>
                  ) : null}
                  {detail.govt_id_url ? (
                    <a href={detail.govt_id_url} target="_blank" rel="noreferrer">
                      <img
                        src={detail.govt_id_url}
                        alt="ID"
                        className="h-24 w-24 rounded-lg object-cover ring-1 ring-black/10"
                      />
                    </a>
                  ) : null}
                  {photoList(detail.photo_urls).length === 0 && !detail.selfie_url && !detail.govt_id_url ? (
                    <p className="text-sm text-[var(--muted)]">No photos on file.</p>
                  ) : null}
                </div>
              </section>

              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Wallet</h4>
                <p className="text-sm text-[var(--ink)]">
                  Credits: <span className="font-semibold">{detail.wallet?.contact_credits ?? 0}</span>
                  {" · "}
                  Premium until:{" "}
                  <span className="font-semibold">
                    {detail.wallet?.premium_until ? fmtDateTime(detail.wallet.premium_until) : "None"}
                  </span>
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Memberships ({detail.subscriptions.length})
                </h4>
                {detail.subscriptions.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No membership records.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.subscriptions.map((sub) => (
                      <li key={sub.id} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                        <p className="font-semibold text-[var(--ink)]">
                          {sub.plan_code} · {sub.status}
                        </p>
                        <p className="font-mono text-xs text-[var(--muted)]">{sub.razorpay_subscription_id}</p>
                        <p className="text-xs text-[var(--muted)]">
                          Started {fmtDateTime(sub.created_at)}
                          {sub.current_period_end ? ` · period ends ${fmtDateTime(sub.current_period_end)}` : ""}
                          {sub.cancel_at_period_end ? " · cancel at period end" : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Payments ({detail.payments.length})
                </h4>
                {detail.payments.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No credit purchases.</p>
                ) : (
                  <ul className="max-h-56 space-y-2 overflow-y-auto">
                    {detail.payments.map((pay) => (
                      <li key={pay.razorpay_payment_id} className="rounded-xl bg-zinc-50 px-3 py-2 text-sm">
                        <p className="font-semibold text-[var(--ink)]">
                          {money(pay.amount_paise)} · {pay.credits} credits
                        </p>
                        <p className="font-mono text-xs text-[var(--muted)]">{pay.razorpay_payment_id}</p>
                        <p className="text-xs text-[var(--muted)]">{fmtDateTime(pay.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Ticket thread</h4>
                <div className="space-y-3">
                  {detail.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-xl px-3 py-2 text-sm ${
                        message.author_role === "admin" ? "bg-rose-50" : "bg-zinc-50"
                      }`}
                    >
                      <p className="text-xs font-semibold text-[var(--muted)]">
                        {message.author_role === "admin" ? "Team" : "Member"} · {fmtDateTime(message.created_at)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-[var(--ink)]">{message.body}</p>
                      {photoList(message.attachment_urls).length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {photoList(message.attachment_urls).map((url) => (
                            <a key={url} href={url} target="_blank" rel="noreferrer">
                              <img
                                src={url}
                                alt=""
                                className="h-20 w-20 rounded-lg object-cover ring-1 ring-black/10"
                              />
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </Card>
      </div>

      {confirmOpen && detail ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-[var(--ink)]">Delete this account?</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              This signs them out of the app immediately (same as a ban), cancels every open membership, deletes their
              profile, photos, and related data, and notifies them. They can sign in with the same Google account later
              to create a new Mangalam account. This cannot be undone.
            </p>
            <dl className="mt-4 space-y-2 rounded-xl bg-[#fff8f3] px-4 py-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Name</dt>
                <dd className="font-semibold text-[var(--ink)]">{name}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Email</dt>
                <dd className="font-semibold text-[var(--ink)]">{email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Account ID</dt>
                <dd className="break-all font-mono text-xs text-[var(--ink)]">{detail.ticket.profile_id}</dd>
              </div>
            </dl>
            <label className="mt-4 block text-sm">
              <span className="font-semibold text-[var(--ink)]">Type the email to confirm</span>
              <input
                className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-2"
                value={confirmEmail}
                onChange={(event) => setConfirmEmail(event.target.value)}
                placeholder={email || "member@email.com"}
                autoComplete="off"
              />
            </label>
            {detailError ? <p className="mt-3 text-sm text-red-700">{detailError}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmOpen(false);
                  setDetailError(null);
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={
                  deleting ||
                  !email ||
                  confirmEmail.trim().toLowerCase() !== email.trim().toLowerCase()
                }
                onClick={() => void confirmDelete()}
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
