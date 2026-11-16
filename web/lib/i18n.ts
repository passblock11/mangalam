"use client";

import { useEffect, useState } from "react";
import dictionary from "@/lib/translations.json";

export const languageCodes = ["en", "hi", "mr", "ta", "te", "kn", "bn", "gu", "pa", "ml"] as const;
type LanguageCode = (typeof languageCodes)[number];
type Row = Record<string, string>;

const phrases = dictionary as Record<string, Row>;
let current: LanguageCode = "en";
const listeners = new Set<() => void>();

export function getLocale(): LanguageCode {
  return current;
}

export function setLocale(value: string | null | undefined) {
  const next = languageCodes.includes(value as LanguageCode) ? (value as LanguageCode) : "en";
  if (next === current) return;
  current = next;
  if (typeof document !== "undefined") document.documentElement.lang = next;
  if (typeof localStorage !== "undefined") localStorage.setItem("mangalam_language", next);
  listeners.forEach((listener) => listener());
}

export function hydrateLocale() {
  if (typeof localStorage === "undefined") return;
  const saved = localStorage.getItem("mangalam_language");
  if (saved) setLocale(saved);
}

export function useLocale(): LanguageCode {
  const [, refresh] = useState(0);
  useEffect(() => {
    const listener = () => refresh((value) => value + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return current;
}

export function t(english: string): string {
  if (!english || current === "en") return english;
  return phrases[english]?.[current] ?? english;
}

export function tf(english: string, params: Record<string, string>): string {
  let out = t(english);
  for (const [key, value] of Object.entries(params)) out = out.replaceAll(`{${key}}`, value);
  return out;
}

export function tValue(value: string): string {
  if (!value || value === "—" || current === "en") return value;
  const direct = t(value);
  if (direct !== value) return direct;
  if (!value.includes(",")) return value;
  return value.split(",").map((part) => t(part.trim())).join(", ");
}

export function tCatalog(english: string): string {
  const text = english.trim();
  if (!text) return english;
  const direct = t(text);
  if (direct !== text || current === "en") return direct;
  const patterns: Array<[RegExp, string]> = [
    [/^(\d+)\s+Contact Numbers?$/i, "{n} Contact Number"],
    [/^Get\s+(\d+)\s+Contact access$/i, "Get {n} Contact access"],
    [/^(\d+)\s+credits each renewal$/i, "{n} credits each renewal"],
    [/^(\d+)\s+credits$/i, "{n} credits"],
    [/^(\d+)\s+days premium$/i, "{n} days premium"],
  ];
  for (const [source, template] of patterns) {
    const match = source.exec(text);
    if (match?.[1]) return tf(template, { n: match[1] });
  }
  return text;
}

export function tNotice(text: string): string {
  if (!text || current === "en") return text;
  const exact = t(text);
  if (exact !== text) return exact;
  const back = /^(.*) liked you back\. You can now chat\.$/.exec(text);
  if (back?.[1]) return tf("{name} liked you back. You can now chat.", { name: back[1] });
  const liked = /^(.*) liked your profile\.$/.exec(text);
  if (liked?.[1]) return tf("{name} liked your profile.", { name: liked[1] });
  return text;
}
