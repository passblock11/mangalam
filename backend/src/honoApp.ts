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

export const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
  })
);

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
  .route("/notifications", notificationsRouter);

// Vercel: vercel.json rewrites /v1/* → /api/v1/*
app.route("/api/v1", v1);
// Local dev (see src/dev.ts)
app.route("/v1", v1);
