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
// Legal page rendered as a full HTML document (public). Used for Play Store
// listing URLs AND loaded in the app's in-app WebView (instead of a plain
// Text screen). The body is Markdown authored in the admin panel; it is
// rendered client-side via markdown-it from a CDN so the Edge runtime
// doesn't need a markdown dependency.
// ─────────────────────────────────────────────────────────────────────────────
configRouter.get("/legal/:slug/html", async (c) => {
  const slug = c.req.param("slug");
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("legal_pages")
    .select("slug,title,body,version,updated_at,is_published")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  if (!data) {
    return c.html(_legalShell("Not found", "", new Date().toISOString(), true), 404);
  }
  const body = (data.body as string) ?? "";
  const updated = (data.updated_at as string) ?? new Date().toISOString();
  return c.html(_legalShell(data.title ?? slug, body, updated, !data.is_published));
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function _legalShell(
  title: string,
  markdownBody: string,
  updatedAt: string,
  draft: boolean
): string {
  const updatedDate = updatedAt.substring(0, 10);
  const draftBanner = draft
    ? `<div class="draft">Draft — not published</div>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${escapeHtml(title)}</title>
<script src="https://cdn.jsdelivr.net/npm/markdown-it@13.0.2/dist/markdown-it.min.js"></script>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1f1f1f;
    background: #fffdf8;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 760px; margin: 0 auto; padding: 28px 20px calc(28px + env(safe-area-inset-bottom)); }
  h1 { font-size: 28px; margin: 0 0 6px; color: #B71C1C; letter-spacing: -0.3px; }
  .updated { font-size: 13px; color: #8a8a8a; margin-bottom: 22px; }
  .draft { background: #fff3cd; color: #8a6d00; border: 1px solid #ffe69c; padding: 8px 12px; border-radius: 8px; font-size: 13px; margin-bottom: 18px; }
  .content h2 { font-size: 19px; margin: 24px 0 8px; color: #B71C1C; }
  .content h3 { font-size: 16px; margin: 18px 0 6px; }
  .content p { margin: 0 0 12px; font-size: 15px; }
  .content ul, .content ol { margin: 0 0 12px; padding-left: 22px; }
  .content li { margin: 0 0 6px; font-size: 15px; }
  .content a { color: #B71C1C; }
  .content code { background: #f3e9df; padding: 1px 5px; border-radius: 4px; font-size: 13px; }
  .content hr { border: none; border-top: 1px solid #eee; margin: 20px 0; }
  .content blockquote { border-left: 3px solid #C9A227; margin: 0 0 12px; padding: 2px 14px; color: #555; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtml(title)}</h1>
    <div class="updated">Last updated ${escapeHtml(updatedDate)}</div>
    ${draftBanner}
    <div class="content" id="content"></div>
  </div>
  <script>
    (function () {
      var raw = ${JSON.stringify(markdownBody)};
      if (window.markdownit) {
        var md = window.markdownit({ html: false, linkify: true, breaks: true });
        document.getElementById("content").innerHTML = md.render(raw);
      } else {
        var el = document.getElementById("content");
        el.textContent = raw;
      }
    })();
  </script>
</body>
</html>`;
}

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
