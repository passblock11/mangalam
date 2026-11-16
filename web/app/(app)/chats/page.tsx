"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { api } from "@/lib/api";
import { t, useLocale } from "@/lib/i18n";

type Conversation = {
  id: string;
  other_name?: string | null;
  other_profile?: {
    id?: string;
    display_name?: string | null;
    photo_urls?: string[] | null;
    photos_locked?: boolean;
    is_verified?: boolean;
    online?: boolean;
  } | null;
  last_message?: {
    body?: string | null;
    created_at?: string | null;
    deleted?: boolean;
    attachment_type?: string | null;
    attachment_name?: string | null;
  } | null;
};

function preview(row: Conversation): string {
  const last = row.last_message;
  if (!last) return t("Say hello");
  if (last.deleted) return t("This message is deleted");
  if (last.body?.trim()) return last.body;
  if (last.attachment_type === "image") return t("📷 Photo");
  if (last.attachment_type === "audio") return t("🎤 Voice message");
  if (last.attachment_type) return `📎 ${last.attachment_name || t("File")}`;
  return t("Say hello");
}

function when(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return t("Just now");
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function ChatsInner() {
  useLocale();
  const params = useSearchParams();
  const router = useRouter();
  const withId = params.get("with");
  const [folder, setFolder] = useState<"primary" | "sent">("primary");
  const [rows, setRows] = useState<Conversation[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!withId) return;
    const text = window.prompt(t("Write a message"));
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
    let stop = false;
    async function load() {
      try {
        const data = await api<{ conversations?: Conversation[] }>("/v1/conversations", { query: { folder } });
        if (!stop) {
          setRows(data.conversations ?? []);
          setError("");
        }
      } catch (err) {
        if (!stop) setError(err instanceof Error ? err.message : "Could not load chats.");
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 20000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [folder, withId]);

  return (
    <div>
      <div className="flex border-b border-[#e8ddcf]">
        {(["primary", "sent"] as const).map((value) => (
          <button key={value} className={`px-4 py-3 text-sm font-semibold ${folder === value ? "border-b-2 border-maroon text-maroon" : "text-muted"}`} onClick={() => setFolder(value)}>
            {value === "primary" ? t("Primary") : t("Sent")}
          </button>
        ))}
      </div>
      {error ? <p className="mt-4 text-sm text-maroon">{error}</p> : null}
      {rows.length === 0 && !error ? (
        <div className="px-6 py-16 text-center">
          <p className="text-lg font-semibold">{t("No conversations yet")}</p>
          <p className="mt-2 text-sm leading-6 text-muted">{t("Start a chat from a match's profile to see it here.")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white">
          {rows.map((row, index) => {
            const person = row.other_profile;
            const name = person?.display_name || row.other_name || t("Member");
            const photo = person?.photo_urls?.[0];
            return (
              <Link key={row.id} href={`/chats/${row.id}`} className={`flex items-center gap-3 px-3 py-2.5 ${index ? "border-t border-[#eee6de]" : ""}`}>
                <span className="relative grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl bg-[#f3e9df] text-lg font-semibold text-maroon">
                  {photo && !person?.photos_locked ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" className="h-full w-full rounded-2xl object-cover" />
                  ) : name[0]}
                  {person?.online ? <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#22C55E]" aria-label="Online" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[15.5px] font-bold">{name}</span>
                    {person?.is_verified ? <span className="text-xs text-maroon">✓</span> : null}
                  </span>
                  <span className="block truncate text-[13.5px] text-muted">{preview(row)}</span>
                </span>
                <span className="shrink-0 text-[11.5px] text-muted">{when(row.last_message?.created_at)}</span>
              </Link>
            );
          })}
        </div>
      )}
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
