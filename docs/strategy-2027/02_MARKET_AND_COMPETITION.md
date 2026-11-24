# 02 — Tunisian market, segments, sizing and competition

Research date: 16 Nov 2026. Each statistic lists source, date, definition and limit. Press reports of official bulletins are secondary sources; the founder should pull the original BCT bulletins before using a figure with investors.

## 1. Market facts

| # | Fact | Source and date | Definition and limits |
|---|---|---|---|
| M1 | 10.5 million internet users; 7.77 million social media user identities (62.5% of population), Oct 2026 | DataReportal, *Digital 2027: Tunisia* — https://datareportal.com/reports/digital-2027-tunisia | "User identities" are not unique people |
| M2 | Card e-payments in H1 2026: 10.3 million transactions, 771.4 million DT, 1,456 active merchant sites | Managers.tn reporting the BCT H1 2026 payments report — https://managers.tn/?p=121466 | Measures **online card payments only**. Includes bill payment and top-ups. It is **not** the e-commerce market and excludes COD entirely |
| M3 | Cash on delivery is above 85% of online transactions | Tunisie Numérique — https://www.tunisienumerique.com/retours-ecommerce-menace-rentabilite/ | Press estimate, method not given |
| M4 | 56% of online buyers prefer COD, 90% of them in cash | MDWEB survey cited by Tunisie Numérique — https://www.tunisienumerique.com/?p=1002489 | Survey of buyers on formal sites; social-commerce share is likely higher (INFERRED) |
| M5 | About 30% of COD orders are refused at delivery | Tayara.tn estimate cited by Tunisie Numérique — https://www.tunisienumerique.com/?p=1020008 | One operator's estimate |
| M6 | 15–25% of parcels refused in fashion | Kolonell (agency blog), Oct 2026 — https://kolonell.com/fr/blog/paiement-en-ligne-ecommerce-tunisie-clictopay-konnect-comparatif-2026 | Agency estimate, not a study |
| M7 | Fewer than one consumer in ten buys online; COD in cash is described by the Ministry of Commerce as the main obstacle for the organised sector | AllAfrica, Jun 2026 — https://fr.allafrica.com/stories/202606090488.html ; La Presse, Feb 2026 — https://www.lapresse.tn/2026/02/09/e-commerce-le-paiement-a-la-livraison-freine-encore-la-transition-digitale/ | Official statements relayed by press |
| M8 | Over 98% of e-commerce transactions occur in Tunis, Sfax, Sousse and Gabès | US Commercial Service country guide — https://www.trade.gov/country-commercial-guides/tunisia-ecommerce | Refers to card e-commerce; date of underlying data unclear |
| M9 | Founa and Jumia Tunisia closed | Tunisie Numérique — https://www.tunisienumerique.com/?p=1002489 | Signals that marketplaces struggle on unit economics |
| M10 | Local gateways charge roughly 1.5–2.5%; Konnect cited at 1.6% | Kolonell 2026 — https://kolonell.com/en/blog/online-payments-for-a-business-in-tunisia-fees-integration-2026 ; WeAreTech — https://www.wearetech.africa/en/fils/solutions/tunisie-konnect-propose-divers-services-financiers-grace-a-ses-plateformes-web-et-mobile | Indicative; get a written quote |
| M11 | Flouci offers payment plugins for WooCommerce, PrestaShop, Converty and (June 2026) Shopify | Managers.tn — https://managers.tn/?p=118162 | Shows Converty is an established local platform |
| M12 | IntiGo (courier) launched a "virtual parcel" COD service for digital goods in June 2026 | Business News — https://businessnews.com.tn/2026/06/24/paiement-a-la-livraison-pour-le-digital-intigo-lance-le-colis-virtuel-une-solution-pour-booster-le-e-commerce/1407363/ | Couriers are moving into software and payments |

**What is UNKNOWN and matters:** the number of active social sellers; average orders per seller; real refusal rates by category; courier price lists and return fees; competitor prices. None of these could be verified from reliable public sources. They are the first things the Q1 pilot and 30 seller interviews must measure.

**Reading for Domo.** Demand-side behaviour is clear: most buyers pay cash at the door, and a large share of parcels come back. The pain is real and costs the seller two courier legs plus tied-up stock. The official line pushes towards prepayment, which will take years. A tool that makes COD less wasteful fits the next 12–24 months. A tool that needs buyers to pay online does not.

## 2. Market sizing (ranges, bottom-up)

