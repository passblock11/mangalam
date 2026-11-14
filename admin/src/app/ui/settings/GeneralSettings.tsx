"use client";

import { useEffect, useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { fetchAppSettings, updateAppSettings } from "../../settings-actions";
import { Button, Card } from "../shared";
import { useAdminLiveReload } from "../admin-live";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function GeneralSettings() {
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const res = await fetchAppSettings();
    if (!res.ok) {
      if (!silent) setError(res.error);
    } else {
      setData(res.data);
      if (!silent) setError(null);
    }
    if (!silent) setLoading(false);
  }
  useEffect(() => {
    void load(false);
  }, []);
  useAdminLiveReload("settings", () => void load(true));

  async function save() {
    setSaving(true);
    setError(null);
    setOk(false);
    const res = await updateAppSettings({
      app_name: data.app_name,
      tagline: data.tagline,
      support_email: data.support_email,
      support_phone: data.support_phone,
      support_whatsapp: data.support_whatsapp,
      currency: data.currency,
    });
    const credits = await updateAppSettings({
      phone_credit_cost: Math.max(0, Math.min(1000, Number(data.phone_credit_cost) || 0)),
      whatsapp_credit_cost: Math.max(0, Math.min(1000, Number(data.whatsapp_credit_cost) || 0)),
    });
    const messages = await updateAppSettings({
      message_credit_cost: Math.max(0, Math.min(1000, Number(data.message_credit_cost) || 0)),
      message_free_per_chat: Math.max(0, Math.min(1000, Number(data.message_free_per_chat) || 0)),
      message_charge_replies: data.message_charge_replies !== false,
    });
    const waiver = await updateAppSettings({
      female_membership_free: data.female_membership_free === true,
    });
    setSaving(false);
    if (!res.ok) setError(res.error);
    else if (!credits.ok) setError(credits.error ?? "Could not save credit costs. Run migration 0013 on the database.");
    else if (!messages.ok) {
      const message = messages.error ?? "Could not save message credits.";
      setError(
        /message_credit_cost|message_free_per_chat|message_charge_replies|column/i.test(message)
          ? `${message} Run supabase/migrations/0020_message_credits.sql in the behlr SQL editor.`
          : message
      );
    }
    else if (!waiver.ok) {
      const message = waiver.error ?? "Could not save the membership switch.";
      setError(
        message.includes("female_membership_free")
          ? `${message} Run supabase/migrations/0017_female_membership_free.sql in the behlr SQL editor.`
          : message
      );
    } else setOk(true);
  }

  if (loading && Object.keys(data).length === 0) return <p className="text-sm text-[var(--muted)]">Loading…</p>;

  return (
    <Card className="max-w-2xl p-5">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {ok && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Saved.
        </div>
      )}
      <div className="space-y-4">
        <Field label="App name" value={data.app_name ?? ""} onChange={(v) => setData({ ...data, app_name: v })} />
        <Field label="Tagline" value={data.tagline ?? ""} onChange={(v) => setData({ ...data, tagline: v })} />
        <p className="text-xs text-[var(--muted)]">
          The name, logo, splash, and login screen that members see are set in Appearance. These two fields stay with the other app settings.
        </p>
        <Field label="Support email" value={data.support_email ?? ""} onChange={(v) => setData({ ...data, support_email: v })} />
        <Field label="Support phone" value={data.support_phone ?? ""} onChange={(v) => setData({ ...data, support_phone: v })} />
        <Field label="Support WhatsApp" value={data.support_whatsapp ?? ""} onChange={(v) => setData({ ...data, support_whatsapp: v })} />
        <Field label="Currency" value={data.currency ?? "INR"} onChange={(v) => setData({ ...data, currency: v })} />
        <Field
          label="Credits per phone view"
          value={String(data.phone_credit_cost ?? 1)}
          onChange={(v) => setData({ ...data, phone_credit_cost: v.replace(/[^\d]/g, "") })}
        />
        <Field
          label="Credits per WhatsApp view"
          value={String(data.whatsapp_credit_cost ?? 1)}
          onChange={(v) => setData({ ...data, whatsapp_credit_cost: v.replace(/[^\d]/g, "") })}
        />
        <p className="text-xs text-[var(--muted)]">
          A paid, verified member spends this many contact credits the first time they open that number. Email is never shown. If the member has turned phone sharing off, no credits are spent and others must ask in chat.
        </p>
        <Field
          label="Credits per message"
          value={String(data.message_credit_cost ?? 1)}
          onChange={(v) => setData({ ...data, message_credit_cost: v.replace(/[^\d]/g, "") })}
        />
        <Field
          label="Free messages in each chat"
          value={String(data.message_free_per_chat ?? 0)}
          onChange={(v) => setData({ ...data, message_free_per_chat: v.replace(/[^\d]/g, "") })}
        />
        <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] px-3 py-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={data.message_charge_replies !== false}
            onChange={(e) => setData({ ...data, message_charge_replies: e.target.checked })}
          />
          <span>
            <span className="block text-sm font-semibold text-[var(--ink)]">
              Charge replies too
            </span>
            <span className="mt-1 block text-xs text-[var(--muted)]">
              On: every message from either person spends credits, after their free messages in that chat. Off: only the person who sent the first message is charged. The other person can reply without credits.
            </span>
          </span>
        </label>
        <p className="text-xs text-[var(--muted)]">
          Set credits per message to 0 to keep chat free. Free messages are counted per member, per chat, and are not given back if a message is deleted. Editing a message does not cost again. The balance is the same contact-credit wallet members buy or receive with a membership.
        </p>
        <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] px-3 py-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={data.female_membership_free === true}
            onChange={(e) => setData({ ...data, female_membership_free: e.target.checked })}
          />
          <span>
            <span className="block text-sm font-semibold text-[var(--ink)]">
              Women use the app without a membership
            </span>
            <span className="mt-1 block text-xs text-[var(--muted)]">
              Turn this on to let women use the app without a subscription or contact credits. They can view phone and WhatsApp numbers and send messages with a zero balance. Verification and photos still apply. Turn it off any time to ask women for a membership and credits again. Men are unchanged.
            </span>
          </span>
        </label>
      </div>
      <div className="mt-5">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save changes
        </Button>
      </div>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--maroon)]"
      />
    </label>
  );
}
