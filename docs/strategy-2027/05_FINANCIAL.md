# 05 — Financial plan: assumptions, forecast, unit economics, capital, pricing experiments

The model is `DOMO_2027_Financial_Model.xlsx` (sheets: Summary, Assumptions, Conservative, Base, Aggressive, Unit economics, Sensitivity). Every number below is read from that workbook after recalculation. All amounts are in TND. Revenue is shown excluding VAT and excludes cash collected for others and merchants' ad budgets.

**There are no actuals.** Domo has had no revenue. Opening cash is UNKNOWN; the model uses a 3,000 DT placeholder. The founder should replace it on the Assumptions sheet.

## 1. Assumptions register (base case; conservative and aggressive are in the workbook)

| Assumption | Base | Status |
|---|---|---|
| Existing registered merchants | 4 (about 1 real) | VERIFIED |
| Existing active paying merchants | 0 | VERIFIED |
| New signups, 12 months | 610 (15 in Dec rising to 75 in Nov) | HYPOTHESIS from channel capacity (06) |
| Activation (5+ confirmed orders in 30 days) | 35% | HYPOTHESIS |
| Paid conversion of activated merchants | 30% (20% of the free base at launch) | HYPOTHESIS |
| Monthly paid churn | 6% (52% a year) | HYPOTHESIS |
| Monthly free-user churn | 12% | HYPOTHESIS |
| Prices incl. VAT | Pro 39, Business 99; 20% on Business | PROPOSED |
| Billing starts | March 2027 | PROPOSED |
| Orders per active merchant | 90/month | HYPOTHESIS |
| Confirmation rate / delivery success | 70% / 78% | HYPOTHESIS (see market facts M5, M6) |
| Monetisable orders | None: no per-order fee | Decision D5 |
| Delivery usage | 0 (own delivery frozen; no courier partner) | Decision D2 |
| Boost attach / price / direct cost | 4% of paying; 250 DT; 60% | HYPOTHESIS |
| Marketing spend | 9,000 DT over 12 months | PROPOSED |
| Messaging | 0.15 DT per signup OTP; 0.03 DT per automated message, 10% of orders from July | ASSUMPTION; Meta's Tunisian rate not verified |
| Infrastructure | 60 DT/month + 0.15 DT per active merchant | ASSUMPTION; check invoices |
| Payment gateway | 2% of collections | Market fact M10 |
| Refunds and disputes | Not modelled: subscriptions are monthly, cancel at period end | Decision |
| Staff | Founder unpaid; support contractor 900 DT/month above 150 active merchants | ASSUMPTION |
| Legal and setup | 3,000 DT one-off | ASSUMPTION; get quotes |
| Accounting | 250 DT/month | ASSUMPTION |
| Taxes | VAT 19% excluded from revenue; no corporate tax while loss-making; regime to confirm | Needs accountant |

## 2. Twelve-month outcomes

| Metric | Conservative | Base | Aggressive |
|---|---|---|---|
| Signups | 306 | 610 | 1,110 |
| Active merchants, Nov 2027 | 44 | 139 | 358 |
| Paying merchants, Nov 2027 | 8 | 44 | 144 |
| Orders processed | 16,594 | 76,473 | 250,783 |
| Revenue | 1,645 | 10,526 | 43,450 |
| — SaaS | 1,480 | 8,690 | 29,675 |
| — Boost | 164 | 1,836 | 8,921 |
| — Courier referral | 0 | 0 | 4,854 |
| Gross profit | 695 | 8,125 | 35,602 |
| Operating expenses | 14,650 | 20,400 | 37,500 |
| **Operating result** | **(13,955)** | **(12,275)** | **(1,898)** |
| Revenue in Nov 2027 | 344 | 2,120 | 9,176 |
| Operating result in Nov 2027 | (808) | (171) | 3,436 |
| Lowest cash balance (3,000 opening) | (10,955) | (9,275) | (9,619) |

