"use client";

import { useEffect, useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { fetchAppSettings, updateAppSettings } from "../../settings-actions";
import { Button, Card } from "../shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function GeneralSettings() {
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetchAppSettings();
    if (!res.ok) setError(res.error);
    else setData(res.data);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

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
    setSaving(false);
    if (!res.ok) setError(res.error);
    else setOk(true);
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading…</p>;

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
        <Field label="Support email" value={data.support_email ?? ""} onChange={(v) => setData({ ...data, support_email: v })} />
        <Field label="Support phone" value={data.support_phone ?? ""} onChange={(v) => setData({ ...data, support_phone: v })} />
        <Field label="Support WhatsApp" value={data.support_whatsapp ?? ""} onChange={(v) => setData({ ...data, support_whatsapp: v })} />
        <Field label="Currency" value={data.currency ?? "INR"} onChange={(v) => setData({ ...data, currency: v })} />
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
