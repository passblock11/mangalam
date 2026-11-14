"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("mangalam_notice");
    if (stored) {
      setNotice(stored);
      sessionStorage.removeItem("mangalam_notice");
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/discover");
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      <div className="relative hidden min-h-screen lg:block">
        <img
          src="/photos/story-cafe.jpg"
          alt="A couple talking over coffee"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/20" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <Link href="/" className="text-3xl font-semibold">Mangalam</Link>
          <div>
            <p className="text-4xl font-semibold leading-tight">The same account as the app.</p>
            <p className="mt-3 max-w-sm text-white/90">Sign in with Google to open your profile, matches, and messages.</p>
          </div>
        </div>
      </div>
      <div className="flex min-h-screen flex-col">
        <div className="flex h-[68px] items-center justify-between px-5 lg:justify-end">
          <Link href="/" className="text-2xl font-semibold text-maroon lg:hidden">Mangalam</Link>
          <Link href="/help" className="text-sm font-medium text-[#3d4451]">Help</Link>
        </div>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
          <h1 className="text-3xl font-semibold">Welcome back</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Use the Google account you already use in the Mangalam app.
          </p>
          {notice ? <p className="mt-4 rounded-xl bg-[#fde8e8] px-4 py-3 text-sm text-maroon">{notice}</p> : null}
          {error ? <p className="mt-4 rounded-xl bg-[#fde8e8] px-4 py-3 text-sm text-maroon">{error}</p> : null}
          <button
            disabled={busy}
            className="mt-6 h-12 w-full rounded-md bg-maroon text-sm font-medium text-white disabled:opacity-60"
            onClick={async () => {
              setBusy(true);
              setError("");
              const { error: signError } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: `${window.location.origin}/auth/callback` },
              });
              if (signError) {
                setError(signError.message);
                setBusy(false);
              }
            }}
          >
            {busy ? "Opening Google…" : "Continue with Google"}
          </button>
          <p className="mt-4 text-xs leading-5 text-muted">
            By continuing you agree to the <Link className="text-maroon" href="/terms">terms</Link> and <Link className="text-maroon" href="/privacy">privacy policy</Link>.
          </p>
        </main>
      </div>
    </div>
  );
}
