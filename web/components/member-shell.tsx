"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { CropHost } from "@/components/photo-cropper";
import { markOffline, PresencePing } from "@/components/presence";
import { api, ApiError } from "@/lib/api";
import { setLocale, t, useLocale } from "@/lib/i18n";
import { profileReady, type Profile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

const nav: [string, string, IconName][] = [
  ["/discover", "Discover", "search"],
  ["/connections", "Likes", "heart"],
  ["/chats", "Chats", "message"],
  ["/profile", "Profile", "user"],
];

function titles(path: string): string {
  if (path.startsWith("/people/")) return "View profile";
  if (path.startsWith("/chats/")) return "Chat";
  if (path.startsWith("/support/")) return "Get help & support";
  const known: Record<string, string> = {
    "/discover": "Discover",
    "/connections": "Connections",
    "/chats": "Messages",
    "/profile": "Profile",
    "/membership": "My Membership",
    "/edit": "Edit profile",
    "/verification": "Profile verification",
    "/notifications": "Notifications",
    "/support": "Get help & support",
    "/biodata": "Premium biodata",
    "/onboarding": "Registration",
  };
  return known[path] ?? "Mangalam";
}

function goBack(path: string, router: { back: () => void; push: (href: string) => void }) {
  const parent = path.startsWith("/chats/")
    ? "/chats"
    : path.startsWith("/people/")
      ? "/discover"
      : path.startsWith("/support/")
        ? "/support"
        : "/profile";
  if (typeof window !== "undefined" && window.history.length > 1) router.back();
  else router.push(parent);
}

export function MemberShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const language = useLocale();
  const [ready, setReady] = useState(false);

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
        setLocale(profile?.app_language);
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

  const section = titles(path);
  const onTab = nav.some(([href]) => path === href);
  return (
    <div key={language} className="member-app min-h-screen text-ink">
      <header className="sticky top-0 z-30 border-b border-[#e8ddcf] bg-[#fff8f3]/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-1 px-2">
          {onTab ? null : (
            <button type="button" className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-ink shadow-none outline-none hover:bg-black/5" aria-label={t("Back")} onClick={() => goBack(path, router)}>
              <Icon name="arrow-left" className="h-6 w-6" />
            </button>
          )}
          <p className="min-w-0 flex-1 truncate px-1 text-lg font-bold tracking-tight">{t(section)}</p>
          <div className="flex items-center gap-1">
            <Link href="/notifications" className="grid h-10 w-10 place-items-center rounded-full text-ink" aria-label={t("Notifications")}>
              <Icon name="bell" className="h-5 w-5" />
            </Link>
            <button
              className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-ink shadow-none outline-none hover:bg-black/5"
              aria-label={t("Log out")}
              onClick={async () => {
                if (!window.confirm(`${t("Log out?")}\n${t("You will be signed out of Mangalam on this device.")}`)) return;
                await markOffline();
                await supabase.auth.signOut();
                router.replace("/");
              }}
            >
              <Icon name="logout" className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      <PresencePing />
      <CropHost />
      <main className={`mx-auto max-w-3xl px-4 py-4 ${onTab ? "pb-32" : "pb-8"}`}>{children}</main>
      {onTab ? (
      <nav className="fixed bottom-3 left-1/2 z-40 w-[min(520px,calc(100%-24px))] -translate-x-1/2 rounded-[28px] border border-white/80 bg-white/75 shadow-[0_8px_24px_rgba(183,28,28,0.12)] backdrop-blur-xl">
        <div className="grid grid-cols-4 px-1 py-2">
          {nav.map(([href, label, icon]) => (
            <Link key={href} href={href} className={`grid place-items-center gap-1 py-1 text-[11px] ${path.startsWith(href) ? "font-semibold text-maroon" : "font-medium text-muted"}`}>
              <Icon name={icon} className="h-[22px] w-[22px]" /> {t(label)}
            </Link>
          ))}
        </div>
      </nav>
      ) : null}
    </div>
  );
}
