import { getAdminSession } from "@/lib/admin-session-server";
import { adminsExist } from "./auth-actions";
import { AdminDashboard } from "./ui/AdminDashboard";
import { AdminLogin } from "./ui/AdminLogin";
import { AdminBootstrap } from "./ui/AdminBootstrap";
import { SignOutButton } from "./ui/SignOutButton";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-16 text-center text-[var(--ink)]">
        <p className="font-medium">Missing Supabase configuration</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Set <code className="rounded bg-zinc-200 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-zinc-200 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (see
          admin/.env.local.example).
        </p>
      </div>
    );
  }

  const session = await getAdminSession();

  let body: React.ReactNode;
  if (session) {
    body = <AdminDashboard session={session} />;
  } else {
    const probe = await adminsExist();
    if (probe.ok && !probe.exists) {
      body = <AdminBootstrap />;
    } else {
      body = <AdminLogin />;
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--maroon)] to-[var(--gold)] text-white">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden
              >
                <path d="M12 21s-7.5-4.6-10-9.3C.6 8.4 2.5 5 5.8 5c2 0 3.5 1.2 4.2 2.5C10.7 6.2 12.2 5 14.2 5 17.5 5 19.4 8.4 22 11.7 19.5 16.4 12 21 12 21z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-[var(--ink)]">
                Mangalam Admin
              </h1>
              <p className="text-[11px] text-[var(--muted)]">Moderation & verification</p>
            </div>
            {session && (
              <span className="ml-3 hidden text-xs text-[var(--muted)] sm:inline">
                {session.email}
                {session.is_super_admin ? " · super admin" : ""}
              </span>
            )}
          </div>
          {session && <SignOutButton />}
        </div>
      </header>

      {body}
    </div>
  );
}
