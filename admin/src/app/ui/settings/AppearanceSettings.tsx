"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ImagePlus, Loader2, Save, Trash2 } from "lucide-react";
import { fetchAppSettings, saveAppBranding, uploadBrandingImage } from "../../settings-actions";
import { ImageCropDialog } from "../ImageCropDialog";
import { BUILTIN_BRAND, emptyBrandCustom, type BrandCustom } from "./brand";
import { Button, Card } from "../shared";
import { useAdminLiveReload } from "../admin-live";

type Active = "default" | "custom";
type CropSlot = "logo" | "splash" | "login";

const CROP_ASPECT: Record<CropSlot, number> = {
  logo: 1,
  splash: 9 / 16,
  login: 3 / 4,
};

export function AppearanceSettings() {
  const [active, setActive] = useState<Active>("default");
  const [custom, setCustom] = useState<BrandCustom>(emptyBrandCustom());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState<{
    slot: CropSlot;
    file: File;
    apply: (url: string) => void;
  } | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const res = await fetchAppSettings();
    if (!res.ok) {
      if (!silent) setError(res.error);
      if (!silent) setLoading(false);
      return;
    }
    const branding = (res.data as { branding?: { active?: string; custom?: Partial<BrandCustom> } }).branding;
    if (branding && typeof branding === "object") {
      setActive(branding.active === "custom" ? "custom" : "default");
      setCustom(mergeCustom(branding.custom));
    }
    if (!silent) setError(null);
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    void load(false);
  }, []);
  useAdminLiveReload("settings", () => {
    if (!saving && !uploading && !pending) void load(true);
  });

  async function save() {
    setSaving(true);
    setError(null);
    setOk(false);
    const res = await saveAppBranding({ active, custom });
    setSaving(false);
    if (!res.ok) setError(res.error);
    else setOk(true);
  }

  function openCrop(slot: CropSlot, file: File | undefined, apply: (url: string) => void) {
    if (!file) return;
    setError(null);
    setOk(false);
    setPending({ slot, file, apply });
  }

  async function upload(slot: string, file: File | undefined, apply: (url: string) => void) {
    if (!file) return;
    setUploading(slot);
    setError(null);
    setOk(false);
    const body = new FormData();
    body.set("file", file);
    const res = await uploadBrandingImage(body);
    setUploading(null);
    if (!res.ok) setError(res.error);
    else apply(res.data.url);
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading…</p>;

  const splashName = custom.app_name.trim() || BUILTIN_BRAND.app_name;
  const splashLine = custom.tagline.trim() || BUILTIN_BRAND.tagline;
  const loginPhoto = custom.login.background_images[0];
  const usingCustom = active === "custom";

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Saved. Fully restart the app. The name and logo show on the splash and login screen. The name under the phone icon is Mangalam and changes only when a new build is installed. The home screen icon stays the one built into the app.
        </div>
      )}

      <Card className="p-5">
        <h3 className="text-sm font-bold text-[var(--ink)]">Which design is live</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          The current Mangalam splash and login screen stay saved. You can switch back to them at any time. Sign-in, payments, and the rest of the app are unchanged.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Choice
            selected={!usingCustom}
            title="Current Mangalam design"
            body="Maroon splash, gold heart, mandala login. This is the design already in the app."
            onClick={() => setActive("default")}
          />
          <Choice
            selected={usingCustom}
            title="Custom"
            body="Your name, logo, colours, animation, and login photos. Empty text keeps the current wording."
            onClick={() => setActive("custom")}
          />
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          <Card className="space-y-4 p-5">
            <h3 className="text-sm font-bold text-[var(--ink)]">App name and logo</h3>
            <p className="text-xs text-[var(--muted)]">
              These apply on the splash and login screen after you save and fully restart the app, including while Current Mangalam design is selected. An empty name keeps Mangalam. An empty logo keeps the heart. The icon on the phone home screen cannot be replaced from here.
            </p>
            <Field label="App name" value={custom.app_name} placeholder="Mangalam" onChange={(v) => setCustom({ ...custom, app_name: v })} />
            <Field label="Tagline" value={custom.tagline} placeholder="Find your perfect match" onChange={(v) => setCustom({ ...custom, tagline: v })} />
            <ImageSlot
              label="Logo"
              hint="Square PNG or JPG. Shown on the splash and login screen. Leave empty to keep the heart."
              url={custom.logo_url}
              busy={uploading === "logo"}
              onPick={(file) => openCrop("logo", file, (url) => setCustom({ ...custom, logo_url: url }))}
              onClear={() => setCustom({ ...custom, logo_url: null })}
            />
          </Card>

          <Card className="space-y-4 p-5">
            <h3 className="text-sm font-bold text-[var(--ink)]">Splash screen</h3>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Animation</span>
              <select
                value={custom.splash.animation}
                onChange={(e) =>
                  setCustom({
                    ...custom,
                    splash: { ...custom.splash, animation: e.target.value as BrandCustom["splash"]["animation"] },
                  })
                }
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--maroon)]"
              >
                <option value="scale_fade">Scale and fade (current)</option>
                <option value="fade">Fade in</option>
                <option value="rise">Rise and fade</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                How long it stays ({(custom.splash.duration_ms / 1000).toFixed(1)}s)
              </span>
              <input
                type="range"
                min={1500}
                max={8000}
                step={100}
                value={custom.splash.duration_ms}
                onChange={(e) =>
                  setCustom({ ...custom, splash: { ...custom.splash, duration_ms: Number(e.target.value) } })
                }
                className="w-full"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorField label="Background top" value={custom.splash.background_start} onChange={(v) => setCustom({ ...custom, splash: { ...custom.splash, background_start: v } })} />
              <ColorField label="Background bottom" value={custom.splash.background_end} onChange={(v) => setCustom({ ...custom, splash: { ...custom.splash, background_end: v } })} />
              <ColorField label="Accent" value={custom.splash.accent} onChange={(v) => setCustom({ ...custom, splash: { ...custom.splash, accent: v } })} />
              <ColorField label="Title colour" value={custom.splash.title_color} onChange={(v) => setCustom({ ...custom, splash: { ...custom.splash, title_color: v } })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={custom.splash.show_loader}
                onChange={(e) => setCustom({ ...custom, splash: { ...custom.splash, show_loader: e.target.checked } })}
              />
              Show the loading ring
            </label>
            <ImageSlot
              label="Splash background"
              hint="Optional. If empty, the colour gradient above is used."
              url={custom.splash.background_image_url}
              busy={uploading === "splash"}
              onPick={(file) =>
                openCrop("splash", file, (url) =>
                  setCustom({ ...custom, splash: { ...custom.splash, background_image_url: url } })
                )
              }
              onClear={() => setCustom({ ...custom, splash: { ...custom.splash, background_image_url: null } })}
            />
          </Card>

          <Card className="space-y-4 p-5">
            <h3 className="text-sm font-bold text-[var(--ink)]">Login screen</h3>
            <Field label="Headline" value={custom.login.headline} placeholder={BUILTIN_BRAND.login.headline} onChange={(v) => setCustom({ ...custom, login: { ...custom.login, headline: v } })} />
            <Field label="Supporting line" value={custom.login.subheadline} placeholder="Trusted by thousands of families…" onChange={(v) => setCustom({ ...custom, login: { ...custom.login, subheadline: v } })} />
            <Field label="Welcome title" value={custom.login.welcome_title} placeholder="Welcome" onChange={(v) => setCustom({ ...custom, login: { ...custom.login, welcome_title: v } })} />
            <Field label="Welcome subtitle" value={custom.login.welcome_subtitle} placeholder="Sign in to continue your journey." onChange={(v) => setCustom({ ...custom, login: { ...custom.login, welcome_subtitle: v } })} />
            <ColorField label="Bottom sheet colour" value={custom.login.sheet_color} onChange={(v) => setCustom({ ...custom, login: { ...custom.login, sheet_color: v } })} />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={custom.login.show_mandala}
                onChange={(e) => setCustom({ ...custom, login: { ...custom.login, show_mandala: e.target.checked } })}
              />
              Show the ring decoration when no photo is set
            </label>
            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Background photos ({custom.login.background_images.length}/5)
              </span>
              <p className="mb-2 text-xs text-[var(--muted)]">
                These crossfade on the login screen. If you add none, the current maroon gradient stays.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {custom.login.background_images.map((url) => (
                  <div key={url} className="relative overflow-hidden rounded-xl border border-[var(--border)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-28 w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white"
                      onClick={() =>
                        setCustom({
                          ...custom,
                          login: {
                            ...custom.login,
                            background_images: custom.login.background_images.filter((item) => item !== url),
                          },
                        })
                      }
                      aria-label="Remove photo"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {custom.login.background_images.length < 5 && (
                  <label className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-xs text-[var(--muted)]">
                    {uploading === "login" ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                    <span className="mt-1">Add photo</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        openCrop("login", file, (url) =>
                          setCustom({
                            ...custom,
                            login: {
                              ...custom.login,
                              background_images: [...custom.login.background_images, url].slice(0, 5),
                            },
                          })
                        );
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </Card>

          <Button onClick={() => void save()} disabled={saving || uploading != null}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save appearance
          </Button>
        </div>

        <div className="space-y-4">
          <Preview
            label="Splash"
            style={{
              backgroundImage: usingCustom && custom.splash.background_image_url
                ? `linear-gradient(${custom.splash.background_start}cc, ${custom.splash.background_end}dd), url(${custom.splash.background_image_url})`
                : `linear-gradient(${usingCustom ? custom.splash.background_start : "#B71C1C"}, ${usingCustom ? custom.splash.background_end : "#7E0F0F"})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <Logo url={custom.logo_url} ring={usingCustom ? custom.splash.accent : "#C9A227"} />
            <p className="mt-3 text-center text-sm font-extrabold" style={{ color: usingCustom ? custom.splash.title_color : "#fff" }}>
              {splashName}
            </p>
            <p className="mt-1 text-center text-[10px]" style={{ color: usingCustom ? custom.splash.accent : "#C9A227" }}>
              {usingCustom ? splashLine : "Find your perfect match"}
            </p>
          </Preview>
          <Preview
            label="Login"
            style={{
              backgroundImage: usingCustom && loginPhoto
                ? `linear-gradient(rgba(0,0,0,.28), rgba(0,0,0,.28)), url(${loginPhoto})`
                : "linear-gradient(#8E1B1B, #B71C1C, #4A0E0E)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <p className="text-sm font-extrabold leading-tight text-white">
              {(usingCustom && custom.login.headline.trim()) || "Find your perfect match."}
            </p>
            <div className="mt-auto rounded-t-2xl px-3 py-3" style={{ background: usingCustom ? custom.login.sheet_color : "#FFF8F3" }}>
              <p className="text-xs font-extrabold text-[#1F1B16]">
                {(usingCustom && custom.login.welcome_title.trim()) || "Welcome"}
              </p>
              <div className="mt-2 h-7 rounded-lg border border-[#D7C8B8] bg-white text-center text-[10px] leading-7 font-bold text-[#1F1B16]">
                Continue with Google
              </div>
            </div>
          </Preview>
        </div>
      </div>
      {pending && (
        <ImageCropDialog
          file={pending.file}
          initialAspect={CROP_ASPECT[pending.slot]}
          round={pending.slot === "logo"}
          onCancel={() => setPending(null)}
          onConfirm={(file) => {
            const current = pending;
            setPending(null);
            void upload(current.slot, file, current.apply);
          }}
        />
      )}
    </div>
  );
}

function mergeCustom(raw: Partial<BrandCustom> | undefined): BrandCustom {
  const base = emptyBrandCustom();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    logo_url: raw.logo_url ?? null,
    splash: { ...base.splash, ...(raw.splash ?? {}) },
    login: {
      ...base.login,
      ...(raw.login ?? {}),
      background_images: Array.isArray(raw.login?.background_images) ? raw.login.background_images : [],
    },
  };
}

function Choice({
  selected,
  title,
  body,
  onClick,
}: {
  selected: boolean;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left ${
        selected ? "border-[var(--maroon)] bg-red-50" : "border-[var(--border)] bg-white"
      }`}
    >
      <span className="block text-sm font-bold text-[var(--ink)]">{title}</span>
      <span className="mt-1 block text-xs text-[var(--muted)]">{body}</span>
    </button>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--maroon)]"
      />
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const safe = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#B71C1C";
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      <span className="flex items-center gap-2">
        <input type="color" value={safe} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-9 w-12 cursor-pointer rounded border border-[var(--border)] bg-white" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--maroon)]"
        />
      </span>
    </label>
  );
}

function ImageSlot({
  label,
  hint,
  url,
  busy,
  onPick,
  onClear,
}: {
  label: string;
  hint: string;
  url: string | null;
  busy: boolean;
  onPick: (file: File | undefined) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      <p className="mb-2 text-xs text-[var(--muted)]">{hint}</p>
      <div className="flex items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-16 w-16 rounded-xl object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#B71C1C] text-lg text-[#C9A227]">♥</div>
        )}
        <label className="cursor-pointer rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">
          {busy ? "Uploading…" : url ? "Replace" : "Upload"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              onPick(file);
            }}
          />
        </label>
        {url && (
          <button type="button" onClick={onClear} className="text-xs font-semibold text-red-700">
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function Preview({
  label,
  style,
  children,
}: {
  label: string;
  style: CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <div className="mx-auto flex h-[420px] w-[220px] flex-col overflow-hidden rounded-[28px] border-4 border-zinc-900 p-4 shadow-lg" style={style}>
        <div className="flex h-full flex-col">{children}</div>
      </div>
    </div>
  );
}

function Logo({ url, ring }: { url: string | null; ring: string }) {
  return (
    <div className="mx-auto mt-16 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 bg-white/10" style={{ borderColor: ring }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-2xl" style={{ color: ring }}>♥</span>
      )}
    </div>
  );
}