**Base case by month (DT):**

| | Dec | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Signups | 15 | 25 | 35 | 45 | 55 | 60 | 60 | 55 | 50 | 65 | 70 | 75 |
| Active merchants | 5 | 13 | 24 | 37 | 52 | 67 | 81 | 92 | 100 | 113 | 126 | 139 |
| Paying merchants | 0 | 0 | 0 | 6 | 10 | 16 | 21 | 26 | 30 | 34 | 38 | 43 |
| Revenue | 0 | 0 | 0 | 129 | 439 | 686 | 957 | 1,222 | 1,456 | 1,649 | 1,866 | 2,120 |
| Operating result | (2,463) | (2,066) | (1,169) | (1,746) | (1,198) | (1,084) | (848) | (539) | (334) | (370) | (287) | (171) |
| Closing cash | 537 | (1,529) | (2,698) | (4,444) | (5,641) | (6,726) | (7,574) | (8,113) | (8,447) | (8,817) | (9,104) | (9,275) |

The honest reading: in the base case Domo ends the year with about 44 paying merchants, about 2,100 DT of monthly revenue, close to monthly break-even with an unpaid founder, and a cumulative loss of about 12,300 DT. This is a small business being validated, not a venture-scale trajectory yet.

## 3. Unit economics (provisional; no real cohorts)

| Metric | Conservative | Base | Aggressive |
|---|---|---|---|
| Blended ARPU excl. VAT, DT/month | 40.3 | 42.9 | 45.4 |
| Variable cost per paying merchant | 1.11 | 1.44 | 1.95 |
| Subscription gross margin | 97% | 97% | 96% |
| Paid lifetime, months | 11.1 | 16.7 | 22.2 |
| Gross-margin-adjusted LTV, DT | 436 | 690 | 965 |
| Blended CAC per new paying merchant, DT | 294 | 166 | 116 |
| LTV / CAC | 1.5 | 4.2 | 8.3 |
| CAC payback, months | 7.5 | 4.0 | 2.7 |
| Annual paid churn | 68% | 52% | 42% |
| Boost gross margin | 35% | 40% | 45% |
| Revenue per active merchant, Nov, DT | 7.9 | 15.2 | 25.6 |
| Direct cost per processed order, Nov, DT | 0.04 | 0.03 | 0.04 |
| Contribution per confirmed order, Nov, DT | 0.14 | 0.20 | 0.24 |

CAC by channel cannot be computed before spend exists; targets are in 06. Contribution per successful shipment is nil in conservative and base because no delivery revenue is assumed.

**Break-even.** With fixed costs of 2,660 DT/month (infrastructure, tooling, accounting, other, support contractor, 1,000 DT marketing) and 41.4 DT monthly contribution per paying merchant, break-even is **about 64 paying merchants**. In lean mode (no support contractor, 300 DT marketing; fixed about 1,060 DT) it is **about 26 paying merchants**. A founder salary of 2,000 DT/month would add about 48 paying merchants to either figure.

## 4. Sensitivity (base case, 12 months)

| Change | Revenue | Operating result | Paying, Nov | Lowest cash |
|---|---|---|---|---|
| Base | 10,526 | (12,275) | 43.5 | (9,275) |
| Activation 35% → 25% | 7,519 | (14,828) | 31.0 | (11,828) |
| Paid conversion 30% → 18% | 6,235 | (16,029) | 25.9 | (13,029) |
| Paid churn 6% → 10% | 9,582 | (13,088) | 37.7 | (10,088) |
| Signups −40% | 6,316 | (15,813) | 26.1 | (12,813) |
| Orders per merchant 90 → 50 | 10,526 | (12,207) | 43.5 | (9,207) |
| Message cost ×3, 30% automated | 10,526 | (13,505) | 43.5 | (10,505) |
| Pro at 29 DT | 9,163 | (13,606) | 43.5 | (10,606) |
| Pro at 49 DT (same conversion) | 11,889 | (10,944) | 43.5 | (8,042) |
| Marketing +50%, same signups | 10,526 | (16,775) | 43.5 | (13,775) |
| No Boost demand | 8,690 | (13,009) | 43.5 | (10,009) |
| Support contractor from 80 merchants | 10,526 | (17,675) | 43.5 | (14,675) |
| Billing delayed to June | 7,565 | (14,897) | 39.4 | (11,897) |

