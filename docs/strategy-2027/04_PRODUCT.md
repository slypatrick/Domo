# 04 — Product ecosystem, UX strategy, prioritisation, future opportunities

## 1. Product structure

The brief proposes seven systems (Commerce, Trust, Market, Delivery, Boost, Connect, Operations). Seven brands for a product with one real seller would repeat the fragmentation found in the audit. **Recommended structure: one product, two capabilities, one service, one back office.**

| System in the brief | Decision | Purpose | Personas | Keep | Missing | Commercial impact | Operational obligation | Stage |
|---|---|---|---|---|---|---|---|---|
| A. Commerce | **The product ("Domo")** | Capture, confirm and follow COD orders | Seller, staff | F1–F7, F9, F16, F18 | Paste-to-order, bulk actions, export, reminders, seats, billing | All subscription revenue | Support | Q1–Q2 |
| B. Trust | **Capability inside the product, not a brand** | Evidence of confirmation, delivery events, fair history | Seller, buyer, admin | F5, F7, F17, F11 | Buyer data notice, own-shop default, audit log, retention rules | Differentiation | Contest handling within 3 business days | Q1 |
| C. Market | **Dormant** | Directory and storefronts | Buyer | F9, F10 | Nothing to build now | None in year one | None | Year 2 gate |
| D. Delivery | **Becomes "courier connection" inside Connect; own delivery frozen** | Remove double entry; get outcomes | Seller | Failure causes, statuses | Courier export, status import, later booking | Retention; later referral fee | Partner management | Q2–Q3 |
| E. Boost | **Service, waitlist** | Managed social media | Seller | F20 | Delivery process, reporting | Secondary revenue | Freelancer management | Pilot Q2 |
| F. Connect | **Capability** | API, webhooks, plugins | Sellers with sites | F19 | Webhooks, docs, WooCommerce plugin | Business tier | Developer support | Q2–Q3 |
| G. Operations | **Back office** | Admin, billing, support, metrics | Founder | F21 | Metrics dashboard, subscription admin, audit | Enables everything | — | Q1 |

Should trust be a separate branded product? No. A separate "Domo Trust" suggests a credit-bureau-like score, which is the riskiest reading. Trust is shown as facts inside each order.

## 2. UX strategy

### Seller

