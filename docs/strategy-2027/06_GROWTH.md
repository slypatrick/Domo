# 06 — Growth: acquisition, funnel, campaigns, content, referrals, retention, partnerships

The signup forecast in the financial model (610 in the base case) is built from the channel capacities below. All conversion rates are HYPOTHESES to be replaced by measured values from January 2027.

## 1. Channels ranked

Scores 1–5 (5 is best). Workload = low founder workload.

| Channel | Cost | Speed | Trust | Reach | Conversion | Workload | Repeatable | Scalable | Total /40 | Use |
|---|---|---|---|---|---|---|---|---|---|---|
| Direct outreach to sellers' pages (DM + 60-second demo video) | 5 | 5 | 3 | 3 | 4 | 2 | 4 | 2 | 28 | **Core from day 1** |
| Seller-to-seller referral | 5 | 3 | 5 | 3 | 5 | 5 | 4 | 4 | 34 | **Core from month 3** |
| Seller Facebook groups and WhatsApp communities | 5 | 4 | 4 | 3 | 3 | 3 | 3 | 3 | 28 | Core |
| TikTok/Reels demonstrations (organic) | 5 | 3 | 3 | 4 | 3 | 3 | 4 | 4 | 29 | Core |
| Meta ads to demo video | 2 | 5 | 2 | 5 | 2 | 4 | 5 | 5 | 30 | From month 4, only with measured CAC |
| Courier referrals | 4 | 2 | 5 | 4 | 4 | 4 | 4 | 5 | 32 | When a partner exists |
| Agencies / community managers | 4 | 2 | 4 | 3 | 3 | 4 | 3 | 3 | 26 | Q3 |
| Workshops with incubators, universities, associations | 3 | 2 | 5 | 2 | 4 | 2 | 3 | 2 | 23 | One a month from Q2 |
| SEO and guides | 4 | 1 | 4 | 3 | 3 | 3 | 5 | 4 | 27 | Start in Q1, pays in H2 |
| Influencer sellers | 3 | 4 | 4 | 4 | 3 | 3 | 2 | 3 | 26 | Pay in free months, not cash |
| Field sales | 1 | 3 | 5 | 1 | 5 | 1 | 2 | 1 | 19 | Only for 10 lighthouse sellers |

