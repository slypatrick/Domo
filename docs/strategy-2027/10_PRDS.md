# 10 — Product requirements library

Index, then one PRD per approved initiative. Each PRD covers the 28 required fields in a fixed order. "Current state" refers to the audit in 01. Complexity: S (≤1 founder-week), M (1–2), L (2–3).

| PRD | Name | Batch | Month | Priority | KPI |
|---|---|---|---|---|---|
| 01 | Analytics events and admin metrics | B1 | Dec | Critical | North Star measurable |
| 02 | Phone OTP and password reset | B1 | Dec | Critical | Fake accounts, support load |
| 13 | Feature flags, own-shop history, buyer notice, admin audit | B1 | Dec | Critical | Legal risk, clarity |
| 03 | First-order onboarding | B2 | Jan | Critical | Time to first link |
| 04 | Paste-to-order and duplicate detection | B2 | Jan | High | Activation |
| 05 | Batch reminders and weekly summary | B2 | Jan | High | Confirmation rate |
| 06 | Money-saved and refusal report | B3 | Feb | High | Paid conversion |
| 07 | Subscriptions and billing | B4 | Feb–Mar | Critical | MRR |
| 08 | Courier export and status import | B5 | Apr | High | Orders with outcome |
| 12 | Reliability pack (R2, tests, monitoring, backups) | B5 | Apr | High | Error rate |
| 09 | Referral programme | B6 | May | Medium | CAC |
| 10 | Webhooks, API docs, WooCommerce plugin | B7 | Jun | Medium | API users |
| 11 | Team seats, roles, bulk actions | B8 | Jul | Medium | Business plan share |

---

## PRD-01 — Analytics events and admin metrics

1. **ID / name:** PRD-01, Analytics events and admin metrics.
2. **Objective:** steer by activation and retention instead of registrations.
3. **Problem:** nothing records when a seller reaches value; the founder cannot see the funnel.
4. **Persona:** founder as administrator.
5. **Current state:** absent (F23).
6. **Future behaviour:** server emits events; admin "Aujourd'hui" tab shows funnel and trends.
7. **Journey:** admin opens console → sees today's signups, activated sellers this week, median time to first link, confirmation rate, list of sellers stuck before first link with a WhatsApp shortcut.
8. **Screens:** admin default tab; date range selector (7/30/90 days).
9. **Components:** five stat tiles, one cohort table (signup week × activated %), one "stuck" list.
10. **Business rules:** activation = ≥5 buyer-confirmed orders within 30 days of signup; weekly active = ≥1 order created.
11. **Validation:** date range ≤180 days.
12. **Data:** `events` table (see B1).
13. **Permissions:** admin only.
14. **Integrations:** none.
15. **Notifications:** none.
16. **States:** empty ("Aucune donnée sur cette période"), loading skeleton, error with retry.
17. **Privacy/security:** no buyer personal data in events; seller IDs only.
18. **Edge cases:** deleted seller (events kept with null seller); clock skew ignored (server time).
19. **Dependencies:** none.
20. **Non-goals:** third-party analytics, buyer tracking, dashboards for sellers.
21. **Acceptance:** tests 1–2 in B1.
22. **Test scenarios:** seeded dataset of 10 sellers with known activation count.
23. **Complexity:** S.
24. **Priority:** Critical.
25. **Month:** Dec 2026.
26. **KPI:** all.
27. **Rollout/rollback:** additive; remove tab if faulty.

## PRD-02 — Phone OTP and password reset

1–5. **Objective:** only real phone owners create accounts; lost passwords recoverable. **Problem:** anyone can register any number; no reset. **Persona:** all account holders. **Current:** absent (F25).
6–7. **Behaviour and journey:** sign-up: phone → code sent → enter 6 digits → shop name and password. Reset: "Mot de passe oublié" → phone → code → new password.
8–10. **Screens/components/rules:** code input with paste support and resend timer (60 s); code valid 10 minutes, 5 attempts; 3 sends per phone per hour.
11. **Validation:** Tunisian mobile format (8 digits, existing rule).
12. **Data:** `otps`, `users.phone_verified_at`.
13. **Permissions:** public endpoints, rate-limited.
14. **Integration:** OTP provider via interface (WhatsApp authentication template or SMS; founder chooses after quotes).
15. **Notifications:** the OTP message; "mot de passe modifié" push.
16. **States:** sending, wrong code, expired, too many attempts, provider down ("Réessayez dans quelques minutes" and support link).
17. **Security:** codes hashed; constant-time compare; sessions revoked on reset; Turnstile on send.
18. **Edge cases:** number already registered; existing unverified accounts get 30 days; provider outage must not block existing logins.
19. **Dependencies:** provider account.
20. **Non-goals:** email login, social login, 2FA at every login.
21–22. **Acceptance/tests:** tests 3–4 in B1.
23–27. S–M; Critical; Dec; fake-account rate, reset tickets; flag `OTP_REQUIRED`.

