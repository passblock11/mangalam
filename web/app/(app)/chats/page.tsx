"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { api } from "@/lib/api";

type Conversation = {
  id: string;
  other_name?: string | null;
  other_profile?: { id?: string; display_name?: string | null; photo_urls?: string[] | null } | null;
  last_message?: { body?: string | null } | null;
};

function ChatsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const withId = params.get("with");
  const [folder, setFolder] = useState<"primary" | "sent">("primary");
  const [rows, setRows] = useState<Conversation[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!withId) return;
    const text = window.prompt("Write a message");
    if (!text) {
      router.replace("/chats");
      return;
    }
    api<{ conversation_id?: string }>("/v1/conversations", {
      method: "POST",
      body: { other_profile_id: withId, first_message: text },
    })
      .then((data) => router.replace(`/chats/${data.conversation_id}`))
      .catch((err: Error) => {
        setError(err.message);
        router.replace("/chats");
      });
  }, [withId, router]);

  useEffect(() => {
    api<{ conversations?: Conversation[] }>("/v1/conversations", { query: { folder } })
      .then((data) => setRows(data.conversations ?? []))
      .catch((err: Error) => setError(err.message));
  }, [folder, withId]);

  return (
    <div>
      <p className="text-xs tracking-[0.16em] text-gold uppercase">Messages</p>
      <h1 className="text-3xl font-semibold">Chats</h1>
      <div className="mt-4 flex gap-2">
        {(["primary", "sent"] as const).map((value) => (
          <button key={value} className={`rounded-full px-4 py-2 text-sm ${folder === value ? "bg-maroon text-white" : "bg-white text-muted"}`} onClick={() => setFolder(value)}>
            {value === "primary" ? "Primary" : "Sent"}
          </button>
        ))}
      </div>
      {error ? <p className="mt-4 text-sm text-maroon">{error}</p> : null}
      <div className="mt-6 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
        {rows.length === 0 ? <p className="p-6 text-muted">No conversations yet.</p> : null}
        {rows.map((row) => (
          <Link key={row.id} href={`/chats/${row.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-cream">
            <span>
              <span className="block font-medium">{row.other_profile?.display_name || row.other_name || "Member"}</span>
              <span className="block truncate text-sm text-muted">{row.last_message?.body || "Open the conversation"}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function ChatsPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading chats…</p>}>
      <ChatsInner />
    </Suspense>
  );
}
