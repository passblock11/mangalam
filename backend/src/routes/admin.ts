import { Hono } from "hono";
import { z } from "zod";
import {
  ADMIN_FEATURES,
  hashPassword,
  verifyPassword,
  signAdminToken,
  normalizePermissions,
  rowToAdmin,
  hasPermission,
  requireAdmin,
  type AdminRow,
  type AdminFeature,
} from "../admin-auth.js";
import { getSupabaseAdmin } from "../supabase.js";

export const adminRouter = new Hono();

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap: create the FIRST super admin. Only works when the table is empty.
// ─────────────────────────────────────────────────────────────────────────────
const bootstrapSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  full_name: z.string().min(1).max(120).optional(),
});

adminRouter.post("/bootstrap", async (c) => {
  const sb = getSupabaseAdmin();
  const { count, error: countErr } = await sb
    .from("admins")
    .select("*", { count: "exact", head: true });
  if (countErr) return c.json({ error: countErr.message }, 500);
  if ((count ?? 0) > 0) {
    return c.json({ error: "Admin bootstrap is already complete." }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = bootstrapSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { email, password, full_name } = parsed.data;

  const passwordHash = await hashPassword(password);
  const { data, error } = await sb
    .from("admins")
    .insert({
      email: email.trim().toLowerCase(),
      password_hash: passwordHash,
      full_name: full_name?.trim() || null,
      is_active: true,
      is_super_admin: true,
      permissions: {},
    })
    .select("id,email,full_name,permissions,is_active,is_super_admin,last_login_at,created_at,updated_at")
    .single();
  if (error) return c.json({ error: error.message }, 500);

  const admin = rowToAdmin(data);
  const token = await signAdminToken(admin);
  return c.json({ token, admin });
});

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

adminRouter.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid email or password" }, 400);
  const { email, password } = parsed.data;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("admins")
    .select("id,email,full_name,password_hash,permissions,is_active,is_super_admin,last_login_at,created_at,updated_at")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ error: "Invalid email or password" }, 401);

  const ok = await verifyPassword(password, String(data.password_hash));
  if (!ok) return c.json({ error: "Invalid email or password" }, 401);
  if (!data.is_active) return c.json({ error: "This admin account is disabled." }, 403);

  await sb
    .from("admins")
    .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", data.id);

  const admin = rowToAdmin(data);
  const token = await signAdminToken(admin);
  return c.json({ token, admin });
});

// ─────────────────────────────────────────────────────────────────────────────
// Current admin (from token)
// ─────────────────────────────────────────────────────────────────────────────
adminRouter.get("/me", requireAdmin(), async (c) => {
  const admin = c.get("admin");
  return c.json({ admin });
});

// ─────────────────────────────────────────────────────────────────────────────
// List admins (requires admins permission)
// ─────────────────────────────────────────────────────────────────────────────
adminRouter.get("/admins", requireAdmin("admins"), async (c) => {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("admins")
    .select("id,email,full_name,permissions,is_active,is_super_admin,last_login_at,created_at,updated_at")
    .order("created_at", { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ admins: (data ?? []).map(rowToAdmin) });
});

// ─────────────────────────────────────────────────────────────────────────────
// Create admin (requires admins permission)
// ─────────────────────────────────────────────────────────────────────────────
const createSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  full_name: z.string().min(1).max(120).optional(),
  permissions: z.record(z.string(), z.boolean()).optional(),
  is_super_admin: z.boolean().optional(),
});

adminRouter.post("/admins", requireAdmin("admins"), async (c) => {
  const actor = c.get("admin");
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { email, password, full_name, permissions, is_super_admin } = parsed.data;

  // Only super admins can create super admins
  if (is_super_admin && !actor.is_super_admin) {
    return c.json({ error: "Only super admins can create super admins" }, 403);
  }

  const sb = getSupabaseAdmin();
  const passwordHash = await hashPassword(password);
  const { data, error } = await sb
    .from("admins")
    .insert({
      email: email.trim().toLowerCase(),
      password_hash: passwordHash,
      full_name: full_name?.trim() || null,
      permissions: normalizePermissions(permissions ?? {}),
      is_active: true,
      is_super_admin: !!is_super_admin,
    })
    .select("id,email,full_name,permissions,is_active,is_super_admin,last_login_at,created_at,updated_at")
    .single();
  if (error) {
    if (error.code === "23505") return c.json({ error: "An admin with this email already exists" }, 409);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ admin: rowToAdmin(data) });
});

// ─────────────────────────────────────────────────────────────────────────────
// Update admin (permissions, is_active, full_name, password reset)
// ─────────────────────────────────────────────────────────────────────────────
const updateSchema = z.object({
  full_name: z.string().min(1).max(120).optional(),
  permissions: z.record(z.string(), z.boolean()).optional(),
  is_active: z.boolean().optional(),
  is_super_admin: z.boolean().optional(),
  password: z.string().min(8).max(200).optional(),
});

adminRouter.patch("/admins/:id", requireAdmin("admins"), async (c) => {
  const actor = c.get("admin");
  const targetId = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { full_name, permissions, is_active, is_super_admin, password } = parsed.data;

  // Super-admin flag changes require the actor to be a super admin
  if (is_super_admin !== undefined && !actor.is_super_admin) {
    return c.json({ error: "Only super admins can change the super-admin flag" }, 403);
  }
  // Prevent self-deactivation / self-demotion
  if (targetId === actor.id) {
    if (is_active === false) return c.json({ error: "You cannot disable your own account" }, 400);
    if (is_super_admin === false) return c.json({ error: "You cannot remove your own super-admin status" }, 400);
  }

  const sb = getSupabaseAdmin();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (full_name !== undefined) patch.full_name = full_name.trim() || null;
  if (permissions !== undefined) patch.permissions = normalizePermissions(permissions);
  if (is_active !== undefined) patch.is_active = is_active;
  if (is_super_admin !== undefined) patch.is_super_admin = is_super_admin;
  if (password) patch.password_hash = await hashPassword(password);

  const { data, error } = await sb
    .from("admins")
    .update(patch)
    .eq("id", targetId)
    .select("id,email,full_name,permissions,is_active,is_super_admin,last_login_at,created_at,updated_at")
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ error: "Admin not found" }, 404);
  return c.json({ admin: rowToAdmin(data) });
});

// ─────────────────────────────────────────────────────────────────────────────
// Delete admin (cannot delete self)
// ─────────────────────────────────────────────────────────────────────────────
adminRouter.delete("/admins/:id", requireAdmin("admins"), async (c) => {
  const actor = c.get("admin");
  const targetId = c.req.param("id");
  if (targetId === actor.id) {
    return c.json({ error: "You cannot delete your own admin account" }, 400);
  }
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("admins").delete().eq("id", targetId);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Feature list (for the admin panel UI checkboxes)
// ─────────────────────────────────────────────────────────────────────────────
adminRouter.get("/features", requireAdmin(), async (c) => {
  return c.json({ features: ADMIN_FEATURES as readonly string[] });
});
