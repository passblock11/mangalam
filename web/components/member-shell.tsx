"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { profileReady, type Profile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

const nav = [
  ["/discover", "Discover"],
  ["/connections", "Connections"],
  ["/chats", "Chats"],
  ["/profile", "Profile"],
];

export function MemberShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("Mangalam");

  useEffect(() => {
    let stop = false;
    (async () => {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      try {
        const me = await api<{ profile: Profile | null }>("/v1/me");
        if (stop) return;
        const profile = me.profile;
        setName(profile?.display_name || "Member");
        const complete = profileReady(profile);
        if (!complete && path !== "/onboarding") {
          router.replace("/onboarding");
          return;
        }
        if (complete && path === "/onboarding") {
          router.replace("/discover");
          return;
        }
        if (complete && path !== "/membership" && path !== "/onboarding") {
          const pending = profile?.preferences?.membership_pending === true;
          const female = profile?.gender?.toLowerCase() === "female";
          let blocked = pending;
          if (female) {
            const config = await api<{ settings?: { female_membership_free?: boolean } }>("/v1/config");
            const flag = config.settings?.female_membership_free;
            if (flag === true) blocked = false;
            if (flag === false) {
              const membership = await api<{ premium_until?: string | null; benefits_active?: boolean }>("/v1/payments/membership");
              const until = membership.premium_until ? new Date(membership.premium_until).getTime() : 0;
              blocked = !(membership.benefits_active || until > Date.now());
            }
          }
          if (blocked) {
            router.replace("/membership");
            return;
          }
        }
        setReady(true);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) router.replace("/login");
        else setReady(true);
      }
    })();
    return () => {
      stop = true;
    };
  }, [path, router]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-white text-maroon">
        <p className="text-3xl font-semibold">Mangalam</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/discover" className="text-2xl font-semibold text-maroon">Mangalam</Link>
          <nav className="hidden items-center gap-7 text-sm md:flex">
            {nav.map(([href, label]) => (
              <Link key={href} href={href} className={path.startsWith(href) ? "border-b-2 border-maroon py-5 font-semibold text-maroon" : "py-5 text-[#444]"}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/notifications" className="text-[#444] hover:text-maroon">Alerts</Link>
            <span className="hidden max-w-32 truncate text-muted sm:inline">{name}</span>
            <button
              className="rounded-full border border-line px-3 py-1.5 hover:border-maroon"
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace("/");
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-24">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-4">
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className={`py-3 text-center text-xs ${path.startsWith(href) ? "font-semibold text-maroon" : "text-muted"}`}>
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
