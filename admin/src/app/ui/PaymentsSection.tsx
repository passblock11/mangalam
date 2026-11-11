"use client";

import { useEffect, useState } from "react";
import { IndianRupee, Wallet, RefreshCw, ChevronRight } from "lucide-react";
import { fetchPayments } from "../actions";
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
};

export function PaymentsSection() {
  const [items, setItems] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetchPayments();
    if (!res.ok) setError(res.error);
    else setItems(res.data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const totalRevenue = items.reduce((s, p) => s + (p.amount_paise ?? 0), 0);
  const totalCredits = items.reduce((s, p) => s + (p.credits ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">Payments</h2>
          <p className="text-sm text-[var(--muted)]">
            Razorpay credit purchases & revenue ledger.
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

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
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
                          <p className="truncate text-xs text-[var(--muted)]">{p.phone ?? "—"}</p>
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
