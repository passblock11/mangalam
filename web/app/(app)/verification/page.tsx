"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { PhotoCapture } from "@/components/photo-picker";
import { api } from "@/lib/api";

type Status = { verification_status?: string | null; verification_note?: string | null; is_verified?: boolean };

export default function VerificationPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [selfie, setSelfie] = useState("");
  const [idFile, setIdFile] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const state = status?.is_verified ? "approved" : status?.verification_status || "none";
  const banner = state === "approved"
    ? { icon: "check" as const, title: "Verified", text: "You can now view contact details of members who opt in.", tint: "text-[#2e7d32] border-[#2e7d32]/30 bg-[#2e7d32]/10" }
    : state === "pending"
      ? { icon: "clock" as const, title: "Under review", text: "Our team is verifying your documents. This usually takes 24–48 hours.", tint: "text-gold border-gold/40 bg-gold/10" }
      : state === "rejected"
        ? { icon: "warning" as const, title: "Rejected", text: status?.verification_note || "Please re-submit clear, valid documents.", tint: "text-maroon border-maroon/30 bg-maroon/10" }
        : { icon: "shield" as const, title: "Not verified yet", text: "Verify your identity to unlock contact details of other members.", tint: "text-maroon border-maroon/30 bg-maroon/10" };

  useEffect(() => {
    api<{ verification?: Status | null }>("/v1/verification/status")
      .then((data) => setStatus(data.verification ?? null))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="mx-auto max-w-xl">
      <div className={`rounded-3xl border p-4 ${banner.tint}`}>
        <p className="flex items-center gap-2 font-semibold"><Icon name={banner.icon} className="h-5 w-5" /> {banner.title}</p>
        <p className="mt-1 text-sm">{banner.text}</p>
      </div>
      {state !== "pending" ? (
        <>
          <div className="mt-5 space-y-3">
            <PhotoCapture title="Live selfie" hint="Take a front-facing photo" done={Boolean(selfie)} icon="camera" kind="selfie" bucket="verification-docs" onReady={setSelfie} />
            <PhotoCapture title="Government ID" hint="Aadhaar, PAN, passport, or driving licence" done={Boolean(idFile)} icon="document" kind="document" bucket="verification-docs" onReady={setIdFile} />
          </div>
          <button
            disabled={busy}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-maroon px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            onClick={async () => {
              if (!selfie || !idFile) {
                setError("Add both a selfie and a government ID.");
                return;
              }
              setBusy(true);
              setError("");
              try {
                await api("/v1/verification/submit", { method: "POST", body: { selfie_url: selfie, govt_id_url: idFile } });
                setStatus({ verification_status: "pending" });
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not submit verification.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Icon name="check" className="h-4 w-4" /> {busy ? "Submitting…" : "Submit for review"}
          </button>
          <p className="mt-3 text-center text-xs leading-5 text-muted">Your documents are private. Only our review team can see them, and they are never shown to other members.</p>
        </>
      ) : null}
      {error ? <p className="mt-3 text-sm text-maroon">{error}</p> : null}
    </div>
  );
}
