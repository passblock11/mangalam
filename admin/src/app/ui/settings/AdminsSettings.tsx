"use client";

import { useEffect, useState } from "react";
import { Shield, ShieldOff, Loader2, Crown, UserPlus, Lock, Mail, User } from "lucide-react";
import {
  fetchAdminAccounts,
  createAdminAccount,
  updateAdminAccount,
  deleteAdminAccount,
  type AdminAccount,
} from "../../settings-actions";
import {
  ADMIN_FEATURES,
  ADMIN_FEATURE_LABELS,
  type AdminSession,
  type AdminFeature,
} from "@/lib/admin-session";
import { Avatar, Badge, Button, Card, EmptyState, Modal } from "../shared";
import { useAdminLiveReload } from "../admin-live";

export function AdminsSettings({ session }: { session: AdminSession }) {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editFor, setEditFor] = useState<AdminAccount | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const res = await fetchAdminAccounts();
    if (!res.ok) {
      if (!silent) setError(res.error);
    } else {
      setAdmins(res.data);
      if (!silent) setError(null);
    }
    if (!silent) setLoading(false);
  }
  useEffect(() => {
    void load(false);
  }, []);
  useAdminLiveReload("settings", () => {
    if (!showCreate && !editFor && !busy) void load(true);
  });

  async function toggleActive(a: AdminAccount) {
    setBusy(a.id);
    const res = await updateAdminAccount(a.id, { is_active: !a.is_active });
    setBusy(null);
    if (!res.ok) setError(res.error);
    else await load();
  }

  async function remove(a: AdminAccount) {
    if (!confirm(`Delete admin ${a.email}? This cannot be undone.`)) return;
    setBusy(a.id);
    const res = await deleteAdminAccount(a.id);
    setBusy(null);
    if (!res.ok) setError(res.error);
    else await load();
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown size={16} className="text-[var(--gold)]" />
            <h3 className="text-sm font-bold text-[var(--ink)]">
              Admin accounts ({admins.length})
            </h3>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <UserPlus size={14} /> New admin
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : admins.length === 0 ? (
          <EmptyState>No admins.</EmptyState>
        ) : (
          <div className="space-y-2">
            {admins.map((a) => {
              const isSelf = a.id === session.id;
              return (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-zinc-50 px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={a.full_name ?? a.email} size={38} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-[var(--ink)]">
                          {a.full_name ?? a.email}
                        </p>
                        {a.is_super_admin && (
                          <Badge tone="gold">
                            <Crown size={11} /> Super
                          </Badge>
                        )}
                        {!a.is_active && <Badge tone="red">Disabled</Badge>}
                        {isSelf && <Badge tone="neutral">You</Badge>}
                      </div>
                      <p className="text-xs text-[var(--muted)]">{a.email}</p>
                      {!a.is_super_admin && (
                        <p className="mt-1 text-[11px] text-[var(--muted)]">
                          {ADMIN_FEATURES.filter((f) => a.permissions?.[f]).length} features
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy === a.id || isSelf}
                      onClick={() => setEditFor(a)}
                    >
                      Edit
                    </Button>
                    {!a.is_super_admin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === a.id || isSelf}
                        onClick={() => void toggleActive(a)}
                      >
                        {a.is_active ? (
                          <>
                            <ShieldOff size={14} /> Disable
                          </>
                        ) : (
                          <>
                            <Shield size={14} /> Enable
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy === a.id || isSelf}
                      onClick={() => void remove(a)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {showCreate && (
        <AdminForm
          session={session}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            void load();
          }}
        />
      )}

      {editFor && (
        <AdminForm
          session={session}
          existing={editFor}
          onClose={() => setEditFor(null)}
          onSaved={() => {
            setEditFor(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function AdminForm({
  session,
  existing,
  onClose,
  onSaved,
}: {
  session: AdminSession;
  existing?: AdminAccount;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isCreate = !existing;
  const [email, setEmail] = useState(existing?.email ?? "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(existing?.full_name ?? "");
  const [permissions, setPermissions] = useState<Partial<Record<AdminFeature, boolean>>>(
    existing?.permissions ?? {}
  );
  const [isSuperAdmin, setIsSuperAdmin] = useState(existing?.is_super_admin ?? false);
  const [isActive, setIsActive] = useState(existing?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canGrantSuper = session.is_super_admin;
  const features = ADMIN_FEATURES;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    if (isCreate) {
      if (!email.trim() || !password) {
        setSaving(false);
        setError("Email and password are required.");
        return;
      }
      if (password.length < 8) {
        setSaving(false);
        setError("Password must be at least 8 characters.");
        return;
      }
      const res = await createAdminAccount({
        email: email.trim(),
        password,
        full_name: fullName.trim() || undefined,
        permissions,
        is_super_admin: isSuperAdmin,
      });
      setSaving(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved();
    } else {
      if (!existing) return;
      const patch: {
        full_name?: string;
        permissions?: Partial<Record<AdminFeature, boolean>>;
        is_active?: boolean;
        is_super_admin?: boolean;
        password?: string;
      } = {};
      if ((fullName.trim() || null) !== existing.full_name) patch.full_name = fullName.trim();
      if (JSON.stringify(permissions) !== JSON.stringify(existing.permissions))
        patch.permissions = permissions;
      if (isActive !== existing.is_active) patch.is_active = isActive;
      if (isSuperAdmin !== existing.is_super_admin) patch.is_super_admin = isSuperAdmin;
      if (password) {
        if (password.length < 8) {
          setSaving(false);
          setError("Password must be at least 8 characters.");
          return;
        }
        patch.password = password;
      }
      if (Object.keys(patch).length === 0) {
        setSaving(false);
        onClose();
        return;
      }
      const res = await updateAdminAccount(existing.id, patch);
      setSaving(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved();
    }
  }

  return (
    <Modal open onClose={onClose} title={isCreate ? "Create admin account" : `Edit ${existing?.email}`}>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        {isCreate && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Email
            </span>
            <div className="relative">
              <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--border)] bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--maroon)]"
              />
            </div>
          </label>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Full name
          </span>
          <div className="relative">
            <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-[var(--border)] bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--maroon)]"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {isCreate ? "Password (min 8 chars)" : "Reset password (leave blank to keep)"}
          </span>
          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isCreate ? "At least 8 characters" : "New password"}
              className="w-full rounded-lg border border-[var(--border)] bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--maroon)]"
            />
          </div>
        </label>

        <div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Feature permissions
          </span>
          <p className="mb-2 text-xs text-[var(--muted)]">
            Only checked features will be available to this admin. Super admins bypass all checks.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {features.map((f) => {
              const checked = isSuperAdmin || permissions[f] === true;
              return (
                <label
                  key={f}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    isSuperAdmin
                      ? "border-zinc-200 bg-zinc-50 text-[var(--muted)]"
                      : "border-[var(--border)] bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isSuperAdmin}
                    onChange={(e) =>
                      setPermissions((p) => ({ ...p, [f]: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-[var(--border)] accent-[var(--maroon)]"
                  />
                  <span className="font-medium text-[var(--ink)]">
                    {ADMIN_FEATURE_LABELS[f]}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {canGrantSuper && (
          <label className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={isSuperAdmin}
              onChange={(e) => setIsSuperAdmin(e.target.checked)}
              className="h-4 w-4 rounded border-amber-300 accent-amber-600"
            />
            <span className="font-semibold text-amber-800">
              Super admin (full access, can manage other admins)
            </span>
          </label>
        )}

        {!isCreate && (
          <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--maroon)]"
            />
            <span className="font-medium text-[var(--ink)]">Account active</span>
          </label>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {isCreate ? "Create admin" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
