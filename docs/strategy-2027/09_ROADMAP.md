# 09 — Twelve-month roadmap, releases, KPI scorecard, decision gates

**Capacity assumption (lean plan):** one founder at 30–35 hours a week, of which 8–10 direct Claude Opus build sessions; no employee. Each Opus batch (B1–B9, defined in 10) is sized at one to three founder-weeks including testing. Budgets match the base case of the financial model (operating expenses 20,400 DT over the year). KPI targets are base-case model values.

The brief's quarter structure is kept with one change: Q3 is "retain and connect" instead of "expand segments", because expansion before retention is proven would waste the small budget.

## 1. Month by month

| Month | Objective | Product (Opus batch) | UX | Acquisition | Revenue | Partnerships | Ops | Budget (DT) | KPI targets (end of month) | Dependencies | Risks | Acceptance | Gate to proceed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Dec 2026** | Make the wedge measurable and safe | **B1** Foundation: analytics events, admin metrics, OTP + reset, feature flags freezing delivery/protection/cross-shop, own-shop history default, buyer data notice | First-order onboarding order | 20 pilot sellers by hand; 30 interviews started | None | First talks with 2 couriers and 2 gateways | Lawyer and accountant engaged; revoke leaked token; set admin phone | 2,400 | 15 signups; 5 active | Founder time; legal quotes | Legal entity delay | B1 acceptance tests pass | ≥10 pilot sellers sent ≥1 link |
| **Jan 2027** | Shorten time to first confirmed order | **B2** Paste-to-order, duplicate detection, batch reminders, weekly summary | Simple/compact toggle | Pilot continues; first 3 Reels a week | PX-0 prepared | Gateway application filed | INPDP filing prepared by counsel | 2,000 | 25 signups; 13 active; median time-to-first-link <3 min | B1 | Low usage | B2 tests pass | Activation ≥25% on pilot cohort |
| **Feb** | Show the value in dinars; prepare billing | **B3** Money-saved and refusal report; **B4** subscriptions (plans, usage metering, invoices, gateway or manual transfer) built, off | Pricing page, limit notices | "Défi 30 jours" | **PX-0** founding offer | Gateway contract | Terms of sale reviewed | 1,100 | 35 signups; 24 active; ≥5 pre-commitments | Entity, gateway | R5 | Billing dry-run with test payments | **G1** (below) |
| **Mar** | Start charging | B4 switched on; billing support fixes | Upgrade flow polish | Referral programme (**B6** light) | Billing live; **PX-1** price test | Courier file formats collected | Invoicing process with accountant | 1,800 | 45 signups; 37 active; 6 paying | B4 | Low conversion | First 5 invoices correct | Payment success ≥90% |
| **Apr** | Remove double entry | **B5** Courier export + status import; reliability: R2 media, tests, error monitoring, backup drill | Shipping screen | Meta ads test (300 DT) with CAC tracking | Boost pilot with 3 clients (PX-4) | File exchange with first courier | Help centre (10 articles) | 1,500 | 55 signups; 52 active; 10 paying | Courier format | Courier unresponsive | Export accepted by one courier's tool | Share of orders with outcome ≥50% |
| **May** | Prove retention | B5 follow-ups; referral full (**B6**) | Reorder link on delivered orders | Workshop 1; ads if CAC <150 DT | PX-1 decision; PX-2 | Agency referral terms | Weekly scorecard habit | 1,600 | 60 signups; 67 active; 16 paying | — | Churn | Referral reward only on activation | **G2** |
| **Jun** | Open to sellers with sites | **B7** Webhooks, API docs, WooCommerce plugin | Developer page | Content on "combien coûte un retour" | Annual plan push (PX-3) | Plugin listing | — | 1,600 | 60 signups; 81 active; 21 paying | B4 | Low demand | Signed webhooks with retries | ≥3 API users or pause B7 follow-ups |
| **Jul** | Serve bigger sellers | **B8** Team seats and roles; bulk actions | Compact table | Outreach to 30 high-volume sellers | Business plan sales | Courier API scoping | — | 1,500 | 55 signups; 92 active; 26 paying | — | Summer slowdown | Role tests (member cannot see billing) | — |
| **Aug** | Widen reach | **B9a** Arabic interface (RTL) | Arabic copy reviewed by native speaker | Arabic videos | — | — | — | 1,500 | 50 signups; 100 active; 30 paying | Translator | Quality of copy | No layout break in RTL at 360 px | **G3** |
| **Sep** | Connect a courier (only if partner signed) | **B9b** Courier booking API with one partner, or WhatsApp automation pack (P14) if no partner | Booking flow | Back-to-school campaign | Referral fee terms (experimental) | Partner agreement | Support contractor if trigger met | 1,700 | 65 signups; 113 active; 34 paying | Partner | No partner | End-to-end test parcel | Partner signed, else fall back to P14 |
| **Oct** | Tighten unit economics | Churn fixes from interviews; billing dunning | Cancellation survey | Scale best channel only | Price review | Second courier talks | — | 1,800 | 70 signups; 126 active; 38 paying | Data | — | Paid churn measured by cohort | — |
| **Nov** | Decide year two | Hardening; year-end peak readiness | — | Peak-season campaign | Annual renewals | — | Year-two plan, investor update | 1,900 | 75 signups; 139 active; 44 paying; revenue ≈2,100 DT/month | — | — | Restore drill repeated | **G4** |

