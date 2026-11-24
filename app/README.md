# Domo: trusted COD orders

Two-sided accounts and reputation for Tunisian social-commerce sellers and their customers.
Cloudflare Worker + D1 + static PWA, with no runtime dependencies.

## Run locally
```bash
npm install
npx wrangler d1 migrations apply wsel --local
npx wrangler dev            # http://localhost:8787
```

## Deploy (Cloudflare Pages → https://patricksly.pages.dev)
The D1 database `wsel` already exists and has its schema; `pages/wrangler.toml` points to it.
```bash
npm install
npx wrangler login            # or set CLOUDFLARE_API_TOKEN
npm run deploy:pages          # builds dist/ (static files + _worker.js) and deploys project "patricksly"
```
Schema changes later: `cd pages && npx wrangler d1 migrations apply wsel --remote`.

## Deploy as a plain Worker (alternative, URL uses the account's workers.dev subdomain)
```bash
npx wrangler login
npx wrangler d1 create wsel                    # copy the database_id into wrangler.toml
npx wrangler d1 migrations apply wsel --remote
npx wrangler deploy
```
Then attach your domain in the Cloudflare dashboard (Workers → wsel → Settings → Domains).

## How trust works
- **Phone verification is free.** Each order has a secret link (`/?o=…`) in the seller's WhatsApp message.
  Opening it proves access to that number. A customer who creates or logs into an account from that link
  gets a verified number, and every order sent to that number is linked to them.
- **Only verified customers have a public score.** Numbers without an account are only visible to the seller
  who entered them (their own history), never shared between sellers.
- **Reviews only after a real order** that was delivered or refused, one review per side per order.
- **Double-blind:** a review stays hidden until the other side reviews too, or 14 days pass.
- **Order status locks once reviewed**, so a seller can't flip a delivered order to "refused" afterwards.
- **Right of reply and reporting:** the person reviewed can reply publicly once and report a review.
- **Score (0–100):**
  - customer = 70% delivery reliability (delivered vs refused) + 30% ratings, both starting from a neutral prior;
  - seller = ratings.
  - "Nouveau" until 3 orders or reviews.
- Customers appear to others as "Amira B."; sellers as their shop name.
- Deleting an account removes reviews about you; reviews you wrote stay, anonymised.

## API (all JSON, `Authorization: Bearer <token>`)
| Method | Path | Who |
|---|---|---|
| POST | /api/auth/register · /api/auth/login · /api/auth/logout | all |
| GET/PATCH/DELETE | /api/me | all |
| GET/POST | /api/orders · PATCH/DELETE /api/orders/:id | seller |
| GET | /api/lookup?phone= | seller |
| GET | /api/my-orders | customer |
| GET | /api/claim/:token · POST /api/claim/:token/respond | public |
| POST | /api/claim/:token/link | customer |
| POST | /api/reviews · GET /api/reviews/todo | all |
| GET | /api/profile/:id | all |
| POST | /api/reviews/:id/reply · /api/reviews/:id/report | person reviewed |

## Storefronts
- Each seller has a storefront at `/?shop=<slug>`: cover, logo, bio, rating and review count, delivered-order count,
  category chips (horizontal scroll, sticky), product grid with photos, product sheet, cart (kept per tab) and checkout.
- Sellers edit it in **Boutique**: cover, logo, bio (autosave), products with photo, price, category, description, visibility.
- Photos are resized in the browser before upload (cover 1600px wide 16:6, logo 512px, products 1000px square, WebP or JPEG)
  and served from `/media/<key>` with a one-year immutable cache.
- Storage: images live in the D1 `media` table until R2 is enabled. Then create the `wsel-media` bucket and uncomment
  the `[[r2_buckets]]` block in `pages/wrangler.toml`: new uploads go to R2, old ones keep working.

## Store search, store IDs, secure purchase
- **Explorer** (`/?explore`, also a tab for customers): search stores by name, product, city or category, ranked by trust.
  Every store has a short **ID** (e.g. `DY-7K3P`) that customers can type; `/?explore=DY-7K3P` opens the result directly.
- **Achat sécurisé** (seller opt-in in Boutique): buyer pays 3 % (2–15 DT) at checkout; the parcel can be opened before paying,
  free return if not as described, problem report up to 7 days after delivery. Fee stored in `orders.secure_fee`,
  owed to Domo, shown in the seller's stats; courier CSV has an "Ouverture du colis" column.
- **Disputes**: customer reports from the order link; seller answers (exchange / take back and refund / refuse with a reason);
  the customer sees the answer. An admin view for escalations is not built yet.

## Messages and in-app calls
- Customers and sellers chat inside Domo (Messages: top-bar icon on phones, sidebar on desktop). Customers start from a
  storefront ("Message"); sellers can write to customers who ordered with a Domo account. Quick replies, order cards,
  "Vu" read receipts, a gentle reminder to stay in the app when a phone number is typed.
- Voice calls: WebRTC, audio goes directly between the two phones and is encrypted (DTLS-SRTP). Phone numbers are never
  shared. Signalling (offer/answer/ICE) goes through D1; an incoming call shows within ~5 s while the app is open.
  Calls are logged in the conversation (duration, missed, declined).
