# 03 — Vision, positioning, business model and trade-offs

## 1. Vision and positioning

- **Mission:** help Tunisian online sellers ship only the orders that will be accepted.
- **Vision (3 years):** the standard order desk for cash-on-delivery commerce in Tunisia, connected to every major courier.
- **Brand promise:** "Chaque commande confirmée avant d'être expédiée."
- **Value proposition:** in under a minute per order, the buyer confirms items, price and address from their own phone; the seller sees what is confirmed, what was delivered and why parcels came back.
- **Category:** COD order confirmation and tracking for social sellers ("bureau de commandes"). Not a marketplace, not a store builder, not a courier.
- **Primary audience:** Instagram/Facebook sellers of fashion, accessories and beauty with 50–400 orders a month. **Secondary:** sellers with a website who want confirmation by API; high-volume COD teams (from Q3).
- **Competitive narrative:** store builders help you get orders; couriers move parcels; nobody sits between the two to make sure the parcel is wanted. Domo does, without replacing either.

**Positioning concepts tested against criteria** (clarity, truthfulness today, differentiation, relevance to beachhead; 1–5 each):

| Concept | Clarity | True today | Different | Relevant | Total |
|---|---|---|---|---|---|
| "La marketplace tunisienne de confiance" | 4 | 1 | 2 | 2 | 9 |
| "Tout pour vendre en ligne" | 2 | 2 | 1 | 3 | 8 |
| **"Moins de colis refusés"** | 5 | 4 | 5 | 5 | **19** |
| "Le score de confiance des acheteurs" | 4 | 2 | 5 | 4 | 15 (and legally exposed) |

Selected: **"Moins de colis refusés."** Claims must stay provable: say "confirmée par le client", never "vérifiée" or "garantie".

**Tone.** Direct, practical, seller-to-seller. Numbers over adjectives.

**French messaging:** "Vos clients confirment en un clic. Vous n'expédiez que les commandes confirmées." / "Gardez WhatsApp, gardez votre livreur. Ajoutez la confirmation."

**Tunisian Arabic (derja) messaging — drafts for native review, not final:** "ما تبعثش كولي قبل ما الكليون يأكّد." / "الكليون يأكّد بكليك، وإنت تبعث وإنت مرتاح."

**Trust messaging principles:** state facts ("3 livrées, 1 refus du client"); never label a person; say who sees what; always show how to contest.

## 2. Revenue models evaluated

Year-one opportunity uses base-case volumes from the financial model. "Trust effect" is the effect on merchant and buyer trust.

| Model | Price tested | 12-month revenue (base) | Direct cost | Contribution margin | Sales/support effort | Capital | Adoption odds | Main risk | Trust effect | Time to first revenue | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1. Freemium SaaS | Free up to 40 confirmed orders/month | 0 directly | ~0.15 DT/merchant/month | Negative but tiny | Low | None | High | Free users cost support time | Positive | — | **Adopt as entry tier** |
| 2. Subscriptions | Pro 39 DT, Business 99 DT (incl. VAT) | 8,690 DT | ~1.4 DT/merchant/month | ~97% | Medium | Billing build | Medium (untested) | Unwillingness to pay | Neutral | Mar 2027 | **Primary engine** |
| 3. Per-order pricing | 0.2–0.4 DT/confirmed order | Similar to 2 | Same | High | Low | Metering | Low–medium | Bill shock; sellers enter fewer orders, starving the data | Negative | — | **Reject as base; use included-usage tiers** |
| 4. Delivery coordination (own delivery, 8 DT/parcel, 4 DT to driver) | 8 DT | 0 | 4 DT driver + loss, cash risk, dispatch time | Unknown, likely thin | Very high | Working capital for payouts | Low | Cash liability, labour status, theft/loss | Negative if a parcel or cash goes missing | — | **Freeze** |
| 4b. Courier referral | 0.15 DT/shipment paid by courier | 0 (base), 4,854 (aggressive) | ~0 | ~100% | Partnership work | None | Depends on a partner | No partner exists | Neutral if disclosed | H2 2027 | **Experimental** |
| 5. Boost services | 149 / 299 / 549 DT per month | 1,836 DT | 60% freelancer | 40% | High | None | Low–medium | Founder time, quality, churn | Positive if results are real | Apr 2027 | **Secondary, capacity-capped** |
| 6. Marketplace commission / sponsored placement | 3–8% or paid ranking | 0 | — | — | High | Demand generation | Very low | No buyers; double-charging with subscriptions | Negative | — | **Reject for year one** |
| 7. B2B: API plan, multi-store, confirmation-as-a-service | Inside Business; custom above 1,500 orders | Inside model 2 | Low | High | Medium | Docs, webhooks | Medium | Small number of buyers | Neutral | Q3 2027 | **Fold into Business tier** |
| Protected purchase (3% from buyer) | 2–15 DT | 0 | Refund liability | Unknown | High | Reserve fund | Low | Unlicensed guarantee/escrow | Negative if a claim is unpaid | — | **Freeze** |
| Selling buyer reputation data | — | — | — | — | — | — | — | Unlawful without clear basis | Destructive | — | **Reject** |

