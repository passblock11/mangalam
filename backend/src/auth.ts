import { createMiddleware } from "hono/factory";
import { jwtVerify, type JWTPayload } from "jose";
import { env } from "./env.js";

export type AuthUser = JWTPayload & { sub?: string };

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
    userId: string;
  }
}

function getJwtSecret(): Uint8Array {
  const raw = env("SUPABASE_JWT_SECRET");
  if (!raw) {
    throw new Error("SUPABASE_JWT_SECRET is not set");
  }
  return new TextEncoder().encode(raw);
}

export const requireAuth = createMiddleware(async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Missing Authorization Bearer token" }, 401);
  }
  const token = auth.slice("Bearer ".length).trim();
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ["HS256"],
    });
    const sub = payload.sub;
    if (!sub) {
      return c.json({ error: "Invalid token: no sub" }, 401);
    }
    c.set("user", payload);
    c.set("userId", sub);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
});
