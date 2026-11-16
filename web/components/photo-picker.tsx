"use client";

import { useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import type { CropKind } from "@/components/photo-cropper";
import { PhotoViewer } from "@/components/photo-viewer";
import { preparePhoto } from "@/lib/prepare-photo";
import { t, useLocale } from "@/lib/i18n";
import { uploadPhoto } from "@/lib/upload";

type Bucket = "profile-photos" | "verification-docs" | "report-screenshots";

export function PhotoPicker({
  urls,
  onChange,
  maxPhotos = 6,
  kind = "profile",
  bucket = "profile-photos",
  folder = "",
}: {
  urls: string[];
  onChange: (urls: string[]) => void | Promise<void>;
  maxPhotos?: number;
  kind?: CropKind;
  bucket?: Bucket;
  folder?: string;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [viewer, setViewer] = useState<number | null>(null);
  const remaining = maxPhotos - urls.length;
  useLocale();

  async function take(list: FileList | null) {
    setMenu(false);
    const files = [...(list ?? [])].slice(0, Math.max(remaining, 0));
    if (!files.length) return;
    setBusy(true);
    setError("");
    const next = [...urls];
    try {
      for (const file of files) {
        if (next.length >= maxPhotos) break;
        const prepared = await preparePhoto(file, kind);
        if (!prepared) continue;
        next.push(await uploadPhoto(prepared, bucket, folder));
      }
      if (next.length !== urls.length) await onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the photo.");
      if (next.length !== urls.length) await onChange(next);
    } finally {
      setBusy(false);
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2.5">
        {urls.map((url, index) => (
          <div key={`${url}-${index}`} className="relative h-[140px] w-[140px] overflow-hidden rounded-[14px] bg-[#f3e9df]">
            <button type="button" className="h-full w-full" onClick={() => setViewer(index)} aria-label={`Open photo ${index + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
            <button
              type="button"
              className="absolute top-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white"
              aria-label="Remove photo"
              onClick={() => onChange(urls.filter((_, item) => item !== index))}
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        ))}
        {remaining > 0 ? (
          <div className="relative">
            <button
              type="button"
              disabled={busy}
              className="grid h-[140px] w-[140px] place-items-center rounded-[14px] border border-maroon/30 bg-[#fff8f3] text-maroon disabled:opacity-70"
              onClick={() => setMenu((open) => !open)}
              aria-label="Add photo"
            >
              {busy ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-maroon border-t-transparent" /> : <Icon name="add" className="h-8 w-8" />}
            </button>
            {menu ? (
              <div className="absolute top-[148px] left-0 z-20 w-44 overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[#fff8f3]" onClick={() => galleryRef.current?.click()}>
                  <Icon name="gallery" className="h-4 w-4 text-maroon" /> {t("From gallery")}
                </button>
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[#fff8f3]" onClick={() => cameraRef.current?.click()}>
                  <Icon name="camera" className="h-4 w-4 text-maroon" /> {t("Take photo")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="mt-2.5 text-xs text-muted">{urls.length} / {maxPhotos} photos</p>
      {error ? <p className="mt-2 text-sm text-maroon">{error}</p> : null}
      <input ref={galleryRef} className="hidden" type="file" accept="image/*" multiple={remaining > 1} onChange={(event) => void take(event.target.files)} />
      <input ref={cameraRef} className="hidden" type="file" accept="image/*" capture="environment" onChange={(event) => void take(event.target.files)} />
      {viewer != null ? <PhotoViewer urls={urls} index={viewer} onClose={() => setViewer(null)} /> : null}
    </div>
  );
}

export function PhotoCapture({
  title,
  hint,
  done,
  icon,
  kind,
  bucket,
  folder = "",
  onReady,
}: {
  title: string;
  hint: string;
  done: boolean;
  icon: IconName;
  kind: CropKind;
  bucket: Bucket;
  folder?: string;
  onReady: (value: string) => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  const [viewer, setViewer] = useState(false);
  useLocale();

  async function take(list: FileList | null) {
    setMenu(false);
    const file = list?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const prepared = await preparePhoto(file, kind);
      if (!prepared) return;
      const stored = await uploadPhoto(prepared, bucket, folder);
      setPreview(URL.createObjectURL(prepared));
      onReady(stored);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the photo.");
    } finally {
      setBusy(false);
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
        <button type="button" className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#fff8f3] text-maroon" onClick={() => (preview ? setViewer(true) : setMenu(true))} aria-label={title}>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icon name={icon} />
          )}
        </button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setMenu((open) => !open)}>
          <p className="font-semibold">{t(title)}</p>
          <p className="text-sm text-muted">{busy ? t("Please wait…") : done ? t("Added") : t(hint)}</p>
        </button>
        <Icon name={done ? "check" : "chevron-right"} className={done ? "h-5 w-5 text-gold" : "h-5 w-5 text-muted"} />
      </div>
      {menu ? (
        <div className="mt-2 w-48 overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
          <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[#fff8f3]" onClick={() => galleryRef.current?.click()}>
            <Icon name="gallery" className="h-4 w-4 text-maroon" /> {t("From gallery")}
          </button>
          <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[#fff8f3]" onClick={() => cameraRef.current?.click()}>
            <Icon name="camera" className="h-4 w-4 text-maroon" /> {t("Take photo")}
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm text-maroon">{error}</p> : null}
      <input ref={galleryRef} className="hidden" type="file" accept="image/*" onChange={(event) => void take(event.target.files)} />
      <input ref={cameraRef} className="hidden" type="file" accept="image/*" capture={kind === "selfie" ? "user" : "environment"} onChange={(event) => void take(event.target.files)} />
      {viewer && preview ? <PhotoViewer urls={[preview]} index={0} onClose={() => setViewer(false)} /> : null}
    </div>
  );
}
