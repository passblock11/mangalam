"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Loader2, FileText } from "lucide-react";
import { fetchLegalPagesAdmin, upsertLegalPage, deleteLegalPage } from "../../settings-actions";
import { Badge, Button, Card, EmptyState, fmtDate } from "../shared";

type Page = {
  id: string;
  slug: string;
  title: string;
  body: string;
  version: number;
  is_published: boolean;
  updated_at: string;
};

export function LegalSettings() {
  const [items, setItems] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Page | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetchLegalPagesAdmin();
    if (!res.ok) setError(res.error);
    else setItems(res.data);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function save(p: Page) {
    setSaving(true);
    setError(null);
    const res = await upsertLegalPage({
      id: p.id || undefined,
      slug: p.slug,
      title: p.title,
      body: p.body,
      is_published: p.is_published,
    });
    setSaving(false);
    if (!res.ok) setError(res.error);
    else {
      setEditing(null);
      await load();
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this legal page?")) return;
    const res = await deleteLegalPage(id);
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
        <h3 className="text-sm font-bold text-[var(--ink)]">Legal pages ({items.length})</h3>
        <Button
          size="sm"
          onClick={() =>
            setEditing({ id: "", slug: "", title: "", body: "", version: 1, is_published: true, updated_at: "" })
          }
        >
          <Plus size={14} /> Add page
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState>No legal pages. Click &ldquo;Add page&rdquo;.</EmptyState>
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <Card key={p.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-[var(--maroon)]">
                  <FileText size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[var(--ink)]">{p.title}</p>
                    {p.is_published ? <Badge tone="green">Published</Badge> : <Badge tone="neutral">Draft</Badge>}
                  </div>
                  <p className="font-mono text-xs text-[var(--muted)]">/{p.slug} · updated {fmtDate(p.updated_at)}</p>
                </div>
              </div>
              <div className="flex gap-2">
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
        <PageEditor p={editing} onClose={() => setEditing(null)} onSave={(p) => void save(p)} saving={saving} />
      )}
    </div>
  );
}

function PageEditor({
  p,
  onClose,
  onSave,
  saving,
}: {
  p: Page;
  onClose: () => void;
  onSave: (p: Page) => void;
  saving: boolean;
}) {
  const [v, setV] = useState<Page>(p);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col p-5">
        <h3 className="mb-4 text-base font-bold text-[var(--ink)]">
          {p.id ? "Edit page" : "Add legal page"}
        </h3>
        <div className="space-y-3 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase text-[var(--muted)]">Slug</span>
              <input
                type="text"
                value={v.slug}
                onChange={(e) => setV({ ...v, slug: e.target.value })}
                placeholder="privacy, terms, refund…"
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 font-mono text-xs outline-none focus:border-[var(--maroon)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase text-[var(--muted)]">Title</span>
              <input
                type="text"
                value={v.title}
                onChange={(e) => setV({ ...v, title: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--maroon)]"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-[var(--muted)]">
              Body (Markdown supported)
            </span>
            <textarea
              value={v.body}
              onChange={(e) => setV({ ...v, body: e.target.value })}
              rows={14}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 font-mono text-xs outline-none focus:border-[var(--maroon)]"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.is_published} onChange={(e) => setV({ ...v, is_published: e.target.checked })} />
            <span>Published (visible in app)</span>
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
