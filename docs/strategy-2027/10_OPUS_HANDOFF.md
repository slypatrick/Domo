# 10 — Opus handoff: master brief, implementation batches, task template

Read this first, then `10_PRDS.md`. Strategy context is in 03 and 04; architecture in 08.

## 1. Master handoff

**Product in one line:** Domo lets a Tunisian social seller get each cash-on-delivery order confirmed by the buyer before shipping, and shows what happened to it afterwards.

**Repository:** `wsel-app/` — `src/worker.js` (API), `public/index.html` (PWA), `migrations/` (D1), `pages/wrangler.toml`. Site: `domo-site/`. Deploy: copy `public` to `dist`, `src/worker.js` to `dist/_worker.js`, `wrangler pages deploy` (project `patricksly`); migrations with `wrangler d1 migrations apply wsel --remote`.

**Rules for every batch:**

1. Additive migrations only. Never drop or rewrite existing user data.
2. Frozen modules (Domo delivery, protected purchase, cross-shop history, calls) stay in the code behind flags; do not extend them.
3. Buyer flows never require an account.
4. Wording: "confirmée par le client", never "vérifiée" or "garantie". Facts, not labels, about buyers.
5. Every new endpoint has: auth check, tenant filter, input validation, rate limit where public, and an API test.
6. Keep the front end dependency-free and the visual identity unchanged.
7. Test locally against a seeded D1, then on three viewports (360, 768, 1280). Never report something as deployed or tested unless it was.
8. The founder deploys or supplies a scoped token per session; never store tokens.

**Dependency map:**

```
B1 Foundation ──► B2 First order ──► B3 Value report ──► B4 Subscriptions ──► B6 Referral
      │                                                        │
      └────────────► B5 Courier files + reliability ◄──────────┘
                                   │
B4 ──► B7 Webhooks/API/plugin      ├──► B9b Courier booking (needs partner)
B4 ──► B8 Seats and bulk           │
B2 ──► B9a Arabic                  └──► P14 WhatsApp automation (alternative to B9b)
```

**Classification:** quick wins: flags, own-shop default, batch reminders. Foundations: B1, reliability part of B5. Core: B2, B3, B5. Revenue enablers: B4, B8. Growth enablers: B6, B7, B9a. Experimental: B9b, P14.

## 2. Implementation batches

Each batch is independently shippable. "Files" are likely touch points.

### B1 — Foundation and trust consolidation (first assignment; full text in §4)

### B2 — First order in three minutes
- **Objective:** median time from sign-up to first confirmation link under 3 minutes.
- **Scope:** PRD-03 (onboarding order), PRD-04 (paste-to-order, duplicate warning), PRD-05 (batch reminders, weekly summary).
- **Dependencies:** B1 events.
- **Files:** `public/index.html` (`onboarding()`, order form, list toolbar), `src/worker.js` (`/api/orders`, new `/api/orders/parse`, cron handler), new migration for `reminders_sent`.
- **Architecture decisions:** parser is deterministic and runs server-side; Cron Trigger added in `wrangler.toml`.
- **Acceptance tests:** 100 fixture messages parse with ≥85% correct phone and price; duplicate warning on same phone + overlapping items within 48 h; reminder batch opens WhatsApp once per order and records `reminder_sent`.
- **Risk controls:** parsed fields always editable before save; no message is sent automatically.
- **Done:** tests pass; pilot sellers use it for one week without a blocking bug.

### B3 — Value report
- **Scope:** PRD-06. Money saved = (orders not shipped because refused or unanswered at confirmation) × seller's courier fee (settings, default 8 DT) + return fee if set. Refusal rate by cause, governorate, product.
- **Files:** Stats screen, `/api/stats`.
- **Acceptance:** figures recompute exactly from `order_events` fixtures; formula shown to the seller.

