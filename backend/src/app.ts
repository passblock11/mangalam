/**
 * Vercel Hono entry — must default-export a handler (see Vercel "hono" framework).
 * Application routes live in `honoApp.ts`.
 *
 * Vercel's build scans for a literal `from "hono"` import on the entry file.
 */
import { Hono } from "hono";
import { handle } from "hono/vercel";

void Hono;
import { app } from "./honoApp.js";

export const config = {
  runtime: "edge",
};

export default handle(app);
