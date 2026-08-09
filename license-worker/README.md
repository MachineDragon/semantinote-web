# SemantiNote license backend (Cloudflare Worker · Stripe)

Free serverless backend that issues + checks product keys. Full click-by-click
instructions are in the main guide (`../../semantinote-app/START-HERE.md`, "Sell it
with Stripe"). Quick reference:

**What it does**
- `POST /webhook` — Stripe calls it after a paid checkout → generates a key, stores it.
- `GET /key?session_id=…` — the `thanks.html` page uses this to show the buyer their key.
- `GET /?key=…` — the app calls this to validate a key → `{ "valid": true|false }`.

**Deploy (free, no credit card)**
1. Cloudflare dashboard → **Workers & Pages → Create → Create Worker** → paste `worker.js`.
2. **KV**: Workers & Pages → KV → Create namespace `LICENSES` → bind it to the Worker as
   `LICENSES` (Settings → Variables → KV Namespace Bindings).
3. **Secret**: Settings → Variables → add (Encrypt) `STRIPE_WEBHOOK_SECRET`
   (from Stripe → Developers → Webhooks → your endpoint).
4. Deploy. Copy the Worker URL.

**Wire it up**
- App: `semantinote-app/src/main/license.ts` → `VALIDATE_URL = "<worker url>"`,
  `BUY_URL = "<your Stripe Payment Link>"`.
- Success page: `../thanks.html` → set `WORKER_URL` to the Worker URL.
- Stripe Payment Link → set its success URL to `https://<your-site>/thanks.html?session_id={CHECKOUT_SESSION_ID}`.

CLI alternative (`wrangler.toml` is included):
```bash
npm i -g wrangler && wrangler login
wrangler kv namespace create LICENSES   # paste the id into wrangler.toml
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler deploy
```
