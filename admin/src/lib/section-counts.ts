import type { AdminFeature, AdminSession } from "./admin-session";
import type { SectionCounts } from "./admin-live-types";
import { supabaseAdmin } from "./supabaseAdmin";

async function headCount(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>
): Promise<number | null> {
  const { count, error } = await query;
  if (error || count == null) return null;
  return count;
}

const SETTINGS_TABLES = [
  "app_settings",
  "plans",
  "coupons",
  "payment_methods",
  "legal_pages",
  "admins",
] as const;

/** Changes when a settings row is added, removed, or edited. Not shown in the UI. */
async function settingsStamp(
  sb: ReturnType<typeof supabaseAdmin>
): Promise<string> {
  const parts = await Promise.all(
    SETTINGS_TABLES.map(async (table) => {
      const { data, count, error } = await sb
        .from(table)
        .select("updated_at", { count: "exact" })
        .order("updated_at", { ascending: false })
        .limit(1);
      if (error) return `${table}:unavailable`;
      const latest = (data?.[0] as { updated_at?: string } | undefined)?.updated_at ?? "";
      return `${table}:${count ?? 0}:${latest}`;
    })
  );
  return parts.join("|");
}

/**
 * One snapshot of the sidebar numbers.
 * Overview is work waiting (pending reviews + open reports), not a second user total.
 * Payments is credit transactions plus memberships, matching the two lists on that screen.
 */
export async function readSectionCounts(session: AdminSession): Promise<{
  counts: SectionCounts;
  settingsStamp: string;
}> {
  const sb = supabaseAdmin();
  const can = (feature: AdminFeature) =>
    session.is_super_admin || session.permissions?.[feature] === true;

  const [users, pending, openReports, creditPayments, memberships, openSupport, deletionTickets, stamp] =
    await Promise.all([
      headCount(sb.from("profiles").select("*", { count: "exact", head: true })),
      headCount(
        sb.from("profiles").select("*", { count: "exact", head: true }).eq("verification_status", "pending")
      ),
      headCount(sb.from("reports").select("*", { count: "exact", head: true }).eq("status", "open")),
      headCount(sb.from("razorpay_payment_credits").select("*", { count: "exact", head: true })),
      headCount(sb.from("member_subscriptions").select("*", { count: "exact", head: true })),
      headCount(
        sb
          .from("support_tickets")
          .select("*", { count: "exact", head: true })
          .in("status", ["open", "in_progress"])
      ),
      sb
        .from("support_tickets")
        .select("id,subject,category,status")
        .in("status", ["open", "in_progress"])
        .limit(300),
      settingsStamp(sb),
    ]);

  const deletionCount = (deletionTickets.data ?? []).filter((row) => {
    const subject = String(row.subject ?? "").toLowerCase();
    const category = String(row.category ?? "");
    if (!/delete|erase|remove\s+my\s+account|gdpr|close\s+my\s+account/.test(subject)) return false;
    return (
      category === "account" ||
      /delete(\s+my)?\s+(mangalam\s+)?account|account\s+deletion|erase\s+(my\s+)?(data|account)/.test(
        subject
      )
    );
  }).length;

  const counts: SectionCounts = {};
  if (can("overview") && pending != null && openReports != null) {
    counts.overview = pending + openReports;
  }
  if (can("verifications") && pending != null) counts.verifications = pending;
  if (can("users") && users != null) counts.users = users;
  if (can("reports") && openReports != null) counts.reports = openReports;
  if (can("payments") && creditPayments != null && memberships != null) {
    counts.payments = creditPayments + memberships;
  }
  if (can("support") && openSupport != null) counts.support = openSupport;
  if (can("support") && !deletionTickets.error) counts.account_deletion = deletionCount;
  return { counts, settingsStamp: stamp };
}