No reliable count of social sellers exists. The sizing below is a transparent model, not a fact.

Formula: `sellers = social media identities × share that sell × share active monthly`, then `SAM = sellers in beachhead with 30+ orders/month`, `SOM = reachable by Domo's channels in 12 months × activation`.

| Step | Low | Mid | High | Basis |
|---|---|---|---|---|
| Social media identities | 7.77 M | 7.77 M | 7.77 M | M1 |
| Share running a selling page/account | 0.3% | 0.6% | 1.0% | HYPOTHESIS |
| Selling accounts | 23,000 | 47,000 | 78,000 | computed |
| Share active with 30+ orders/month | 15% | 20% | 25% | HYPOTHESIS |
| **TAM: active COD social sellers** | **3,500** | **9,300** | **19,400** | computed |
| Share in fashion, beauty, accessories, home | 50% | 55% | 60% | HYPOTHESIS |
| Share in Grand Tunis + Sahel + Sfax + Nabeul | 65% | 70% | 75% | INFERRED from M8 |
| **SAM: beachhead sellers** | **1,100** | **3,600** | **8,700** | computed |
| **SOM, 12 months: active on Domo** | 44 | 139 | 358 | Financial model scenarios |
| SOM as share of mid SAM | 1.2% | 3.9% | 9.9% | computed |

Revenue view at proposed prices (blended 42.9 DT excl. VAT per paying merchant per month): TAM mid ≈ 9,300 × 30% paying × 42.9 × 12 ≈ **1.4 M DT/year**; SAM mid ≈ **0.56 M DT/year**. This is a small software market. Domo can be a sound small business on subscriptions; it becomes a larger company only through adjacent revenue (courier flow, services) or regional expansion. That conclusion drives the sequencing in document 03.

Per product line, year one: storefront SaaS is contested (Converty, YouCan, Shopify, WooCommerce) and not sized separately; COD order management is the line above; delivery coordination is sized at zero revenue in the base case because no partner exists; marketing services are capacity-bound (about 8 clients per freelancer); marketplace transactions are sized at zero.

Sensitivity: halving "share that sell" halves everything. The 30 interviews should ask each seller how many competing pages they know in their niche, to triangulate.

## 3. Segments

Scores 1–5 (5 is best for Domo). Pain = COD failure pain; Pay = ability to pay 39–99 DT; Reach = ease of acquisition; Support = low support burden; Fit = fit with today's product.

| Segment | Pain | Volume | Pay | Reach | Support | Fit | Total /30 | Note |
|---|---|---|---|---|---|---|---|---|
| Instagram/Facebook fashion and accessories sellers, 50–400 orders/month | 5 | 4 | 3 | 5 | 3 | 5 | **25** | **Beachhead** |
| Beauty and cosmetics sellers | 4 | 4 | 3 | 5 | 3 | 5 | 24 | Second |
| High-volume COD businesses (500+ orders, staff confirming by phone) | 5 | 5 | 5 | 2 | 2 | 3 | 22 | Third; needs team seats, bulk, courier API |
| Home and lifestyle | 3 | 3 | 3 | 4 | 3 | 4 | 20 | Later |
| Individual sellers under 30 orders/month | 3 | 1 | 1 | 5 | 2 | 5 | 17 | Free tier, referral source |
| Existing Converty / YouCan / WooCommerce stores | 4 | 4 | 4 | 3 | 2 | 2 | 19 | Needs plugins and webhooks first (Q2–Q3) |
| Merchants with physical shops | 2 | 2 | 4 | 2 | 3 | 3 | 16 | Wait |
| Small agencies managing several stores | 3 | 4 | 4 | 3 | 3 | 1 | 18 | Needs multi-store workspace; year 2 |

**Why the beachhead:** highest refusal rates (M6), order volumes that make 39 DT trivial against saved courier fees, reachable one by one through their public pages, and served today without a storefront migration. **Why others wait:** high-volume sellers need features Domo lacks; platform users need integrations; micro-sellers cannot pay.

## 4. Geography

Software is national from day one. Anything operational is not.

| Area | Seller density | Acquisition access | Courier coverage | Decision |
|---|---|---|---|---|
| Grand Tunis (Tunis, Ariana, Ben Arous, Manouba) | Highest (INFERRED from M8) | Founder can meet sellers | Dense | Primary focus for outreach and events |
| Sousse, Monastir (Sahel) | High | Online + occasional visits | Dense | Secondary from month 3 |
| Sfax | High | Online | Dense | Secondary from month 3 |
| Nabeul | Medium | Online | Good | Opportunistic |
| Rest of country | Lower | Online only | Variable | Software only, no targeted spend |

