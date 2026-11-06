"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
