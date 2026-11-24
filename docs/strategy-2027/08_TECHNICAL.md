# 08 — Technical assessment, target architecture, integrations

This document plans; it changes nothing. Facts are VERIFIED from the repository at `wsel-app/` and the production database unless marked.

## 1. Existing architecture

| Area | Today | Assessment |
|---|---|---|
| Hosting | Cloudflare Pages (project `patricksly`, app.domo.tn), advanced mode `_worker.js`; separate Pages project for domo.tn | Keep |
| Back end | One JavaScript worker file, ~2,000 lines, tiny router `on(method, pattern, handler)` | Works; split into modules |
| Database | Cloudflare D1 (`wsel`), 11 migrations, ~20 tables | Keep; adequate for years at this scale |
| Auth | Phone + password, PBKDF2-SHA256 100k iterations, session tokens in D1; roles seller/customer/driver; admin by phone allow-list env var | Add OTP, reset, admin role in DB, audit log |
| API | REST JSON under `/api`, public API v1 with keys | Add webhooks, versioning notes, docs |
| Storage | Images as blobs in D1 `media` (~47 KB cap) | Move to R2 |
| Background work | None (`ctx.waitUntil` only) | Add Cron Trigger for reminders, summaries, billing; Queues only if needed |
| Integrations | Web Push (VAPID); OSRM and Nominatim public servers (driver route); WhatsApp via `wa.me` links | Route/geocode only used by frozen delivery |
| Front end | One HTML file, ~2,400 lines of vanilla JS, hash routing, service worker (cache `domo-v19`) | Keep vanilla; split into ES modules with a build step that still emits one file |
| PWA | Manifest, service worker, push | Keep |
| Logging/monitoring | None beyond Cloudflare defaults | Add error capture and uptime check |
| Tests | None | Add API tests for money- and trust-related logic first |
| Secrets | VAPID private key as secret; API token handled by hand | Rotate; CI deploy with scoped token |

**Technical debt ranked:** no tests on trust and (future) billing logic; two very large files; media in D1; no monitoring; admin by env var; no data-retention jobs; frozen features entangled with core order code.

