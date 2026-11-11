"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2 } from "lucide-react";
import {
  fetchAppSettings,
  fetchPaymentMethods,
  upsertPaymentMethod,
  deletePaymentMethod,
} from "../../settings-actions";
import { Badge, Button, Card, EmptyState } from "../shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PROVIDERS = ["razorpay", "upi", "manual", "stripe", "cashfree"];

type Method = {
  id: string;
  provider: string;
  display_name: string;
  config: Record<string, any>;
  is_active: boolean;
  sort_order: number;
};

export function PaymentSettings() {
  const [methods, setMethods] = useState<Method[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Method | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const [m, s] = await Promise.all([fetchPaymentMethods(), fetchAppSettings()]);
    if (m.ok) setMethods(m.data);
    else setError(m.error);
    if (s.ok) setSettings(s.data);
    else setError(s.error);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function save(method: Method) {
    setSaving(true);
    setError(null);
    const res = await upsertPaymentMethod({
      id: method.id || undefined,
      provider: method.provider,
      display_name: method.display_name,
      config: method.config,
      is_active: method.is_active,
      sort_order: method.sort_order,
    });
    setSaving(false);
    if (!res.ok) setError(res.error);
    else {
      setEditing(null);
      await load();
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this payment method?")) return;
    const res = await deletePaymentMethod(id);
    if (!res.ok) setError(res.error);
    else await load();
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading…</p>;

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Active method for collection
            </p>
            <p className="mt-1 text-sm font-bold text-[var(--ink)]">
              {settings.active_payment_method ?? "—"}
            </p>
          </div>
          <Badge tone="amber">Only one active at a time</Badge>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--ink)]">Configured methods</h3>
        <Button
          size="sm"
          onClick={() =>
            setEditing({
              id: "",
              provider: "razorpay",
              display_name: "",
              config: {},
              is_active: false,
              sort_order: methods.length,
            })
          }
        >
          <Plus size={14} /> Add method
        </Button>
      </div>

      {methods.length === 0 ? (
        <EmptyState>No payment methods configured. Click &ldquo;Add method&rdquo;.</EmptyState>
      ) : (
        <div className="space-y-2">
          {methods.map((m) => (
            <Card key={m.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-[var(--maroon)]">
                  <CreditCardIcon />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[var(--ink)]">{m.display_name || m.provider}</p>
                    {m.is_active && (
                      <Badge tone="green">
                        <CheckCircle2 size={11} /> Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    {m.provider} · order {m.sort_order}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing(m)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void remove(m.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <MethodEditor
          method={editing}
          onClose={() => setEditing(null)}
          onSave={(m) => void save(m)}
          saving={saving}
        />
      )}
    </div>
  );
}

function CreditCardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

function MethodEditor({
  method,
  onClose,
  onSave,
  saving,
}: {
  method: Method;
  onClose: () => void;
  onSave: (m: Method) => void;
  saving: boolean;
}) {
  const [m, setM] = useState<Method>(method);
  const [configText, setConfigText] = useState(JSON.stringify(method.config ?? {}, null, 2));

  function apply() {
    let cfg: Record<string, any> = {};
    try {
      cfg = JSON.parse(configText || "{}");
    } catch {
      alert("Config JSON is invalid");
      return;
    }
    onSave({ ...m, config: cfg });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg p-5">
        <h3 className="mb-4 text-base font-bold text-[var(--ink)]">
          {method.id ? "Edit method" : "Add payment method"}
        </h3>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-[var(--muted)]">Provider</span>
            <select
              value={m.provider}
              onChange={(e) => setM({ ...m, provider: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--maroon)]"
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-[var(--muted)]">Display name</span>
            <input
              type="text"
              value={m.display_name}
              onChange={(e) => setM({ ...m, display_name: e.target.value })}
              placeholder="e.g. Razorpay, UPI, Bank Transfer"
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--maroon)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-[var(--muted)]">Sort order</span>
            <input
              type="number"
              value={m.sort_order}
              onChange={(e) => setM({ ...m, sort_order: Number(e.target.value) })}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--maroon)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-[var(--muted)]">
              Config (JSON) — public keys only (e.g. key_id). Never put secrets here.
            </span>
            <textarea
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 font-mono text-xs outline-none focus:border-[var(--maroon)]"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={m.is_active}
              onChange={(e) => setM({ ...m, is_active: e.target.checked })}
            />
            <span>Set as active method for collection (deactivates others)</span>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={saving} onClick={apply}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </Button>
        </div>
      </Card>
    </div>
  );
}