## PRD-13 — Flags, own-shop history, buyer notice, admin audit

1–5. **Objective:** one clear product and lower legal exposure. **Problem:** delivery, protection, cross-shop score and calls are on for everyone. **Persona:** seller, buyer, admin. **Current:** all live (F8, F12, F13, F15).
6. **Behaviour:** frozen modules hidden unless flagged per seller; history limited to the seller's own orders; buyers told what is recorded.
7–9. **Journey/screens:** no new screen; removal of entry points; one line on the buyer page; admin "Fonctions" toggle per seller.
10. **Rules:** minimum three orders before a level; 12-month window; only customer-caused, uncontested refusals count.
11–12. **Data:** `flags`, `seller_flags`, `audit`, `users.is_admin`.
13. **Permissions:** flags editable by admin only.
14–15. None; no notifications.
16. **States:** hidden features return 404 with a neutral message.
17. **Privacy:** cross-shop data never leaves the server when the flag is off.
18. **Edge cases:** orders already in a frozen flow continue to completion.
19–20. **Dependencies:** none. **Non-goals:** deleting frozen code or data.
21–22. **Acceptance/tests:** tests 5–9 in B1.
23–27. M; Critical; Dec; legal risk and clarity; rollback by flag.

## PRD-03 — First-order onboarding

**Objective:** first confirmation link within 3 minutes. **Problem:** checklist starts with logo and products. **Persona:** new seller. **Current:** five-step checklist (F2).
**Behaviour:** after OTP the seller lands on a prefilled order form with a "send to myself" test option; checklist order becomes: create an order → send the link → see it confirmed → add logo → share storefront. Completion of step 3 shows a short success state and unlocks the weekly summary.
**Rules:** a test order sent to the seller's own number is tagged `test` and excluded from metrics and usage. **Data:** `orders.is_test`. **States:** empty list shows the form inline. **Edge cases:** seller skips; checklist stays dismissible. **Non-goals:** tutorial videos in-app. **Acceptance:** median time to first link <3 min on pilot cohort; test orders excluded from activation; 360 px layout intact. **Complexity:** S. **Month:** Jan. **KPI:** time to first link, activation. **Rollout:** all new sellers; old checklist behind flag for rollback.

## PRD-04 — Paste-to-order and duplicate detection

**Objective:** remove typing. **Problem:** sellers retype what the customer wrote in a DM. **Persona:** seller with 50+ orders/month. **Current:** manual form (F3).
**Behaviour:** a "Coller un message" field; server extracts phone (8 digits, with or without +216), governorate and delegation (dictionary with common spellings in French and Arabic script), price ("45dt", "45 د"), quantity, and leaves the rest as items text; fields are shown for correction before saving. Duplicate warning if the same phone has an open order with overlapping item words in 48 h, with "c'est une nouvelle commande" override.
**Rules:** nothing is saved without the seller's confirmation; parser is deterministic. **API:** `POST /api/orders/parse` (auth, 60/min). **Privacy:** pasted text is not stored. **Edge cases:** two phone numbers; no price; Arabic-Indic digits. **Non-goals:** AI parsing, reading screenshots, direct Instagram/Messenger integration. **Acceptance:** ≥85% correct phone and price on 100 fixture messages; duplicate rule tests; free plan limited to 10 parses a month once billing is on. **Complexity:** M. **Month:** Jan. **KPI:** orders per active seller, activation. **Rollback:** hide the field.

## PRD-05 — Batch reminders and weekly summary

**Objective:** raise confirmation rate. **Problem:** unconfirmed orders sit until the seller remembers. **Behaviour:** "À relancer" filter (links sent >4 h ago, not confirmed); tapping "Relancer" opens WhatsApp with the reminder template for each selected order in turn; second reminder at 24 h; after that the order is marked "pas de réponse". Weekly push and in-app summary on Sunday evening: orders, confirmation rate, refusals by cause. **Rules:** at most two reminders per order; no automatic sending in this PRD. **Data:** `reminders_sent` counter on orders; Cron Trigger for the summary. **Non-goals:** WhatsApp API automation (P14). **Acceptance:** reminder count enforced; summary numbers match the report; push respects notification settings. **Complexity:** S. **Month:** Jan. **KPI:** confirmation rate.

## PRD-06 — Money-saved and refusal report

**Objective:** make the value visible and justify the price. **Behaviour:** Stats shows "Frais de livraison évités ce mois" = orders stopped before shipping (refused by buyer or no answer after two reminders) × the seller's courier fee (+ return fee if set in settings); refusal rate after shipping by cause, governorate and product; trend by month. The formula is shown under the figure. **Rules:** estimates are labelled "estimation"; free plan sees the headline figure, paid plans the breakdown. **Data:** `users.courier_fee`, `users.return_fee` (defaults 8 and 0, editable). **Edge cases:** no shipped orders → explanatory empty state. **Non-goals:** product-cost profitability. **Acceptance:** recomputed exactly from fixtures; wording never claims a guaranteed saving. **Complexity:** S. **Month:** Feb. **KPI:** report opens, paid conversion.