### B4 — Subscriptions and billing
- **Scope:** PRD-07. Tables `subscriptions`, `usage_monthly`, `invoices`, `billing_events`; plans Gratuit/Pro/Business; metering of buyer-confirmed orders; soft limits; gateway integration behind an interface with a manual bank-transfer fallback; invoices; dunning; admin subscription tools; 60-day grace for existing users.
- **Architecture decisions required first:** which gateway (founder), invoice numbering and e-invoicing format (accountant).
- **Acceptance:** metering equals event count on fixtures; an order confirmed twice is counted once; downgrade keeps data; no feature is cut for a seller in grace; invoice totals correct to the millime with 19% VAT.
- **Risk controls:** dark launch; reconciliation report gateway vs invoices.

### B5 — Courier files and reliability
- **Scope:** PRD-08 (export per courier format, label sheet, status import, `shipments` table) and PRD-12 (media to R2 with lazy migration, API test suite, error capture, weekly export, restore drill, admin role and audit log).
- **Acceptance:** golden-file tests per courier; import maps courier statuses to Domo causes; images served from R2 with old URLs still working.

### B6 — Referral programme
- **Scope:** PRD-09. Reward on referred seller's activation only.

### B7 — Webhooks, API docs, WooCommerce plugin
- **Scope:** PRD-10. Signed webhooks (`order.confirmed`, `order.refused`, `order.status_changed`), retries, public docs page, minimal plugin that posts new orders and writes back status.

### B8 — Team seats, roles and bulk actions
- **Scope:** PRD-11. Roles owner/staff; staff cannot see billing or delete data; bulk status change and export.

### B9a — Arabic interface
- **Scope:** string catalogue, RTL styles, language switch, buyer page first.

### B9b — Courier booking with one partner (conditional) / P14 WhatsApp automation pack (alternative)
- **Scope:** defined after a partner agreement or a Meta business verification; write a PRD from the template at that time.

## 3. Reusable Opus task template

```
# Task: <ID> <name>
## Why (strategic objective and KPI)
## Current behaviour (with file and function references)
## Target behaviour (user-visible, step by step)
## Scope (exact) / Out of scope (explicit)
## Data changes (tables, columns, migration name; additive only)
## API changes (method, path, auth, request, response, errors, rate limit)
## UI changes (screen, states: empty, loading, error, success; copy in French)
## Business rules and validation
## Permissions and privacy
## Edge cases
## Acceptance tests (numbered, verifiable)
## Rollout (flag, cohort, migration order) and rollback
## Definition of done
- All acceptance tests pass locally against seeded data
- Checked at 360 / 768 / 1280 px, light and dark
- No console errors; service worker cache version bumped
- Founder walkthrough completed before deployment
## Report back
- What changed (files), what was tested and how, what was not tested, open questions
```

## 4. The first Opus assignment — B1 "Socle"

**Objective.** Make Domo measurable, safe to show to pilot sellers, and coherent around the confirmation wedge. KPIs enabled: North Star, activation rate, time to first link.

**Why first.** Without events nothing in the plan can be steered; without OTP and the trust defaults the pilot carries avoidable security and legal risk; freezing side products makes the offer understandable. It delivers one coherent result: a product that can be piloted and measured.

**Scope.**

