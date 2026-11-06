/**
 * Server actions return this shape so production builds show real errors
 * (instead of Next.js digest-only failures for thrown errors).
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
