"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { signOutAdmin } from "../auth-actions";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        void signOutAdmin().then(() => {
          setLoading(false);
          router.refresh();
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-rose-50 disabled:opacity-50"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
