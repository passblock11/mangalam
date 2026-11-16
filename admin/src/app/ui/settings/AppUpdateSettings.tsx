"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { fetchAppSettings, updateAppRelease } from "../../settings-actions";
import { Button, Card } from "../shared";
import { useAdminLiveReload } from "../admin-live";

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.mangalam.matrimony";

type ReleaseForm = {
  force_update_enabled: boolean;
  android_min_version_code: string;
  android_latest_version_name: string;
  force_update_title: string;
  force_update_message: string;
  play_store_url: string;
  confirm_live: boolean;
};

const EMPTY: ReleaseForm = {
  force_update_enabled: false,
  android_min_version_code: "0",
  android_latest_version_name: "",
  force_update_title: "Update Mangalam",
  force_update_message: "A new version of Mangalam is required to continue.",
  play_store_url: PLAY_STORE_URL,
  confirm_live: false,
};

function fromRow(row: Record<string, unknown>): ReleaseForm {
  return {
    force_update_enabled: row.force_update_enabled === true,
    android_min_version_code: String(row.android_min_version_code ?? 0),
    android_latest_version_name: String(row.android_latest_version_name ?? ""),
    force_update_title: String(row.force_update_title ?? EMPTY.force_update_title),
    force_update_message: String(row.force_update_message ?? EMPTY.force_update_message),
    play_store_url: String(row.play_store_url ?? PLAY_STORE_URL),
    confirm_live: row.force_update_enabled === true,
  };
}

export function AppUpdateSettings() {
  const [form, setForm] = useState<ReleaseForm>(EMPTY);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const res = await fetchAppSettings();
    if (!res.ok) {
      if (!silent) setError(res.error ?? "Could not load app update settings.");
    } else {
      const row = res.data;
      const columnsMissing = !("force_update_enabled" in row);
      setMissing(columnsMissing);
      if (!columnsMissing) setForm(fromRow(row));
      if (!silent) setError(null);
    }
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    void load(false);
  }, []);
  useAdminLiveReload("settings", () => void load(true));

  function set<K extends keyof ReleaseForm>(key: K, value: ReleaseForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setOk(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setOk(false);
    const res = await updateAppRelease({
      force_update_enabled: form.force_update_enabled,
      android_min_version_code: Number(form.android_min_version_code),
      android_latest_version_name: form.android_latest_version_name,
      force_update_title: form.force_update_title,
      force_update_message: form.force_update_message,
      play_store_url: form.play_store_url,
      confirm_live: form.confirm_live,
    });
    setSaving(false);
    if (!res.ok) setError(res.error ?? "Could not save.");
    else setOk(true);
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading…</p>;

  if (missing) {
    return (
      <Card className="p-5">
        <h3 className="text-base font-semibold text-[var(--ink)]">App update</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Run supabase/migrations/0023_app_release_and_presence.sql in the behlr SQL editor, then reload this page.
        </p>
      </Card>
    );
  }

  const code = Math.floor(Number(form.android_min_version_code));
  const canSave = !form.force_update_enabled || (form.confirm_live && code >= 1);

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <div>
          <h3 className="text-base font-semibold text-[var(--ink)]">Mandatory Android update</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            This is the only place that can block the Android app. While the switch is off, every install keeps working.
            Turn it on only after that version code is already available on Google Play. Builds older than the minimum
            see a screen with a single Update button and cannot continue. The website is not blocked.
          </p>
        </div>

        <label className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] px-4 py-3">
          <span>
            <span className="block text-sm font-semibold text-[var(--ink)]">Require update</span>
            <span className="block text-xs text-[var(--muted)]">
              {form.force_update_enabled
                ? `Android builds below version code ${Number.isInteger(code) ? code : "—"} are blocked.`
                : "Update is not required."}
            </span>
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--maroon)]"
            checked={form.force_update_enabled}
            onChange={(event) => {
              set("force_update_enabled", event.target.checked);
              if (!event.target.checked) set("confirm_live", false);
            }}
          />
        </label>

        <label className="block text-sm">
          <span className="font-semibold text-[var(--ink)]">Minimum Android version code</span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            The number after + in the app version. 1.0.0+3 means version code 3. Do not enter a code that is not on Play yet.
          </span>
          <input
            inputMode="numeric"
            className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-2"
            value={form.android_min_version_code}
            onChange={(event) => set("android_min_version_code", event.target.value.replace(/[^\d]/g, ""))}
          />
        </label>

        <label className="block text-sm">
          <span className="font-semibold text-[var(--ink)]">Version name shown to you</span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">Optional. For example 1.0.0. Members do not see this as a version picker.</span>
          <input
            className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-2"
            value={form.android_latest_version_name}
            maxLength={32}
            placeholder="1.0.0"
            onChange={(event) => set("android_latest_version_name", event.target.value)}
          />
        </label>

        <label className="block text-sm">
          <span className="font-semibold text-[var(--ink)]">Title</span>
          <input
            className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-2"
            value={form.force_update_title}
            maxLength={80}
            onChange={(event) => set("force_update_title", event.target.value)}
          />
        </label>

        <label className="block text-sm">
          <span className="font-semibold text-[var(--ink)]">Message</span>
          <textarea
            className="mt-2 min-h-24 w-full rounded-xl border border-[var(--border)] px-3 py-2"
            value={form.force_update_message}
            maxLength={400}
            onChange={(event) => set("force_update_message", event.target.value)}
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">{form.force_update_message.trim().length}/400</span>
        </label>

        <label className="block text-sm">
          <span className="font-semibold text-[var(--ink)]">Play Store link</span>
          <input
            className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-2"
            value={form.play_store_url}
            maxLength={300}
            onChange={(event) => set("play_store_url", event.target.value)}
          />
        </label>

        {form.force_update_enabled ? (
          <label className="flex items-start gap-3 rounded-xl bg-[#fff8f3] px-4 py-3 text-sm leading-6 text-[var(--ink)]">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[var(--maroon)]"
              checked={form.confirm_live}
              onChange={(event) => set("confirm_live", event.target.checked)}
            />
            <span>
              This version is already available on Google Play. Members on an older build will be blocked until they update.
            </span>
          </label>
        ) : null}

        <div className="rounded-2xl border border-[#e8ddcf] bg-[#fff8f3] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">What the phone will show</p>
          <p className="mt-2 text-base font-semibold text-[var(--ink)]">{form.force_update_title.trim() || "Update Mangalam"}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{form.force_update_message.trim()}</p>
          <p className="mt-3 inline-flex rounded-full bg-[var(--maroon)] px-4 py-2 text-sm font-semibold text-white">Update</p>
        </div>

        {error ? <p className="text-sm text-[var(--maroon)]">{error}</p> : null}
        {ok ? <p className="text-sm text-green-700">Saved. Phones pick this up the next time they open or return to the app.</p> : null}

        <Button onClick={() => void save()} disabled={saving || !canSave}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {form.force_update_enabled ? "Save and require this update" : "Save"}
        </Button>
      </Card>
    </div>
  );
}
