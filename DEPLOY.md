# SemantiNote — Deploy, Sell & Market (beginner step-by-step)

This is a complete, click-by-click guide. It assumes you've never done any of this
before. Do the parts in order. **Everything here can be started for $0 with no
credit card** — you only pay a small % *per sale* once money is actually coming in.

**The big picture:**
1. Put the **website** on GitHub Pages (free).
2. Keep your **source code private** (free) but let people **download the app** (free).
3. Set up **selling + product keys** (free to start; a small cut per sale).
4. (Optional) Buy a **custom domain** (~$10/year).
5. **Market it** so people actually find it.

---

# Part 1 · Put the website online (GitHub Pages)

The site (this `semantinote-web` folder) is plain static files, so hosting is free.

### 1.1 Make a GitHub account
1. Go to **https://github.com** → click **Sign up** (top right).
2. Enter email → password → a username (this becomes part of your web address, e.g.
   `yourname.github.io`) → verify the puzzle → verify your email.
3. Pick the **Free** plan. No credit card.

### 1.2 Create the website repository
1. Top-right **＋** → **New repository**.
2. **Repository name:** `semantinote-web` (or anything).
3. Set it to **Public** (this repo has NO source code — just the website + later the
   installer downloads).
4. Leave the rest default → **Create repository**.

### 1.3 Upload the website files
Easiest (no command line):
1. On the new repo page → **uploading an existing file** link.
2. Open your `semantinote-web` folder on your computer, select **all** its contents
   (`index.html`, `features.html`, `download.html`, `DEPLOY.md`, the `assets` folder,
   and the hidden `.nojekyll` file) and **drag them into the browser**.
   - If you can't see `.nojekyll` (hidden file): on Mac press **⌘ + Shift + .** in
     Finder to show hidden files, then drag it in too. It's important.
3. Scroll down → **Commit changes**.

### 1.4 Turn on GitHub Pages
1. In the repo → **Settings** (top tab) → **Pages** (left sidebar).
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. **Branch:** `main`, **Folder:** `/ (root)` → **Save**.
4. Wait ~1 minute, refresh. A green banner shows your live URL, e.g.
   `https://yourname.github.io/semantinote-web/`. HTTPS is automatic. **Done — you're live.**

> Because all links are relative, it works at that `/semantinote-web` sub-path or at a
> root domain later.

---

# Part 2 · Protect your source code (two repos)

GitHub ties download visibility to repo visibility:
- **Private repo → private downloads** (only you can get them). Private repos are **free**.
- **Public repo → public downloads** (anyone can).

So you can't have "source hidden" and "installer public" in one repo. Use two:

| Repo | Visibility | Holds |
|---|---|---|
| `semantinote-app` | **Private** (free) | All your app source code |
| `semantinote-web` | **Public** | The website + the built `.dmg`/`.exe` downloads |

**To make the private source repo:** repeat step 1.2 but name it `semantinote-app` and
choose **Private**. Upload your `semantinote-app` folder there.

> ⚠️ **Honest caveat:** a private repo hides your *repository*, but the shipped app's
> JavaScript can still be extracted from it (`app.asar` is bundling, not encryption).
> That's true of every Electron app (Slack, VS Code…). It's fine — your license check is
> **server-side**, so reading the code doesn't let anyone forge keys. Don't over-invest
> in hiding code. (Optional hardening later: Electron "Fuses" for asar integrity + a JS
> obfuscator — see `semantinote-app/BUILD.md`.)

---

# Part 3 · Host the installers (GitHub Releases, not Pages)

GitHub Pages caps files at **100 MB**; your installers are bigger. Put them on
**Releases** (up to **2 GB** each), on your **public** `semantinote-web` repo:

1. Build the installers (see `semantinote-app/BUILD.md`): a macOS
   `SemantiNote-<version>-universal.dmg` and a Windows `SemantiNote-<version>-Setup.exe`.
2. In the **public** repo → **Releases** (right sidebar) → **Create a new release**.
3. **Tag:** `v0.1.0` → **Title:** `SemantiNote 0.1.0`.
4. **Drag the `.dmg` and `.exe`** into the "Attach binaries" box → **Publish release**.
5. Your permanent download links become:
   - `https://github.com/<you>/semantinote-web/releases/latest/download/SemantiNote-universal.dmg`
   - `https://github.com/<you>/semantinote-web/releases/latest/download/SemantiNote-Setup.exe`
   (`releases/latest/download/...` always points at your newest release.)
6. In `download.html`, replace the two disabled **"Coming soon"** buttons (there's a
   `<!-- TODO -->` comment marking them) with links to those URLs. Re-upload
   `download.html` to the repo (drag-and-drop again → Commit).

---

# Part 4 · Sell it + product keys

Your app already has the licensing built in: a **14-day free Pro trial**, then it asks
for a product key. You just need (a) a way to take payment and hand out keys, and (b) a
tiny endpoint the app calls to check a key. Two tracks — pick one.

