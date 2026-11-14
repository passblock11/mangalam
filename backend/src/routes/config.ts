import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";

/** Public app config + legal pages + plans + coupon validation. */
export const configRouter = new Hono();

/** Null until migration 0017 exists, so an older database does not look like "off". */
async function readFemaleMembershipFree(
  sb: ReturnType<typeof getSupabaseAdmin>
): Promise<boolean | null> {
  const res = await sb
    .from("app_settings")
    .select("female_membership_free")
    .eq("id", 1)
    .maybeSingle();
  if (res.error || !res.data || !("female_membership_free" in res.data)) return null;
  return res.data.female_membership_free === true;
}

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

  const plans = await loadPublicPlans(sb);
  const branding = await loadPublicBranding(sb);
  const femaleMembershipFree = await readFemaleMembershipFree(sb);

  return c.json({
    settings: {
      ...(settings ?? {}),
      ...(femaleMembershipFree == null
        ? {}
        : { female_membership_free: femaleMembershipFree }),
    },
    branding,
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
    .select("slug,title,body,version,updated_at,is_published")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  if (!data || data.is_published !== true) return c.json({ error: "Not found" }, 404);
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
  if (!data || data.is_published !== true) {
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
  const plans = await loadPublicPlans(getSupabaseAdmin());
  return c.json({ plans });
});

const planColumns =
  "id,code,name,description,plan_type,price_paise,credits,duration_days,billing_period,total_cycles,sort_order";
const planColumnsLegacy =
  "id,code,name,description,plan_type,price_paise,credits,duration_days,sort_order";

/** Public splash/login branding. A missing column must not break /v1/config. */
async function loadPublicBranding(sb: ReturnType<typeof getSupabaseAdmin>) {
  try {
    const { data, error } = await sb
      .from("app_settings")
      .select("branding")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return { active: "default" as const };
    return publicBranding(data.branding);
  } catch {
    return { active: "default" as const };
  }
}

function publicBranding(raw: unknown) {
  if (!raw || typeof raw !== "object") return { active: "default" as const };
  const root = raw as Record<string, unknown>;
  const custom = root.custom;
  const c = custom && typeof custom === "object" ? (custom as Record<string, unknown>) : {};
  const appName = clip(c.app_name, 40);
  const logoUrl = httpsUrl(c.logo_url);
  if (root.active !== "custom") {
    return {
      active: "default" as const,
      ...(appName ? { app_name: appName } : {}),
      ...(logoUrl ? { logo_url: logoUrl } : {}),
    };
  }
  const splash = asRecord(c.splash);
  const login = asRecord(c.login);
  const images = Array.isArray(login.background_images)
    ? login.background_images.map(httpsUrl).filter((u): u is string => u != null).slice(0, 5)
    : [];
  return {
    active: "custom" as const,
    app_name: appName,
    tagline: clip(c.tagline, 80),
    logo_url: logoUrl,
    splash: {
      animation: allow(splash.animation, ["scale_fade", "fade", "rise"], "scale_fade"),
      duration_ms: clampInt(splash.duration_ms, 1500, 8000, 3000),
      background_start: hex(splash.background_start, "#B71C1C"),
      background_end: hex(splash.background_end, "#7E0F0F"),
      accent: hex(splash.accent, "#C9A227"),
      title_color: hex(splash.title_color, "#FFFFFF"),
      background_image_url: httpsUrl(splash.background_image_url),
      show_loader: splash.show_loader !== false,
    },
    login: {
      headline: clip(login.headline, 80),
      subheadline: clip(login.subheadline, 180),
      welcome_title: clip(login.welcome_title, 40),
      welcome_subtitle: clip(login.welcome_subtitle, 120),
      background_images: images,
      sheet_color: hex(login.sheet_color, "#FFF8F3"),
      show_mandala: login.show_mandala !== false,
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function hex(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const s = value.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(s) ? s.toUpperCase() : fallback;
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s || s.length > 800) return null;
  try {
    const url = new URL(s);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function allow(value: unknown, options: string[], fallback: string): string {
  return typeof value === "string" && options.includes(value) ? value : fallback;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

async function loadPublicPlans(sb: ReturnType<typeof getSupabaseAdmin>) {
  const first = await sb
    .from("plans")
    .select(planColumns)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (!first.error) return first.data ?? [];
  const second = await sb
    .from("plans")
    .select(planColumnsLegacy)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return second.data ?? [];
}

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
