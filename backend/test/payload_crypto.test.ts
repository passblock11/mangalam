import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

const keyBytes = new Uint8Array(32).fill(0x11);
process.env.API_PAYLOAD_KEY = Buffer.from(keyBytes).toString("base64");

const { app } = await import("../src/honoApp.js");
const { openBytes, openHeader, payloadExempt, sealBytes, sealHeader } = await import(
  "../src/payload_crypto.js"
);

const nonce = new Uint8Array(12).fill(0x22);
const plain = '{"ok":true}';
const sealed = await sealBytes(plain, nonce);
assert.equal(await openBytes(sealed), plain);

writeFileSync(
  new URL("../../mobile/test/payload_vector.json", import.meta.url),
  JSON.stringify({
    plain,
    sealed_b64: Buffer.from(sealed).toString("base64"),
    key_b64: process.env.API_PAYLOAD_KEY,
  }),
);

assert.equal(payloadExempt("/v1/payments/razorpay/webhook"), true);
assert.equal(payloadExempt("/api/v1/config/legal/privacy/html"), true);
assert.equal(payloadExempt("/v1/me"), false);

app.post("/v1/__echo", async (c) => {
  const body = await c.req.json().catch(() => null);
  return c.json({ echo: body, q: c.req.query("q") ?? "" });
});

app.post("/v1/razorpay/webhook", async (c) => {
  return c.json({ raw: await c.req.text() });
});

const plainHealth = await app.request("http://localhost/v1/health");
assert.equal(plainHealth.headers.get("content-type")?.includes("application/json"), true);
assert.deepEqual(await plainHealth.json(), { ok: true, service: "mangalam-api" });

const sealedHealth = await app.request("http://localhost/v1/health", {
  headers: { "X-Mangalam-Enc": "1" },
});
assert.equal(sealedHealth.headers.get("content-type"), "application/octet-stream");
const healthBytes = new Uint8Array(await sealedHealth.arrayBuffer());
assert.equal(
  await openBytes(healthBytes),
  JSON.stringify({ ok: true, service: "mangalam-api" }),
);

const body = Buffer.from(await sealBytes(JSON.stringify({ name: "A" })));
const query = await sealHeader(JSON.stringify({ q: "Pune" }));
const echo = await app.request("http://localhost/v1/__echo", {
  method: "POST",
  headers: {
    "X-Mangalam-Enc": "1",
    "X-Mangalam-Q": query,
    "content-type": "application/octet-stream",
  },
  body,
});
const echoed = JSON.parse(await openBytes(new Uint8Array(await echo.arrayBuffer())));
assert.deepEqual(echoed, { echo: { name: "A" }, q: "Pune" });

const webhook = await app.request("http://localhost/v1/razorpay/webhook", {
  method: "POST",
  headers: { "X-Mangalam-Enc": "1", "content-type": "text/plain" },
  body: "mg1-not-json",
});
assert.deepEqual(await webhook.json(), { raw: "mg1-not-json" });

const bad = await app.request("http://localhost/v1/__echo", {
  method: "POST",
  headers: { "X-Mangalam-Enc": "1", "content-type": "application/octet-stream" },
  body: Buffer.from(Uint8Array.from([0x6d, 0x67, 0x31, ...new Uint8Array(28)])),
});
assert.equal(bad.status, 400);
assert.equal((await bad.json()).error, "Could not read the request");

const openedQuery = JSON.parse(await openHeader(query));
assert.equal(openedQuery.q, "Pune");

console.log("payload crypto ok");