## Track A — Gumroad (easiest; recommended to start) 🟢
Gumroad handles checkout, **taxes**, **generating the key**, and **emailing it** to the
buyer automatically — near-zero code. Fee ~10%. No credit card to sign up; you connect a
bank/PayPal to get paid.

### 4A.1 Create the product
1. Go to **https://gumroad.com** → **Start selling** → sign up (email + password).
2. Dashboard → **Products** → **New product** → type **Digital product**.
3. Name: `SemantiNote Pro`, price **$14.99**, "call to action" = *I want this!*.
4. Scroll to **Settings → check "Generate a unique license key per sale."** ✅ (This is
   the key part.)
5. **Publish**. Copy the product's **URL** (e.g. `https://yourname.gumroad.com/l/semantinote`)
   and its **product ID / permalink** (Settings → the part after `/l/`).
6. Get your **access token:** Gumroad → **Settings → Advanced → Applications →
   Generate access token.** Copy it.

### 4A.2 Make the tiny validator (Cloudflare Worker — free, no card)
The app calls one URL to check a key; this Worker asks Gumroad if the key is real.

1. Go to **https://dash.cloudflare.com** → **Sign up** (email + password, verify email).
   **No credit card** for the free plan.
2. Left sidebar → **Workers & Pages** → **Create** → **Create Worker** → name it
   `semantinote-license` → **Deploy** → then **Edit code**.
3. Delete the sample code, paste this, and edit the two constants at the top:
   ```js
   const GUMROAD_PRODUCT_ID = "your_permalink_here"; // the part after /l/
   const GUMROAD_TOKEN = "your_access_token_here";
   export default {
     async fetch(req) {
       const key = new URL(req.url).searchParams.get("key");
       const cors = { "content-type": "application/json", "access-control-allow-origin": "*" };
       if (!key) return new Response(JSON.stringify({ valid: false, error: "No key" }), { headers: cors });
       const r = await fetch("https://api.gumroad.com/v2/licenses/verify", {
         method: "POST",
         headers: { "content-type": "application/x-www-form-urlencoded" },
         body: new URLSearchParams({
           product_id: GUMROAD_PRODUCT_ID,
           license_key: key,
           access_token: GUMROAD_TOKEN,
           increment_uses_count: "false",
         }),
       });
       const data = await r.json();
       return new Response(JSON.stringify({ valid: !!data.success }), { headers: cors });
     },
   };
   ```
   > Tip: for real security put `GUMROAD_TOKEN` in **Settings → Variables → Add variable
   > (Encrypt)** instead of hard-coding it, and read it as `env.GUMROAD_TOKEN`.
4. **Deploy**. Copy the Worker URL (e.g. `https://semantinote-license.yourname.workers.dev`).

### 4A.3 Wire it into the app
In `semantinote-app/src/main/license.ts`, set:
```js
const VALIDATE_URL = "https://semantinote-license.yourname.workers.dev";
const BUY_URL = "https://yourname.gumroad.com/l/semantinote";
```
Rebuild the app. That's it — buyers get a key by email, paste it in, the app checks it
once, and never asks again. ✅

Also set the website Buy button (`download.html`, the `#buy` section) `href` to your
Gumroad URL.

## Track B — Stripe (lower fee ~3%, more setup) 🔵
Only worth it if you'd rather pay ~3% than ~10% and don't mind handling sales tax
yourself. Same idea, but **you** generate/store/email keys.

1. **https://stripe.com** → sign up → **Activate payments** (business details + a bank
   account for payouts; no credit card from you).