- **Make calls connect on every network (recommended):** some mobile networks block direct connections. Create a TURN
  key in the Cloudflare dashboard (Realtime → TURN), then:
  ```
  cd pages
  npx wrangler pages secret put TURN_KEY_ID --project-name patricksly
  npx wrangler pages secret put TURN_KEY_API_TOKEN --project-name patricksly
  ```
  Without them, calls use STUN only and may fail on some carrier networks.
- Limits: no push notifications yet (incoming calls ring only while Domo is open); polling every 3–5 s, which is fine
  for launch — move to WebSockets (Durable Objects) when traffic grows.

## Notifications (Android, iOS, desktop)

Two layers:
- **In-app notification centre** (bell icon, `#notifs`). Stored in D1 (`notifications` table), unread count comes back with `/api/inbox/poll`, app icon badge via `setAppBadge`.
- **Web Push** (works with the app closed). Standard Web Push: aes128gcm encryption (RFC 8291) + VAPID (RFC 8292), implemented in the Worker with WebCrypto, no dependencies. Subscriptions live in `push_subs`; dead ones (404/410) are pruned automatically.

What triggers a notification:
- Seller: new order (storefront or API), customer confirmed/cancelled through the WhatsApp link, dispute opened, new review, new message, incoming call, missed call.
- Customer: order confirmed / shipped / delivered, dispute resolved, new review, new message, incoming call.

Platform support:
- **Android** (Chrome, Edge, Samsung Internet, Firefox): works in the browser, better once installed ("Ajouter à l'écran d'accueil").
- **iPhone / iPad**: iOS/iPadOS 16.4+ and **only after adding Domo to the home screen** (Share → "Sur l'écran d'accueil"), then opening it from the icon and tapping "Activer". The app shows these steps automatically on iOS Safari.
- **Desktop**: Chrome, Edge, Firefox, Safari 16+.

Where users turn it on: the prompt card on the orders page, Réglages → Notifications (sellers), Profil → Notifications (customers), or the notification centre. "Envoyer un test" sends a test push.

Configuration:
- `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` in `pages/wrangler.toml` `[vars]`.
- `VAPID_PRIVATE_JWK` as a secret (never commit it): `npx wrangler pages secret put VAPID_PRIVATE_JWK --project-name patricksly`.
- Generate a new key pair with: `node -e "crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign']).then(async k=>{const j=await crypto.subtle.exportKey('jwk',k.privateKey);const r=Buffer.from(await crypto.subtle.exportKey('raw',k.publicKey));console.log(r.toString('base64url'));console.log(JSON.stringify(j))})"`. Changing keys invalidates existing subscriptions (users re-enable once).
- Endpoints: `GET /api/push/key`, `POST /api/push/subscribe`, `POST /api/push/unsubscribe`, `POST /api/push/test`, `GET /api/notifications`, `POST /api/notifications/read` (`{id}` or `{all:true}`).

## Domains

- https://domo.tn and https://www.domo.tn → promo page (Pages project `domo-tn`, source in `../domo-site/index.html`; its buttons use `const APP='https://app.domo.tn'`).
- https://app.domo.tn → the app (Pages project `patricksly`; https://patricksly.pages.dev still works).
- DNS (Cloudflare zone domo.tn): CNAME `@` and `www` → domo-tn.pages.dev, CNAME `app` → patricksly.pages.dev, all proxied.
- App deep links: `/?start=seller|customer|driver` opens sign-up on that tab, `/?explore`, `/?track=DM-XXXXXX`.

## Spaces: buyer, seller, driver

- **One person, two spaces.** A buyer can open a shop (Compte → Mes espaces → « Devenir vendeur ») and a seller can activate a buyer space. Both rows share the same phone, password and a `link_id`; `POST /api/account/switch` swaps the session without logging in again. If an account already exists with that number, its password is asked once to link it.
- Notifications reach the device whichever space it is open in; the link carries `?as=seller|customer` and the app switches automatically.
- **Profile settings** (`#compte`): photo, name, city, password (current password required), sign out other devices, theme (auto / light / dark), mute notification categories (still kept in the bell), hide city on the public profile, delete account.

## Badges

Computed on the server from real activity (cached per user for 6 h, refreshed after deliveries, reviews and verification). Public profiles, storefronts and the profile sheet show earned badges; the owner also sees the next badges with a progress bar.
- Sellers: Vendeur vérifié, 10 / 100 / 500 livraisons, Très bien noté, Expédition rapide, Zéro litige, Livré par Domo, Pionnier.
- Customers: Numéro vérifié, Client fiable, 10 / 50 colis acceptés, Client fidèle, Avis utiles, Pionnier.
Definitions live in `BADGES` in `src/worker.js`.

## Verified sellers

Seller uploads a photo of their CIN, RNE or patente (Compte → Vérification). Files go to the private `docs` table (never served by `/media`, only to admins through `/api/admin/docs/...`). An admin accepts or refuses with a reason; the seller is notified and gets the blue check on the storefront, Explore, order links and tracking.

## Domo delivery (your own drivers)

