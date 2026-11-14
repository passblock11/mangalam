import { publicConfig } from "./config";
import { supabase } from "./supabase";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error: unknown }).error;
    if (typeof error === "string" && error.trim()) return error;
  }
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 402) return "Payment is required to continue.";
  if (status === 403) return "You do not have permission to do that.";
  if (status === 404) return "The information you requested was not found.";
  return "Something went wrong. Please try again.";
}

export async function api<T = unknown>(
  path: string,
  init?: { method?: string; body?: unknown; query?: Query; auth?: boolean },
): Promise<T> {
  const auth = init?.auth !== false;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const session = (await supabase.auth.getSession()).data.session;
    const token = session?.access_token;
    if (!token) throw new ApiError(401, "Not signed in");
    headers.Authorization = `Bearer ${token}`;
  }
  const url = new URL(path.startsWith("http") ? path : `${publicConfig.apiBase}${path}`);
  for (const [key, value] of Object.entries(init?.query ?? {})) {
    if (value == null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body == null ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (
    res.status === 403 &&
    body &&
    typeof body === "object" &&
    (body as { banned?: boolean }).banned === true
  ) {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "mangalam_notice",
        "Your account is suspended due to malicious activity detected.",
      );
      window.location.assign("/login");
    }
    throw new ApiError(403, "Your account is suspended due to malicious activity detected.");
  }
  if (!res.ok) throw new ApiError(res.status, messageFrom(body, res.status));
  return body as T;
}

export async function publicGet<T>(path: string): Promise<T> {
  const res = await fetch(`${publicConfig.apiBase}${path}`, { next: { revalidate: 120 } });
  if (!res.ok) throw new Error("Could not load this page.");
  return (await res.json()) as T;
}
