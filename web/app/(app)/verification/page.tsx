"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { uploadPhoto } from "@/lib/upload";

type Status = { verification_status?: string | null; verification_note?: string | null; is_verified?: boolean };

export default function VerificationPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ verification?: Status | null }>("/v1/verification/status")
      .then((data) => setStatus(data.verification ?? null))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="max-w-xl">
      <p className="text-xs tracking-[0.16em] text-gold uppercase">Verification</p>
      <h1 className="display text-5xl">Confirm it is you</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Upload a clear selfie and a government ID. Our team reviews them privately. Contact numbers stay locked until this is approved.
      </p>
      <p className="mt-4 text-sm">Status: <span className="font-medium">{status?.is_verified ? "Verified" : status?.verification_status || "Not submitted"}</span></p>
      {status?.verification_note ? <p className="mt-2 text-sm text-maroon">{status.verification_note}</p> : null}
      {error ? <p className="mt-3 text-sm text-maroon">{error}</p> : null}
      <label className="mt-6 block text-sm">Selfie<input className="mt-2 block w-full" type="file" accept="image/*" onChange={(e) => setSelfie(e.target.files?.[0] ?? null)} /></label>
      <label className="mt-4 block text-sm">Government ID<input className="mt-2 block w-full" type="file" accept="image/*" onChange={(e) => setIdFile(e.target.files?.[0] ?? null)} /></label>
      <button
        disabled={busy}
        className="mt-6 rounded-full bg-maroon px-5 py-2.5 text-sm text-white disabled:opacity-50"
        onClick={async () => {
          if (!selfie || !idFile) {
            setError("Add both photos.");
            return;
          }
          setBusy(true);
          setError("");
          try {
            const selfie_url = await uploadPhoto(selfie, "verification-docs");
            const govt_id_url = await uploadPhoto(idFile, "verification-docs");
            await api("/v1/verification/submit", { method: "POST", body: { selfie_url, govt_id_url } });
            setStatus({ verification_status: "pending" });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not submit verification.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Submitting…" : "Submit for review"}
      </button>
    </div>
  );
}
