"use client";

import { useEffect, useState } from "react";
import {
  Users,
  BadgeCheck,
  ShieldAlert,
  Flag,
  Crown,
  IndianRupee,
  UserPlus,
} from "lucide-react";
import { fetchStats, fetchRecentActivity } from "../actions";
import { Card, Badge, fmtDateTime, timeAgo, EmptyState } from "./shared";

type Stats = {
  totalUsers: number;
  verifiedUsers: number;
  pendingVerifications: number;
  openReports: number;
  premiumActive: number;
  totalCredits: number;
  totalPayments: number;
  totalRevenuePaise: number;
  newUsers7d: number;
};

export function OverviewSection() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<{
    signups: { id: string; display_name: string | null; phone: string | null; created_at: string }[];
    verifications: {
      id: string;
      display_name: string | null;
      verification_status: string;
      verification_submitted_at: string | null;
    }[];
    reports: {
      id: string;
      reported_profile_id: string;
      reason: string;
      status: string;
      created_at: string;
    }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const [s, a] = await Promise.all([fetchStats(), fetchRecentActivity()]);
    if (!s.ok) setError(s.error);
    else setStats(s.data);
    if (!a.ok) setError(a.error);
    else setActivity(a.data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading overview…</p>;
  if (error)
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );

  const cards = [
    {
      label: "Total users",
      value: stats?.totalUsers ?? 0,
      icon: Users,
      tint: "from-rose-500 to-rose-600",
      sub: `+${stats?.newUsers7d ?? 0} this week`,
    },
    {
      label: "Verified",
      value: stats?.verifiedUsers ?? 0,
      icon: BadgeCheck,
      tint: "from-emerald-500 to-emerald-600",
      sub: `${stats?.totalUsers ? Math.round(((stats?.verifiedUsers ?? 0) / stats.totalUsers) * 100) : 0}% of users`,
    },
    {
      label: "Pending verifications",
      value: stats?.pendingVerifications ?? 0,
      icon: ShieldAlert,
      tint: "from-amber-500 to-amber-600",
      sub: "awaiting review",
    },
    {
      label: "Open reports",
      value: stats?.openReports ?? 0,
      icon: Flag,
      tint: "from-red-500 to-red-600",
      sub: "needs moderation",
    },
    {
      label: "Premium active",
      value: stats?.premiumActive ?? 0,
      icon: Crown,
      tint: "from-violet-500 to-violet-600",
      sub: `${stats?.totalCredits ?? 0} contact credits`,
    },
    {
      label: "Revenue",
      value: `₹${((stats?.totalRevenuePaise ?? 0) / 100).toLocaleString("en-IN")}`,
      icon: IndianRupee,
      tint: "from-emerald-600 to-teal-600",
      sub: `${stats?.totalPayments ?? 0} payments`,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">Overview</h2>
        <p className="text-sm text-[var(--muted)]">Key metrics across the platform.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <div className="flex items-center justify-between">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${c.tint} text-white shadow-sm`}
              >
                <c.icon size={18} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-extrabold tracking-tight text-[var(--ink)]">
              {c.value}
            </div>
            <div className="text-xs font-medium text-[var(--muted)]">{c.label}</div>
            <div className="mt-1 text-[11px] text-[var(--muted)]">{c.sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ActivityCard title="New signups" icon={UserPlus} tint="text-rose-600">
          {activity?.signups.length ? (
            <ul className="space-y-2">
              {activity.signups.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--ink)]">
                      {s.display_name ?? "Unnamed"}
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">{s.phone ?? "no phone"}</p>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--muted)]">
                    {timeAgo(s.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No signups yet.</EmptyState>
          )}
        </ActivityCard>

        <ActivityCard title="Verification activity" icon={ShieldAlert} tint="text-amber-600">
          {activity?.verifications.length ? (
            <ul className="space-y-2">
              {activity.verifications.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--ink)]">
                      {v.display_name ?? "Unnamed"}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {fmtDateTime(v.verification_submitted_at)}
                    </p>
                  </div>
                  <Badge
                    tone={
                      v.verification_status === "approved"
                        ? "green"
                        : v.verification_status === "pending"
                          ? "amber"
                          : "red"
                    }
                  >
                    {v.verification_status}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No verifications yet.</EmptyState>
          )}
        </ActivityCard>

        <ActivityCard title="Latest reports" icon={Flag} tint="text-red-600">
          {activity?.reports.length ? (
            <ul className="space-y-2">
              {activity.reports.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--ink)]">{r.reason}</p>
                    <p className="text-xs text-[var(--muted)]">{timeAgo(r.created_at)}</p>
                  </div>
                  <Badge tone={r.status === "open" ? "red" : r.status === "reviewing" ? "amber" : "neutral"}>
                    {r.status}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No reports yet.</EmptyState>
          )}
        </ActivityCard>
      </div>
    </div>
  );
}

function ActivityCard({
  title,
  icon: Icon,
  tint,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tint: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon size={18} className={tint} />
        <h3 className="text-sm font-bold text-[var(--ink)]">{title}</h3>
      </div>
      {children}
    </Card>
  );
}
