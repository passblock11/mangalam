import { Hono } from "hono";
import { cors } from "hono/cors";
import { requireAuth } from "./auth.js";
import { healthRouter } from "./routes/health.js";
import { meRouter } from "./routes/me.js";
import { matchesRouter } from "./routes/matches.js";
import { interactionsRouter } from "./routes/interactions.js";
import { likesRouter } from "./routes/likes.js";
import { conversationsRouter } from "./routes/conversations.js";
import { reportsRouter } from "./routes/reports.js";
import { viewsRouter } from "./routes/views.js";
import { profilesRouter } from "./routes/profiles.js";
import { blocksRouter } from "./routes/blocks.js";
import { paymentsRouter } from "./routes/payments.js";
import { authRouter } from "./routes/auth.js";
import { publicRouter } from "./routes/public.js";
import { verificationRouter } from "./routes/verification.js";
import { configRouter } from "./routes/config.js";
import { adminRouter } from "./routes/admin.js";
import { notificationsRouter } from "./routes/notifications.js";
import { supportRouter } from "./routes/support.js";
import {
  looksSealed,
  openBytes,
  openHeader,
  payloadExempt,
  payloadKeyConfigured,
  sealBytes,
} from "./payload_crypto.js";

export const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type", "X-Mangalam-Enc", "X-Mangalam-Q"],
  })
);

// Mobile opt-in. No header means the body and the JSON response stay as they are.
app.use("*", async (c, next) => {
  const enc = (c.req.header("x-mangalam-enc") ?? "").trim();
  if (enc !== "1") return next();
  if (payloadExempt(c.req.path)) return next();
  if (!payloadKeyConfigured()) {
    return c.json({ error: "Secure channel is not configured" }, 503);
  }

  const method = c.req.method.toUpperCase();
  let plainBody: string | null = null;
  try {
    if (method !== "GET" && method !== "HEAD") {
      const buf = new Uint8Array(await c.req.arrayBuffer());
      if (buf.byteLength > 0) {
        plainBody = looksSealed(buf) ? await openBytes(buf) : new TextDecoder().decode(buf);
      }
    }
    const url = new URL(c.req.url);
    const sealedQuery = c.req.header("x-mangalam-q")?.trim();
    if (sealedQuery) {
      const parsed = JSON.parse(await openHeader(sealedQuery)) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return c.json({ error: "Could not read the request" }, 400);
      }
      for (const [key, value] of Object.entries(parsed)) {
        if (value == null) continue;
        url.searchParams.set(key, String(value));
      }
    }
    const headers = new Headers(c.req.raw.headers);
    headers.delete("content-length");
    headers.delete("transfer-encoding");
    headers.delete("x-mangalam-enc");
    headers.delete("x-mangalam-q");
    if (plainBody != null) headers.set("content-type", "application/json; charset=utf-8");
    const inner = new Request(url.toString(), {
      method,
      headers,
      body: plainBody != null && method !== "GET" && method !== "HEAD" ? plainBody : undefined,
    });
    const innerRes = await app.fetch(inner);
    const type = innerRes.headers.get("content-type") ?? "";
    if (!type.includes("application/json")) return innerRes;
    const text = await innerRes.text();
    if (!text) {
      return new Response(null, { status: innerRes.status, headers: innerRes.headers });
    }
    try {
      const sealed = await sealBytes(text);
      const raw = sealed.buffer.slice(
        sealed.byteOffset,
        sealed.byteOffset + sealed.byteLength,
      );
      const out = new Headers(innerRes.headers);
      out.delete("content-length");
      out.set("content-type", "application/octet-stream");
      return new Response(raw as ArrayBuffer, { status: innerRes.status, headers: out });
    } catch {
      const out = new Headers(innerRes.headers);
      out.delete("content-length");
      out.set("content-type", "application/json; charset=utf-8");
      return new Response(text, { status: innerRes.status, headers: out });
    }
  } catch {
    return c.json({ error: "Could not read the request" }, 400);
  }
});

const v1 = new Hono()
  .route("/health", healthRouter)
  .route("/public", publicRouter)
  .route("/auth", authRouter)
  .route("/me", meRouter)
  .route("/matches", matchesRouter)
  .route("/interactions", interactionsRouter)
  .route("/likes", likesRouter)
  .route("/conversations", conversationsRouter)
  .route("/reports", reportsRouter)
  .route("/views", viewsRouter)
  .route("/profiles", profilesRouter)
  .route("/blocks", blocksRouter)
  .route("/payments", paymentsRouter)
  .route("/verification", verificationRouter)
  .route("/config", configRouter)
  .route("/admin", adminRouter)
  .route("/notifications", notificationsRouter)
  .route("/support", supportRouter);

// Vercel: vercel.json rewrites /v1/* → /api/v1/*
app.route("/api/v1", v1);
// Local dev (see src/dev.ts)
app.route("/v1", v1);
