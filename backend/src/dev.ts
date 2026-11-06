/**
 * Local development server (Node). Vercel production uses api/[[...path]].ts (Edge).
 */
import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./app.js";

const port = Number(process.env.PORT) || 3001;

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