1. Seller saves a pickup address (Réglages → Livraison Domo), confirms an order, taps **Livreur Domo**. Fee: `DELIVERY_FEE` (8 DT), deducted from the payout.
2. Admin console → **À attribuer**: pick a driver (active / on duty / same city first). The driver gets a push.
3. Driver app (`Je livre` tab at login): Tournée → « Colis récupéré » (order becomes shipped, customer notified) → « Livré · X DT encaissés » (delivered, cash recorded), or « Refusé » / « Injoignable » / « Colis rendu ».
4. Caisse: cash the driver must hand over. Admin → Livreurs → « Encaisser » once received.
5. Admin → Versements: amount owed to each shop (cash − delivery fees); « Marquer versé » notifies the seller. Sellers see « Versements Domo » in Stats.
Drivers apply from the login screen or from Compte; the admin activates, suspends or creates driver accounts. Driver sessions use `drv_` tokens and can only call the driver routes.

## Admin console

Set the admins' phone numbers in `pages/wrangler.toml` → `ADMIN_PHONES = "50111222,22333444"` (any buyer or seller account with that number gets the console: shield icon in the header on phones, « Console Domo » in the sidebar on desktop). Other settings: `DELIVERY_FEE`, `DRIVER_PAY` (shown to drivers as estimated earnings).

## Illustrations

Empty states, login (mobile), order confirmation, storefront receipt and tracking use vector illustrations from **unDraw** (free for commercial use, no attribution required, see `public/ill/LICENSE.txt`).
- Files: `public/ill/*.svg`, loaded on demand with `ill('name')` and inlined so they take the app colors (`--ud-a` accent, `--ud-k` ink, `--ud-b` light shapes, `--ud-w` white), including dark mode. Cached by the service worker.
- To add one: download from undraw.co, run `npx svgo`, replace `fill="#6c63ff"` with `class="ua"`, dark greys with `class="uk"`, light greys with `class="ub"`, white with `class="uw"`, save to `public/ill/<name>.svg`, then use `${ill('<name>')}`.

## Integrations
- **Public order page**: `/?shop=<slug>&src=<canal>` (canal: Facebook, Marketplace, Instagram, WhatsApp, Site web).
  Customers pick products from the seller's catalogue, get a tracking ID, can confirm right away.
  Add `&embed=1` to embed it in a website (`<iframe>` code is in the Boutique tab).
- **Tracking**: every order has an ID `DM-XXXXXX`. Public page `/?track=DM-XXXXXX` shows status and steps
  (no name, phone or address). WhatsApp template variables `{ref}` and `{suivi}`.
- **Seller API** (server-to-server, key created in Boutique → API, stored hashed):
  ```
  POST /api/v1/orders         Authorization: Bearer wsk_…
       {"name","phone","gov","addr","items","price","src","notes","external_id"}
       → {"ref":"DM-7K3P9Q","status":"new","claim_token":"…"}   (same external_id twice = no duplicate)
  GET  /api/v1/orders/DM-7K3P9Q  → status
  ```
  `/api/shop/*`, `/api/track/*` and `/api/v1/*` send CORS headers.
- **Facebook Messenger automation** (auto-reply with the order link, orders from chats) needs a Meta app
  with the `pages_messaging` permission approved by Meta (Business verification + App Review). Not built yet.
- **Marketplace** has no public API for messages or listings: share the order link in chats instead.

## Before going public
- Declare the personal-data processing to the INPDP (Tunisian data-protection authority) and publish
  terms + privacy policy that explain scores and reviews.
- Add a moderation screen for reported reviews (they are flagged in `reviews.reported`).
- Add rate limiting on login and lookup (Cloudflare rate-limiting rules or a Durable Object).
- Seller identity is not verified yet (consider ID or business registration for a "vendeur vérifié" badge).

## Domo Boost (social media and digital marketing service)

Shops pick a plan in the app (`#boost`, also linked from Boutique, Compte and the desktop sidebar) or compose an à la carte request. Domo then manages their social media and marketing according to the plan.

- Plans and prices live in `BOOST_PACKS` / `BOOST_EXTRAS` in `src/worker.js` (the single source of truth; the app reads them from `GET /api/boost`).
- `POST /api/boost/requests` creates a request (total computed server-side, max 3 pending). Shops can cancel while it is pending.
- Admins handle requests in Console Domo → Domo Boost. "Activer" marks the payment received, starts a 30-day period and sets `users.featured_until` (7, 14 or 30 days, plus extra "À la une" weeks).
- Featured shops are listed first in Explorer with a "Sponsorisé" label. Paying never changes the trust score, badges or reviews.
- No online payment: the team contacts the shop on WhatsApp.
- Migration: `migrations/0008_boost.sql`.

## Public pages, SEO and abuse limits
- `/s/<slug>` serves the app with the shop's own title, description and image in the head (link previews, indexing); `/?shop=<slug>` still works. `/robots.txt` and `/sitemap.xml` are generated by the worker.
- `GET /api/track/:ref` is limited to 30 requests per minute per IP (`rate_hits` table, migration 0009).
- Drivers no longer receive customer or pickup phone numbers once a job is delivered or returned.
