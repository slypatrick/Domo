# 01 — Current state: product audit, feature inventory, user journeys

Evidence labels used in the whole package: **VERIFIED** (code, live behaviour or production data read on 16 Nov 2026), **CLAIMED** (advertised on domo.tn, not independently proven in use), **INFERRED**, **HYPOTHESIS**, **PROPOSED**, **UNKNOWN**.

## 1. What Domo is today

Domo is one progressive web app (app.domo.tn) plus a promotional site (domo.tn). A seller records a cash-on-delivery order, sends the buyer a WhatsApp link, the buyer confirms with one tap, and the seller ships. Around that core sit a public storefront, a store directory, cross-shop buyer history, reviews, Domo's own delivery with drivers and cash payouts, a "protected purchase" fee, a marketing agency offer (Boost) and a small API.

**Production reality (VERIFIED, read-only query, 16 Nov 2026):**

| Measure | Value | Reading |
|---|---|---|
| Seller accounts | 4 | Two are sample stores, one is the admin, about one is real |
| Buyer accounts | 7 | Mostly test |
| Orders ever | 36 (16 delivered) | Mostly demo and test data |
| Sellers with an order in the last 30 days | 3 | Includes samples |
| Drivers | 0 | Domo delivery has never run |
| Domo deliveries | 0 | No delivery revenue ever |
| Boost requests | 0 | No Boost revenue ever |
| Protected-purchase orders | 6 | Test orders |
| Revenue to date | 0 DT | UNKNOWN whether a legal entity exists to invoice |

Domo is a **pre-launch product with a wide feature surface and no validated demand**. Every traction number in this package is therefore a forecast.

## 2. Feature inventory (single source of truth)

Status: W = working in code and tested locally, P = partial, C = claimed only, A = absent. Maturity is about the code, not about market proof. Cost is the expected ongoing burden.