No Domo-operated delivery anywhere in year one.

## 5. Competition

**Verification limits.** Only Converty's own site, app listings and press items were verified. Prices for all named competitors are **UNKNOWN** here. Before pricing goes live, the founder should collect each competitor's public price page (task in 00, open question Q6).

| Player | What it is (evidence) | Direct competitor? |
|---|---|---|
| Converty | Tunisian store builder, Ariana; free subdomain or custom domain; mobile app (VERIFIED on converty.shop and App Store) | Partly: storefront and order list. Not a confirmation tool for DM orders (INFERRED) |
| YouCan | Moroccan store builder used in the Maghreb (INFERRED from eGrow's integration list) | Partly |
| Shopify / WooCommerce | Global store platforms; local payment plugins exist (M11) | Substitute for sellers with a site |
| TikTak Pro | Tunisian store and order-management app (VERIFIED: App Store listing "Manage Orders Easily") | Partly; closest on order management |
| eGrow | COD operations platform integrating stores and carriers, publishing Tunisia content (VERIFIED: egrow.com) | Yes for high-volume sellers |
| Waslo, Yalla Souk, Boutique.tn | Not verified in this research | UNKNOWN |
| Couriers' own dashboards (IntiGo and others) | Parcel entry, tracking, COD statements; IntiGo adding services (M12) | Substitute for the pipeline; potential partners |
| WhatsApp + notebook/spreadsheet + phone calls | The default | **Main competitor** |

**Competitive matrix (verified cells marked V; others are INFERRED and must be checked):**

| Capability | Domo | Store builders (Converty, YouCan, TikTak) | COD ops tools (eGrow) | Manual |
|---|---|---|---|---|
| Works with no storefront, for DM orders | Yes (V) | No (INFERRED) | Partly | Yes |
| Buyer one-tap confirmation with evidence | Yes (V) | Not advertised (UNKNOWN) | Phone/automation | No |
| Storefront | Basic (V) | Strong | No | No |
| Courier integrations | None (V) | Several (INFERRED) | Core strength (V on site) | No |
| Buyer history | Own + cross-shop (V) | Own shop | Own shop | Memory |
| Price | Free today (V) | UNKNOWN | UNKNOWN | Free |
| Switching cost to adopt | Very low | High (rebuild store) | Medium | — |

## 6. Positioning options

Scores 1–5, 5 is best for Domo over 12 months with one founder and little capital.

| Criterion | A: Marketplace | B: Social-commerce OS | C: COD confirmation infrastructure | D: Merchant SaaS + optional services |
|---|---|---|---|---|
| Market demand evidence | 2 | 3 | 5 | 3 |
| Low competitive intensity | 1 | 2 | 4 | 2 |
| Time to value for seller | 1 | 3 | 5 | 3 |
| Low cost to launch | 1 | 2 | 5 | 3 |
| Low implementation complexity | 2 | 1 | 5 | 3 |
| Low capital requirement | 1 | 2 | 5 | 3 |
| Merchant retention | 2 | 4 | 3 | 4 |
| Network effects | 4 | 2 | 2 | 2 |
| Gross margin potential | 2 | 4 | 5 | 4 |
| Low regulatory exposure | 2 | 3 | 4 | 4 |
| Strategic flexibility | 2 | 3 | 4 | 4 |
| Time to sustainable revenue | 1 | 2 | 4 | 3 |
| **Total /60** | **21** | **31** | **51** | **38** |

**Recommendation.** Primary model: **C as the wedge, growing into D** ("the COD order desk for social sellers": confirm, track, learn which orders fail and why). Adjacent opportunity: **courier connection** (export, then booking), because it removes double entry and makes delivery outcomes automatic. Deferred: marketplace (A), own logistics, protected purchase, cross-shop reputation, agency workspaces.

The sequence is defensible because each step uses data the previous step created: confirmations → delivery outcomes → refusal analytics → courier choice.

**Why would a Converty, YouCan or WhatsApp user adopt Domo?** Because Domo does not ask them to move. A WhatsApp seller keeps WhatsApp and gains proof of confirmation and a pipeline. A Converty or WooCommerce seller keeps the site and sends orders to Domo by API for confirmation. The promise is narrow and measurable: fewer parcels sent to people who will not take them.
