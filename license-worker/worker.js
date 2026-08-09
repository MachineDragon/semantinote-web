/**
 * SemantiNote license backend (Cloudflare Worker) — STRIPE track.
 *
 * Three jobs:
 *   1. POST /webhook           ← Stripe calls this after a successful payment.
 *                                Verifies the signature, generates a product key,
 *                                stores it, and remembers it for the success page.
 *   2. GET  /key?session_id=X  ← the "thank you" page fetches the buyer's key.
 *   3. GET  /?key=THE-KEY      ← the app checks a key. Returns { "valid": true|false }.
 *
 * Free to run on Cloudflare's Workers free plan (no credit card).
 *
 * SETUP (see the main guide, "Sell it with Stripe"):
 *   - Bind a KV namespace as  LICENSES   (Settings → Variables → KV Namespace Bindings)
 *   - Add secrets (Settings → Variables → Encrypt):
 *       STRIPE_WEBHOOK_SECRET   = from Stripe → Developers → Webhooks → your endpoint
 *   - Deploy, copy the Worker URL, put it in the app:
 *       src/main/license.ts →  const VALIDATE_URL = "https://.../";
 */

const CORS = { "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": "no-store" };
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: CORS });

// Random, unguessable 16-char key (no ambiguous 0/O/1/I), shown as XXXX-XXXX-XXXX-XXXX.
function generateKey() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(16));
  let s = "";
  for (let i = 0; i < 16; i++) s += A[b[i] % A.length];
  return `${s.slice(0,4)}-${s.slice(4,8)}-${s.slice(8,12)}-${s.slice(12,16)}`;
}

// Verify Stripe's webhook signature (so nobody can fake a "paid" event).
async function stripeSigValid(rawBody, sigHeader, secret) {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(",").map((kv) => kv.split("=")));
  if (!parts.t || !parts.v1) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${parts.t}.${rawBody}`));
  const expected = [...new Uint8Array(mac)].map((x) => x.toString(16).padStart(2, "0")).join("");
  if (expected.length !== parts.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...CORS, "access-control-allow-methods": "GET,POST,OPTIONS" } });
    }

    // 1) Stripe webhook — a real purchase just completed.
    if (request.method === "POST" && url.pathname === "/webhook") {
      const raw = await request.text();
      const ok = await stripeSigValid(raw, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET);
      if (!ok) return json({ error: "bad signature" }, 400);
      const event = JSON.parse(raw);
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const key = generateKey();
        await env.LICENSES.put(`k:${key}`, "active");            // key → status (app checks this)
        await env.LICENSES.put(`s:${session.id}`, key);          // session → key (success page reads this)
      }
      return json({ received: true });
    }

    // 2) Success page fetches the buyer's key by their Stripe session id.
    if (request.method === "GET" && url.pathname === "/key") {
      const sid = url.searchParams.get("session_id");
      if (!sid) return json({ error: "no session_id" }, 400);
      const key = await env.LICENSES.get(`s:${sid}`);
      return key ? json({ key }) : json({ error: "not ready yet" }, 404);
    }

    // 3) The app validates a product key.
    if (request.method === "GET") {
      const key = url.searchParams.get("key");
      if (!key) return json({ valid: false, error: "no key" });
      const status = await env.LICENSES.get(`k:${key.trim().toUpperCase()}`);
      return json({ valid: status === "active" });
    }

    return json({ error: "not found" }, 404);
  },
};