**Capacity behind the base-case forecast:** outreach of 25 personalised DMs a working day ≈ 500 a month at 5% signup ≈ 25 signups; groups and content ≈ 10–20; referrals from month 3 at 0.15 signups per active merchant per month ≈ 5–20; paid from month 4 at about 12–15 DT per signup on 600–1,200 DT ≈ 20–40 (the model's marketing cost per signup averages 14.8 DT). This totals 15 rising to 75 a month.

## 2. Funnel and event definitions

| Stage | Event (tracked in P1) | What Domo says | What the seller experiences | Target (base) |
|---|---|---|---|---|
| Awareness | Video view ≥15 s | "Moins de colis refusés" | A real order confirmed in 20 seconds | — |
| Visit | Landing page view | One promise, one demo, price | Loads fast on mobile | 30% click-through from DM |
| Registration | `signup_completed` | "Créez votre première commande" | Phone + OTP + shop name | 25% of visits |
| Activation | `order_created` then `confirm_link_sent` within 24 h | — | Under 3 minutes | 60% of signups |
| First real order | `order_confirmed_by_buyer` | "Confirmée ✔" | Push notification | 50% of signups |
| First result | 5 confirmed orders in 30 days (**activated**) | Weekly summary | Sees refusal causes | 35% |
| Habit | Orders in 3 of 4 weeks | Money-saved figure | Home screen icon installed | 60% of activated |
| Monetisation | `subscription_started` | Limit notice, report preview | Pays by card or wallet | 30% of activated |
| Retention | Paid in month N+1 | — | — | 94% monthly |
| Referral | `referral_signup` | "Offrez un mois, gagnez un mois" | Share link | 15% of actives refer |

## 3. Launch campaigns

| | Days 1–30: "20 boutiques pilotes" | Days 31–60: "Le défi 30 jours" | Days 61–90: "Fondateurs" |
|---|---|---|---|
| Audience | Fashion/accessories sellers in Grand Tunis, 50–400 orders/month, hand-picked | Same segment plus beauty, via groups and pilot sellers' stories | Activated free users and referrals |
| Pain | Parcels refused at the door | Not knowing why parcels come back | Paying for returns every month |
| Message | "Testez gratuitement, on vous installe en 15 minutes" | "Confirmez toutes vos commandes pendant 30 jours et comparez vos retours" | "Tarif fondateur : Pro à 290 DT l'année, à vie tant que vous restez" |
| Offer | Free, personal onboarding, direct line to the founder | Free; public results from pilot sellers (with consent) | PX-0 pre-commitment |
| Channels | DM, calls, visits | Reels/TikTok, groups, pilot sellers | In-app, WhatsApp broadcast to opted-in sellers |
| Budget | 200 DT | 300–400 DT | 400 DT |
| Outcome | 20 sellers onboarded, 10 activated, 30 interviews done | 60 signups, 20 activated, 3 written case studies | ≥5 pre-paid annual plans |
| Landing page | Demo video, 3 steps, WhatsApp button | Challenge page with counter of confirmed orders | Pricing page |
| Follow-up | Day 1, 3, 7 check-ins by WhatsApp | Weekly summary message | Reminder at day 7 and 14 |
| Success | ≥50% of onboarded send ≥5 links | Activation ≥30% | ≥5 payments |
| Stop if | <5 of 20 use it twice → fix product before spending | Activation <15% | ≤1 payment → rework value and price |

## 4. Content direction (12 months)

Pillars and share: COD failures and how to cut them (30%); seller productivity and tutorials (25%); product demos and new features (20%); seller stories with real numbers (15%); business profitability (10%). Educational content is 70%, sales content 30%.

Cadence a solo founder can hold: 3 short videos a week, 1 guide a month on domo.tn (SEO), 1 seller story a month from March. Distribution: Instagram, Facebook, TikTok, seller groups; every piece ends with one action (try the demo). Quarterly themes: Q1 "pourquoi les colis reviennent"; Q2 "combien vous coûte un retour" (calculator page); Q3 back-to-school and courier comparisons; Q4 year-end peak preparation.

## 5. Referral loops

| Loop | Mechanism | Cost | Abuse risk and control |
|---|---|---|---|
| Seller → seller | One free Pro month for both when the referred seller reaches activation | ≈ 33 DT of forgone revenue per activated referral | Reward only on activation with ≥5 buyer-confirmed orders from distinct phone numbers; cap 6 months a year |
| Courier → seller | Courier shares a Domo link; Domo sends cleaner, confirmed parcels | Partnership time | No payment for signups; value is mutual |
| Agency → seller | 20% of first 3 months' subscription | ≈ 23 DT per seller | Paid after the third paid month |
| Seller → buyer | "Commandez sur ma vitrine Domo" link in bio | None | No incentive for reviews; no reward for orders |

Never rewarded: orders, reviews, or sharing of customer lists.

## 6. Retention

**What makes Domo hard to drop (in order):** (1) fewer wasted parcels, shown as money; (2) one pipeline for the whole day's work; (3) own customer history; (4) courier hand-off without retyping; (5) team access.

| Quarter | Retention work | Measure |
|---|---|---|
| Q1 | First-order onboarding, reminders, weekly summary | Time to first confirmed order; week-4 retention |
| Q2 | Money-saved report, courier export, status import | Share of orders with a recorded outcome |
| Q3 | Seats, webhooks, reorder link, Arabic | Paid churn |
| Q4 | Courier booking (if partner), yearly plan push | Net revenue retention |

Buyer retention is not a year-one goal; buyers benefit through clear confirmation, tracking and contesting. No discounts or loyalty points. Courier retention applies only to partners: clean files, fewer wrong addresses, fewer calls.

**Metrics:** weekly active merchants (≥1 order created in the week); monthly active (≥5 confirmed orders); repeat processing (orders in 3 of 4 weeks); cohort retention at weeks 1, 4, 12; paid retention; revenue retention; time to first value; time to second order; support incidents per 100 active merchants; buyer reorder rate (storefront only).

**Diagnostic rules:** week-1 retention below 40% → onboarding problem, interview 10 drop-offs; week-4 below 25% → value problem, check confirmation rate and double entry; confirmation rate below 55% → message template and timing; paid churn above 9% for two months → pause acquisition spend and call every churned seller.

## 7. Partnerships

No partnership exists today (VERIFIED). Names are prospects only when public evidence supports their relevance.

| Class | Purpose | Value to Domo | Value to partner | Product needed | Commercial proposal | Complexity | Stage | Negotiation criteria |
|---|---|---|---|---|---|---|---|---|
| Couriers (prospects: operators with merchant APIs; IntiGo is publicly expanding services, M12) | Remove double entry, get outcomes | Retention; later referral fee | Confirmed parcels mean fewer returns and calls | Export/import (P8), then API (P15) | Free integration first; later 0.10–0.20 DT per delivered parcel or co-marketing | Medium | Talks Q1, file exchange Q2, API Q3 | No exclusivity; status data access; no cash handling by Domo |
| Payment gateways (Konnect, Flouci, Paymee, ClicToPay — all publicly active, M10–M11) | Collect subscriptions | Billing | New merchant accounts | P7 | Standard merchant rates | Low–medium | Q1 | Recurring or saved-card support, fees ≤2.5%, onboarding time |
| Store platforms and plugins | Reach sellers with sites | Distribution | Lower returns for their merchants | P10 | Free plugin; co-marketing | Medium | Q3 | API stability |
| Agencies / freelancers | Channel and Boost delivery | Signups; capacity | Revenue share | Referral tracking | 20% of first 3 months | Low | Q2–Q3 | Quality, no spam |
| Incubators, universities, associations | Credibility, workshops | Leads | Content for their members | None | Free workshops | Low | Q2 | Access to merchant members |
| Verification / messaging providers | OTP, WhatsApp API | Security, automation | Volume | P2, P14 | Pay per use | Low | Q1 / Q3 | Price per OTP to Tunisian numbers, delivery rate |
| Legal and accounting firms | Compliance | Risk reduction | Fees | — | Fixed quotes | — | Dec 2026 | Experience with INPDP filings and e-invoicing |

**Asset-light versus owned delivery.**

| Option | Margin | Capital | Liability | Reach | Complexity |
|---|---|---|---|---|---|
| Avoid delivery entirely | 0 | 0 | None | — | None |
| **Integrate existing couriers (recommended)** | 0 to 0.2 DT/parcel | Low | Low | National through partners | Medium |
| Coordination layer with negotiated rates | 0.3–1 DT/parcel | Medium | Medium (billing, disputes) | Partner coverage | High |
| Operate deliveries (today's frozen feature) | Up to 4 DT gross, before loss, fuel disputes, idle time | High | High: cash, parcels, labour status | City by city | Very high |

**Firm recommendation:** integrate existing couriers; do not operate deliveries or hold merchants' cash in year one.