## 2. Release plan

| Release | Outcome | Scope | Excluded | Complexity | Test strategy | Rollout | Success | Rollback trigger |
|---|---|---|---|---|---|---|---|---|
| R1 "Socle" (B1) | Measurable, safer product | See B1 | Any new seller feature | M | API tests + manual checklist on 3 devices | All users; flags default off for frozen modules, existing users keep access until notified | Events flowing; 0 P1 bugs for 7 days | Login failure rate >2% |
| R2 "Première commande" (B2) | Faster first value | Paste, duplicates, reminders, summary | AI parsing | M | Parser fixtures from 100 real anonymised messages | Pilot sellers first (flag), then all | Median time-to-first-link <3 min | Wrong parse rate >10% |
| R3 "Valeur" (B3) | Seller sees money saved | Reports | Product-cost profitability | S | Recompute from fixtures | All | ≥40% of actives open the report monthly | Numbers disputed by ≥3 sellers |
| R4 "Abonnements" (B4) | Revenue | Plans, metering, invoices, payments, dunning | Per-order billing, coupons beyond founder offer | L | Unit tests on metering and invoices; sandbox payments | Dark launch → pilot → all, 60-day grace for existing users | Payment success ≥90% | Any wrong invoice in production |
| R5 "Livreurs" (B5) | No double entry | Export, import, shipments table; reliability work | Booking API | M–L | Golden files per courier | Pro and above | ≥50% orders with outcome | Export rejected by courier tool |
| R6–R9 | See batches B6–B9 in document 10 | | | | | | | |

## 3. KPI scorecard

**North Star Metric: monthly active merchants with at least 5 buyer-confirmed orders through Domo.**

| Candidate | For | Against | Verdict |
|---|---|---|---|
| Registrations | Easy | Vanity | Reject |
| Orders created | Volume | Rewards spam and unconfirmed orders | Reject |
| Paying merchants | Revenue | Lags value; zero for months | Supporting |
| **Active merchants with ≥5 confirmed orders** | Requires real buyers acting; leads revenue | Threshold is arbitrary | **Adopt** |
| Parcels delivered after confirmation | Closest to value | Not observable until courier data exists | Adopt in year two |

