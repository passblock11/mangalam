"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2 } from "lucide-react";
import {
  fetchAppSettings,
  fetchPaymentMethods,
  upsertPaymentMethod,
  deletePaymentMethod,
  updateAppSettings,
} from "../../settings-actions";
import { Badge, Button, Card, EmptyState } from "../shared";
import { useAdminLiveReload } from "../admin-live";

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

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const [m, s] = await Promise.all([fetchPaymentMethods(), fetchAppSettings()]);
    if (m.ok) setMethods(m.data);
    else if (!silent) setError(m.error);
    if (s.ok) setSettings(s.data);
    else if (!silent) setError(s.error);
    if (m.ok && s.ok && !silent) setError(null);
    if (!silent) setLoading(false);
  }
  useEffect(() => {
    void load(false);
  }, []);
  useAdminLiveReload("settings", () => {
    if (!editing && !saving) void load(true);
  });

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

      <ExternalModeSwitch settings={settings} onSaved={() => void load()} />

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Active method for collection
            </p>
            <p className="mt-1 text-sm font-bold text-[var(--ink)]">cashfree</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              The website and the phone collect with Cashfree. Production mode chooses its test or live keys.
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

      <RazorpayCredentials
        settings={settings}
        onSaved={() => void load()}
      />
      <CashfreeCredentials
        settings={settings}
        onSaved={() => void load()}
      />
    </div>
  );
}

function settingText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function explainSettingsError(error: string): string {
  if (/column|schema cache/i.test(error)) {
    return "Run supabase/migrations/0022_external_service_mode.sql in the behlr SQL editor once, then save again.";
  }
  return error;
}

