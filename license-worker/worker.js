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

// Self-contained "thank you" page served BY the Worker, so the whole purchase
// flow can be deployed + tested with only the Worker (no website hosting needed).
// Stripe's Payment Link can redirect straight to  <worker>/thanks?session_id=...
const THANKS_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Thank you — SemantiNote</title>
<style>
:root{--p1:#5b52d6;--p2:#8a63e8;--accent:#a99be6}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px;
background:#141418;color:#e9e9ee;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
background-image:radial-gradient(55% 45% at 80% -8%,rgba(138,99,232,.20),transparent 60%),radial-gradient(45% 40% at 8% 6%,rgba(91,82,214,.16),transparent 60%)}
.card{width:100%;max-width:560px;background:#1b1b21;border:1px solid #2c2c34;border-radius:20px;
padding:44px 40px;text-align:center;box-shadow:0 30px 80px -24px rgba(0,0,0,.7);animation:rise .5s ease both}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.logo{width:76px;height:76px;margin:0 auto 18px;filter:drop-shadow(0 12px 24px rgba(107,95,196,.6))}
h1{font-size:30px;margin:0 0 6px;letter-spacing:-.5px}
.sub{color:#a9a9b4;margin:0 0 26px}
.sub b{color:#fff}
.klabel{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);margin-bottom:8px}
.key{font:800 24px/1.3 ui-monospace,Menlo,monospace;letter-spacing:2px;color:#fff;user-select:all;
background:linear-gradient(135deg,rgba(91,82,214,.20),rgba(138,99,232,.10));
border:1px solid #3a3a45;border-radius:14px;padding:18px 12px}
.copy{margin-top:12px;font:700 14px/1 inherit;color:#fff;border:0;border-radius:10px;padding:12px 22px;cursor:pointer;
background:linear-gradient(135deg,var(--p1),var(--p2));box-shadow:0 12px 30px -10px rgba(107,95,196,.8)}
.steps{list-style:none;padding:0;text-align:left;max-width:380px;margin:26px auto 0;color:#c3c3cc;font-size:14px}
.steps li{margin:7px 0}.steps b{color:#fff}
.foot{margin-top:26px;color:#8f8f99;font-size:13px}.foot b{color:#e9e9ee}
.enjoy{margin-top:10px;color:var(--accent);font-weight:600}
</style></head>
<body><div class="card">
<svg class="logo" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b52d6"/><stop offset="1" stop-color="#8a63e8"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="url(#lg)"/><g transform="translate(32 33) scale(1.55) translate(-12 -12)" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><path d="M16 8 2 22"/><path d="M17.5 15H9"/></g></svg>
<h1>Thank you! 🎉</h1>
<p class="sub">You just unlocked <b>SemantiNote Pro</b> — yours for life. Here's your product key:</p>
<div class="klabel">Your product key</div>
<div class="key" id="k">Loading your key…</div>
<button class="copy" id="c" hidden>Copy key</button>
<ol class="steps">
<li><b>1.</b> Open SemantiNote</li>
<li><b>2.</b> Click <b>Enter product key</b> (or the badge in the status bar)</li>
<li><b>3.</b> Paste your key and hit <b>Activate</b> — done forever</li>
</ol>
<p class="foot">📧 We've also emailed your key to you. Pay once — <b>yours forever</b>: no subscription, no monthly fees. Keep it to re-activate on your other devices.</p>
<p class="enjoy">Enjoy your private AI notebook. 💜</p>
</div>
<script>
var sid=new URLSearchParams(location.search).get("session_id"),k=document.getElementById("k"),c=document.getElementById("c");
function show(v){k.textContent=v;c.hidden=false;c.onclick=function(){navigator.clipboard.writeText(v);c.textContent="Copied!";setTimeout(function(){c.textContent="Copy key"},1500)}}
function poll(n){if(!sid){k.textContent="No purchase found";return}
fetch("/key?session_id="+encodeURIComponent(sid)).then(function(r){return r.ok?r.json():Promise.reject()}).then(function(d){show(d.key)}).catch(function(){if(n>0)setTimeout(function(){poll(n-1)},1500);else k.textContent="Still processing — refresh in a moment."})}
poll(6);
</script></body></html>`;

// Verify Stripe's webhook signature (so nobody can fake a "paid" event).
async function stripeSigValid(rawBody, sigHeader, secret) {
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set on the Worker");
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

// Email the buyer their product key via Resend (best-effort — the thank-you page
// still shows the key if this fails). Needs the RESEND_API_KEY secret + a verified
// sending domain (semantinote.com). "from" must be an address on that domain.
const EMAIL_FROM = "SemantiNote <keys@semantinote.com>";
async function sendKeyEmail(env, to, key) {
  if (!env.RESEND_API_KEY || !to) { return; }
  const html = `<!doctype html><html><body style="margin:0;background:#141418;padding:32px;font:16px/1.55 -apple-system,Segoe UI,Roboto,sans-serif;color:#e9e9ee">
<div style="max-width:520px;margin:0 auto;background:#1b1b21;border:1px solid #2c2c34;border-radius:16px;padding:36px 32px;text-align:center">
<div style="font-size:26px;font-weight:700;margin-bottom:6px">Thank you! 🎉</div>
<p style="color:#a9a9b4;margin:0 0 22px">You just unlocked <b>SemantiNote Pro</b> — yours for life. Here's your product key:</p>
<div style="font:800 24px/1.3 ui-monospace,Menlo,monospace;letter-spacing:2px;color:#fff;background:linear-gradient(135deg,rgba(91,82,214,.22),rgba(138,99,232,.12));border:1px solid #3a3a45;border-radius:14px;padding:18px 12px">${key}</div>
<div style="text-align:left;max-width:380px;margin:24px auto 0;color:#c3c3cc;font-size:14px">
<p style="margin:6px 0"><b>1.</b> Open SemantiNote</p>
<p style="margin:6px 0"><b>2.</b> Click <b>Enter product key</b> (or the badge in the status bar)</p>
<p style="margin:6px 0"><b>3.</b> Paste your key and hit <b>Activate</b> — done forever</p>
</div>
<p style="margin-top:24px;color:#8f8f99;font-size:13px">Pay once — <b style="color:#e9e9ee">yours forever</b>. No subscription, no monthly fees. Keep this email so you can re-activate on your other devices.</p>
<p style="margin-top:8px;color:#a99be6;font-weight:600">Enjoy your private AI notebook. 💜</p>
</div></body></html>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "authorization": `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject: "Your SemantiNote Pro key 🔑", html }),
    });
  } catch (e) { /* best effort */ }
}

export default {
  async fetch(request, env) {
   try {
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
        // Idempotent: if this session already has a key (Stripe retries), reuse it.
        let key = await env.LICENSES.get(`s:${session.id}`);
        if (!key) {
          key = generateKey();
          await env.LICENSES.put(`k:${key}`, "active");          // key → status (app checks this)
          await env.LICENSES.put(`s:${session.id}`, key);        // session → key (success page reads this)
          const email = session.customer_details && session.customer_details.email;
          if (email) {
            await env.LICENSES.put(`e:${email.toLowerCase()}`, key); // email → key (retrieval)
            await sendKeyEmail(env, email, key);                     // email the buyer their key
          }
        }
      }
      return json({ received: true });
    }

    // 2a) Self-contained thank-you page (Payment Link can redirect straight here).
    if (request.method === "GET" && url.pathname === "/thanks") {
      return new Response(THANKS_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    }

    // 2b) Success page fetches the buyer's key by their Stripe session id.
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
   } catch (e) {
    // Surface the real reason instead of a bare 500 (e.g. missing webhook secret).
    return json({ error: (e && e.message) ? e.message : String(e) }, 500);
   }
  },
};