## PRD-07 — Subscriptions and billing

1–5. **Objective:** first revenue. **Problem:** no way to charge. **Persona:** seller (owner), admin. **Current:** absent (F22).
6. **Behaviour:** plans Gratuit, Pro (39 DT), Business (99 DT), monthly or annual (10 months); usage = buyer-confirmed orders per calendar month; soft limits with 7-day tolerance; payment by local gateway (card, wallet) or bank transfer/D17 confirmed by admin; invoices downloadable; cancellation at period end.
7. **Journey:** limit notice or paid-feature preview → pricing sheet → choose plan → pay → confirmation and invoice → manage in Settings.
8–9. **Screens:** pricing sheet, checkout hand-off, "Abonnement" in settings (plan, usage bar, invoices, cancel), admin subscriptions tab.
10. **Rules:** an order counts once, in the month of first confirmation; test orders excluded; upgrade immediate and pro-rated; downgrade at period end; failed renewal → 7 days grace → Gratuit limits, no data loss; existing users get 60 days of Pro free from launch; price shown incl. VAT with HT and VAT lines on the invoice.
11. **Validation:** billing identity (name or company, tax ID optional) before first invoice.
12. **Data:** `subscriptions`, `usage_monthly`, `invoices`, `billing_events`.
13. **Permissions:** owner only; admin can grant, extend, refund (audited).
14. **Integrations:** gateway behind `PaymentProvider` interface; webhook endpoint with signature check.
15. **Notifications:** 80% and 100% usage, payment success, failure, renewal in 3 days.
16. **States:** payment pending, failed, awaiting transfer confirmation.
17. **Security:** no card data touches Domo; webhook idempotency.
18. **Edge cases:** double webhook; payment after downgrade; annual upgrade mid-term; refund.
19. **Dependencies:** legal entity, gateway contract, accountant's invoice format (e-invoicing).
20. **Non-goals:** per-order billing, coupons other than founder offer and referral months, multi-currency.
21. **Acceptance:** see B4.
22. **Tests:** unit tests for metering, proration, invoice totals; sandbox end-to-end.
23–27. L; Critical; build Feb, live Mar; MRR, payment success; dark launch, kill switch `BILLING_ON`.

## PRD-08 — Courier export and status import

**Objective:** no retyping; delivery outcomes recorded. **Behaviour:** select confirmed orders → choose courier → download file in that courier's format (start with the two most used by pilot sellers; formats collected in March) and an A4 label sheet; later upload the courier's status file to update orders in bulk, mapping courier statuses to Domo outcomes and causes, with a preview of changes before applying. **Data:** `shipments`, `couriers`. **Rules:** import never overrides a status set by the buyer's contest decision; unknown statuses are listed for manual choice. **Non-goals:** live API booking (B9b), price comparison. **Acceptance:** golden-file tests; export accepted by the courier's own upload tool (manual check by the founder); import of 200 rows under 5 s. **Complexity:** M. **Month:** Apr. **KPI:** share of shipped orders with an outcome ≥50%.

## PRD-12 — Reliability pack

Media to R2 (new uploads to R2, lazy copy of old blobs, same URLs); API test suite covering auth, tenant isolation, order transitions, trust counting, usage metering; error capture table and daily admin digest; weekly D1 export to R2; documented restore drill. **Acceptance:** suite runs with one command; a restore to a scratch database succeeds and is recorded. **Complexity:** M. **Month:** Apr.

## PRD-09 — Referral programme

Personal link; referred seller gets one free Pro month at sign-up; referrer gets one when the referred seller is activated with confirmations from ≥5 distinct buyer phones; cap 6 months a year; admin view of referrals; no cash. **Acceptance:** reward granted once; self-referral by same phone or device blocked. **Complexity:** S. **Month:** May. **KPI:** referred share of signups ≥20%.

## PRD-10 — Webhooks, API docs, WooCommerce plugin

Signed webhooks with retries (5, exponential backoff) and a delivery log; public documentation page with examples; minimal WooCommerce plugin: sends new COD orders to Domo, writes back confirmation status as an order note and status. Business plan only. **Non-goals:** Shopify app, Converty integration (needs their cooperation). **Acceptance:** signature verification example works; plugin tested on a clean WooCommerce install. **Complexity:** L. **Month:** Jun. **KPI:** ≥3 API users by end of July.

## PRD-11 — Team seats, roles and bulk actions

Owner invites staff by phone (OTP); staff can create and update orders, cannot see billing, API keys, exports of the whole customer list, or delete; every order event records the acting member; bulk select for status change, reminders and export. Seats: 2 on Pro, 5 on Business. **Acceptance:** permission tests per role; audit shows actor. **Complexity:** M. **Month:** Jul. **KPI:** Business share ≥20% of paying.
