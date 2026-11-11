"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Loader2, Percent, IndianRupee } from "lucide-react";
import { fetchCoupons, upsertCoupon, deleteCoupon } from "../../settings-actions";
import { Badge, Button, Card, EmptyState, fmtDate } from "../shared";

type Coupon = {
  id: string;
  code: string;
  description: string;
  discount_type: string;
  discount_value: number;
  min_amount_paise: number;
  max_uses: number | null;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
};

export function CouponsSettings() {
  const [items, setItems] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetchCoupons();
    if (!res.ok) setError(res.error);
    else setItems(res.data);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function save(c: Coupon) {
    setSaving(true);
    setError(null);
    const res = await upsertCoupon({
      id: c.id || undefined,
      code: c.code,
      description: c.description,
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      min_amount_paise: c.min_amount_paise,
      max_uses: c.max_uses,
      valid_from: c.valid_from,
      valid_until: c.valid_until,
      is_active: c.is_active,
    });
    setSaving(false);
    if (!res.ok) setError(res.error);
    else {
      setEditing(null);
      await load();
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this coupon?")) return;
    const res = await deleteCoupon(id);
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
        <h3 className="text-sm font-bold text-[var(--ink)]">Coupons ({items.length})</h3>
        <Button
          size="sm"
          onClick={() =>
            setEditing({
              id: "",
              code: "",
              description: "",
              discount_type: "percent",
              discount_value: 10,
              min_amount_paise: 0,
              max_uses: null,
              used_count: 0,
              valid_from: null,
              valid_until: null,
              is_active: true,
            })
          }
        >
          <Plus size={14} /> Add coupon
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState>No coupons yet. Click &ldquo;Add coupon&rdquo;.</EmptyState>
      ) : (
        <div className="space-y-2">
          {items.map((c) => (
            <Card key={c.id} className="flex items-center justify-between p-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-mono font-bold text-[var(--ink)]">{c.code}</p>
                  {c.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {c.discount_type === "percent" ? (
                    <span className="inline-flex items-center gap-1"><Percent size={11} /> {c.discount_value}% off</span>
                  ) : (
                    <span className="inline-flex items-center gap-1"><IndianRupee size={11} /> {(c.discount_value / 100).toLocaleString("en-IN")} off</span>
                  )}
                  {c.max_uses != null && <> · {c.used_count}/{c.max_uses} used</>}
                  {c.valid_until && <> · until {fmtDate(c.valid_until)}</>}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => void remove(c.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <CouponEditor c={editing} onClose={() => setEditing(null)} onSave={(c) => void save(c)} saving={saving} />
      )}
    </div>
  );
}

function CouponEditor({
  c,
  onClose,
  onSave,
  saving,
}: {
  c: Coupon;
  onClose: () => void;
  onSave: (c: Coupon) => void;
  saving: boolean;
}) {
  const [v, setV] = useState<Coupon>(c);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg p-5">
        <h3 className="mb-4 text-base font-bold text-[var(--ink)]">
          {c.id ? "Edit coupon" : "Add coupon"}
        </h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <In label="Code" value={v.code} onChange={(x) => setV({ ...v, code: x })} mono />
            <Sel label="Discount type" value={v.discount_type} onChange={(x) => setV({ ...v, discount_type: x })} options={["percent", "flat"]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <In
              label={v.discount_type === "percent" ? "Discount (%)" : "Discount (₹)"}
              value={String(v.discount_type === "flat" ? v.discount_value / 100 : v.discount_value)}
              onChange={(x) => setV({ ...v, discount_value: v.discount_type === "flat" ? Math.round(Number(x) * 100) : Number(x) || 0 })}
              type="number"
            />
            <In label="Min amount (₹)" value={String(v.min_amount_paise / 100)} onChange={(x) => setV({ ...v, min_amount_paise: Math.round(Number(x) * 100) })} type="number" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <In label="Max uses (blank=unlimited)" value={v.max_uses == null ? "" : String(v.max_uses)} onChange={(x) => setV({ ...v, max_uses: x === "" ? null : Number(x) })} type="number" />
            <In label="Valid until (optional)" value={v.valid_until ? v.valid_until.slice(0, 10) : ""} onChange={(x) => setV({ ...v, valid_until: x ? new Date(x).toISOString() : null })} type="date" />
          </div>
          <In label="Description" value={v.description} onChange={(x) => setV({ ...v, description: x })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.is_active} onChange={(e) => setV({ ...v, is_active: e.target.checked })} />
            <span>Active</span>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={saving} onClick={() => onSave(v)}>
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
