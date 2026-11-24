# 07 — Operating model, trust and compliance, risk register

Nothing here is legal advice or an assurance of compliance. It lists what was found and what a qualified Tunisian lawyer and accountant must confirm.

## 1. Operating model and team

| Function | Why | Needed from | Weekly load (base) | Who | Cost | Trigger to change |
|---|---|---|---|---|---|---|
| Strategy, product decisions | Direction | Now | 4 h | Founder | — | — |
| Engineering | Build | Now | Opus sessions directed by founder, 8–10 h of founder time | Founder + Claude Opus | 350 DT/month tooling | Backlog older than 6 weeks → contract developer review |
| Merchant acquisition | Signups | Now | 10 h | Founder | Marketing budget | CAC measured and <150 DT → add freelancer |
| Onboarding and support | Activation | Now | 4 h rising to 10 h | Founder, then contractor | 900 DT/month | 150 active merchants or >10 h/week |
| Trust and contests | Fairness | Now | <1 h | Founder | — | >10 open contests/week |
| Courier partner coordination | Integration | Q2 | 1–2 h | Founder | — | Second partner |
| Boost delivery | Service revenue | Q2 pilot | 0 for founder beyond QA | Freelancer | 60% of Boost revenue | 8 clients per freelancer |
| Accounting, invoicing | Compliance | Dec 2026 | 1 h | Accountant | 250 DT/month | — |
| Legal | Compliance | Dec 2026 | One-off | Lawyer | ≈3,000 DT one-off (quote needed) | New regulated activity |
| QA | Quality | Now | 2 h | Founder with test checklist; automated tests from batch 5 | — | — |

Founder time totals about 30–35 hours a week in the base case. If the founder has less, use the solo-founder roadmap in 09 §4. No employee is recommended in year one.

## 2. Standard operating procedures (targets fit a one-person team)

| Procedure | Steps | Target |
|---|---|---|
| Onboard a merchant | Welcome message within 2 h in working hours → check first order → day-3 and day-7 check-in → tag in tracking sheet | First confirmed order within 48 h |
| Verify a business | Seller uploads RNE extract or patente + ID → admin checks name match → approve/refuse with reason → log | 3 business days |
| Failed confirmation | Reminder at +4 h and +24 h → seller calls → mark "pas de réponse" → do not ship | Same day |
| Delivery dispute (courier vs seller) | Domo is not a party; provide event log on request | 2 business days |
| Courier support | Partner contact channel; file-format issues fixed in next release | 2 business days |
| Refund claim (subscription) | Refund pro rata if a billing error; otherwise cancel at period end | 5 business days |
| Trust incident / contested refusal | Read order events → hear buyer and seller → decide → notify both → log reason | 3 business days; refusal does not count meanwhile |
| Correct or delete personal data | Verify requester by phone OTP → correct/delete → confirm | 10 business days |
| System incident | Status note to affected sellers by WhatsApp → fix or roll back deployment → post-mortem note | Acknowledge in 4 h (working hours) |
| Billing dispute | Check gateway record → correct invoice → credit if owed | 5 business days |
| Suspicious activity | Rate-limit flags, many accounts per device/phone → suspend rewards → manual review | Weekly review |
| Partnership management | One owner (founder), written terms, quarterly review | Quarterly |

## 3. Trust system: risk assessment and recommendation

**Legal context found (sources in 02 and below; all need counsel):**

- Organic Law 2004-63 requires a prior declaration to the INPDP for processing personal data, with silence for one month counting as acceptance (art. 7 as published at legislation-securite.tn). A commentary in Tunisie Numérique describes declaration or authorisation as the key obligation and mentions a draft organic law (no. 095/2025) and a 2023 cybersecurity decree-law. Whether Domo has filed anything is UNKNOWN.
- A bill on selling through websites and social networks (no. 42/2024) was still in committee in June 2026 (AllAfrica, La Presse). Press summaries mention identification of sellers (RNE extract with a signed specification) and a short return window for buyers (Managers.tn). Not law yet; it would favour tools that formalise sellers.
- E-invoicing was extended to service providers from 1 January 2026 by article 53 of the 2026 finance law, with a ministry note of 23 January 2026 on practical conditions (KPMG circular, Business News). Domo sells services, so its own invoices are in scope in principle.
- Payment facilitation is licensed by the BCT (Konnect and Flouci are described as approved facilitators). Collecting buyers' cash and paying merchants (the frozen delivery and protected-purchase features) may fall under payment or collection rules. UNKNOWN; do not operate without advice.

**Alternatives for buyer history:**

