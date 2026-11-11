"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Heart, Lock, Mail, Loader2 } from "lucide-react";
import { signInAdmin } from "../auth-actions";

export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signInAdmin(email, password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-65px)] max-w-md items-center px-4 py-12">
      <div className="w-full">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--maroon)] to-[var(--gold)] text-white shadow-lg">
            <Heart size={26} fill="currentColor" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-[var(--ink)]">
            Admin Console
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Sign in to manage Mangalam
          </p>
        </div>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm"
        >
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Email
              </span>
              <div className="relative">
                <Mail
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="w-full rounded-xl border border-[var(--border)] bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--maroon)]"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Password
              </span>
              <div className="relative">
                <Lock
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
                <input
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl border border-[var(--border)] bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--maroon)]"
                />
              </div>
            </label>

            {error && (
              <p
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--maroon)] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[var(--maroon-dark)] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </div>

          <p className="mt-5 text-center text-xs text-[var(--muted)]">
            Admin credentials are managed in the Settings → Admins section.
          </p>
        </form>
      </div>
    </div>
  );
}