function ExternalModeSwitch({
  settings,
  onSaved,
}: {
  settings: Record<string, any>;
  onSaved: () => void;
}) {
  const live = settings.integrations_live === true;
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function setLive(next: boolean) {
    if (saving || next === live) return;
    setSaving(true);
    setMsg(null);
    const res = await updateAppSettings({ integrations_live: next });
    setSaving(false);
    if (res.ok) {
      setMsg({
        kind: "ok",
        text: next
          ? "Production mode is on. Cashfree and Razorpay now use their live credentials."
          : "Production mode is off. Cashfree and Razorpay now use their test credentials.",
      });
      onSaved();
    } else {
      setMsg({ kind: "err", text: explainSettingsError(res.error) });
    }
  }

  return (
    <Card className={`p-4 ${live ? "border-[var(--maroon)]" : ""}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--ink)]">Production mode</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            One switch for every payment gateway. Off uses the test credentials below. On uses the live credentials.
            The website and the phone app ask the server on the next payment, so this applies without another app release.
          </p>
          <p className={`mt-2 text-xs font-semibold ${live ? "text-[var(--maroon)]" : "text-[var(--ink)]"}`}>
            {live ? "Live credentials are in use." : "Test credentials are in use."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={live}
          aria-label="Production mode"
          disabled={saving}
          onClick={() => void setLive(!live)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${live ? "bg-[var(--maroon)]" : "bg-zinc-300"}`}
        >
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${live ? "left-5" : "left-0.5"}`} />
        </button>
      </div>
      {msg && <StatusNote msg={msg} />}
    </Card>
  );
}

function StatusNote({ msg }: { msg: { kind: "ok" | "err"; text: string } }) {
  return (
    <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${msg.kind === "ok" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
      {msg.text}
    </div>
  );
}

function InUse({ on }: { on: boolean }) {
  if (!on) return null;
  return <Badge tone="green">In use</Badge>;
}

function RazorpayCredentials({
  settings,
  onSaved,
}: {
  settings: Record<string, any>;
  onSaved: () => void;
}) {
  const legacyId = settingText(settings.razorpay_key_id);
  const legacyLive = legacyId.startsWith("rzp_live_");
  const [testId, setTestId] = useState("");
  const [testSecret, setTestSecret] = useState("");
  const [testWebhook, setTestWebhook] = useState("");
  const [liveId, setLiveId] = useState("");
  const [liveSecret, setLiveSecret] = useState("");
  const [liveWebhook, setLiveWebhook] = useState("");
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const production = settings.integrations_live === true;

  useEffect(() => {
    setTestId(settingText(settings.razorpay_test_key_id) || (legacyLive ? "" : legacyId));
    setTestSecret(settingText(settings.razorpay_test_key_secret) || (legacyLive ? "" : settingText(settings.razorpay_key_secret)));
    setTestWebhook(settingText(settings.razorpay_test_webhook_secret) || (legacyLive ? "" : settingText(settings.razorpay_webhook_secret)));
    setLiveId(settingText(settings.razorpay_live_key_id) || (legacyLive ? legacyId : ""));
    setLiveSecret(settingText(settings.razorpay_live_key_secret) || (legacyLive ? settingText(settings.razorpay_key_secret) : ""));
    setLiveWebhook(settingText(settings.razorpay_live_webhook_secret) || (legacyLive ? settingText(settings.razorpay_webhook_secret) : ""));
  }, [
    settings.razorpay_test_key_id,
    settings.razorpay_test_key_secret,
    settings.razorpay_test_webhook_secret,
    settings.razorpay_live_key_id,
    settings.razorpay_live_key_secret,
    settings.razorpay_live_webhook_secret,
    settings.razorpay_key_id,
    settings.razorpay_key_secret,
    settings.razorpay_webhook_secret,
    legacyId,
    legacyLive,
  ]);

  const testReady = Boolean(testId.trim() && testSecret.trim());
  const liveReady = Boolean(liveId.trim() && liveSecret.trim());
  const testPartial = Boolean(testId.trim() || testSecret.trim()) && !testReady;
  const livePartial = Boolean(liveId.trim() || liveSecret.trim()) && !liveReady;

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await updateAppSettings({
      razorpay_test_key_id: testId.trim(),
      razorpay_test_key_secret: testSecret.trim(),
      razorpay_test_webhook_secret: testWebhook.trim(),
      razorpay_live_key_id: liveId.trim(),
      razorpay_live_key_secret: liveSecret.trim(),
      razorpay_live_webhook_secret: liveWebhook.trim(),
    });
    setSaving(false);
    if (res.ok) {
      setMsg({ kind: "ok", text: "Razorpay test and live credentials saved." });
      onSaved();
    } else {
      setMsg({ kind: "err", text: explainSettingsError(res.error) });
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-[var(--maroon)]">
          <KeyIcon />
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--ink)]">Razorpay API credentials</p>
          <p className="text-xs text-[var(--muted)]">
            Keep the test keys and the live keys here. The production switch above chooses which pair collects payments.
            Secrets stay on the server.
          </p>
        </div>
      </div>
      {msg && <StatusNote msg={msg} />}
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <CredentialGroup title="Test credentials" inUse={!production}>
          <TextField label="Key ID" value={testId} onChange={setTestId} placeholder="rzp_test_…" />
          <SecretField label="Key secret" value={testSecret} onChange={setTestSecret} shown={showSecrets} />
          <SecretField label="Webhook secret" value={testWebhook} onChange={setTestWebhook} shown={showSecrets} />
        </CredentialGroup>
        <CredentialGroup title="Live credentials" inUse={production}>
          <TextField label="Key ID" value={liveId} onChange={setLiveId} placeholder="rzp_live_…" />
          <SecretField label="Key secret" value={liveSecret} onChange={setLiveSecret} shown={showSecrets} />
          <SecretField label="Webhook secret" value={liveWebhook} onChange={setLiveWebhook} shown={showSecrets} />
        </CredentialGroup>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <Button size="sm" variant="ghost" type="button" onClick={() => setShowSecrets((v) => !v)}>
          {showSecrets ? "Hide secrets" : "Show secrets"}
        </Button>
        <Button size="sm" disabled={saving || testPartial || livePartial || (!testReady && !liveReady)} onClick={() => void save()}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save credentials
        </Button>
      </div>
    </Card>
  );
}

function CredentialGroup({
  title,
  inUse,
  children,
}: {
  title: string;
  inUse: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`space-y-3 rounded-xl border p-3 ${inUse ? "border-[var(--maroon)] bg-rose-50/40" : "border-[var(--border)]"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink)]">{title}</p>
        <InUse on={inUse} />
      </div>
      {children}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase text-[var(--muted)]">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 font-mono text-xs outline-none focus:border-[var(--maroon)]"
      />
    </label>
  );
}

