"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { supportEmail } from "@/lib/config";
import { uploadPhoto } from "@/lib/upload";

type Ticket = { id: string; ticket_number?: number; subject: string; status: string; category: string; updated_at?: string };

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("account");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");

  function load() {
    api<{ tickets?: Ticket[] }>("/v1/support/tickets").then((data) => setTickets(data.tickets ?? [])).catch((err: Error) => setError(err.message));
  }
  useEffect(load, []);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <p className="text-xs tracking-[0.16em] text-gold uppercase">Support</p>
        <h1 className="display text-5xl">Your tickets</h1>
        <p className="mt-3 text-sm text-muted">You can also email {supportEmail}.</p>
        <div className="mt-6 space-y-3">
          {tickets.length === 0 ? <p className="text-muted">No tickets yet.</p> : null}
          {tickets.map((ticket) => (
            <Link key={ticket.id} href={`/support/${ticket.id}`} className="block rounded-3xl border border-line bg-white p-4">
              <p className="font-medium">{ticket.subject}</p>
              <p className="mt-1 text-sm text-muted">{ticket.status.replaceAll("_", " ")} · {ticket.category}</p>
            </Link>
          ))}
        </div>
      </div>
      <form
        className="rounded-3xl border border-line bg-white p-6"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          try {
            const attachment_urls: string[] = [];
            for (const file of files.slice(0, 4)) attachment_urls.push(await uploadPhoto(file, "report-screenshots", "support/"));
            await api("/v1/support/tickets", {
              method: "POST",
              body: { subject, category, body, ...(attachment_urls.length ? { attachment_urls } : {}) },
            });
            setSubject("");
            setBody("");
            setFiles([]);
            load();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not open the ticket.");
          }
        }}
      >
        <h2 className="display text-3xl">New ticket</h2>
        <input className="mt-4 w-full rounded-2xl border border-line px-3 py-2" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <select className="mt-3 w-full rounded-2xl border border-line px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)}>
          {["account", "verification", "payment", "technical", "other"].map((item) => <option key={item}>{item}</option>)}
        </select>
        <textarea className="mt-3 min-h-32 w-full rounded-2xl border border-line px-3 py-2" placeholder="Describe what happened" value={body} onChange={(e) => setBody(e.target.value)} />
        <input className="mt-3 block w-full text-sm" type="file" accept="image/*" multiple onChange={(e) => setFiles([...(e.target.files ?? [])])} />
        {error ? <p className="mt-3 text-sm text-maroon">{error}</p> : null}
        <button className="mt-4 rounded-full bg-maroon px-5 py-2.5 text-sm text-white">Send</button>
      </form>
    </div>
  );
}