- **Minimum onboarding:** phone, OTP, shop name, password. Nothing else before the first order.
- **First meaningful action:** create one order (paste a customer's message or type it) and send the confirmation link. Target: under 3 minutes from sign-up.
- **First confirmed order** is the activation moment: celebrate it, then ask for logo/storefront.
- **Home:** today's work first ("À confirmer", "À expédier", "En livraison", "Retours"), then one number: confirmed-before-shipping rate and estimated courier fees saved this month.
- **Order operations:** paste-to-order; duplicate detection on phone + items within 48 hours; batch "send reminders"; batch status change; courier export.
- **Notifications hierarchy:** (1) buyer confirmed/refused, (2) contest opened, (3) weekly summary. No marketing pushes.
- **Automation:** reminders at +4 h and +24 h, deterministic rules, seller-controlled.
- **Reporting:** refusal rate by cause, by governorate, by product; money saved.
- **Upgrade triggers:** 80% of included orders; opening a paid report; adding a second seat; requesting the API.
- **Support and recovery:** every error says what happened and what to do; WhatsApp support link in settings.
- **Two levels of density:** default "simple" view; "compact table" toggle for sellers above 200 orders/month. Same screens, not two apps.

### Buyer

No account, ever, to confirm. The confirmation page shows shop name, items, total including delivery, address, and three actions (confirm, change address, refuse). It states in one line what is recorded and who sees it. Tracking and contesting from the same link. Repeat order: "commander à nouveau" on delivered orders for shops with a storefront.

### Courier

No Domo courier app is needed in year one. Requirement is a clean hand-off: export file per courier format, parcel label sheet, and import of the courier's status file.

### Administrator

One "Aujourd'hui" page: sign-ups, activations, stuck onboardings, open contests, failed payments, errors. Workflows for verification, contests (decision + reason, logged), subscription changes, data correction or deletion requests.

### Design strategy

Keep the current identity (blue #1d3fd1, navy, Bricolage Grotesque / Instrument Sans). Mobile-first; bottom navigation with at most five items; French first, Arabic (RTL) in Q3; WCAG AA contrast and 44 px targets; empty states that lead to the first order; facts-not-labels for trust.

### UX acceptance criteria for Opus (examples; full sets are in the PRDs)

1. A new seller reaches the order form in at most 2 screens after OTP.
2. From sign-up to a sent confirmation link: median under 3 minutes in the pilot.
3. No screen scrolls horizontally at 360, 768 or 1280 px.
4. Every destructive action names the object and asks once.
5. The buyer page loads under 2 s on 3G-fast throttling and works without JavaScript errors on Android Chrome and iOS Safari.

## 3. Feature prioritisation

Score = (Reach × Impact × Confidence) ÷ Effort; Reach in merchants per quarter at base case, Impact 0.5–3, Confidence 0.5–1, Effort in Opus work-weeks at solo-founder pace.

| ID | Initiative | Problem | Reach | Impact | Conf. | Effort | Score | Type |
|---|---|---|---|---|---|---|---|---|
| P1 | Event tracking + admin metrics | Blind to activation/retention | all | 3 | 1 | 1 | — | Foundation |
| P2 | First-order onboarding + OTP + password reset | Slow first value; fake accounts | 100 | 3 | 0.8 | 1.5 | 160 | Core |
| P3 | Trust consolidation: own-shop default, buyer notice, flags to freeze delivery/protection/cross-shop | Legal exposure, product clarity | all | 3 | 1 | 1 | — | Foundation |
| P4 | Paste-to-order + duplicate detection | Typing each order | 100 | 2 | 0.7 | 1.5 | 93 | Core |
| P5 | Reminders (batch, seller-sent) | Unconfirmed orders | 100 | 2 | 0.8 | 1 | 160 | Core |
| P6 | Money-saved and refusal report | No visible value; no reason to pay | 100 | 2 | 0.7 | 1 | 140 | Revenue enabler |
| P7 | Subscriptions and billing | No revenue | 100 | 3 | 0.8 | 2.5 | 96 | Revenue enabler |
| P8 | Courier export + status import | Double entry; missing outcomes | 80 | 2 | 0.7 | 2 | 56 | Core |
| P9 | Referral programme | Paid CAC | 60 | 1.5 | 0.6 | 1 | 54 | Growth |
| P10 | Webhooks + API docs + WooCommerce plugin | Sellers with sites | 30 | 2 | 0.6 | 3 | 12 | Growth |
| P11 | Team seats and roles | Larger sellers | 20 | 2 | 0.7 | 1.5 | 19 | Revenue enabler |
| P12 | Media to R2, tests, error monitoring, backups drill | Fragility | all | 2 | 1 | 2 | — | Foundation |
| P13 | Arabic interface (RTL) | Reach | 60 | 1 | 0.6 | 2.5 | 14 | Growth |
| P14 | WhatsApp Business API automation pack | Manual sending | 20 | 2 | 0.5 | 3 | 7 | Experimental |
| P15 | Courier booking API with one partner | Friction; referral revenue | 40 | 2 | 0.4 | 3 | 11 | Experimental |

Quick wins: P1, P3, P5. Foundations: P1, P3, P12. Explicitly not built in year one: marketplace features, driver app changes, inventory forecasting, multi-inbox.

## 4. Future opportunities

Format: problem → evidence → user → data needed → model → value → cost → risk → decision.

| Opportunity | Assessment | Decision |
|---|---|---|
| Paste-to-order from a customer message | Sellers copy details by hand (INFERRED). Deterministic parsing of phone, governorate and price covers most cases; an LLM adds cost and privacy questions | **Build deterministic (P4)**; test AI later |
| Duplicate order detection | Same phone + similar items within 48 h. Simple rule | **Build** inside P4 |
| Address quality help | Governorate/delegation pick-lists and buyer-shared location already exist | **Build** small improvements |
| Smart confirmation reminders | Fixed schedule beats "smart" until data exists | **Build deterministic (P5)** |
| Delivery failure prevention | Needs outcome data from couriers | **Defer** until P8 has 3 months of data |
| Profitability insights | Needs product cost input; valuable for retention | **Build light** inside P6 (courier fees saved), full version year 2 |
| Inventory forecasting | Beachhead sells small, changing stock | **Defer** |
| Product import from other platforms | Only for storefront use | **Defer** |
| WhatsApp Business automation | Meta bills per delivered template message since July 2025 (Meta pricing docs); Tunisian rate unverified; needs Meta business verification | **Experiment (P14)** on Business tier |
| Multi-channel inbox | Competes with Meta's own tools | **Reject** |
| Support automation | No volume | **Defer** |
| Embedded confirmation widget / API | Lets site owners keep their store | **Build (P10)** |
| Courier comparison and selection | Needs several partners and outcome data | **Year 2** |
| Returns and exchange automation | Depends on courier integration | **Year 2** |
| Agency workspaces | Small segment | **Year 2** |
| B2B analytics | Would expose merchant or buyer data | **Reject** unless aggregated and consented |
| Buyer reorder tools | Cheap with storefront | **Build small** in Q3 |
| Privacy-respecting shared trust | Possible moat; legally uncertain | **Legal review first** (see 07) |

Ranked by expected value: P4, P5, P6, P8, P10.