| # | Feature | User | Status | Source | Business value | Main weakness | Cost | Recommendation | Priority | Period |
|---|---|---|---|---|---|---|---|---|---|---|
| F1 | Seller sign-up and login (phone + password, PBKDF2) | Seller | W | `/api/auth/*` | Acquisition | No phone ownership check, no password reset | Low | Improve | Critical | Q1 |
| F2 | 5-step onboarding checklist | Seller | W | `onboarding()` in index.html | Activation | Leads with logo/storefront, not with the first order | Low | Improve | High | Q1 |
| F3 | Manual order entry | Seller | W | `POST /api/orders` | Core value | Typing each order is slow for 100+ orders/month | Low | Improve (paste-to-order) | Critical | Q1 |
| F4 | WhatsApp confirmation link (wa.me, sent from the seller's own WhatsApp) | Seller, buyer | W | `waLink`, `/api/claim/:token` | Core value, zero message cost | Seller must tap send for each order; no reminder automation | None | Preserve, add reminders | Critical | Q1 |
| F5 | Buyer confirmation page (confirm, refuse, share location, link account) | Buyer | W | `/api/claim/:token/*` | Trust evidence | No account needed (good) | Low | Preserve | Critical | — |
| F6 | Order pipeline and statuses with event log | Seller | W | `orders`, `order_events` | Retention | No bulk actions, no export | Low | Improve | High | Q1 |
| F7 | Failure causes and contestable refusals | Seller, buyer, admin | W | migration 0011 | Fairness, legal risk reduction | New; untested with real users | Medium (admin time) | Preserve | High | — |
| F8 | Cross-shop buyer history and trust level | Seller | W | `trust()` | Differentiation | Shared personal data across merchants; legal basis unreviewed; empty network so no value yet | Legal | **Restrict to own-shop history until legal review** | Critical | Q1 |
| F9 | Storefront (`/s/slug`), catalogue, cart, guest checkout | Buyer | W | `/api/shop/:slug` | Order capture | No variants or stock | Low | Preserve, light improvements | Medium | Q2 |
| F10 | Store directory / explorer | Buyer | W | `/api/stores` | Discovery | 3 stores: no liquidity | Low | Preserve, no investment | Low | Year 2 |
| F11 | Reviews (two-way, 14-day blind) | Buyer, seller | W | `/api/reviews` | Trust | Needs volume | Low | Preserve | Low | — |
| F12 | Domo delivery: driver app, dispatch, route map, cash, payouts | Driver, admin | W in code, never operated | migration 0007, 0010 | Revenue 8 DT/parcel (4 DT to driver) | Domo holds merchants' cash, employs/contracts drivers, carries loss and labour risk; 0 drivers | High | **Freeze (feature flag off for new sellers)** | — | Revisit Q4 gate |
| F13 | Protected purchase (3% buyer fee, 2–15 DT) | Buyer | W | `secureFee` | Revenue | Looks like escrow/insurance without a licence or a funded guarantee | Legal | **Freeze** | — | Year 2 |
| F14 | Disputes | Buyer, seller, admin | W | `/api/claim/:token/dispute` | Trust | Tied to F13 | Medium | Keep for contests only | Low | — |
| F15 | In-app messages and audio calls | Buyer, seller | W | `conversations`, `calls` | Marginal | WhatsApp already does this; maintenance cost | Medium | Retire calls, keep messages dormant | Low | Q2 |
| F16 | Push notifications | All | W | VAPID | Retention | iOS needs installed PWA | Low | Preserve | Medium | — |
| F17 | Seller verification (documents) | Seller, admin | W | `verifications` | Trust | Admin console unreachable in prod (ADMIN_PHONES empty) | Low | Fix config, preserve | High | Q1 |
| F18 | Stats screen | Seller | P | index.html | Retention | No money-saved or refusal-rate figure | Low | Improve | High | Q1–Q2 |
| F19 | API v1 (create order, read status) and API keys | Seller with a site | W | `/api/v1/orders` | Adoption without migration | No webhooks, no docs page, no plugins | Low | Improve | High | Q2 |
| F20 | Boost (149 / 299 / 549 DT packages, extras) | Seller | W request flow; service never delivered | migration 0008 | Service revenue | Labour-heavy, no capacity, no proof | High (labour) | Keep as waitlist; pilot with 3 clients | Medium | Q2 |
| F21 | Admin console (verifications, deliveries, drivers, payouts, contests, Boost) | Admin | W | `/api/admin/*` | Operations | No metrics dashboard, no audit log of admin actions | Low | Improve | High | Q1 |
| F22 | Subscriptions and billing | Seller | **A** | — | Revenue | Nothing exists | Medium | **Build** | Critical | Q1 build, Q2 on |
| F23 | Product analytics / event tracking | Internal | **A** | — | Steering | Cannot measure activation or retention | Low | **Build** | Critical | Q1 |
| F24 | Courier integrations | Seller | **A** | — | Retention, later revenue | No partner | Medium | Build export first, API later | High | Q2–Q3 |
| F25 | Password reset, phone OTP | All | **A** | — | Security, support load | — | Low + per-OTP | Build | Critical | Q1 |
| F26 | Arabic interface | All | **A** | — | Reach | French only | Medium | Build (RTL) | Medium | Q3 |
| F27 | Legal pages, SEO pages, sitemap | Public | W | domo-site | Compliance, acquisition | Company identity missing on legal notice | Low | Complete | Critical | Q1 |

**Technical facts (VERIFIED):** Cloudflare Pages advanced mode; one worker file (~2,000 lines) and one front-end file (~2,400 lines of vanilla JS); D1 database with 11 migrations and about 20 tables; images stored as blobs in D1 (about 47 KB cap each); no automated tests; no error monitoring; no background queue; rate limiting in D1; OSRM and Nominatim public endpoints for the driver route.

## 3. User journeys and friction

**Merchant.** Discovery (site) → registration (30 seconds, no verification) → *checklist asks for logo and product first* → first order typed by hand → WhatsApp link sent from own phone → buyer confirms → seller ships with a courier *outside Domo* (no label, no export, status updated by hand) → delivery result entered by hand → no settlement (courier pays seller directly) → stats → repeat → no upgrade path exists.
Friction: (1) the first-value moment (a confirmed order) is step 3 of the checklist instead of step 1; (2) double entry, because the order is typed in Domo and again in the courier's tool; (3) delivery outcome is manual, so refusal data is incomplete; (4) nothing shows the money saved.

**Buyer.** Receives WhatsApp link → confirms without an account → may share location → tracks → may review or contest. This is the strongest journey. Missing: a clear statement of what data is kept and who sees it.

**Courier (Domo driver).** Apply → admin approval → jobs → pickup → delivery → cash → settlement. Built, never used. Each step creates a liability for Domo (cash, loss, labour status).

**Administrator.** Console exists but is unreachable in production until `ADMIN_PHONES` is set. No overview of activation, retention or revenue.

## 4. Is Domo one product?

Today Domo is **an assortment of connected ideas around one good core**. The confirmation loop (F3–F7) is coherent and differentiated. Storefront and API feed it. Delivery, protected purchase, calls, marketplace and Boost are separate businesses with different economics, each of which would need its own operations. None has users.

**Proposed consolidated structure (PROPOSED):**

1. **Domo Commandes** (the product): order capture, confirmation, pipeline, own-shop buyer history, stats, storefront as an order-capture channel, API.
2. **Domo Connect** (capability, not a brand): courier export/booking, webhooks, plugins.
3. **Domo Boost** (service, waitlist-gated).
4. **Frozen behind flags:** Domo delivery, protected purchase, cross-shop scoring, audio calls. Code stays; no new seller sees them.
5. **Dormant:** directory/explorer stays online, receives no investment until supply exists.

## 5. Current-state scorecard (0–5)

| Dimension | Score | Why | Confidence |
|---|---|---|---|
| Product clarity | 2 | Site promises confirmation, delivery, marketplace, agency at once | High |
| Seller activation | 1 | No funnel data; checklist misordered | Medium |
| Buyer trust | 3 | No-account confirmation, contestable refusals, legal pages | Medium |
| Merchant retention potential | 2 | Core loop is useful; double entry with couriers limits habit | Low (untested) |
| Reliability | 3 | Simple stack, no known outages; no monitoring or tests | Medium |
| Marketplace liquidity | 0 | Three stores, two of them samples | High |
| Logistics readiness | 1 | Software exists; no drivers, no partner, no insurance | High |
| Revenue readiness | 0 | No billing, no entity confirmed, no payment gateway | High |
| Customer support | 1 | support@ address only | High |
| Growth distribution | 1 | Site and SEO basics; Facebook launch material prepared | Medium |
| Data governance | 1 | Privacy page exists; no INPDP declaration known; shared buyer data | Medium |
| Financial transparency | 1 | No books, payouts ledger exists in code | Medium |
| Competitive differentiation | 3 | Confirmation without forcing a storefront is distinct | Medium |
| Technical maintainability | 2 | Two very large files, no tests; small and readable otherwise | High |

Lack of usage, not poor engineering, drives most low scores.

## 6. Defects and risks recorded for Opus (not fixed here)

1. Admin console unreachable in production (`ADMIN_PHONES` empty).
2. No password reset; no phone verification at sign-up (account takeover and fake-account risk).
3. A Cloudflare API token has been pasted in several chats and must be revoked by the founder.
4. Images in D1 blobs: size cap, database growth. Move to R2.
5. No tests, no error reporting, no backups procedure documented (D1 Time Travel exists by default; restore never rehearsed).
6. `/mentions-legales/` lacks company name, tax ID, RNE number and address.
7. Cross-shop trust score is live by default.
