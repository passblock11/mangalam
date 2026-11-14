"use client";

import { useEffect, useState } from "react";
import { useAdminRevision } from "./admin-live";
import { IndianRupee, Wallet, RefreshCw, ChevronRight } from "lucide-react";
import { fetchMemberSubscriptions, fetchPayments } from "../actions";
import { Avatar, Badge, Button, Card, EmptyState, fmtDateTime, fmtMoney } from "./shared";
import { UserDetailDrawer } from "./UserDetailDrawer";

type Payment = {
  razorpay_payment_id: string;
  profile_id: string;
  credits: number;
  amount_paise: number;
  created_at: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
};

export function PaymentsSection() {
  const [items, setItems] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [subs, setSubs] = useState<Awaited<ReturnType<typeof fetchMemberSubscriptions>> | null>(null);
  const rev = useAdminRevision("payments");

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const [res, memberships] = await Promise.all([fetchPayments(), fetchMemberSubscriptions()]);
    if (!res.ok) {
      if (!silent) setError(res.error);
    } else {
      setItems(res.data);
      setError(null);
    }
    setSubs(memberships);
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (rev === 0) return;
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev]);

  const totalRevenue = items.reduce((s, p) => s + (p.amount_paise ?? 0), 0);
  const totalCredits = items.reduce((s, p) => s + (p.credits ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">Payments</h2>
          <p className="text-sm text-[var(--muted)]">
            Membership renewals and one-time credit packs. Both are recorded after Razorpay confirms the payment.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <IndianRupee size={18} />
          </div>
          <p className="mt-3 text-2xl font-extrabold text-[var(--ink)]">
            {fmtMoney(totalRevenue)}
          </p>
          <p className="text-xs text-[var(--muted)]">Total revenue</p>
        </Card>
        <Card className="p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white">
            <Wallet size={18} />
          </div>
          <p className="mt-3 text-2xl font-extrabold text-[var(--ink)]">{totalCredits}</p>
          <p className="text-xs text-[var(--muted)]">Credits sold</p>
        </Card>
        <Card className="p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 text-white">
            <RefreshCw size={18} />
          </div>
          <p className="mt-3 text-2xl font-extrabold text-[var(--ink)]">{items.length}</p>
          <p className="text-xs text-[var(--muted)]">Transactions</p>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-bold text-[var(--ink)]">Memberships</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Recurring UPI or card mandates. Cancelling keeps access until the paid period ends.
        </p>
        {subs && !subs.ok ? (
          <p className="mt-3 text-sm text-red-700">{subs.error}</p>
        ) : !subs || subs.data.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No memberships yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Member</th>
                  <th className="py-2 pr-3 font-semibold">Plan</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 font-semibold">Period ends</th>
                </tr>
              </thead>
              <tbody>
                {subs.data.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer border-t border-[var(--border)] hover:bg-rose-50/40"
                    onClick={() => setSelected(s.profile_id)}
                  >
                    <td className="py-2 pr-3">{s.display_name || s.phone || "Member"}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{s.plan_code}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={s.status === "active" ? "green" : "neutral"}>
                        {s.cancel_at_period_end ? `${s.status} · ends` : s.status}
                      </Badge>
                    </td>
                    <td className="py-2">{s.current_period_end ? fmtDateTime(s.current_period_end) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState>No payments yet.</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-zinc-50/70 text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Member</th>
                  <th className="px-4 py-3 font-semibold">Payment ID</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Credits</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr
                    key={p.razorpay_payment_id}
                    className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-rose-50/40"
                    onClick={() => setSelected(p.profile_id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={p.display_name} size={32} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--ink)]">
                            {p.display_name ?? "Unnamed"}
                          </p>
                          <p className="truncate text-xs text-[var(--muted)]">
                            {p.phone ?? "no phone"} · {p.email ?? "no email"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                      {p.razorpay_payment_id.slice(0, 18)}…
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="green">{fmtMoney(p.amount_paise)}</Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--ink)]">{p.credits}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{fmtDateTime(p.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight size={16} className="text-[var(--muted)]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <UserDetailDrawer profileId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
