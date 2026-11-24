# 00 — Executive decision brief

Planning horizon: December 2026 to November 2027. Strategy only; nothing in the product, database or production configuration was changed to produce this package. Figures come from `DOMO_2027_Financial_Model.xlsx`. All forecasts rest on assumptions that have not been tested, because Domo has no usage history.

## 1. Summary

**Where Domo stands.** A working app with a wide feature surface and no customers: about one real seller, no drivers, no Boost client, no revenue, no billing system, and an unconfirmed legal entity (production data, 16 Nov 2026). The engineering is ahead of the business.

**What Domo should become.** The COD order desk for Tunisian social sellers: the buyer confirms each order from their phone before it ships, and the seller sees what was delivered, what came back and why. Promise: "Moins de colis refusés."

**What to stop.** Domo's own delivery and cash handling, the buyer-paid protection fee, cross-shop buyer scoring and in-app calls are frozen behind flags. The marketplace stays online and receives no investment.

**How it earns.** Subscriptions with a free tier: Gratuit (40 confirmed orders a month), Pro 39 DT, Business 99 DT, VAT included. Boost services stay as a capped secondary line. Courier referral fees are an experiment for the second half of the year, and only with a signed partner.

**What the year looks like (base case).** 610 signups, 139 active merchants and about 44 paying by November 2027; 10,526 DT of revenue; a 12,275 DT operating loss; monthly result close to zero by November with an unpaid founder. Conservative: 8 paying, 1,645 DT revenue, 13,955 DT loss. Aggressive: 144 paying, 43,450 DT revenue, 1,898 DT loss, profitable monthly from the autumn.

**What it needs.** About 15,000 DT over twelve months, 30–35 founder hours a week, a lawyer and an accountant in December, and a payment gateway by February.

**The first proof point.** By the end of February 2027: at least 10 of 20 pilot sellers activated and at least 5 willing to prepay. If not, narrow and fix before spending more.

## 2. The ten non-negotiable strategic decisions

1. Domo is a COD confirmation and order-tracking tool for social sellers. It is not a marketplace, a courier or a store builder.
2. Beachhead: Instagram and Facebook sellers of fashion, accessories and beauty with 50–400 orders a month, starting in Grand Tunis.
3. Own delivery and cash handling are frozen for the whole year. Couriers are partners.
4. Buyer history is limited to each seller's own shop until a lawyer and the INPDP position say otherwise. No blacklist, ever.
5. The buyer never needs an account, and every recorded fact can be contested.
6. Revenue comes first from subscriptions with included usage, counted on buyer-confirmed orders. No per-order fees, no commission.
7. The first quarter is a free, measured pilot. Billing starts in March 2027, after a prepayment test.
8. Every month has one objective and one gate. Spending rises only when the previous gate is met.
9. One codebase on the current Cloudflare stack, restructured gradually, with tests before billing goes live. No rewrite.
10. Domo says only what it can prove: "confirmée par le client", facts instead of labels, estimates labelled as estimates.

## 3. The five biggest mistakes to avoid

| Mistake | Consequence |
|---|---|
| Launching own delivery to "complete the offer" | Domo would hold merchants' cash and parcels with no capital, insurance or legal structure; one loss or theft ends merchant trust |
| Keeping cross-shop scoring on by default | A complaint or regulator inquiry before any revenue; a wrongly labelled buyer becomes the public story of the brand |
| Building more features before 20 sellers use the core weekly | Another quarter of engineering with no evidence; the audit already shows this pattern |
| Buying ads before activation works | The model shows CAC per paying merchant of 166 DT in the base case and 294 DT in the conservative case; with weak activation the budget is gone in two months |
| Scaling Boost as an agency | 40% margin and founder hours per client; it would consume the time needed for the product that has 97% margin |

## 4. Final synthesis: twenty answers