function SecretField({
  label,
  value,
  onChange,
  shown,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  shown: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase text-[var(--muted)]">{label}</span>
      <input
        type={shown ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••••••"
        className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 font-mono text-xs outline-none focus:border-[var(--maroon)]"
      />
    </label>
  );
}

function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 2l-2 2m-7.5 7.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 0L15 6m-3.5 3.5L18 3" />
    </svg>
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

function CashfreeCredentials({
  settings,
  onSaved,
}: {
  settings: Record<string, any>;
  onSaved: () => void;
}) {
  const legacyProduction = settings.cashfree_environment === "production";
  const legacyId = settingText(settings.cashfree_client_id);
  const legacySecret = settingText(settings.cashfree_client_secret);
  const [sandboxId, setSandboxId] = useState("");
  const [sandboxSecret, setSandboxSecret] = useState("");
  const [liveId, setLiveId] = useState("");
  const [liveSecret, setLiveSecret] = useState("");
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const production = settings.integrations_live === true;
  const active = settings.active_payment_method === "cashfree";

  useEffect(() => {
    setSandboxId(settingText(settings.cashfree_sandbox_client_id) || (legacyProduction ? "" : legacyId));
    setSandboxSecret(settingText(settings.cashfree_sandbox_client_secret) || (legacyProduction ? "" : legacySecret));
    setLiveId(settingText(settings.cashfree_live_client_id) || (legacyProduction ? legacyId : ""));
    setLiveSecret(settingText(settings.cashfree_live_client_secret) || (legacyProduction ? legacySecret : ""));
  }, [
    settings.cashfree_sandbox_client_id,
    settings.cashfree_sandbox_client_secret,
    settings.cashfree_live_client_id,
    settings.cashfree_live_client_secret,
    settings.cashfree_client_id,
    settings.cashfree_client_secret,
    settings.cashfree_environment,
    legacyId,
    legacySecret,
    legacyProduction,
  ]);

  const sandboxReady = Boolean(sandboxId.trim() && sandboxSecret.trim());
  const liveReady = Boolean(liveId.trim() && liveSecret.trim());
  const sandboxPartial = Boolean(sandboxId.trim() || sandboxSecret.trim()) && !sandboxReady;
  const livePartial = Boolean(liveId.trim() || liveSecret.trim()) && !liveReady;
  const activePairReady = production ? liveReady : sandboxReady;

  async function save(activate: boolean) {
    setSaving(true);
    setMsg(null);
    const res = await updateAppSettings({
      cashfree_sandbox_client_id: sandboxId.trim(),
      cashfree_sandbox_client_secret: sandboxSecret.trim(),
      cashfree_live_client_id: liveId.trim(),
      cashfree_live_client_secret: liveSecret.trim(),
      active_payment_method: "cashfree",
    });
    setSaving(false);
    if (res.ok) {
      setMsg({
        kind: "ok",
        text: activate
          ? "Cashfree credentials saved. The website and the phone collect with the pair selected by production mode."
          : "Cashfree test and live credentials saved. The website and the phone use the pair selected by production mode.",
      });
      onSaved();
    } else {
      setMsg({ kind: "err", text: explainSettingsError(res.error) });
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3">
        <p className="text-sm font-bold text-[var(--ink)]">Cashfree</p>
        <p className="text-xs text-[var(--muted)]">
          Save the sandbox App ID and the live App ID separately. The production switch chooses which one is used.
          Webhook URL for both: https://mangalam-api.vercel.app/v1/payments/cashfree/webhook
        </p>
        <p className="mt-1 text-xs font-semibold text-[var(--ink)]">
          {active ? "Collecting payments with Cashfree." : "Cashfree is saved but not the active gateway."}
        </p>
      </div>
      {msg && <StatusNote msg={msg} />}
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <CredentialGroup title="Test credentials" inUse={!production}>
          <TextField label="App ID" value={sandboxId} onChange={setSandboxId} placeholder="Sandbox App ID" />
          <SecretField label="Secret key" value={sandboxSecret} onChange={setSandboxSecret} shown={showSecrets} />
        </CredentialGroup>
        <CredentialGroup title="Live credentials" inUse={production}>
          <TextField label="App ID" value={liveId} onChange={setLiveId} placeholder="Live App ID" />
          <SecretField label="Secret key" value={liveSecret} onChange={setLiveSecret} shown={showSecrets} />
        </CredentialGroup>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" variant="ghost" type="button" onClick={() => setShowSecrets((v) => !v)}>
          {showSecrets ? "Hide secrets" : "Show secrets"}
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={saving || sandboxPartial || livePartial || (!sandboxReady && !liveReady)} onClick={() => void save(false)}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save keys
          </Button>
          <Button size="sm" disabled={saving || sandboxPartial || livePartial || !activePairReady} onClick={() => void save(true)}>
            Save and collect with Cashfree
          </Button>
        </div>
      </div>
    </Card>
  );
}
