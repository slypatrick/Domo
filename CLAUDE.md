# Domo — handbook for every session

Domo (ex-Wsel) is a Tunisian COD (cash on delivery) order-confirmation platform for social-media sellers.
- **app.domo.tn** — the app (sellers, buyers, delivery drivers, admin). Folder `app/`.
- **domo.tn** — the marketing site for sellers. Folder `site/`.
- `docs/strategy-2027/` — the DOMO 2027 strategy package.

## How to work
- Language of the product: French first, Arabic (RTL) layer, user-facing copy in plain words.
- Implement directly, test, never claim untested work. Test on phone sizes (360/390) and desktop (1280), in the WebKit (iPhone) engine as well as Chromium.
- **Deploying = pushing to `main`.** GitHub Actions (`.github/workflows/deploy.yml`) deploys `app/` to Cloudflare Pages project `patricksly` and `site/` to project `domo-tn`, and applies new D1 migrations from `app/migrations/`. No Cloudflare token is needed in a session.
- After a push, check the Actions run, then verify live: `curl -s https://app.domo.tn/sw.js | grep -o "domo-v[0-9]*"`.
- Bump the service-worker cache name in `app/public/sw.js` (`domo-vNN`) on every app release so phones pick up the new version.
- Never commit secrets (`.dev.vars`, tokens, the VAPID private key). Never put tokens in docs, memory or chat.

## App architecture (`app/`)
- Frontend: one file, `public/index.html` (vanilla JS, hash routes like `#commandes`, `#boutique`, `#tournee`, `#admin`). Public pages use query strings: `/?shop=<slug>`, `/?explore`, `/?track`, `/?o=<claim>`, `/?reset=<token>`.
- Backend: `src/worker.js` — Cloudflare Pages advanced mode (`dist/_worker.js`), routes registered with `on('METHOD', '/api/...', handler, {public})`.
- Database: Cloudflare D1 `wsel` (id `dcb57cc9-05a1-4638-a324-398b247d3ad8`). Migrations are numbered SQL files in `app/migrations/` (latest: `0013_pw_resets.sql`). Add a new numbered file for every schema change; never edit applied ones.
- Config: `app/pages/wrangler.toml` (vars: VAPID public key, DELIVERY_FEE, DRIVER_PAY, ADMIN_PHONES). Secret `VAPID_PRIVATE_JWK` lives only in Cloudflare.
- Admin console: sellers whose phone is in `ADMIN_PHONES` (currently 29415587) see the shield icon → `#admin`.
- Password reset is admin-assisted: user requests on sign-in → appears in admin dashboard → admin sends a one-time WhatsApp link (24 h).

## Local development
```bash
cd app && npm install
rm -rf dist && cp -r public dist && cp src/worker.js dist/_worker.js
cd pages
npx wrangler d1 migrations apply wsel --local --persist-to /tmp/domo-state
npx wrangler pages dev ../dist --port 8788 --persist-to /tmp/domo-state --binding "ADMIN_PHONES=50111222"
```
Then create test accounts through the sign-in screen (seller, buyer, driver) and use phone 50111222 for a local admin seller.

## Design rules learned the hard way
- **CSS class names collide**: `.th` (chat header), `.dl`, `.chart`, `.sbody` already caused bugs. Prefix new component classes (e.g. `ckth`, `pth`, `kdelta`, `shbody`).
- `<nav>` elements inherit the bottom-bar styles; use `<div role="navigation">` for in-page navs.
- Forms: errors appear under each field via `validate([[el,msg],...])` / `setErr`; phone placeholders read `ex. 22 123 456`; one column on phones.
- One main action per card; rare actions go in the `⋯` menu (`omenu`). Bottom sheets on phones.
- Paused features (protected purchase / "Achat sécurisé") must not be shown or advertised.
- Visual direction (Nov 2026): Uber Eats clarity + Etsy photo-first warmth. Buyer side: borderless photo-first product and shop cards, round "+" on the photo, grey pill chips (`--chip`) with black selected (`--cta`), black pill CTAs for cart/checkout. Domo blue (`--brand`) stays for links, brand and seller tools. Status tabs use the same black selected pill. Restyle rules live in the last CSS blocks of `index.html` ("Design upgrade" and "Commerce restyle").
- Fonts: Bricolage Grotesque (titles) + Instrument Sans (text) for French; **Cairo** for Arabic (loaded on demand when the language is Arabic; a 1-glyph Cairo subset renders the "ع" button). Never add `text=` to the main Google Fonts link: it subsets every family in that request.
- UX critique and history: see the Domo project doc `claude/domo-ux-critique-2026-11.md`.

## Not done yet
- Google Play (Trusted Web Activity) — needs `/.well-known/assetlinks.json` with the signing fingerprint once the package exists.
- App Store — needs a Capacitor shell with native features (push, camera, share, Face ID) and an Apple developer account.
- Native Arabic review; password reset by SMS/WhatsApp code once a provider is chosen.