**Selection.** Primary: subscriptions with a free tier. Secondary: Boost, capped at what one freelancer can deliver. Experimental: courier referral fees, pricing add-ons (extra seats, WhatsApp automation pack). Rejected for year one: per-order billing, commission, own delivery, protected purchase, any sale of buyer data.

## 3. Unified pricing architecture (PROPOSED, to be validated by experiment PX-1)

Prices include 19% VAT. Annual = 10 months paid.

| | **Gratuit** | **Pro — 39 DT/month (390/year)** | **Business — 99 DT/month (990/year)** | **Sur mesure** |
|---|---|---|---|---|
| Target | New and small sellers | Beachhead: 50–400 orders/month | Teams, sites, 400–1,500 orders/month | 1,500+ orders, agencies |
| Confirmed orders included | 40/month | 400/month | 1,500/month | Negotiated |
| Confirmation link, pipeline, storefront | Yes | Yes | Yes | Yes |
| Own-shop buyer history | Last 30 days | Full | Full | Full |
| Refusal analytics and "money saved" report | Summary | Full | Full | Full |
| Paste-to-order and bulk actions | 10/month | Yes | Yes | Yes |
| Courier export (CSV/label sheet) | No | Yes | Yes + booking when available | Yes |
| Reminders (seller-sent templates) | Manual | One-tap batch | Automated WhatsApp pack (fair-use 300 messages, then 0.05 DT each) | Negotiated |
| Team seats | 1 | 2 | 5 | Negotiated |
| API and webhooks | No | No | Yes | Yes |
| Support | Help centre | WhatsApp, 1 business day | WhatsApp, same day | Named contact |
| Est. variable cost per month | 0.15 DT | ~1.0 DT | ~3–5 DT | — |
| Gross margin | — | ~97% | ~94–96% | — |

**Upgrade logic.** Soft limit: at 80% of included orders the seller is told; at 100% nothing is blocked for 7 days, then new confirmations wait until upgrade or next month. Orders already sent are never withheld. **Downgrade/cancel:** effective at period end; data kept and exportable; paid-only features become read-only. **Price change promise** (already on the site): 30 days' notice.

Why confirmed orders and not created orders: Domo must never earn more from spam or failed orders. Why not delivered orders: Domo cannot yet observe delivery reliably.

**Boost** stays separately priced at the current list (149 / 299 / 549 DT). Ad budgets are paid by the merchant directly to Meta and never pass through Domo's accounts.

## 4. Strategic trade-offs and decisions

Each decision lists alternatives, criteria, evidence, reasoning, uncertainty and reversal condition.

| # | Decision | Alternatives | Evidence | Why | Uncertainty | Reverse when |
|---|---|---|---|---|---|---|
| D1 | Wedge = COD confirmation for social sellers | Marketplace; store builder; logistics | M3–M6 refusal data; scores in 02 §6; zero users for other lines | Fastest proof with least capital | No usage data | <20% activation after 150 signups despite onboarding fixes |
| D2 | Freeze own delivery | Launch in Tunis with 3–5 drivers | 0 drivers; cash and labour liabilities; couriers already dense | Capital and risk without proof of margin | Could be a moat later | A courier partnership fails **and** ≥100 paying merchants ask for it, with legal structure and insurance in place |
| D3 | Freeze protected purchase | Keep as optional | No licence review; no reserve | An unpaid claim would end the brand | Might lift buyer conversion | Written legal opinion plus a funded reserve or insurer |
| D4 | Restrict buyer history to the seller's own shop by default | Keep cross-shop score | Law 2004-63 prior declaration regime; no legal review | Removes largest legal exposure; network is empty so little value is lost | Cross-shop data may be the long-term moat | INPDP position and counsel opinion obtained; buyer notice and contest flow accepted |
| D5 | Subscription with included usage | Per-order; commission | Table §2 | Predictable, aligned with value | Willingness to pay unknown | PX-1 shows <10% conversion at every price tested |
| D6 | No marketplace investment | Demand campaigns | Closures of Founa and Jumia Tunisia (M9); 3 stores | Cold start needs capital | Directory may bring SEO traffic | ≥300 active stores with catalogues |
| D7 | Free pilot in Q1, billing from March 2027 | Charge from day one | No entity/gateway confirmed; need proof | Learn before pricing | Delays revenue | Entity and gateway ready earlier and pilot sellers ask to pay |
| D8 | Asset-light courier strategy: export first, API booking second | Build own; ignore couriers | Double-entry friction in journeys | Removes friction, creates outcome data | Courier willingness unknown | No courier agrees by Aug 2027 → stay on export |
| D9 | Boost capped and gated | Scale agency | 0 requests; labour model | Protects founder time | Could be the best cash source | ≥5 paying Boost clients retained 3 months at ≥40% margin |
| D10 | One codebase, modular monolith on Cloudflare | Rewrite; microservices | Small, working stack | Cheapest path | Two large files slow change | See 08 |