**What matters most:** paid conversion, signups and activation, then when the first hire happens. Order volume, message cost and price level matter far less at this scale. Higher refusal rates do not change Domo's revenue (no per-order fee) but raise the value of the product. Delayed delivery integrations affect retention, which appears here as churn.

## 5. Capital plans

| Plan | Monthly budget | 12-month need | What it buys | What is postponed |
|---|---|---|---|---|
| **Bootstrap** | 800–1,400 DT | ≈ 14,000 DT if revenue follows the conservative case (loss 13,955) | Legal setup, tooling, accounting, 100–350 DT marketing | Paid ads, Arabic UI, WhatsApp API, any hire |
| **Lean growth (recommended)** | 1,500–2,300 DT | **≈ 15,000 DT** (base case loss 12,275 + buffer) | Base-case plan | Courier API, second freelancer |
| **Funded expansion** | 3,000–5,000 DT | ≈ 45,000–60,000 DT | Aggressive marketing, part-time support from month 6, courier integration, founder stipend | Marketplace, own delivery still excluded |

Minimum working capital: three months of fixed costs, about 3,000 DT lean. Runway on 15,000 DT in the base case: beyond November 2027. Hiring thresholds: support contractor at 150 active merchants or when the founder spends more than 10 hours a week on support; Boost freelancer per 8 Boost clients; no employee in year one. Cash preservation: annual plans at 10 months' price, Boost invoiced in advance, no credit to merchants, no ad budgets through Domo.

Acquisition by budget: zero (direct outreach, referrals, seller groups, content); low, under 500 DT/month (boosted posts of demo videos, micro-influencer sellers paid in free months); moderate, 500–1,500 (always-on Meta ads to the demo, one workshop a month); higher, 1,500+ (only once CAC per paying merchant is measured under 150 DT).

## 6. Pricing experiments

No willingness-to-pay data exists; none is invented here. Existing free users keep everything they have for 60 days after billing starts.

| ID | Hypothesis | Segment | Range | Measure | Window | Decision rule | Risk / rollback |
|---|---|---|---|---|---|---|---|
| PX-0 | Pilot sellers will pre-commit to pay | 20 pilot sellers, Feb 2027 | "Founding" annual Pro at 290 DT | Number who pay | 3 weeks | ≥5 of 20 → proceed with 39 DT; ≤1 → revisit value before billing | Refund on request within 30 days |
| PX-1 | 39 DT converts no worse than 29 DT | New activated sellers, by signup week (alternating) | 29 / 39 / 49 DT | Conversion at day 45; revenue per activated seller | 8 weeks, ≥40 activated sellers per arm | Pick the price with highest revenue per activated seller if conversion gap <5 points | Honour lowest price seen for 12 months |
| PX-2 | Free limit of 40 orders drives upgrades without hurting activation | New signups | 25 / 40 / 60 | Activation, upgrade rate | 8 weeks | Keep the limit with best paid conversion if activation drop <3 points | Raise limit immediately if activation falls |
| PX-3 | Annual at 10 months is taken by ≥20% | Paying sellers at month 2 | 10 vs 9 months | Take rate, cash | 6 weeks | Keep the better cash outcome | — |
| PX-4 | Boost entry at 149 DT retains 3 months | 3–5 pilot clients | List price | Retention, margin, hours | 3 months | Continue only if margin ≥40% and ≤5 founder hours/client/month | Stop new sales |
