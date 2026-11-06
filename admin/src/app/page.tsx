import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminDashboard } from "./ui/AdminDashboard";
import { AdminLogin } from "./ui/AdminLogin";
import { SignOutButton } from "./ui/SignOutButton";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <div className="min-h-screen bg-zinc-50 px-4 py-16 text-center text-zinc-700">
        <p className="font-medium">Missing Supabase configuration</p>
        <p className="mt-2 text-sm text-zinc-500">
          Set <code className="rounded bg-zinc-200 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-zinc-200 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (see
          admin/.env.local.example).
        </p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = !!prof?.is_admin;
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Mangalam Admin</h1>
            <p className="text-sm text-zinc-500">Moderation & verification</p>
          </div>
          {isAdmin && <SignOutButton />}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        {isAdmin ? <AdminDashboard /> : <AdminLogin />}
      </main>
    </div>
  );
}
