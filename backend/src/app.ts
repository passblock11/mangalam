/**
 * Vercel Hono entry — must default-export a handler (see Vercel "hono" framework).
 * Application routes live in `honoApp.ts`.
 */
import { handle } from "hono/vercel";
import { app } from "./honoApp.js";

export const config = {
  runtime: "edge",
};

export default handle(app);
