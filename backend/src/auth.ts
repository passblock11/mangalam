import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { env } from "./env.js";

export type AuthUser = JWTPayload & { sub?: string };

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
    userId: string;
  }
}

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedJwksUrl: string | null = null;

function getJwtSecret(): Uint8Array | null {
  const raw = env("SUPABASE_JWT_SECRET");
  if (!raw) return null;
  return new TextEncoder().encode(raw);
}

function getJwks(supabaseUrl: string) {
  const jwksUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
  if (cachedJwks && cachedJwksUrl === jwksUrl) return cachedJwks;
  cachedJwksUrl = jwksUrl;
  cachedJwks = createRemoteJWKSet(new URL(jwksUrl));
  return cachedJwks;
}

async function verifySupabaseAccessToken(token: string): Promise<JWTPayload> {
  const supabaseUrl = env("SUPABASE_URL")?.replace(/\/$/, "");
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is not set");
  }

  const issuer = `${supabaseUrl}/auth/v1`;

  try {
    const { payload } = await jwtVerify(token, getJwks(supabaseUrl), {
      algorithms: ["ES256"],
      issuer,
    });
    return payload;
  } catch (es256Error) {
    const secret = getJwtSecret();
    if (!secret) throw es256Error;
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    return payload;
  }
}

export const requireAuth = createMiddleware(async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Missing Authorization Bearer token" }, 401);
  }
  const token = auth.slice("Bearer ".length).trim();
  try {
    const payload = await verifySupabaseAccessToken(token);
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