1. **What business?** A subscription tool for COD order confirmation and follow-up, later the neutral link between sellers and couriers.
2. **Most defensible initial advantage?** It works without a storefront and without changing courier, and it produces evidence of confirmation plus reasons for failure. Speed of adoption, not technology.
3. **First segment?** Fashion, accessories and beauty sellers on Instagram/Facebook, 50–400 orders a month.
4. **Stop or postpone?** Own delivery, protected purchase, cross-shop scoring, calls, marketplace investment, agency scaling, inventory, multi-inbox.
5. **Consolidate now?** Order entry, confirmation link, pipeline, failure causes and contests, own-shop history, stats, storefront as an order channel, API: one product.
6. **Five capabilities with the strongest economic value?** Paste-to-order; reminders; money-saved report; courier export and status import; subscriptions.
7. **Free, paid, usage-based?** Free: the core loop up to 40 confirmed orders. Paid: volume, full history and reports, courier files, seats, API. Usage-based: only automated WhatsApp messages above a fair-use allowance.
8. **Prices and why?** 39 and 99 DT a month including VAT, annual at ten months. At 100 orders a month, avoiding five wasted parcels at roughly 8 DT each covers Pro. The level is a proposal to be tested at 29/39/49 (PX-1). Competitor prices were not verified.
9. **First cohorts?** Twenty hand-picked pilot sellers, then a 30-day challenge with public results, then referrals; ads only after activation reaches 25%.
10. **Repeat usage and trust?** Daily pipeline, weekly summary, value shown in dinars, courier hand-off; for buyers, no account, clear notice, contestable records.
11. **Partnerships that matter?** One payment gateway (to bill), one or two couriers (file exchange, then API), a lawyer and an accountant.
12. **Greatest regulatory and operational risks?** Personal-data rules for buyer history; any holding of third-party cash; invoicing obligations; founder bandwidth.
13. **Investment needed?** About 15,000 DT for the lean plan; about 14,000 DT in bootstrap mode if revenue follows the conservative case; 45,000–60,000 DT for the funded plan.
14. **Twelve-month outcomes?** Revenue 1,645 / 10,526 / 43,450 DT; operating result −13,955 / −12,275 / −1,898 DT; paying merchants 8 / 44 / 144.
15. **Break-even?** About 64 paying merchants with a support contractor and 1,000 DT of monthly marketing; about 26 in lean mode; add about 48 for a 2,000 DT founder draw.
16. **Product-market-fit signals?** Week-12 retention of activated sellers ≥50%, paid churn ≤5% for three months, ≥30% of signups from referrals, ≥40% "very disappointed" on a survey of at least 30 users.
17. **Expansion path?** Dec foundation → Jan first-order speed → Feb value and prepayment test → Mar billing → Apr courier files → May referral and retention gate → Jun API → Jul teams → Aug Arabic → Sep courier booking if a partner signs → Oct unit economics → Nov year-two decision.
18. **First Opus batch?** B1 "Socle": analytics events and admin metrics, OTP and password reset, feature flags that freeze side products, own-shop history default, buyer notice, admin role and audit log (10 §4).
19. **November 2027?** See §6.
20. **Year two?** Courier network layer, deposits through a licensed gateway, high-volume teams, confirmation API for platforms; shared trust only with legal clearance (11 §7).

## 5. The 90-day founder action plan

| Weeks | Business decisions | User validation | Partnerships | Requests to Opus |
|---|---|---|---|---|
| 1–2 (early Dec) | Revoke the leaked Cloudflare token. Confirm or create the legal entity. Engage a lawyer (checklist in 07 §3) and an accountant. Replace opening cash in the workbook. Approve the ten decisions | List 60 target sellers; book 10 interviews | Ask two gateways for onboarding terms | B1 |
| 3–4 | Choose OTP provider from quotes | Onboard the first 10 pilot sellers personally; 10 more interviews | First call with two couriers: ask for file formats | B1 finished and deployed |
| 5–6 (Jan) | Collect competitor price pages | 20 pilot sellers live; weekly check-ins | Gateway application filed | B2 |
| 7–8 | Review activation; fix the top friction | 30 interviews completed; write three seller stories (with consent) | INPDP filing prepared by counsel | B2 finished; B3 |
| 9–10 (Feb) | Set founder-offer terms; terms of sale reviewed | "Défi 30 jours" launched | Gateway contract signed | B4 built, switched off |
| 11–12 | **Gate G1.** Decide: start billing in March, or narrow | PX-0: ask 20 sellers to prepay | Courier file formats in hand | B4 dry run with test payments |
| 13 (early Mar) | Billing on; PX-1 starts | — | — | Billing fixes; B5 scoped |

## 6. The twelve-month end state (base case)

- **Product:** one app centred on confirmation and follow-up, with paste-to-order, reminders, value report, courier files, seats, webhooks, French and Arabic. Frozen modules still frozen or removed.
- **Merchants:** about 139 active, about 44 paying, concentrated in fashion and beauty, mostly Grand Tunis, Sahel and Sfax.
- **Monetisation:** about 2,100 DT of monthly revenue, roughly 85% subscriptions and 15% Boost; possibly a first courier referral agreement.
- **Costs:** about 1,900 DT a month; founder unpaid; no employee; one freelancer for Boost; support contractor not yet triggered.
- **Operations:** weekly scorecard, monthly review, written procedures, legal and tax basics in place.
- **Position:** known among social sellers as the confirmation tool; neutral towards couriers and store platforms; ready to choose a year-two direction with real cohort data.

## 7. Open questions for the founder, by priority

| # | Question | Why it matters |
|---|---|---|
| Q1 | Does a legal entity exist? Form, tax ID, RNE number, address | Billing, legal notice, gateway contract |
| Q2 | Opening cash and monthly amount you can commit | Chooses bootstrap, lean or funded plan |
| Q3 | Hours a week you can give | Chooses the roadmap variant |
| Q4 | Has any declaration been made to the INPDP? | Data-protection exposure |
| Q5 | Do you accept freezing delivery, protection, cross-shop history and calls? | First Opus batch depends on it |
| Q6 | Real prices of Converty, TikTak Pro, YouCan, eGrow and two couriers (delivery and return fees) | Pricing and messaging; not verified in this research |
| Q7 | Which couriers do target sellers use most? | Order of integrations |
| Q8 | Is there anyone who can deliver Boost work reliably? | Whether to pilot Boost at all |
| Q9 | Preferred OTP channel (WhatsApp or SMS) after quotes | B1 |
| Q10 | Native review of the Tunisian Arabic lines | Brand quality |

## 8. Evidence limits

Verified: the codebase, the live site and production counts. Publicly reported and cited: market statistics in 02. Not verified: competitor prices and several competitor products, courier prices, Meta's WhatsApp rate for Tunisian numbers, the legal position on every point in 07. Every conversion, churn and volume figure is a hypothesis until the pilot replaces it.
