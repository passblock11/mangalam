"use client";

import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

export type CropKind = "profile" | "selfie" | "document" | "chat" | "report";

type Request = {
  file: File;
  kind: CropKind;
  resolve: (file: File | null) => void;
};

const presets = [
  { name: "Original", value: undefined },
  { name: "1:1", value: 1 },
  { name: "3:4", value: 3 / 4 },
  { name: "4:3", value: 4 / 3 },
  { name: "9:16", value: 9 / 16 },
  { name: "16:9", value: 16 / 9 },
] as const;

let openCrop: ((request: Request) => void) | null = null;

export function cropPhoto(file: File, kind: CropKind): Promise<File | null> {
  const raster = /^image\/|^$/.test(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
  if (!raster) return Promise.resolve(file);
  if (!openCrop) return Promise.resolve(file);
  return new Promise((resolve) => openCrop?.({ file, kind, resolve }));
}

export function CropHost() {
  const [request, setRequest] = useState<Request | null>(null);
  useEffect(() => {
    openCrop = setRequest;
    return () => {
      openCrop = null;
    };
  }, []);
  if (!request) return null;
  return <CropDialog request={request} onClose={() => setRequest(null)} />;
}

function CropDialog({ request, onClose }: { request: Request; onClose: () => void }) {
  const [url] = useState(() => URL.createObjectURL(request.file));
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [aspect, setAspect] = useState<number | undefined>(request.kind === "profile" ? 3 / 4 : undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  function finish(file: File | null) {
    request.resolve(file);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div className="flex h-[min(720px,92vh)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-[#1f1b16] text-white">
        <div className="flex items-center justify-between bg-maroon px-4 py-3">
          <p className="font-medium">Crop photo</p>
          <button type="button" onClick={() => finish(null)}>Cancel</button>
        </div>
        <div className="relative min-h-0 flex-1">
          <Cropper
            image={url}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
          />
        </div>
        <div className="space-y-3 px-4 py-3">
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-full" />
          <div className="flex flex-wrap gap-2 text-xs">
            {presets.map((preset) => (
              <button key={preset.name} type="button" className={`rounded-full px-3 py-1 ${aspect === preset.value ? "bg-gold text-ink" : "bg-white/10"}`} onClick={() => setAspect(preset.value)}>
                {preset.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            className="h-11 w-full rounded-md bg-maroon font-medium disabled:opacity-60"
            onClick={async () => {
              setBusy(true);
              try {
                finish(area ? await exportCrop(url, area, request.file.name) : request.file);
              } catch {
                finish(request.file);
              }
            }}
          >
            Use photo
          </button>
        </div>
      </div>
    </div>
  );
}

async function exportCrop(url: string, area: Area, name: string): Promise<File> {
  const image = await loadImage(url);
  const scale = Math.min(1, 1600 / Math.max(area.width, area.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(area.width * scale));
  canvas.height = Math.max(1, Math.round(area.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("crop");
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("crop"))), "image/jpeg", 0.88);
  });
  const base = name.replace(/\.[^.]+$/, "").trim() || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("crop"));
    image.src = url;
  });
}
