// Supabase Edge Function: thin proxy to api.razorpay.com.
//
// Why this exists: the Mangalam backend runs on the Vercel Edge runtime,
// whose outbound fetch to api.razorpay.com is intercepted and returns
// HTTP 406 with an empty body (no server/content-type headers) —
// confirmed for real keys, fake keys, and even a no-auth GET. Supabase
// Edge Functions run on Deno Deploy, which reaches Razorpay normally.
//
// Security:
//   - A shared secret (PROXY_SECRET env var) is required on every
//     request via the `x-proxy-secret` header. Without it the proxy
//     returns 401.
//   - The upstream host is hardcoded to api.razorpay.com — this is NOT a
//     general-purpose proxy. Callers pass only the path (e.g. /v1/orders).
//   - The Razorpay Authorization header passes through unchanged; the
//     secret is not logged or stored.
//
// Expected request:
//   POST {FUNCTION_URL}
//   Headers:
//     x-proxy-secret: <PROXY_SECRET>
//     x-target-path: /v1/orders
//     authorization: Basic <base64(keyId:keySecret)>
//     content-type: application/json
//   Body: <Razorpay JSON body>

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const PROXY_SECRET = Deno.env.get("PROXY_SECRET") ?? "";
const UPSTREAM = "https://api.razorpay.com";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

serve(async (req: Request) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  // Shared-secret auth
  if (!PROXY_SECRET) {
    return new Response(
      JSON.stringify({ error: "PROXY_SECRET not configured on the function" }),
      { status: 500, headers: { "content-type": "application/json", ...CORS } },
    );
  }
  if (req.headers.get("x-proxy-secret") !== PROXY_SECRET) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "content-type": "application/json", ...CORS } },
    );
  }

  // Target path must start with "/" — prevents open-proxy abuse.
  const targetPath = req.headers.get("x-target-path") ?? "/";
  if (!targetPath.startsWith("/")) {
    return new Response(
      JSON.stringify({ error: "Invalid target path" }),
      { status: 400, headers: { "content-type": "application/json", ...CORS } },
    );
  }

  // Build the upstream request, forwarding only safe headers.
  const upstreamHeaders = new Headers();
  const forwardHeaders = [
    "authorization",
    "content-type",
    "accept",
    "user-agent",
  ];
  for (const h of forwardHeaders) {
    const v = req.headers.get(h);
    if (v) upstreamHeaders.set(h, v);
  }

  const init: RequestInit = {
    method: req.method,
    headers: upstreamHeaders,
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${UPSTREAM}${targetPath}`, init);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `Upstream fetch failed: ${(e as Error).message}` }),
      { status: 502, headers: { "content-type": "application/json", ...CORS } },
    );
  }

  const respHeaders = new Headers(upstream.headers);
  for (const [k, v] of Object.entries(CORS)) respHeaders.set(k, v);
  const body = await upstream.text();
  return new Response(body, { status: upstream.status, headers: respHeaders });
});
