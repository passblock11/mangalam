import { getSupabaseAdmin } from "./supabase.js";

const cache = new Map<string, { email: string | null; at: number }>();
const TTL_MS = 10 * 60 * 1000;

/** Google/auth email for a profile. Cached briefly so list screens stay fast. */
export async function emailFor(userId: string): Promise<string | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.email;
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.auth.admin.getUserById(userId);
    const email = error ? null : data.user?.email ?? null;
    cache.set(userId, { email, at: Date.now() });
    return email;
  } catch {
    return null;
  }
}

export async function emailsFor(ids: string[]): Promise<Map<string, string | null>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const entries = await Promise.all(
    unique.map(async (id) => [id, await emailFor(id)] as const)
  );
  return new Map(entries);
}
