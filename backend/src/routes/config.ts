import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";

/** Public app config + legal pages + plans + coupon validation. */
export const configRouter = new Hono();

// ─────────────────────────────────────────────────────────────────────────────
// Public bootstrap config (no auth) — safe fields only
// ─────────────────────────────────────────────────────────────────────────────
configRouter.get("/", async (c) => {
  const sb = getSupabaseAdmin();
  const { data: settings } = await sb
    .from("app_settings")
    .select("app_name,tagline,support_email,support_phone,support_whatsapp,currency,active_payment_method")
    .eq("id", 1)
    .maybeSingle();

  const { data: methods } = await sb
    .from("payment_methods")
    .select("provider,display_name,config,is_active,sort_order")
    .order("sort_order", { ascending: true });

  const { data: plans } = await sb
    .from("plans")
    .select("id,code,name,description,plan_type,price_paise,credits,duration_days,sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return c.json({
    settings: settings ?? null,
    payment_methods: (methods ?? []).map((m) => ({
      provider: m.provider,
      display_name: m.display_name,
      is_active: m.is_active,
      sort_order: m.sort_order,
      // Only expose non-secret config keys (key_id is public; secrets never stored here)
      config: m.config ?? {},
    })),
    plans: plans ?? [],
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Legal page by slug (public)
// ─────────────────────────────────────────────────────────────────────────────
configRouter.get("/legal/:slug", async (c) => {
  const slug = c.req.param("slug");
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("legal_pages")
    .select("slug,title,body,version,updated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ error: "Not found" }, 404);
  return c.json({ page: data });
});

// ─────────────────────────────────────────────────────────────────────────────
// All legal pages (public) — list with slug + title only
// ─────────────────────────────────────────────────────────────────────────────
configRouter.get("/legal", async (c) => {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("legal_pages")
    .select("slug,title,updated_at")
    .eq("is_published", true)
    .order("title", { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ pages: data ?? [] });
});

// ─────────────────────────────────────────────────────────────────────────────
// Plans list (public)
// ─────────────────────────────────────────────────────────────────────────────
configRouter.get("/plans", async (c) => {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("plans")
    .select("id,code,name,description,plan_type,price_paise,credits,duration_days,sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ plans: data ?? [] });
});

// ─────────────────────────────────────────────────────────────────────────────
// Coupon validation (auth required)
// ─────────────────────────────────────────────────────────────────────────────
const validateSchema = z.object({
  code: z.string().min(1).max(60),
  amount_paise: z.number().int().min(0),
});

configRouter.use("/coupons/validate", requireAuth);
configRouter.post("/coupons/validate", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = validateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { code, amount_paise } = parsed.data;

  const sb = getSupabaseAdmin();
  const { data: coupon, error } = await sb
    .from("coupons")
    .select("id,code,discount_type,discount_value,min_amount_paise,max_uses,used_count,valid_from,valid_until,is_active")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  if (!coupon || !coupon.is_active) {
    return c.json({ valid: false, error: "Invalid coupon code" }, 404);
  }
  const now = Date.now();
  if (coupon.valid_from && new Date(coupon.valid_from).getTime() > now) {
    return c.json({ valid: false, error: "Coupon not yet active" }, 400);
  }
  if (coupon.valid_until && new Date(coupon.valid_until).getTime() < now) {
    return c.json({ valid: false, error: "Coupon expired" }, 400);
  }
  if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) {
    return c.json({ valid: false, error: "Coupon usage limit reached" }, 400);
  }
  if (amount_paise < (coupon.min_amount_paise ?? 0)) {
    return c.json({ valid: false, error: "Minimum amount not met" }, 400);
  }

  let discountPaise = 0;
  if (coupon.discount_type === "percent") {
    discountPaise = Math.floor((amount_paise * coupon.discount_value) / 100);
  } else {
    discountPaise = coupon.discount_value;
  }
  discountPaise = Math.min(discountPaise, amount_paise);

  return c.json({
    valid: true,
    code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    discount_paise: discountPaise,
    final_amount_paise: amount_paise - discountPaise,
  });
});
