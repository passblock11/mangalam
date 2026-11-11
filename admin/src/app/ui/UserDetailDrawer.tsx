"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Ban,
  Crown,
  Wallet,
  ShieldCheck,
  Phone,
  MessageCircle,
  MapPin,
  Calendar,
  Briefcase,
  GraduationCap,
  Sparkles,
  Heart,
  Flag,
  ZoomIn,
  X,
} from "lucide-react";
import {
  fetchUserDetail,
  grantPremium,
  revokePremium,
  setContactCredits,
  setProfileVerified,
  banUser,
} from "../actions";
import { Avatar, Badge, Button, fmtDate, fmtDateTime, timeAgo } from "./shared";

export function UserDetailDrawer({
  profileId,
  onClose,
}: {
  profileId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [premiumDays, setPremiumDays] = useState("30");
  const [credits, setCredits] = useState("5");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    const res = await fetchUserDetail(profileId);
    if (!res.ok) setError(res.error);
    else setData(res.data);
    setLoading(false);
  }

  useEffect(() => {
    if (profileId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [profileId, onClose]);

  if (!profileId) return null;

  const p = (data ?? {}) as {
    display_name: string | null;
    phone: string | null;
    whatsapp_number: string | null;
    phone_visible: boolean | null;
    date_of_birth: string | null;
    gender: string | null;
    community: string | null;
    mother_tongue: string | null;
    diet: string | null;
    height_cm: number | null;
    profile_for: string | null;
    marital_status: string | null;
    city: string | null;
    state: string | null;
    bio: string | null;
    is_verified: boolean | null;
    is_admin: boolean | null;
    verification_status: string | null;
    verification_note: string | null;
    verification_submitted_at: string | null;
    verification_reviewed_at: string | null;
    created_at: string | null;
    updated_at: string | null;
    last_active_at: string | null;
    mangal_dosh: string | null;
    birth_time: string | null;
    birth_place: string | null;
    occupation: string | null;
    education_level: string | null;
    monthly_salary: string | null;
    photo_urls: string[] | null;
    wallet: { contact_credits: number; premium_until: string | null } | null;
    reports_against_count: number | null;
    reports_by_count: number | null;
    banned_until: string | null;
  };
  const photoUrls = p.photo_urls ?? [];
  const wallet = p.wallet;
  const isPremium = !!wallet?.premium_until && new Date(wallet.premium_until).getTime() > Date.now();
  const isBanned = !!p.banned_until && new Date(p.banned_until).getTime() > Date.now();

  async function act(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(key);
    const out = await fn();
    setBusy(null);
    if (!out.ok && out.error) setError(out.error);
    else await load();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex h-full w-full max-w-xl flex-col bg-[var(--background)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <Avatar name={p.display_name} photoUrl={photoUrls[0]} size={44} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[var(--ink)]">{p.display_name ?? "Unnamed"}</h3>
                {Boolean(p.is_verified) && <BadgeCheck size={16} className="text-emerald-600" />}
                {isPremium && (
                  <Badge tone="gold">
                    <Crown size={11} /> Premium
                  </Badge>
                )}
                {isBanned && (
                  <Badge tone="red">
                    <Ban size={11} /> Banned
                  </Badge>
                )}
              </div>
              <p className="text-xs text-[var(--muted)]">
                Joined {fmtDate(p.created_at)} · Last active {timeAgo(p.last_active_at)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {data && !loading && (
            <div className="space-y-6">
              {/* Photos */}
              {photoUrls.length > 0 && (
                <Section title="Photos">
                  <div className="grid grid-cols-3 gap-2">
                    {photoUrls.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setLightbox(url)}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--border)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`photo ${i + 1}`} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                          <ZoomIn size={18} className="text-white" />
                        </div>
                      </button>
                    ))}
                  </div>
                </Section>
              )}

              {/* Verification */}
              <Section title="Verification" icon={ShieldCheck}>
                <div className="flex items-center gap-2">
                  <Badge
                    tone={
                      p.verification_status === "approved"
                        ? "green"
                        : p.verification_status === "pending"
                          ? "amber"
                          : p.verification_status === "rejected"
                            ? "red"
                            : "neutral"
                    }
                  >
                    {p.verification_status ?? "none"}
                  </Badge>
                  {p.verification_submitted_at && (
                    <span className="text-xs text-[var(--muted)]">
                      submitted {fmtDateTime(p.verification_submitted_at)}
                    </span>
                  )}
                </div>
                {p.verification_note && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {p.verification_note}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <Button
                    variant={p.is_verified ? "secondary" : "success"}
                    size="sm"
                    disabled={busy === "verify"}
                    onClick={() =>
                      void act("verify", () =>
                        setProfileVerified(profileId, !p.is_verified)
                      )
                    }
                  >
                    <BadgeCheck size={14} />
                    {p.is_verified ? "Unverify" : "Mark verified"}
                  </Button>
                </div>
              </Section>

              {/* Wallet */}
              <Section title="Wallet & premium" icon={Wallet}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs text-[var(--muted)]">Contact credits</p>
                    <p className="text-lg font-bold text-[var(--ink)]">
                      {wallet?.contact_credits ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs text-[var(--muted)]">Premium until</p>
                    <p className="text-sm font-semibold text-[var(--ink)]">
                      {isPremium ? fmtDate(wallet?.premium_until) : "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={premiumDays}
                      onChange={(e) => setPremiumDays(e.target.value)}
                      className="w-20 rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--maroon)]"
                    />
                    <span className="self-center text-xs text-[var(--muted)]">days</span>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={busy === "premium"}
                      onClick={() =>
                        void act("premium", () =>
                          grantPremium(profileId, Number(premiumDays) || 30)
                        )
                      }
                    >
                      <Crown size={14} /> Grant premium
                    </Button>
                    {isPremium && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy === "premium"}
                        onClick={() => void act("premium", () => revokePremium(profileId))}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      value={credits}
                      onChange={(e) => setCredits(e.target.value)}
                      className="w-20 rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--maroon)]"
                    />
                    <span className="self-center text-xs text-[var(--muted)]">credits</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy === "credits"}
                      onClick={() =>
                        void act("credits", () =>
                          setContactCredits(profileId, Number(credits) || 0)
                        )
                      }
                    >
                      Set credits
                    </Button>
                  </div>
                </div>
              </Section>

              {/* Contact */}
              <Section title="Contact" icon={Phone}>
                <div className="space-y-1.5 text-sm">
                  <Row label="Phone" value={p.phone} icon={Phone} />
                  <Row label="WhatsApp" value={p.whatsapp_number} icon={MessageCircle} />
                  <Row
                    label="Sharing opt-in"
                    value={p.phone_visible ? "Enabled" : "Off"}
                  />
                </div>
              </Section>

              {/* Profile */}
              <Section title="Profile" icon={Heart}>
                <div className="space-y-1.5 text-sm">
                  <Row label="Gender" value={p.gender} />
                  <Row label="DOB" value={fmtDate(p.date_of_birth)} icon={Calendar} />
                  <Row label="Profile for" value={p.profile_for} />
                  <Row label="Marital status" value={p.marital_status} />
                  <Row label="Community" value={p.community} />
                  <Row label="Mother tongue" value={p.mother_tongue} />
                  <Row label="Diet" value={p.diet} />
                  <Row label="Height" value={p.height_cm ? `${p.height_cm} cm` : null} />
                  <Row label="Location" value={[p.city, p.state].filter(Boolean).join(", ") || null} icon={MapPin} />
                  <Row label="Occupation" value={p.occupation} icon={Briefcase} />
                  <Row label="Education" value={p.education_level} icon={GraduationCap} />
                  <Row label="Salary" value={p.monthly_salary} icon={Wallet} />
                  <Row label="Mangal Dosh" value={p.mangal_dosh} icon={Sparkles} />
                  <Row label="Birth time" value={p.birth_time} icon={Calendar} />
                  <Row label="Birth place" value={p.birth_place} icon={MapPin} />
                </div>
                {p.bio && (
                  <p className="mt-3 rounded-lg bg-white p-3 text-sm text-[var(--ink)]">{p.bio}</p>
                )}
              </Section>

              {/* Moderation */}
              <Section title="Moderation" icon={Flag}>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs text-[var(--muted)]">Reports against</p>
                    <p className="text-lg font-bold text-red-600">
                      {p.reports_against_count ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs text-[var(--muted)]">Reports filed</p>
                    <p className="text-lg font-bold text-[var(--ink)]">
                      {p.reports_by_count ?? 0}
                    </p>
                  </div>
                </div>
                <Button
                  variant={isBanned ? "secondary" : "danger"}
                  size="sm"
                  disabled={busy === "ban"}
                  onClick={() => void act("ban", () => banUser(profileId, !isBanned))}
                >
                  <Ban size={14} />
                  {isBanned ? "Unban user" : "Ban user"}
                </Button>
                {isBanned && p.banned_until && (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Banned until {fmtDateTime(p.banned_until)}
                  </p>
                )}
              </Section>
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="photo"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
          />
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setLightbox(null)}
          >
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        {Icon && <Icon size={15} className="text-[var(--maroon)]" />}
        <h4 className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
          {title}
        </h4>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-white p-4">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-[var(--muted)]">
        {Icon && <Icon size={13} />}
        {label}
      </span>
      <span className="font-medium text-[var(--ink)]">
        {value == null || value === "" ? "—" : value}
      </span>
    </div>
  );
}
