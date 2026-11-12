/**
 * Vercel Hono entry — must default-export a handler (see Vercel "hono" framework).
 * Application routes live in `honoApp.ts`.
 *
 * Vercel's build scans for a literal `from "hono"` import on the entry file.
 *
 * NOTE: We use the Node.js runtime (not Edge) because the Vercel Edge
 * runtime's outbound fetch to api.razorpay.com is intercepted and
 * returns HTTP 406 with an empty body (no server/content-type headers),
 * which breaks Razorpay order creation. The Node.js runtime uses a
 * different network egress path and reaches Razorpay normally.
 */
import { Hono } from "hono";
import { handle } from "hono/vercel";

void Hono;
import { app } from "./honoApp.js";

export const config = {
  runtime: "nodejs",
};

export default handle(app);
