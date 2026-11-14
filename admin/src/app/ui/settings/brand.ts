/** The design that ships in the app. Stored with every save so it can be selected again. */
export const BUILTIN_BRAND = {
  id: "mangalam_current",
  label: "Current Mangalam design",
  app_name: "Mangalam",
  tagline: "Find your perfect match",
  splash: {
    animation: "scale_fade",
    duration_ms: 3000,
    background_start: "#B71C1C",
    background_end: "#7E0F0F",
    accent: "#C9A227",
    title_color: "#FFFFFF",
    show_loader: true,
  },
  login: {
    headline: "Find your\nperfect match.",
    subheadline: "Trusted by thousands of families to\nfind meaningful, verified alliances.",
    welcome_title: "Welcome",
    welcome_subtitle: "Sign in to continue your journey.",
    sheet_color: "#FFF8F3",
    show_mandala: true,
  },
} as const;

export type BrandCustom = {
  app_name: string;
  tagline: string;
  logo_url: string | null;
  splash: {
    animation: "scale_fade" | "fade" | "rise";
    duration_ms: number;
    background_start: string;
    background_end: string;
    accent: string;
    title_color: string;
    background_image_url: string | null;
    show_loader: boolean;
  };
  login: {
    headline: string;
    subheadline: string;
    welcome_title: string;
    welcome_subtitle: string;
    background_images: string[];
    sheet_color: string;
    show_mandala: boolean;
  };
};

export function emptyBrandCustom(): BrandCustom {
  return {
    app_name: "",
    tagline: "",
    logo_url: null,
    splash: {
      animation: "scale_fade",
      duration_ms: 3000,
      background_start: "#B71C1C",
      background_end: "#7E0F0F",
      accent: "#C9A227",
      title_color: "#FFFFFF",
      background_image_url: null,
      show_loader: true,
    },
    login: {
      headline: "",
      subheadline: "",
      welcome_title: "",
      welcome_subtitle: "",
      background_images: [],
      sheet_color: "#FFF8F3",
      show_mandala: true,
    },
  };
}

function brandHex(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const s = value.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(s) ? s.toUpperCase() : fallback;
}

function brandHttps(value: unknown): string | null {
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

function brandClip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export function sanitizeBrandCustom(input: BrandCustom): BrandCustom {
  const base = emptyBrandCustom();
  const animation = ["scale_fade", "fade", "rise"].includes(input.splash?.animation)
    ? input.splash.animation
    : "scale_fade";
  const duration = Number(input.splash?.duration_ms);
  const images = Array.isArray(input.login?.background_images)
    ? input.login.background_images.map(brandHttps).filter((u): u is string => u != null).slice(0, 5)
    : [];
  return {
    app_name: brandClip(input.app_name, 40),
    tagline: brandClip(input.tagline, 80),
    logo_url: brandHttps(input.logo_url),
    splash: {
      animation,
      duration_ms: Number.isFinite(duration)
        ? Math.max(1500, Math.min(8000, Math.round(duration)))
        : 3000,
      background_start: brandHex(input.splash?.background_start, base.splash.background_start),
      background_end: brandHex(input.splash?.background_end, base.splash.background_end),
      accent: brandHex(input.splash?.accent, base.splash.accent),
      title_color: brandHex(input.splash?.title_color, base.splash.title_color),
      background_image_url: brandHttps(input.splash?.background_image_url),
      show_loader: input.splash?.show_loader !== false,
    },
    login: {
      headline: brandClip(input.login?.headline, 80),
      subheadline: brandClip(input.login?.subheadline, 180),
      welcome_title: brandClip(input.login?.welcome_title, 40),
      welcome_subtitle: brandClip(input.login?.welcome_subtitle, 120),
      background_images: images,
      sheet_color: brandHex(input.login?.sheet_color, base.login.sheet_color),
      show_mandala: input.login?.show_mandala !== false,
    },
  };
}