| KPI | Formula | Source | Frequency | Owner | Baseline | Target Nov 2027 | Warning | Action if missed |
|---|---|---|---|---|---|---|---|---|
| North Star | Sellers with ≥5 `order_confirmed_by_buyer` in the month | events | Weekly | Founder | ~1 | 139 | <70% of month target | Diagnose funnel stage |
| Activation rate | Activated ÷ signups, by cohort | events | Weekly | Founder | Unknown | 35% | <25% | Interview 10 non-activated |
| Time to first link | Median minutes signup → `confirm_link_sent` | events | Weekly | Founder | Unknown | <3 | >10 | Onboarding fix |
| Confirmation rate | Confirmed ÷ links sent | events | Weekly | Founder | Unknown | 70% | <55% | Template and timing |
| Orders with recorded outcome | Outcome set ÷ shipped | DB | Monthly | Founder | Low | 70% | <40% | Courier import adoption |
| Customer-refusal rate | Customer refusals ÷ shipped | DB | Monthly | Founder | Unknown | Reported, with trend | Rising 2 months | Content, reminders |
| Week-4 retention | Cohort active in week 4 | events | Weekly | Founder | Unknown | 40% | <25% | Value problem review |
| Paid conversion | Paying ÷ activated (45 days) | billing | Monthly | Founder | — | 30% | <15% | Price/value test |
| Paid churn | Lost ÷ start-of-month paying | billing | Monthly | Founder | — | ≤6% | >9% | Call churned sellers; pause ads |
| MRR (excl. VAT) | Sum of active subscriptions | billing | Monthly | Founder | 0 | ≈1,860 SaaS | <60% of plan | Review plan |
| Gross margin | (Revenue − direct costs) ÷ revenue | accounts | Monthly | Founder | — | ≥75% | <60% | Check Boost and messaging |
| CAC per paying merchant | Marketing ÷ new paying | accounts | Monthly | Founder | — | ≤166 DT | >250 | Cut worst channel |
| Support load | Tickets per 100 actives; founder hours | log | Weekly | Founder | — | <15; <10 h | >25 | Help content; contractor |
| Partner performance | Export acceptance, status delay | DB | Monthly | Founder | — | — | — | Partner review |
| Reliability | Error rate; uptime check | monitoring | Weekly | Founder | Unknown | <0.5% errors | >2% | Fix before features |
| Contest handling | Median days to decision | DB | Monthly | Founder | — | ≤3 | >5 | Prioritise |

**Weekly review (30 minutes):** North Star, signups by channel, activation of last week's cohort, time to first link, open support items, one decision.
**Monthly business review (investor-style, one page):** highlights and lowlights; KPI table against plan; revenue, costs, cash, runway; cohort retention chart; top three learnings from seller calls; decisions and asks; next month's single objective.

## 4. Alternative roadmaps

| | Solo founder, 15 h/week | **Lean plan (this document)** | Funded (≈50,000 DT, part-time developer and support) |
|---|---|---|---|
| Q1 | B1, B2 | B1–B4 | B1–B5 |
| Q2 | B3, B4 (billing in May) | B5–B7 | B6–B8, Arabic, ads at 2,000 DT/month |
| Q3 | B5 | B8, B9a, B9b | Courier API with 2 partners, WhatsApp automation |
| Q4 | B6 | Hardening, year-two decision | Second segment (high-volume teams) |
| Paying merchants, Nov | 8–20 | ≈44 | 100–144 |

## 5. Decision gates

| Gate | Date | Continue if | Otherwise |
|---|---|---|---|
| **G1 — Problem and willingness to pay** | End Feb 2027 | ≥10 of 20 pilot sellers activated **and** ≥5 pre-commitments (PX-0) | Narrow: one category, concierge onboarding for 4 more weeks; do not start ads |
| **G2 — Early retention** | End May | Week-4 retention ≥35% and paid conversion ≥20% of activated | Change pricing (PX-1 lowest arm) or packaging; stop Boost if PX-4 fails |
| **G3 — Repeatable acquisition** | End Aug | One channel with CAC per paying merchant <200 DT at ≥15 new paying a month | Hold spend at 300 DT/month; focus on referrals |
| **G4 — Year-two direction** | End Nov | ≥40 paying, paid churn ≤7%, monthly result ≥ −300 DT | Narrow to consulting-light mode, or pivot positioning to "confirmation API for stores" if API users retain better |
| Stop a revenue line | Any month | — | Boost: margin <40% or >5 founder hours per client for 2 months. Courier fee: partner objects or sellers perceive conflict |
| Marketplace | Review at G4 | ≥300 active stores with catalogues | Stay dormant |
| Own delivery | Review at G4 | Conditions in decision D2 | Stay frozen; remove code in year two |
| Invest more | Any time after G2 | LTV/CAC ≥3 measured on two cohorts and payback <6 months | Stay lean |
