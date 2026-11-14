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
  Settings,
  LifeBuoy,
} from "lucide-react";
import { OverviewSection } from "./OverviewSection";
import { VerificationsSection } from "./VerificationsSection";
import { UsersSection } from "./UsersSection";
import { ReportsSection } from "./ReportsSection";
import { PaymentsSection } from "./PaymentsSection";
import { SettingsSection } from "./SettingsSection";
import { SupportSection } from "./SupportSection";
import { hasPermission, type AdminSession, type AdminFeature } from "@/lib/admin-session";
import { AdminLiveProvider, useSectionCounts } from "./admin-live";

type Tab = "overview" | "verifications" | "users" | "reports" | "payments" | "support" | "settings";

const COUNT_LABEL: Partial<Record<Tab, string>> = {
  overview: "Pending verifications and open reports",
  verifications: "Pending reviews",
  users: "Members",
  reports: "Open reports",
  payments: "Payments and memberships",
  support: "Tickets that need a reply",
};

const NAV: { id: Tab; feature: AdminFeature; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "overview", feature: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "verifications", feature: "verifications", label: "Verifications", icon: ShieldCheck },
  { id: "users", feature: "users", label: "Users", icon: Users },
  { id: "reports", feature: "reports", label: "Reports", icon: Flag },
  { id: "payments", feature: "payments", label: "Payments", icon: Wallet },
  { id: "support", feature: "support", label: "Support", icon: LifeBuoy },
  { id: "settings", feature: "settings", label: "Settings", icon: Settings },
];

export function AdminDashboard({ session }: { session: AdminSession }) {
  return (
    <AdminLiveProvider>
      <Dashboard session={session} />
    </AdminLiveProvider>
  );
}

function Dashboard({ session }: { session: AdminSession }) {
  const allowed = NAV.filter((n) => hasPermission(session, n.feature));
  const [tab, setTab] = useState<Tab>(allowed[0]?.id ?? "overview");
  const [mobileOpen, setMobileOpen] = useState(false);

  // If the active tab is not allowed (e.g. permissions changed), fall back.
  if (!allowed.some((n) => n.id === tab) && allowed[0]) {
    setTab(allowed[0].id);
  }

  return (
    <div className="flex min-h-[calc(100vh-65px)] bg-[var(--background)]">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-white md:block">
        <Sidebar session={session} items={allowed} tab={tab} onTab={(t) => setTab(t)} />
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
              session={session}
              items={allowed}
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
          {allowed.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
              Your admin account has no feature permissions assigned. Ask a super admin to grant
              access in Settings → Admins.
            </div>
          ) : (
            <>
              {tab === "overview" && <OverviewSection />}
              {tab === "verifications" && <VerificationsSection />}
              {tab === "users" && <UsersSection />}
              {tab === "reports" && <ReportsSection />}
              {tab === "payments" && <PaymentsSection />}
              {tab === "support" && <SupportSection />}
              {tab === "settings" && <SettingsSection session={session} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Sidebar({
  session,
  items,
  tab,
  onTab,
}: {
  session: AdminSession;
  items: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[];
  tab: Tab;
  onTab: (t: Tab) => void;
}) {
  const counts = useSectionCounts();
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
        {items.map((n) => {
          const active = tab === n.id;
          const count = n.id === "settings" ? undefined : counts[n.id];
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onTab(n.id)}
              title={COUNT_LABEL[n.id]}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-[var(--maroon)] text-white shadow-sm"
                  : "text-[var(--ink)] hover:bg-rose-50"
              }`}
            >
              <n.icon size={18} />
              <span className="flex-1 text-left">{n.label}</span>
              {count !== undefined && (
                <span
                  className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold tabular-nums ${
                    active ? "bg-white/20 text-white" : "bg-rose-50 text-[var(--maroon)]"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] p-3 text-[11px] text-[var(--muted)]">
        <p className="truncate px-2 font-semibold text-[var(--ink)]">{session.email}</p>
        <p className="px-2">{session.is_super_admin ? "Super admin" : "Admin"}</p>
        <p className="mt-1 px-2">v2.0 · Mangalam Admin</p>
      </div>
    </div>
  );
}
