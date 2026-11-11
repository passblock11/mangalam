import { Hono } from "hono";
import { env } from "../env.js";

/** Unauthenticated endpoints safe for mobile bootstrap. */
export const publicRouter = new Hono();

publicRouter.get("/mobile-config", (c) =>
  c.json({
    google_web_client_id: env("GOOGLE_WEB_CLIENT_ID") ?? "",
    google_ios_client_id: env("GOOGLE_IOS_CLIENT_ID") ?? "",
  })
);
