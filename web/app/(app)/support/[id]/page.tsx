"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

type Ticket = { subject?: string; status?: string; category?: string };
type Note = { id: string; body: string; author_role?: string; created_at?: string };

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Note[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const data = await api<{ ticket?: Ticket; messages?: Note[] }>(`/v1/support/tickets/${id}`);
    setTicket(data.ticket ?? null);
    setMessages(data.messages ?? []);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [id]);

  return (
    <div className="max-w-2xl">
      <p className="text-xs tracking-[0.16em] text-gold uppercase">{ticket?.status?.replaceAll("_", " ") || "Ticket"}</p>
      <h1 className="display text-5xl">{ticket?.subject || "Support"}</h1>
      <div className="mt-6 space-y-3">
        {messages.map((message) => (
          <article key={message.id} className="rounded-3xl bg-white px-4 py-3">
            <p className="text-xs text-muted">{message.author_role === "admin" ? "Mangalam" : "You"}</p>
            <p className="mt-1 text-sm leading-6">{message.body}</p>
          </article>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-maroon">{error}</p> : null}
      <form
        className="mt-4 flex gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await api(`/v1/support/tickets/${id}/messages`, { method: "POST", body: { body } });
            setBody("");
            await load();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not send the reply.");
          }
        }}
      >
        <input className="flex-1 rounded-full border border-line bg-white px-4 py-3" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Reply" />
        <button className="rounded-full bg-maroon px-5 text-sm text-white">Send</button>
      </form>
    </div>
  );
}
