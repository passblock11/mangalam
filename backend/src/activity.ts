/** Human-readable activity for profile headers (reference: "Active this week"). */
export function activityLabel(
  lastActiveAt: string | null | undefined,
  updatedAt: string | null | undefined
): string {
  const raw = lastActiveAt || updatedAt;
  if (!raw) return "";
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const hour = 3600 * 1000;
  const day = 24 * hour;
  if (diff < hour) return "Active today";
  if (diff < day) return "Active today";
  if (diff < 7 * day) return "Active this week";
  if (diff < 30 * day) return "Active this month";
  return "Recently active";
}
