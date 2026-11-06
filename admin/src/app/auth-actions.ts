"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function signInAdmin(
  email: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = email.trim();
  if (!trimmed || !password) {
    return { ok: false, error: "Enter email and password." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: trimmed,
    password,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  const uid = data.user?.id;
  if (!uid) {
    return { ok: false, error: "Sign-in returned no user." };
  }

  const { data: prof, error: pe } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", uid)
    .maybeSingle();

  if (pe) {
    await supabase.auth.signOut();
    return { ok: false, error: pe.message };
  }

  if (!prof?.is_admin) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error:
        "This account is not an admin. In Supabase SQL: update public.profiles set is_admin = true where id = '<your-user-id>';",
    };
  }

  revalidatePath("/");
  return { ok: true };
}

export async function signOutAdmin(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/");
}
