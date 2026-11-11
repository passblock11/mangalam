"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  Flag,
  Wallet,
  Heart,
  Menu,
} from "lucide-react";
import { OverviewSection } from "./OverviewSection";
import { VerificationsSection } from "./VerificationsSection";
import { UsersSection } from "./UsersSection";
import { ReportsSection } from "./ReportsSection";
import { PaymentsSection } from "./PaymentsSection";

type Tab = "overview" | "verifications" | "users" | "reports" | "payments";

const NAV: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "verifications", label: "Verifications", icon: ShieldCheck },
  { id: "users", label: "Users", icon: Users },
  { id: "reports", label: "Reports", icon: Flag },
  { id: "payments", label: "Payments", icon: Wallet },
];

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-[calc(100vh-65px)] bg-[var(--background)]">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-white md:block">
        <Sidebar tab={tab} onTab={(t) => setTab(t)} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl">
            <Sidebar
              tab={tab}
              onTab={(t) => {
                setTab(t);
                setMobileOpen(false);
              }}
            />
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 overflow-x-hidden">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span className="flex items-center gap-1.5 text-sm font-bold text-[var(--maroon)]">
            <Heart size={16} fill="currentColor" /> Mangalam
          </span>
          <span className="w-9" />
        </div>

        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {tab === "overview" && <OverviewSection />}
          {tab === "verifications" && <VerificationsSection />}
          {tab === "users" && <UsersSection />}
          {tab === "reports" && <ReportsSection />}
          {tab === "payments" && <PaymentsSection />}
        </div>
      </main>
    </div>
  );
}

function Sidebar({
  tab,
  onTab,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--maroon)] to-[var(--gold)] text-white shadow-sm">
          <Heart size={18} fill="currentColor" />
        </div>
        <div>
          <p className="text-sm font-extrabold tracking-tight text-[var(--ink)]">Mangalam</p>
          <p className="text-[11px] text-[var(--muted)]">Admin Console</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((n) => {
          const active = tab === n.id;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onTab(n.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-[var(--maroon)] text-white shadow-sm"
                  : "text-[var(--ink)] hover:bg-rose-50"
              }`}
            >
              <n.icon size={18} />
              {n.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] p-3 text-[11px] text-[var(--muted)]">
        <p className="px-2">Moderation & operations</p>
        <p className="px-2">v2.0 · Mangalam Admin</p>
      </div>
    </div>
  );
}
