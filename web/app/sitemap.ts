import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://mangalam-web-beta.vercel.app";
  return ["", "/search", "/communities", "/how-it-works", "/stories", "/pricing", "/about", "/privacy", "/terms", "/refund", "/contact", "/help", "/safety", "/login"].map((path) => ({
    url: `${base}${path || "/"}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.6,
  }));
}