| Option | Fraud-prevention value | Legal feasibility | Consumer harm | Build | Support cost | Brand risk | Decision |
|---|---|---|---|---|---|---|---|
| 1. Confirmation evidence only (who confirmed what, when) | Medium | High | Very low | Done | Low | Low | **Adopt now** |
| 2. Seller's own history with a buyer | Medium–high for repeat buyers | High (seller's own customer records) | Low | Done; make default | Low | Low | **Adopt now** |
| 3. Platform indicators limited to facts, with notice and contest | High once network exists | Uncertain | Medium (false positives) | Done, behind flag | Medium | Medium | **Only after legal review** |
| 4. Shared reputation or exclusion lists | High | Doubtful | High | — | High | High | **Reject** |

Rules that hold in every option: a failed delivery is not fraud; no blacklist by phone number; buyers see what is recorded and can contest; contested events do not count; only customer-caused refusals count (already built); numbers can change owner, so history older than 12 months is ignored; admin overrides are logged.

**False positives and remedies:** recycled phone numbers, shared family phones, courier errors recorded as refusals, malicious sellers. Remedies: cause codes, contest flow, 12-month window, minimum of three orders before any level is shown, admin review, deletion on request.

**Legal-review checklist (questions for counsel):**

1. Company form and what must appear in the legal notice and invoices.
2. INPDP: declaration or authorisation for (a) seller accounts, (b) buyers' order data processed on behalf of sellers, (c) any cross-shop indicator; controller versus processor roles; hosting outside Tunisia (Cloudflare) and transfer rules.
3. Lawfulness of showing one seller facts about a buyer's orders with other sellers; required notice and consent.
4. Retention periods and deletion.
5. Terms: Domo's liability towards sellers, buyers and couriers; that Domo is not party to the sale.
6. Whether holding COD cash or a buyer-paid "protection" fee needs a BCT or insurance authorisation.
7. Status of drivers if delivery is ever resumed.
8. E-invoicing and VAT regime for subscriptions and services; treatment of annual plans.
9. Consumer disclosures required on storefronts (seller identity, price, delivery, returns) under Law 2000-83 and Law 98-40, and under the pending bill.
10. Rules for WhatsApp messages to buyers (opt-in wording).
11. Advertising transparency for sponsored placement and Boost-managed ads.

## 4. Risk register

L = likelihood, I = impact (1–5).

| # | Risk | L | I | Mitigation | Owner | Trigger |
|---|---|---|---|---|---|---|
| R1 | Sellers will not pay | 4 | 5 | PX-0 pre-commitment, money-saved report, founder pricing | Founder | ≤1 of 20 pre-commit |
| R2 | Low activation (double entry, habit) | 4 | 4 | First-order onboarding, paste-to-order, courier export | Founder | Activation <20% after 150 signups |
| R3 | Founder bandwidth | 4 | 4 | Solo roadmap, frozen lines, weekly scorecard | Founder | Two missed monthly gates |
| R4 | Data-protection complaint or INPDP action | 2 | 5 | Own-shop default, declaration, notice, contest flow | Founder + lawyer | Any complaint |
| R5 | No legal entity or gateway → cannot bill | 3 | 5 | Start in December; fallback: manual invoices by bank transfer or D17 | Founder | Not ready by 15 Feb |
| R6 | Courier launches its own confirmation tool | 3 | 3 | Be courier-neutral; integrate quickly | Founder | Announcement |
| R7 | Store builder copies confirmation | 3 | 3 | Depth in refusal analytics; neutrality across platforms | Founder | — |
| R8 | WhatsApp policy or price change | 2 | 3 | Default flow uses seller's own WhatsApp link (no API dependency) | — | Meta notice |
| R9 | Security incident (leaked token, no OTP) | 3 | 4 | Revoke token now; OTP; rotate secrets; monitoring | Founder | — |
| R10 | Data loss | 2 | 5 | Backups drill, R2 for media | Opus batch 5 | — |
| R11 | Free users' cost and support load | 3 | 2 | Limits, help centre | — | Support >10 h/week |
| R12 | Boost quality damages brand | 3 | 3 | Cap, pilot, written deliverables | Founder | Client churn in month 1 |
| R13 | Cash runs out | 3 | 5 | 15,000 DT plan; lean mode switch | Founder | Cash < 3 months fixed costs |
| R14 | Pending e-commerce law imposes new duties | 3 | 2 | Seller verification feature already exists; follow the bill | Founder | Adoption |
| R15 | Fake orders or reviews to game referrals | 2 | 2 | Reward on activation with distinct confirmed buyers | — | Pattern in weekly review |
