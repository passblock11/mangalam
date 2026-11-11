/**
 * Client-safe admin session types and constants.
 * No next/headers import here — safe to import from client components.
 */

export type AdminFeature =
  | "overview"
  | "verifications"
  | "users"
  | "reports"
  | "payments"
  | "settings"
  | "admins";

export const ADMIN_FEATURES: AdminFeature[] = [
  "overview",
  "verifications",
  "users",
  "reports",
  "payments",
  "settings",
  "admins",
];

export const ADMIN_FEATURE_LABELS: Record<AdminFeature, string> = {
  overview: "Overview & stats",
  verifications: "Verification review",
  users: "User management",
  reports: "Reports & moderation",
  payments: "Payments ledger",
  settings: "App settings (plans, coupons, legal)",
  admins: "Admin management",
};

export type AdminSession = {
  id: string;
  email: string;
  full_name: string | null;
  permissions: Partial<Record<AdminFeature, boolean>>;
  is_active: boolean;
  is_super_admin: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export function hasPermission(
  admin: { permissions: Partial<Record<AdminFeature, boolean>>; is_super_admin: boolean },
  feature: AdminFeature
): boolean {
  if (admin.is_super_admin) return true;
  return admin.permissions?.[feature] === true;
}
