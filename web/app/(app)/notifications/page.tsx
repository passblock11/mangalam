"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { api } from "@/lib/api";
import { t, tNotice, useLocale } from "@/lib/i18n";

type Item = {
  id: string;
  title?: string | null;
  body?: string | null;
  type?: string | null;
  data?: Record<string, unknown> | null;
  read_at?: string | null;
  created_at?: string | null;
};

function iconFor(type: string): { name: IconName; color: string } {
  if (type === "match") return { name: "heart", color: "text-gold bg-gold/15" };
  if (type === "message") return { name: "message", color: "text-maroon bg-maroon/10" };
  if (type === "like" || type === "shortlist") return { name: "heart", color: "text-[#e53935] bg-[#e53935]/10" };
  if (type === "view") return { name: "eye", color: "text-muted bg-black/5" };
  if (type === "verification") return { name: "shield", color: "text-muted bg-black/5" };
  if (type === "support") return { name: "info", color: "text-muted bg-black/5" };
  if (type === "report") return { name: "warning", color: "text-muted bg-black/5" };
  return { name: "bell", color: "text-muted bg-black/5" };
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

export default function NotificationsPage() {
  useLocale();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<{ title: string; body: string } | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ items?: Item[] }>("/v1/notifications");
      setItems(data.items ?? []);
      await api("/v1/notifications/read-all", { method: "POST" });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not load notifications"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  function open(item: Item) {
    const type = item.type || "system";
    const data = item.data ?? {};
    const conversationId = String(data.conversation_id ?? "");
    const fromProfileId = String(data.from_profile_id ?? "");
    const ticketId = String(data.ticket_id ?? "");
    if (type === "message" && conversationId) {
      router.push(`/chats/${conversationId}`);
      return;
    }
    if ((type === "like" || type === "match" || type === "shortlist" || type === "view") && fromProfileId) {
      router.push(`/people/${fromProfileId}`);
      return;
    }
    if (type === "verification") {
      router.push("/verification");
      return;
    }
    if (type === "support") {
      router.push(ticketId ? `/support/${ticketId}` : "/support");
      return;
    }
    const title = (item.title || "").trim();
    const body = (item.body || "").trim();
    if (title || body) setNote({ title: tNotice(title), body: tNotice(body) });
  }

  if (loading) return <p className="py-16 text-center text-muted">{t("Please wait…")}</p>;
  if (error) {
    return (
      <div className="py-16 text-center">
        <p className="font-semibold">{t("Could not load notifications")}</p>
        <p className="mt-1 text-sm text-muted">{error}</p>
        <button className="mt-4 rounded-xl bg-maroon px-4 py-2 text-sm text-white" onClick={() => load()}>{t("Retry")}</button>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="px-6 py-20 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-black/5 text-muted"><Icon name="bell" className="h-6 w-6" /></span>
        <p className="mt-3 text-lg font-semibold">{t("No notifications yet")}</p>
        <p className="mt-1 text-sm text-muted">{t("Likes, matches and messages will appear here.")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white">
      <div className="flex justify-end border-b border-[#eee6de] px-2">
        <button className="grid h-11 w-11 place-items-center text-ink" aria-label={t("Refresh")} onClick={() => load()}>
          <Icon name="refresh" className="h-5 w-5" />
        </button>
      </div>
      {items.map((item, index) => {
        const type = item.type || "system";
        const icon = iconFor(type);
        const unread = !item.read_at;
        return (
          <button key={item.id} className={`flex w-full items-start gap-3 px-3.5 py-3 text-left ${index ? "border-t border-[#eee6de]" : ""}`} onClick={() => open(item)}>
            <span className={`grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full ${icon.color}`}>
              <Icon name={icon.name} className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className={`truncate text-[15px] ${unread ? "font-extrabold" : "font-semibold"}`}>{tNotice(item.title || "")}</span>
                {unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-maroon" /> : null}
              </span>
              {item.body ? <span className="mt-0.5 line-clamp-2 block text-[13.5px] leading-5 text-muted">{tNotice(item.body)}</span> : null}
            </span>
            <span className="shrink-0 text-[11.5px] text-muted">{when(item.created_at)}</span>
          </button>
        );
      })}
      {note ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setNote(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(event) => event.stopPropagation()}>
            {note.title ? <p className="text-lg font-extrabold">{note.title}</p> : null}
            {note.body ? <p className="mt-2 text-sm leading-6 text-muted">{note.body}</p> : null}
            <button className="mt-4 h-10 w-full rounded-xl bg-maroon text-sm font-semibold text-white" onClick={() => setNote(null)}>{t("Close")}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
