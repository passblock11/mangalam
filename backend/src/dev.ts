/**
 * Local development server (Node). Vercel production uses src/app.ts (Edge + hono/vercel handle).
 */
import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./honoApp.js";
import { env } from "./env.js";

const port = Number(env("PORT")) || 3001;

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.info(`Mangalam API listening on http://localhost:${info.port}`);
    console.info(`Try: GET http://localhost:${info.port}/v1/health`);
  }
);
