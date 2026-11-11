"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Loader2, Crown, Coins, Zap } from "lucide-react";
import { fetchPlansAdmin, upsertPlan, deletePlan } from "../../settings-actions";
import { Badge, Button, Card, EmptyState } from "../shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string;
  plan_type: string;
  price_paise: number;
  credits: number;
  duration_days: number | null;
  is_active: boolean;
  sort_order: number;
};

export function PlansSettings() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetchPlansAdmin();
    if (!res.ok) setError(res.error);
    else setPlans(res.data);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function save(p: Plan) {
    setSaving(true);
    setError(null);
    const res = await upsertPlan({
      id: p.id || undefined,
      code: p.code,
      name: p.name,
      description: p.description,
      plan_type: p.plan_type,
      price_paise: p.price_paise,
      credits: p.credits,
      duration_days: p.duration_days,
      is_active: p.is_active,
      sort_order: p.sort_order,
    });
    setSaving(false);
    if (!res.ok) setError(res.error);
    else {
      setEditing(null);
      await load();
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this plan?")) return;
    const res = await deletePlan(id);
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

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--ink)]">Plans ({plans.length})</h3>
        <Button
          size="sm"
          onClick={() =>
            setEditing({
              id: "",
              code: "",
              name: "",
              description: "",
              plan_type: "subscription",
              price_paise: 0,
              credits: 0,
              duration_days: 30,
              is_active: true,
              sort_order: plans.length,
            })
          }
        >
          <Plus size={14} /> Add plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <EmptyState>No plans yet. Click &ldquo;Add plan&rdquo;.</EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {plans.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <TypeIcon type={p.plan_type} />
                    <p className="font-semibold text-[var(--ink)]">{p.name}</p>
                    {!p.is_active && <Badge tone="neutral">Hidden</Badge>}
                  </div>
                  <p className="mt-1 font-mono text-xs text-[var(--muted)]">{p.code}</p>
                </div>
                <p className="text-lg font-extrabold text-[var(--maroon)]">
                  ₹{(p.price_paise / 100).toLocaleString("en-IN")}
                </p>
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {p.plan_type === "subscription"
                  ? `Premium for ${p.duration_days ?? 0} days`
                  : p.plan_type === "credits"
                    ? `${p.credits} contact credits`
                    : "One-time purchase"}
              </p>
              {p.description && (
                <p className="mt-2 text-xs text-[var(--ink)]">{p.description}</p>
              )}
              <div className="mt-3 flex gap-2 border-t border-[var(--border)] pt-3">
                <Button size="sm" variant="secondary" onClick={() => setEditing(p)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => void remove(p.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <PlanEditor plan={editing} onClose={() => setEditing(null)} onSave={(p) => void save(p)} saving={saving} />
      )}
    </div>
  );
}

function TypeIcon({ type }: { type: string }) {
  const Icon = type === "subscription" ? Crown : type === "credits" ? Coins : Zap;
  return <Icon size={16} className="text-[var(--gold)]" />;
}

function PlanEditor({
  plan,
  onClose,
  onSave,
  saving,
}: {
  plan: Plan;
  onClose: () => void;
  onSave: (p: Plan) => void;
  saving: boolean;
}) {
  const [p, setP] = useState<Plan>(plan);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg p-5">
        <h3 className="mb-4 text-base font-bold text-[var(--ink)]">
          {plan.id ? "Edit plan" : "Add plan"}
        </h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <In label="Code" value={p.code} onChange={(v) => setP({ ...p, code: v })} mono />
            <In label="Name" value={p.name} onChange={(v) => setP({ ...p, name: v })} />
          </div>
          <Sel
            label="Plan type"
            value={p.plan_type}
            onChange={(v) => setP({ ...p, plan_type: v })}
            options={["subscription", "one_time", "credits"]}
          />
          <div className="grid grid-cols-3 gap-3">
            <In label="Price (₹)" value={String(p.price_paise / 100)} onChange={(v) => setP({ ...p, price_paise: Math.round(Number(v) * 100) })} type="number" />
            <In label="Credits" value={String(p.credits)} onChange={(v) => setP({ ...p, credits: Number(v) || 0 })} type="number" />
            <In label="Duration (days)" value={String(p.duration_days ?? 0)} onChange={(v) => setP({ ...p, duration_days: v ? Number(v) : null })} type="number" />
          </div>
          <In label="Description" value={p.description} onChange={(v) => setP({ ...p, description: v })} />
          <div className="grid grid-cols-2 gap-3">
            <In label="Sort order" value={String(p.sort_order)} onChange={(v) => setP({ ...p, sort_order: Number(v) || 0 })} type="number" />
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" checked={p.is_active} onChange={(e) => setP({ ...p, is_active: e.target.checked })} />
              <span>Active (visible in app)</span>
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={saving} onClick={() => onSave(p)}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </Button>
        </div>
      </Card>
    </div>
  );
}

function In({
  label,
  value,
  onChange,
  type = "text",
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase text-[var(--muted)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--maroon)] ${mono ? "font-mono text-xs" : ""}`}
      />
    </label>
  );
}

function Sel({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase text-[var(--muted)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--maroon)]"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
