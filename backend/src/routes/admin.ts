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
import { notify, type NotificationType } from "../notify.js";

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

// ─────────────────────────────────────────────────────────────────────────────
// Reports — full detail list for the admin complaint console
// ─────────────────────────────────────────────────────────────────────────────
adminRouter.get("/reports", requireAdmin("reports"), async (c) => {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("reports")
    .select(
      "id,reporter_id,reported_profile_id,title,description,category,screenshot_urls,reason,status,created_at,reviewed_at,reviewed_by,admin_notes,resolution"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return c.json({ error: error.message }, 500);

  const ids = Array.from(
    new Set((data ?? []).flatMap((r) => [r.reporter_id, r.reported_profile_id]))
  );
  const { data: profs } = await sb
    .from("profiles")
    .select("id,display_name,phone,photo_urls,is_banned,is_verified,verification_status")
    .in("id", ids);
  const map = new Map((profs ?? []).map((p) => [p.id, p]));

  const rows = (data ?? []).map((r) => ({
    ...r,
    reported_profile: map.get(r.reported_profile_id) ?? null,
    reporter_profile: map.get(r.reporter_id) ?? null,
  }));
  return c.json({ reports: rows });
});

const reportUpdateSchema = z.object({
  status: z.enum(["open", "reviewing", "closed", "actioned"]).optional(),
  admin_notes: z.string().max(4000).optional(),
  resolution: z.string().max(4000).optional(),
});

adminRouter.patch("/reports/:id", requireAdmin("reports"), async (c) => {
  const admin = c.get("admin");
  const id = c.req.param("id");
  const parsed = reportUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const patch: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.admin_notes !== undefined) patch.admin_notes = parsed.data.admin_notes;
  if (parsed.data.resolution !== undefined) patch.resolution = parsed.data.resolution;
  // Mark reviewed when status moves to a terminal state
  if (parsed.data.status === "closed" || parsed.data.status === "actioned") {
    patch.reviewed_at = new Date().toISOString();
    patch.reviewed_by = admin.id;
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("reports").update(patch).eq("id", id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ban / unban a user (app user, not an admin)
// Sets profiles.is_banned AND the Supabase Auth ban so the token is rejected
// on the next request (requireAuth) and they cannot re-login.
// ─────────────────────────────────────────────────────────────────────────────
const banSchema = z.object({
  reason: z.string().min(1).max(2000).optional(),
});

const adminNotifySchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(400),
  type: z
    .enum(["like", "match", "message", "shortlist", "view", "system", "verification", "report", "support"])
    .default("system"),
  profile_id: z.string().uuid().optional(),
  all: z.boolean().optional(),
  audience: z.enum(["all", "female", "female_unpaid"]).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

/** Insert the in-app row and send the Firebase push. */
adminRouter.post("/notify", requireAdmin(), async (c) => {
  const parsed = adminNotifySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { title, body, type, profile_id, all, audience, data } = parsed.data;
  const who = audience ?? (all ? "all" : undefined);
  if (!who && !profile_id) return c.json({ error: "Choose a member." }, 400);

  const sb = getSupabaseAdmin();
  const ids: string[] = [];
  if (who === "all" || who === "female" || who === "female_unpaid") {
    for (let from = 0; from < 20000; from += 500) {
      let query = sb.from("profiles").select("id,is_banned,gender");
      if (who !== "all") query = query.ilike("gender", "female");
      const { data: page, error } = await query.range(from, from + 499);
      if (error) return c.json({ error: error.message }, 500);
      const rows = page ?? [];
      for (const row of rows) {
        if (row.is_banned === true) continue;
        ids.push(row.id as string);
      }
      if (rows.length < 500) break;
    }
    if (who === "female_unpaid" && ids.length > 0) {
      const paid = new Set<string>();
      for (let i = 0; i < ids.length; i += 100) {
        const slice = ids.slice(i, i + 100);
        const { data: wallets, error } = await sb
          .from("wallets")
          .select("profile_id,premium_until")
          .in("profile_id", slice);
        if (error) return c.json({ error: error.message }, 500);
        for (const wallet of wallets ?? []) {
          const until = wallet.premium_until ? new Date(wallet.premium_until as string).getTime() : 0;
          if (Number.isFinite(until) && until > Date.now()) paid.add(wallet.profile_id as string);
        }
      }
      ids.splice(0, ids.length, ...ids.filter((id) => !paid.has(id)));
    }
  } else if (profile_id) {
    ids.push(profile_id);
  }

  for (const id of ids) {
    await notify({
      profile_id: id,
      type: type as NotificationType,
      title,
      body,
      data: data ?? {},
    });
  }
  return c.json({ ok: true, sent: ids.length });
});

adminRouter.post("/users/:id/ban", requireAdmin("users"), async (c) => {
  const id = c.req.param("id");
  const parsed = banSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const reason = parsed.data.reason?.trim() || null;

  const sb = getSupabaseAdmin();
  // 1) Flag the profile (this is what requireAuth checks on every request)
  const { error: pErr } = await sb
    .from("profiles")
    .update({
      is_banned: true,
      banned_at: new Date().toISOString(),
      ban_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (pErr) return c.json({ error: pErr.message }, 500);

  // 2) Also ban at the Supabase Auth layer so they can't refresh/re-login
  const { error: aErr } = await sb.auth.admin.updateUserById(id, {
    ban_duration: "87600h", // ~10 years
  });
  if (aErr) {
    // Non-fatal: the profile flag is the authoritative check. Log and continue.
    return c.json({ ok: true, warning: aErr.message });
  }
  return c.json({ ok: true });
});

adminRouter.post("/users/:id/unban", requireAdmin("users"), async (c) => {
  const id = c.req.param("id");
  const sb = getSupabaseAdmin();
  const { error: pErr } = await sb
    .from("profiles")
    .update({
      is_banned: false,
      banned_at: null,
      ban_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (pErr) return c.json({ error: pErr.message }, 500);

  const { error: aErr } = await sb.auth.admin.updateUserById(id, {
    ban_duration: "none",
  });
  if (aErr) {
    return c.json({ ok: true, warning: aErr.message });
  }
  return c.json({ ok: true });
});