2. **Products → Add product** → `SemantiNote Pro`, one-time **$14.99** → save → create a
   **Payment Link** → copy its URL (that's your Buy button + `BUY_URL`).
3. Cloudflare Worker (as in 4A.2) but with a **KV** store:
   - Workers & Pages → **KV** → **Create namespace** `licenses`.
   - Your Worker → **Settings → Variables → KV Namespace Bindings** → bind it as `LICENSES`.
   - Worker does two things: on Stripe's **webhook** (`checkout.session.completed`)
     generate a random key, `LICENSES.put(key, "active")`, and email it; and on
     `GET ?key=` return `{ valid: (await LICENSES.get(key)) === "active" }`.
4. **Stripe → Developers → Webhooks → Add endpoint** → URL = your Worker → event
   `checkout.session.completed` → copy the **signing secret** into a Worker variable.
5. **Email the key:** sign up at **https://resend.com** (free 3,000/mo, no card), verify a
   sender, and have the Worker POST the key to Resend's API after a sale.
6. Set `VALIDATE_URL` (Worker) and `BUY_URL` (Payment Link) in `license.ts`; rebuild.

> Starting out, **Track A (Gumroad) is the smart move** — it removes tax, email, and key
> generation entirely. Switch to Stripe later once sales justify the extra plumbing.

### Testing the license flow now (no payment needed)
In **development only**, the app accepts the key **`SEMANTI-DEV-UNLOCK`** to simulate a
purchase (disabled in shipped builds). Use it to see the "Pro unlocked" state.

---

# Part 5 · (Optional) Custom domain — e.g. semantinote.com

**You don't need this to launch** — `yourname.github.io/semantinote-web` works free
forever. A custom domain just looks more professional.

### Important beginner facts
- **Domains are rented yearly, not bought once.** A `.com` is about **$10–12/year**, every
  year, to keep it. There's no "buy it once forever."
- **Truly free domains?** Not really worth it — old "free domain" sites (Freenom etc.) are
  unreliable and can take your name back. The genuinely free option is the
  **`github.io` subdomain you already have**. If you want a real custom name, budget ~$10/yr.
- **Cheapest legit registrars** (where you buy):
  - **Cloudflare Registrar** (`dash.cloudflare.com → Domain Registration`) — sold **at
    cost**, no markup, usually the cheapest (~$9–10/yr for `.com`), no upsells. Best value.
  - **Porkbun** — very cheap (~$9–11/yr), no nonsense.
  - **Namecheap** — cheap first-year deals (~$6–11), watch the renewal price.
  - Avoid GoDaddy's upsell maze for a first domain.

### Connect it to GitHub Pages (free HTTPS)
1. Buy the domain at one of the above.
2. In your **public repo → Settings → Pages → Custom domain** → type `semantinote.com` → Save.
3. At your registrar's **DNS** settings, add:
   - Four **A records** for `@` pointing to GitHub's IPs: `185.199.108.153`,
     `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
   - One **CNAME** record: `www` → `yourname.github.io`.
4. Back in GitHub Pages, tick **Enforce HTTPS** (may take an hour to appear). Done.

---

# Part 6 · Marketing — how people actually find it

**This is the part that decides whether you make sales.** A great app nobody hears about
sells nothing. These are the channels that have repeatedly worked for indie software,
roughly in launch order. Your angle is strong: **"100% private, on-device AI notes — your
data never leaves your computer."** Lead with that everywhere.

### Before you launch (build an audience of a few hundred)
1. **Build in public.** Post progress, screenshots, and your "why" on **X/Twitter**,
   **Reddit**, and **https://indiehackers.com**. People root for founders they've followed.
2. **Collect emails.** The download page has a "Notify me" box — wire it to a free list
   (Buttondown/ConvertKit free tier) so launch day isn't to an empty room.

### Launch week (do these on a Tue–Thu)
3. **Product Hunt** (`producthunt.com`) — the classic indie launch. Prep: a clear tagline,
   a 30-sec demo GIF/video, 5–6 screenshots, and a strong first comment telling the story.
   Reply to *every* comment all day. Ask friends to check it out (don't beg for upvotes —
   PH penalizes that; just share the link).
4. **Show HN on Hacker News** (`news.ycombinator.com`) — post titled
   **"Show HN: SemantiNote – private, on-device AI notes."** The privacy/local-AI angle is
   catnip here. Be humble, present in the comments, and share technical details.
5. **Reddit — the biggest lever for this product.** Post (value-first, not an ad; read each
   sub's rules) in: **r/LocalLLaMA**, **r/selfhosted**, **r/privacy**, **r/PKMS**,
   **r/ObsidianMD**, **r/NoteTaking**. A "I built a fully-local AI notes app, here's how it
   works" post + demo does far better than "buy my app."

### Ongoing (compounding)
6. **AlternativeTo** (`alternativeto.net`) — list SemantiNote as a private alternative to
   **Notion, OneNote, Evernote, Otter.ai, Obsidian**. Huge, long-tail discovery.
7. **SEO / comparison content** — a simple blog: "A private alternative to \<big app\>",
   "How to run AI notes fully offline", "Record Teams/Zoom meetings locally." These rank
   for years and bring buyers who are already looking.
8. **Awesome-lists & directories** — get added to `awesome-selfhosted`, `awesome-electron`,
   `awesome-privacy` (open a PR), plus Slant, SaaSHub. Free, durable traffic.
9. **Creators/YouTubers** — email privacy / local-AI / "second brain" YouTubers offering a
   free Pro key for an honest review. One good video can outsell everything else.
10. **Communities** — be genuinely helpful in relevant Discords/forums (LocalLLaMA,
    self-hosting, PKM). Mention the app only when it truly answers someone's question.
11. **Social proof** — the moment you get a happy user, ask for a one-line testimonial and
    add it to the site. Reviews sell.
12. **Let the free tier do the work** — a free, private notebook that spreads by word of
    mouth is your best long-term marketing; the paid AI converts the fans.

**Rule of thumb:** pick 2–3 of these and do them *well and repeatedly* rather than all of
them once. Reddit + Product Hunt + AlternativeTo alone can get a privacy tool its first
real customers.
