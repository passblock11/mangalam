"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { uploadChatFile } from "@/lib/upload";

type Message = {
  id: string;
  sender_id: string;
  body?: string | null;
  created_at?: string;
  deleted?: boolean;
  edited?: boolean;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
};
type Billing = { next_cost?: number; free_remaining?: number; credits?: number; balance?: number };
type Peer = { id?: string; display_name?: string | null };

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [billing, setBilling] = useState<Billing | null>(null);
  const [other, setOther] = useState<Peer | null>(null);
  const [error, setError] = useState("");
  const [mine, setMine] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  async function load() {
    const data = await api<{ messages?: Message[]; billing?: Billing; other?: Peer }>(`/v1/conversations/${id}/messages`);
    setMessages(data.messages ?? []);
    setBilling(data.billing ?? null);
    setOther(data.other ?? null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setMine(data.session?.user.id ?? ""));
    load().catch((err: Error) => setError(err.message));
  }, [id]);

  async function send(file?: File) {
    setError("");
    try {
      const attachment = file ? await uploadChatFile(file, id) : null;
      const body = text.trim();
      if (!body && !attachment) return;
      await api(`/v1/conversations/${id}/messages`, {
        method: "POST",
        body: {
          body,
          ...(attachment ? {
            attachment_url: attachment.url,
            attachment_type: attachment.type,
            attachment_name: attachment.name,
            attachment_mime: attachment.mime,
            attachment_size: attachment.size,
          } : {}),
        },
      });
      setText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the message.");
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{other?.display_name || "Conversation"}</h1>
        {other?.id ? <Link className="text-sm text-maroon" href={`/people/${other.id}`}>View profile</Link> : null}
      </div>
      {billing?.next_cost ? <p className="mt-2 text-sm text-muted">This message uses {billing.next_cost} credits. {billing.credits ?? billing.balance ?? ""} left.</p> : null}
      {typeof billing?.free_remaining === "number" && billing.free_remaining > 0 ? <p className="mt-2 text-sm text-muted">{billing.free_remaining} free messages left in this chat.</p> : null}
      <div className="mt-4 flex-1 space-y-3">
        {messages.map((message) => {
          const own = message.sender_id === mine;
          return (
            <div key={message.id} className={`max-w-lg rounded-3xl px-4 py-3 text-sm ${own ? "ml-auto bg-maroon text-white" : "bg-white"}`}>
              {message.deleted ? <p className="italic opacity-70">This message was deleted.</p> : (
                <>
                  {message.attachment_url && message.attachment_type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={message.attachment_url} alt="" className="mb-2 max-h-64 rounded-2xl" />
                  ) : null}
                  {message.attachment_url && message.attachment_type !== "image" ? (
                    <a className="mb-2 block underline" href={message.attachment_url} target="_blank" rel="noreferrer">{message.attachment_name || "Attachment"}</a>
                  ) : null}
                  {message.body ? <p>{message.body}</p> : null}
                  {message.edited ? <p className="mt-1 text-[11px] opacity-70">Edited</p> : null}
                </>
              )}
              {own && !message.deleted ? (
                <div className="mt-2 flex gap-3 text-[11px] opacity-80">
                  {!message.attachment_url ? <button onClick={() => setEditing(message.id)}>Edit</button> : null}
                  <button onClick={async () => {
                    if (!window.confirm("Delete this message?")) return;
                    await api(`/v1/conversations/${id}/messages/${message.id}`, { method: "DELETE" });
                    await load();
                  }}>Delete</button>
                </div>
              ) : null}
              {editing === message.id ? (
                <form className="mt-2 flex gap-2" onSubmit={async (event) => {
                  event.preventDefault();
                  const next = new FormData(event.currentTarget).get("body");
                  if (typeof next !== "string" || !next.trim()) return;
                  await api(`/v1/conversations/${id}/messages/${message.id}`, { method: "PATCH", body: { body: next.trim() } });
                  setEditing(null);
                  await load();
                }}>
                  <input name="body" defaultValue={message.body ?? ""} className="flex-1 rounded-full px-3 py-1 text-ink" />
                  <button className="text-xs">Save</button>
                </form>
              ) : null}
            </div>
          );
        })}
      </div>
      {error ? <p className="mt-3 text-sm text-maroon">{error}</p> : null}
      <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <input className="flex-1 rounded-full border border-line bg-white px-4 py-3" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" />
        <label className="grid cursor-pointer place-items-center rounded-full border border-line bg-white px-4 text-sm">
          Photo
          <input className="hidden" type="file" accept="image/*,.pdf,.doc,.docx" onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void send(file);
          }} />
        </label>
        <button className="rounded-full bg-maroon px-5 text-sm text-white">Send</button>
      </form>
    </div>
  );
}