**Scalability:** at the aggressive case (358 merchants, ~35,000 orders a month) D1 and Workers are far below their limits (INFERRED from Cloudflare's published limits; check current plan limits). Scale is not the constraint; change safety is.

**Preserve, upgrade or replace:** preserve the stack; upgrade structure; replace nothing wholesale. A rewrite in a framework would cost weeks and add no merchant value.

## 2. Target architecture (PROPOSED)

A **modular monolith** on Cloudflare: one Worker, modules with clear boundaries. Separate services are not justified by one developer and a few hundred tenants.

```
domo.tn (static site)          app.domo.tn (PWA)
        \                        /
         Cloudflare Worker (router, auth, rate limit)
   ┌──────────┬───────────┬──────────┬───────────┬──────────┐
 accounts   orders     trust      billing    connect     admin
 (OTP,      (state     (evidence, (plans,    (API keys,  (metrics,
  seats)    machine,   own-shop   usage,     webhooks,   contests,
            reminders) history,   invoices,  courier     audit)
                       contests)  gateway)   files)
   └──────────┴─────┬─────┴──────────┴───────────┴──────────┘
                D1 (relational)   R2 (media, exports)   Cron Triggers
                                                         (reminders, usage, summaries, retention)
```

Cloudflare products used: Workers/Pages, D1, R2, Cron Triggers, Turnstile on sign-up. Not used by default: Queues (add only when webhook retries need it), Durable Objects, KV, Workers AI.

- **Multi-tenant isolation:** every seller-owned row carries `seller_id`; a single data-access helper adds the filter; tests assert that seller A cannot read seller B's rows.
- **Order state machine:** `new → confirmed | refused_by_buyer | no_answer → shipped → delivered | not_delivered(cause)`; transitions validated server-side; every transition is an `order_events` row with actor and time.
- **Trust evidence:** derived only from `order_events`; own-shop scope by default; cross-shop behind a feature flag.
- **Notifications:** push now; WhatsApp API later through one provider interface.
- **Financial events:** append-only `billing_events`; invoices numbered sequentially; no merchant funds held.
- **Analytics:** first-party `events` table with daily roll-ups; no third-party trackers on buyer pages.
- **Security:** OTP, session rotation, admin role with audit log, scoped deploy token, secret rotation, rate limits, Turnstile.
- **Monitoring:** error capture to a table plus daily email; external uptime ping.
- **Disaster recovery:** D1 Time Travel restore rehearsed once; weekly export to R2.

## 3. Build versus buy

| Need | Build | Buy / use | Cost and lock-in | Decision |
|---|---|---|---|---|
| Buyer messaging (default) | wa.me link (done) | — | Free, no lock-in | Keep |
| Automated messaging | — | WhatsApp Cloud API directly or via a provider | Per delivered message (Meta); Tunisian rate to verify; provider markup | Buy, Q3, behind an interface |
| OTP | — | WhatsApp authentication template or SMS vendor | Per OTP; get quotes for +216 | Buy |
| Payments | — | Local licensed gateway (prospects: Konnect, Flouci, Paymee, ClicToPay) | ~1.5–2.5% (M10) | Buy; fallback manual transfer |
| Courier | File export/import | Partner API | Per partner | Build export, then integrate |
| Phone/identity verification of sellers | Document upload (done) | — | — | Keep |
| Search | SQL LIKE (done) | — | — | Keep |
| Analytics | First-party events | — | — | Build (small) |
| Support | WhatsApp Business app + shared label system | Help desk later | Free | Keep |
| Marketing automation | — | Meta tools | — | Do not build |

## 4. Conceptual data model

Existing tables: `users, sessions, orders, order_events, reviews, products, media, conversations, messages, calls, notifications, push_subs, docs, verifications, drivers, driver_sessions, driver_push, boost_requests, rate_hits, geocache`.

| Object | Status | Key relationships and integrity rules |
|---|---|---|
| User / identity | Exists | Unique phone per role; add `phone_verified_at` |
| Merchant (seller) and store | Exists in `users` | Slug unique; add `plan`, `seats` |
| Team member | **Proposed** `members(seller_id, user_id, role)` | A member acts only within one seller |
| Product | Exists | Belongs to seller |
| Inventory | Not proposed in year one | — |
| Customer (buyer) | Exists implicitly by phone on orders | No global profile exposed across sellers by default |
| Order | Exists | Belongs to seller; `idem` unique per seller; state machine |
| Confirmation event | Exists in `order_events` | Append-only |
| Shipment | **Proposed** `shipments(order_id, courier, tracking_ref, status, cause, updated_at)` | One active shipment per order |
| Courier partner | **Proposed** `couriers(id, name, export_format)` | — |
| Payments and settlements (merchant cash) | Exists for frozen delivery | Not used |
| Subscription | **Proposed** `subscriptions(seller_id, plan, status, period_start, period_end, price)` | One active per seller |
| Usage | **Proposed** `usage_monthly(seller_id, month, confirmed_orders)` | Derived from events; recomputable |
| Invoice / billing event | **Proposed** `invoices`, `billing_events` | Sequential numbers; append-only |
| Marketing service | Exists `boost_requests` | — |
| Dispute / contest | Exists on orders | Decision and reason required |
| Trust evidence | Derived | Never stored as a label |
| Audit event | **Proposed** `audit(actor, action, target, at, meta)` | Append-only; all admin actions |
| Analytics event | **Proposed** `events(name, seller_id, at, props)` | No buyer personal data in props |
| Referral | **Proposed** `referrals(referrer_id, referred_id, status)` | Reward once, on activation |

## 5. Non-functional requirements

| Area | Requirement (no guarantee beyond the platform's) |
|---|---|
| Security | OTP at sign-up and reset; no secrets in repo; admin actions audited; dependency-free front end stays so |
| Privacy | Buyer data visible only to the seller of the order; retention job deletes buyer phone/address 24 months after last order (period to confirm with counsel) |
| Performance | Buyer confirmation page under 100 KB transferred; seller home interactive under 3 s on mid-range Android over 4G (measure, do not promise) |
| Uptime | Relies on Cloudflare; monitor and report monthly; no SLA offered in year one |
| Backup and recovery | Weekly export; restore drill documented; target recovery within one working day |
| Auditability | Every order transition and admin decision has actor, time and reason |
| Observability | Error rate and slow requests visible in admin |
| Accessibility | WCAG AA contrast, labels, focus, 44 px targets |
| Mobile | No horizontal scroll at 360 px; works as installed PWA on Android and iOS |
| Integration reliability | Webhooks signed, retried up to 5 times with backoff, idempotency keys honoured |
| Tests | API tests for auth, tenant isolation, order transitions, trust counting, usage metering, billing before billing goes live |
| Migration safety | Additive migrations only; feature flags for frozen modules; no destructive change without export |
