"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Item = { id: string; title?: string; body?: string | null; type?: string; read_at?: string | null; created_at?: string };

export default function NotificationsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ items?: Item[] }>("/v1/notifications")
      .then(async (data) => {
        setItems(data.items ?? []);
        await api("/v1/notifications/read-all", { method: "POST" });
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="max-w-2xl">
      <p className="text-xs tracking-[0.16em] text-gold uppercase">Alerts</p>
      <h1 className="display text-5xl">Notifications</h1>
      {error ? <p className="mt-4 text-sm text-maroon">{error}</p> : null}
      <div className="mt-6 space-y-3">
        {items.length === 0 && !error ? <p className="text-muted">You are all caught up.</p> : null}
        {items.map((item) => (
          <article key={item.id} className="rounded-3xl border border-line bg-white px-5 py-4">
            <p className="font-medium">{item.title}</p>
            {item.body ? <p className="mt-1 text-sm leading-6 text-muted">{item.body}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
