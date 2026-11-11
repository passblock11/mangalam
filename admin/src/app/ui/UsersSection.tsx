"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, BadgeCheck, Crown, RefreshCw, ChevronRight } from "lucide-react";
import { fetchProfilesEnhanced } from "../actions";
import { Avatar, Badge, Button, Card, EmptyState, fmtDate, timeAgo } from "./shared";
import { UserDetailDrawer } from "./UserDetailDrawer";

type Profile = {
  id: string;
  display_name: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  city: string | null;
  state: string | null;
  gender: string | null;
  is_verified: boolean;
  verification_status: string | null;
  created_at: string;
  last_active_at: string | null;
  photo_urls: string[] | null;
  premium_until: string | null;
  contact_credits: number | null;
};

export function UsersSection() {
  const [items, setItems] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    const res = await fetchProfilesEnhanced(q);
    if (!res.ok) setError(res.error);
    else setItems(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void load(search);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">Users</h2>
        <p className="text-sm text-[var(--muted)]">
          Search members, manage verification, premium, credits & bans.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or city…"
            className="w-full rounded-xl border border-[var(--border)] bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--maroon)]"
          />
        </div>
        <Button type="submit" variant="primary">
          <Search size={16} /> Search
        </Button>
        <Button type="button" variant="secondary" onClick={() => void load(search)}>
          <RefreshCw size={16} />
        </Button>
      </form>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState>No profiles found.</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-zinc-50/70 text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Member</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Premium</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                  <th className="px-4 py-3 font-semibold">Active</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const isPremium =
                    !!p.premium_until && new Date(p.premium_until).getTime() > Date.now();
                  return (
                    <tr
                      key={p.id}
                      className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-rose-50/40"
                      onClick={() => setSelected(p.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={p.display_name} photoUrl={p.photo_urls?.[0]} size={36} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[var(--ink)]">
                              {p.display_name ?? "Unnamed"}
                            </p>
                            <p className="truncate text-xs text-[var(--muted)]">
                              {p.phone ?? "no phone"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {[p.city, p.state].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {p.is_verified ? (
                            <Badge tone="green">
                              <BadgeCheck size={11} /> Verified
                            </Badge>
                          ) : (
                            <Badge tone="neutral">Unverified</Badge>
                          )}
                          {p.verification_status === "pending" && (
                            <Badge tone="amber">Pending</Badge>
                          )}
                          {p.verification_status === "rejected" && (
                            <Badge tone="red">Rejected</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isPremium ? (
                          <Badge tone="gold">
                            <Crown size={11} /> Active
                          </Badge>
                        ) : (
                          <span className="text-xs text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">{fmtDate(p.created_at)}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">{timeAgo(p.last_active_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRight size={16} className="text-[var(--muted)]" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <UserDetailDrawer profileId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