1. **Analytics events (PRD-01).** Migration `0012_events.sql`: `events(id, name, seller_id, at, props JSON)`, index on `(name, at)` and `(seller_id, at)`. Server-side helper `track(env, name, sellerId, props)`. Emit: `signup_completed`, `order_created` (props: channel = manual | storefront | api), `confirm_link_sent` (new endpoint `POST /api/orders/:id/link-sent` called when the seller taps the WhatsApp button), `order_confirmed_by_buyer`, `order_refused_by_buyer`, `order_status_changed`, `reminder_sent`. No buyer phone, name or address in props.
2. **Admin metrics (PRD-01).** `GET /api/admin/metrics?from&to`: signups per day, activated sellers (≥5 `order_confirmed_by_buyer` within 30 days of signup), median minutes from signup to first `confirm_link_sent`, weekly active sellers, confirmation rate. New admin tab "Aujourd'hui" as the default tab.
3. **Phone OTP and password reset (PRD-02).** Provider behind an interface `sendOtp(phone, code)` with two drivers: `log` (development: code shown in server log) and `http` (configurable URL and key in env; provider chosen by founder). 6-digit code, 10-minute expiry, 5 attempts, rate limit 3 sends per phone per hour and 10 per IP per hour. Table `otps(phone, code_hash, purpose, expires_at, attempts)`. Sign-up requires OTP when `OTP_REQUIRED=1`; existing accounts are asked to verify at next login but are not locked out for 30 days. Reset flow: phone → OTP → new password → all sessions revoked. `users.phone_verified_at` added.
4. **Feature flags and freeze (PRD-13).** Table `flags(key, value)` plus per-seller overrides `seller_flags(seller_id, key, value)`. Flags: `delivery`, `secure_purchase`, `cross_shop_history`, `calls`. Defaults off. Sellers who have ever used a frozen feature keep it on through an override created by the migration (production: none have real usage). When off: UI entry points hidden, endpoints return 404 for that seller, storefront checkout hides the protection option, site copy updated in a separate site task.
5. **Own-shop history default (PRD-13).** With `cross_shop_history` off, `trust()` and badges use only orders where `seller_id` is the current seller; wording "Chez vous : 3 livrées, 1 refus du client". Minimum three orders before any level; ignore events older than 12 months.
6. **Buyer notice (PRD-13).** One sentence with a link on the confirmation page: what is recorded, that only this shop sees it, how to contest or request deletion. Privacy page updated to match.
7. **Admin access.** Replace the env allow-list with `users.is_admin` (migration sets it for phones in `ADMIN_PHONES` at deploy time; founder supplies the phone). Table `audit(actor_id, action, target, at, meta)`; every admin POST/PATCH writes a row.

**Explicitly out of scope:** onboarding redesign, paste-to-order, billing, any change to frozen modules' logic, visual redesign.

**Files likely involved:** `src/worker.js` (auth routes ~304–445, `trust()` ~150–169, claim routes ~571–640, shop order route ~841–880, admin routes ~1649–1900), `public/index.html` (sign-in/sign-up views, `badge()`, `custRisk`/`ownRisk`, `claimView`, `renderAdmin`, driver and delivery entry points, checkout protection option), `migrations/0012_events.sql`, `0013_otp_flags_admin.sql`, `pages/wrangler.toml` (new vars), `domo-site/confidentialite`.

**Business rules.** An order confirmed twice emits one event. Activation is computed, never stored. OTP codes are stored hashed. A seller can never read another seller's events.

**Acceptance tests.**

1. Creating an order, tapping the WhatsApp button and confirming as buyer produces exactly three events with correct `seller_id` and no personal data in `props`.
2. `/api/admin/metrics` returns the expected activation count on a seeded dataset of 10 sellers (fixture provided in the test).
3. Sign-up without a valid OTP fails when `OTP_REQUIRED=1`; six wrong attempts lock the code; the fourth send in an hour returns 429.
4. Password reset revokes existing sessions.
5. With flags off, a new seller sees no delivery, protection or call entry points; the related endpoints return 404; storefront checkout shows no protection fee.
6. Seller A's order view shows only A's history for a buyer who also ordered from seller B.
7. A buyer with two orders shows no level; with three, facts only.
8. Every admin action creates an `audit` row; a non-admin gets 403 on all `/api/admin/*`.
9. Existing seeded accounts can still log in; no existing order, review or product is altered (row counts equal before and after migration).
10. No horizontal scroll and no console error on sign-up, order list, buyer confirmation and admin at 360, 768 and 1280 px.

**Risk controls.** Migrations additive; `OTP_REQUIRED` and flags allow instant rollback by configuration; deploy to a preview branch first; export D1 before applying migrations.

**Definition of done.** All ten tests pass locally; founder completes a walkthrough on a phone; preview deployment checked; production deploy done by the founder or with a token supplied for that session; a short report lists what was and was not tested.
