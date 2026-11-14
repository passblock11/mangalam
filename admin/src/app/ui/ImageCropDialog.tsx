"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";

const ASPECTS = [
  { id: "square", label: "Square", value: 1 },
  { id: "portrait", label: "Portrait", value: 3 / 4 },
  { id: "story", label: "Story", value: 9 / 16 },
  { id: "landscape", label: "Landscape", value: 4 / 3 },
  { id: "wide", label: "Wide", value: 16 / 9 },
] as const;

export function ImageCropDialog({
  file,
  initialAspect,
  round = false,
  onCancel,
  onConfirm,
}: {
  file: File;
  initialAspect: number;
  round?: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}) {
  const [url, setUrl] = useState("");
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(initialAspect);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const onCropComplete = useCallback((_: Area, area: Area) => {
    setPixels(area);
  }, []);

  async function confirm() {
    if (!pixels || !url) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await renderCrop(url, pixels, file.type);
      const ext = blob.type === "image/png" ? "png" : "jpg";
      const base = file.name.replace(/\.[^.]+$/, "").trim() || "image";
      onConfirm(new File([blob], `${base}.${ext}`, { type: blob.type }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not crop that image.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-sm font-bold text-[var(--ink)]">Crop image</h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Drag to move the photo. Use the slider to zoom, then choose a frame.
          </p>
        </div>
        <div className="relative h-[340px] bg-[#1F1B16]">
          {url && (
            <Cropper
              image={url}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={round && aspect === 1 ? "round" : "rect"}
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>
        <div className="space-y-3 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {ASPECTS.map((item) => {
              const selected = Math.abs(item.value - aspect) < 0.001;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setAspect(item.value);
                    setCrop({ x: 0, y: 0 });
                    setZoom(1);
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    selected
                      ? "bg-[#B71C1C] text-white"
                      : "border border-[var(--border)] text-[var(--ink)]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Zoom
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={busy || !pixels}
              className="rounded-lg bg-[#B71C1C] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Cropping…" : "Use crop"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read that image."));
    image.src = src;
  });
}

async function renderCrop(src: string, crop: Area, sourceType: string): Promise<Blob> {
  const image = await loadImage(src);
  const maxEdge = 1600;
  let width = Math.max(1, Math.round(crop.width));
  let height = Math.max(1, Math.round(crop.height));
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not crop that image.");
  const keepAlpha = sourceType === "image/png" || sourceType === "image/webp";
  if (!keepAlpha) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
  const type = keepAlpha ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92));
  if (!blob) throw new Error("Could not crop that image.");
  return blob;
}
