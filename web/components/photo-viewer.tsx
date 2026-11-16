"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

export function PhotoViewer({ urls, index, onClose }: { urls: string[]; index: number; onClose: () => void }) {
  const [page, setPage] = useState(index);
  const many = urls.length > 1;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setPage((current) => Math.min(urls.length - 1, current + 1));
      if (event.key === "ArrowLeft") setPage((current) => Math.max(0, current - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, urls.length]);

  const url = urls[page];
  if (!url) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black" role="dialog" aria-modal="true" aria-label="Photo">
      <button type="button" className="absolute inset-0" aria-label="Close photo" onClick={onClose} />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="pointer-events-auto max-h-[88vh] max-w-[92vw] object-contain" />
      </div>
      <button type="button" className="absolute top-4 left-4 grid h-11 w-11 place-items-center rounded-full bg-white text-ink shadow" onClick={onClose} aria-label="Back">
        <Icon name="chevron-left" />
      </button>
      <p className="absolute top-5 left-1/2 -translate-x-1/2 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-ink">
        {page + 1} / {urls.length}
      </p>
      {many && page > 0 ? (
        <button type="button" className="absolute top-1/2 left-3 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow" onClick={() => setPage(page - 1)} aria-label="Previous photo">
          <Icon name="chevron-left" />
        </button>
      ) : null}
      {many && page < urls.length - 1 ? (
        <button type="button" className="absolute top-1/2 right-3 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow" onClick={() => setPage(page + 1)} aria-label="Next photo">
          <Icon name="chevron-right" />
        </button>
      ) : null}
    </div>
  );
}
