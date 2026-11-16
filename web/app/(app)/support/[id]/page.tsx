"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PhotoViewer } from "@/components/photo-viewer";
import { api } from "@/lib/api";

type Ticket = { subject?: string; status?: string; category?: string; ticket_number?: number };
type Note = { id: string; body?: string | null; author_role?: string | null; created_at?: string; attachment_urls?: unknown };
type Event = { id: string; to_status?: string | null; actor_role?: string | null; created_at?: string };

const statusLabel: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_you: "Waiting for you",
  resolved: "Resolved",
  closed: "Closed",
};

function photosOf(value: unknown): string[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.replace(/^\{|\}$/g, "").split(",")
      : [];
  return list
    .map((item) => String(item).trim())
    .filter((item) => item.startsWith("https://"));
}

function fromSupport(role?: string | null): boolean {
  return String(role ?? "").trim().toLowerCase() === "admin";
}

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Note[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [viewer, setViewer] = useState<string | null>(null);

  async function load() {
    const data = await api<{ ticket?: Ticket; messages?: Note[]; events?: Event[] }>(`/v1/support/tickets/${id}`);
    setTicket(data.ticket ?? null);
    setMessages(data.messages ?? []);
    setEvents(data.events ?? []);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [id]);

  const status = ticket?.status || "open";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col">
      <p className="text-xs font-semibold tracking-[0.16em] text-maroon uppercase">{statusLabel[status] || status}</p>
      <h1 className="mt-1 text-3xl font-semibold">{ticket?.subject || "Support"}</h1>
      {ticket?.ticket_number ? <p className="mt-1 text-sm text-muted">Ticket #{ticket.ticket_number}</p> : null}
      {events.length ? (
        <div className="mt-4 rounded-2xl bg-white px-4 py-3">
          <p className="text-sm font-semibold">Status history</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {events.map((event) => (
              <li key={event.id}>
                {fromSupport(event.actor_role) ? "Mangalam support" : "You"} · {statusLabel[event.to_status || "open"] || event.to_status}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-4 flex-1 space-y-3">
        {messages.map((message) => {
          const mine = !fromSupport(message.author_role);
          const photos = photosOf(message.attachment_urls);
          return (
            <article key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${mine ? "bg-maroon text-white" : "bg-[#f3e9df] text-ink"}`}>
                <p className={`text-xs font-semibold ${mine ? "text-white/80" : "text-maroon"}`}>{mine ? "You" : "Mangalam support"}</p>
                {message.body ? <p className="mt-1 text-sm leading-6 whitespace-pre-wrap">{message.body}</p> : null}
                {photos.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {photos.map((url) => (
                      <button key={url} type="button" onClick={() => setViewer(url)} aria-label="Open photo">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-24 w-24 rounded-xl object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      {error ? <p className="mt-3 text-sm text-maroon">{error}</p> : null}
      <form
        className="mt-4 flex gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const text = body.trim();
          if (!text) return;
          try {
            await api(`/v1/support/tickets/${id}/messages`, { method: "POST", body: { body: text } });
            setBody("");
            await load();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not send the reply.");
          }
        }}
      >
        <input className="flex-1 rounded-full border border-line bg-white px-4 py-3" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add more detail" />
        <button className="rounded-full bg-maroon px-5 text-sm text-white">Send</button>
      </form>
      {viewer ? <PhotoViewer urls={[viewer]} index={0} onClose={() => setViewer(null)} /> : null}
    </div>
  );
}
