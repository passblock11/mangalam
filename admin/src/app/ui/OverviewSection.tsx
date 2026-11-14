"use client";

import { useEffect, useState } from "react";
import { useAdminRevision } from "./admin-live";
import {
  Users,
  BadgeCheck,
  ShieldAlert,
  Flag,
  Crown,
  IndianRupee,
  UserPlus,
} from "lucide-react";
import { fetchStats, fetchRecentActivity, sendMemberUpdate } from "../actions";
import { Card, Badge, Button, fmtDateTime, timeAgo, EmptyState } from "./shared";

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
    signups: { id: string; display_name: string | null; phone: string | null; email: string | null; created_at: string }[];
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
  const rev = useAdminRevision("overview");

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const [s, a] = await Promise.all([fetchStats(), fetchRecentActivity()]);
    if (!s.ok) {
      if (!silent) setError(s.error);
    } else {
      setStats(s.data);
      setError(null);
    }
    if (!a.ok) {
      if (!silent) setError(a.error);
    } else setActivity(a.data);
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    void load(false);
    // The first snapshot must not depend on the live revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (rev === 0) return;
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev]);

  if (loading && !stats) return <p className="text-sm text-[var(--muted)]">Loading overview…</p>;
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

      <MemberUpdateCard />

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
                    <p className="truncate text-xs text-[var(--muted)]">{s.email ?? "no email"}</p>
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

function MemberUpdateCard() {
  const [title, setTitle] = useState("Mangalam");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function send() {
    setBusy(true);
    setMessage(null);
    setFailed(false);
    const res = await sendMemberUpdate({ title, body });
    setBusy(false);
    if (!res.ok) {
      setFailed(true);
      setMessage(res.error);
      return;
    }
    setBody("");
    setMessage(
      res.data.sent === 1
        ? "Sent to 1 member. It appears in their notification bar."
        : `Sent to ${res.data.sent} members. It appears in their notification bar.`
    );
  }

  return (
    <Card className="space-y-3 p-5">
      <h3 className="text-sm font-bold text-[var(--ink)]">Send an update</h3>
      <p className="text-xs text-[var(--muted)]">
        Members see this in the phone notification bar and in the app notification list.
      </p>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Title</span>
        <input
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--maroon)]"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Message</span>
        <textarea
          value={body}
          maxLength={240}
          rows={3}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--maroon)]"
        />
      </label>
      {message && (
        <p className={`text-xs ${failed ? "text-red-700" : "text-emerald-700"}`}>{message}</p>
      )}
      <Button onClick={() => void send()} disabled={busy || !title.trim() || !body.trim()}>
        {busy ? "Sending…" : "Send to all members"}
      </Button>
    </Card>
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
