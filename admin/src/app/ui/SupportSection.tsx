"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { useAdminRevision } from "./admin-live";
import { Badge, Button, Card, EmptyState, fmtDateTime } from "./shared";
import {
  fetchSupportTicket,
  fetchSupportTickets,
  updateSupportTicket,
  type SupportTicketDetail,
  type SupportTicketRow,
} from "../support-actions";

const FILTERS = [
  { id: "needs", label: "Needs reply" },
  { id: "waiting_on_you", label: "Waiting on member" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_you: "Waiting on member",
  resolved: "Resolved",
  closed: "Closed",
};

const CATEGORY_LABEL: Record<string, string> = {
  account: "Account",
  verification: "Verification",
  payment: "Payment",
  technical: "App problem",
  other: "Other",
};

type FilterId = (typeof FILTERS)[number]["id"];

function photoUrls(value: string[] | null | undefined): string[] {
  return (value ?? []).filter((url) => typeof url === "string" && url.startsWith("https://"));
}

function tone(status: string): "amber" | "blue" | "green" | "neutral" {
  if (status === "open") return "amber";
  if (status === "in_progress") return "blue";
  if (status === "resolved") return "green";
  return "neutral";
}

export function SupportSection() {
  const [items, setItems] = useState<SupportTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("needs");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("in_progress");
  const [saving, setSaving] = useState(false);
  const rev = useAdminRevision("support");

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const res = await fetchSupportTickets();
    if (!res.ok) {
      if (!silent) setError(res.error);
    } else {
      setItems(res.data);
      setError(null);
    }
    if (!silent) setLoading(false);
  }

  async function openTicket(id: string, silent = false) {
    setSelected(id);
    const res = await fetchSupportTicket(id);
    if (!res.ok) {
      if (!silent) setDetailError(res.error);
      return;
    }
    setDetail(res.data);
    setDetailError(null);
    if (!silent) {
      setReply("");
      setStatus(res.data.status === "open" ? "in_progress" : res.data.status);
    }
  }

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (rev === 0) return;
    void load(true);
    if (selected) void openTicket(selected, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev]);

  const visible = items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "needs") return item.status === "open" || item.status === "in_progress";
    return item.status === filter;
  });

  async function save() {
    if (!detail) return;
    setSaving(true);
    setDetailError(null);
    const res = await updateSupportTicket({
      ticketId: detail.id,
      body: reply,
      status: status as SupportTicketDetail["status"],
    });
    setSaving(false);
    if (!res.ok) {
      setDetailError(res.error);
      return;
    }
    setReply("");
    await load(true);
    await openTicket(detail.id, true);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">Support</h2>
        <p className="text-sm text-[var(--muted)]">
          Members can email passblock.securities@gmail.com or send a ticket in the app. A reply or status change notifies them.
        </p>
      </div>
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              filter === item.id
                ? "bg-[var(--maroon)] text-white"
                : "bg-white text-[var(--ink)] ring-1 ring-[var(--border)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="overflow-hidden">
          {loading && items.length === 0 ? (
            <p className="p-4 text-sm text-[var(--muted)]">Loading…</p>
          ) : visible.length === 0 ? (
            <div className="p-6">
              <EmptyState>No tickets here.</EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {visible.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void openTicket(item.id)}
                    className={`w-full px-4 py-3 text-left ${
                      selected === item.id ? "bg-rose-50" : "hover:bg-zinc-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-[var(--ink)]">
                        #{item.ticket_number} {item.subject}
                      </p>
                      <Badge tone={tone(item.status)}>{STATUS_LABEL[item.status] ?? item.status}</Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--muted)]">
                      {item.member_name ?? "Member"} · {CATEGORY_LABEL[item.category] ?? item.category}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          {!detail ? (
            <p className="text-sm text-[var(--muted)]">Choose a ticket to read it and reply.</p>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-[var(--ink)]">
                    #{detail.ticket_number} {detail.subject}
                  </h3>
                  <Badge tone={tone(detail.status)}>{STATUS_LABEL[detail.status] ?? detail.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {detail.member_name ?? "Member"}
                  {detail.member_phone ? ` · ${detail.member_phone}` : ""}
                  {detail.member_email ? ` · ${detail.member_email}` : ""}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {CATEGORY_LABEL[detail.category] ?? detail.category} · opened {fmtDateTime(detail.created_at)}
                </p>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Status history</p>
                <ol className="space-y-2">
                  {detail.events.map((event) => (
                    <li key={event.id} className="text-sm text-[var(--ink)]">
                      <span className="font-semibold">{STATUS_LABEL[event.to_status] ?? event.to_status}</span>
                      <span className="text-[var(--muted)]">
                        {" "}
                        · {event.actor_role === "admin" ? "Team" : "Member"} · {fmtDateTime(event.created_at)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
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
                    {photoUrls(message.attachment_urls).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {photoUrls(message.attachment_urls).map((url) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer">
                            <img
                              src={url}
                              alt="Ticket photo"
                              className="h-24 w-24 rounded-lg object-cover ring-1 ring-black/10"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {detailError && <p className="text-sm text-red-700">{detailError}</p>}
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium normal-case text-[var(--ink)]"
                >
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Reply
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-normal normal-case text-[var(--ink)] outline-none focus:border-[var(--maroon)]"
                />
              </label>
              <Button onClick={() => void save()} disabled={saving}>
                <Send size={16} />
                {saving ? "Sending…" : "Update ticket"}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
