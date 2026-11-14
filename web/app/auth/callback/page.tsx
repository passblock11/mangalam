"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function readable(message: string) {
  if (message.toLowerCase().includes("code verifier") || message.toLowerCase().includes("auth code")) {
    return "Sign-in did not finish. Continue with Google again from the login page.";
  }
  return message;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let stop = false;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const authError = params.get("error_description");
      if (authError) {
        if (!stop) setError(readable(authError));
        return;
      }
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        const session = (await supabase.auth.getSession()).data.session;
        if (session) {
          if (!stop) router.replace("/discover");
          return;
        }
        if (exchangeError) {
          if (!stop) setError(readable(exchangeError.message));
          return;
        }
      }
      const session = (await supabase.auth.getSession()).data.session;
      if (!stop) router.replace(session ? "/discover" : "/login");
    })();
    return () => {
      stop = true;
    };
  }, [router]);

  return (
    <div className="grid min-h-screen place-items-center bg-white px-6 text-center">
      <div>
        <p className="text-4xl font-semibold text-maroon">Mangalam</p>
        <p className="mt-3 text-sm text-muted">{error || "Signing you in…"}</p>
        {error ? (
          <Link href="/login" className="mt-6 inline-flex h-11 items-center rounded-md bg-maroon px-5 text-sm font-medium text-white">
            Back to login
          </Link>
        ) : null}
      </div>
    </div>
  );
}
