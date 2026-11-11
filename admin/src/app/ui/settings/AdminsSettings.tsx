"use client";

import { useEffect, useState } from "react";
import { Search, Shield, ShieldOff, Loader2, Crown } from "lucide-react";
import { fetchAdmins, setAdminStatus, searchProfilesForAdmin } from "../../settings-actions";
import { Avatar, Badge, Button, Card, EmptyState } from "../shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function AdminsSettings() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [results, setResults] = useState<any[] | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetchAdmins();
    if (!res.ok) setError(res.error);
    else setAdmins(res.data);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function search() {
    setSearching(true);
    setError(null);
    const res = await searchProfilesForAdmin(query);
    setSearching(false);
    if (!res.ok) setError(res.error);
    else setResults(res.data);
  }

  async function toggle(profileId: string, makeAdmin: boolean) {
    setBusy(profileId);
    const res = await setAdminStatus(profileId, makeAdmin);
    setBusy(null);
    if (!res.ok) setError(res.error);
    else {
      setResults(null);
      setQuery("");
      await load();
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Crown size={16} className="text-[var(--gold)]" />
          <h3 className="text-sm font-bold text-[var(--ink)]">Current admins ({admins.length})</h3>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : admins.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No admins.</p>
        ) : (
          <div className="space-y-2">
            {admins.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
                <div className="flex items-center gap-3">
                  <Avatar name={a.display_name} size={36} />
                  <div>
                    <p className="font-semibold text-[var(--ink)]">{a.display_name ?? "Unnamed"}</p>
                    <p className="text-xs text-[var(--muted)]">{a.email ?? a.phone ?? "—"}</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" disabled={busy === a.id} onClick={() => void toggle(a.id, false)}>
                  <ShieldOff size={14} /> Demote
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-bold text-[var(--ink)]">Promote a user to admin</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, phone, or email…"
              className="w-full rounded-lg border border-[var(--border)] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--maroon)]"
            />
          </div>
          <Button type="submit" disabled={searching}>
            {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Search
          </Button>
        </form>

        {results && (
          <div className="mt-3 space-y-2">
            {results.length === 0 ? (
              <EmptyState>No users found.</EmptyState>
            ) : (
              results.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.display_name} size={36} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-[var(--ink)]">{r.display_name ?? "Unnamed"}</p>
                        {r.is_admin && <Badge tone="gold">Admin</Badge>}
                      </div>
                      <p className="text-xs text-[var(--muted)]">{r.email ?? r.phone ?? "—"}</p>
                    </div>
                  </div>
                  {r.is_admin ? (
                    <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => void toggle(r.id, false)}>
                      <ShieldOff size={14} /> Demote
                    </Button>
                  ) : (
                    <Button size="sm" variant="success" disabled={busy === r.id} onClick={() => void toggle(r.id, true)}>
                      <Shield size={14} /> Make admin
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
