# domo — brand guidelines (v1, Nov 2026)

## 1. Brand in one line
**Tout ce qu'il vous faut, au même endroit.** Different vendors, different products, one place.
Domo is a Tunisian online marketplace. The identity stands for the idea (bringing things together), never for a product category.

## 2. The logo
- **Idea:** every letter of *domo* touches the next, at one point, without overlapping. Separate pieces that hold hands and become one word: vendors, products and customers brought together.
- **Primary logo:** the wordmark `domo-wordmark-ink.svg` (lower case, always). Use it everywhere the space allows.
- **Icon:** `domo-icon.svg` — the linked "do" in white on Domo blue. For app icons, favicons, avatars. Never replace the wordmark with the icon when there is room for the wordmark.
- **Construction:** custom geometric letters, drawn as paths (no font). Stroke 26 · round radius 64 · x-height 124 · ascender 52 · letter spacing 0 (the letters touch at the three contact points).
- **Versions:** ink on light, white on Domo blue or dark, blue on white, black for one-colour print. Files in this folder, `png/` and `web/`.

**Clear space:** half the x-height on every side. **Minimum size:** wordmark 72 px wide on screen / 20 mm in print; icon 16 px.

**Do not:** stretch or squash · add shadows, outlines, gradients or effects · place on busy photos · separate the letters or add spacing · re-type "Domo" in a font · capitalise it in the logo · recolour with secondary colours.

## 3. Colour
| Role | Name | HEX | RGB |
|---|---|---|---|
| Primary | Bleu Domo | `#1D3FD1` | 29 63 209 |
| Text | Encre | `#0E1630` | 14 22 48 |
| Accent: actions, prices, promos | Corail | `#FF5A3C` | 255 90 60 |
| Warm background | Jasmin | `#FBF3E6` | 251 243 230 |
| Secondary (categories, illustrations only) | Ciel / Soleil / Menthe | `#9DB7FF` / `#FFC23D` / `#2FBF8F` | — |

The logo uses only Encre, Bleu Domo, white or black. Secondary colours are shared equally between categories so that no category owns the brand.
Accessibility: white on Bleu Domo 7.8:1 (AAA); Encre on Jasmin 16.2:1 (AAA). On Corail use Encre text (≈ 5.6:1, AA); white on Corail is only 3.1:1, so white text there must be bold and at least 19 px. Never use Corail for small body text.
Print: confirm CMYK/Pantone with the printer from the HEX values (nearest suggestions: Bleu Domo ≈ Pantone 2728 C, Corail ≈ Pantone Warm Red C — to be proofed).

## 4. Typography
- **Bricolage Grotesque** (700–800) for titles and campaigns.
- **Instrument Sans** (400–700) for text and interface.
- **Cairo** for Arabic.
All three are open-source (SIL Open Font License) and already used by the app. The logo is not set in any of them.

## 5. Graphic element: the chain of circles
Products are shown in circles that touch, like the letters of the logo. Use 3–6 circles in a row or two offset rows; mix product photos with flat brand-colour circles. Photography must cover every category (food, home, beauty, electronics, fashion) and show real products on clean backgrounds.
Pattern files: `pattern-liens-cream.svg`, `pattern-liens-blue.svg` (packaging tape, bags, app splash, social backgrounds). Keep the pattern away from the logo; it is a background, never a frame for it.

## 6. Voice
Simple, warm and practical. Short sentences, concrete words, no jargon. French first, Tunisian Arabic second.
Examples: « Tout ce qu'il vous faut, au même endroit. » · « Des boutiques différentes. Un seul endroit. » · « كل ما تحتاجه في مكان واحد ».

## 7. Files
| File | Use |
|---|---|
| `domo-wordmark-ink.svg` / `-blue` / `-white` / `-black` | Logo masters |
| `domo-icon.svg`, `web/domo-symbol-app-icon.svg` | App icon |
| `web/favicon.ico`, `favicon.svg`, `favicon-16/32/48.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `maskable-512.png`, `site.webmanifest`, `head-snippet.html` | Web and PWA icon set |
| `png/*-1200.png` | Wordmark PNGs (black, white, blue) |
| `pattern-liens-*.svg` | Pattern |
| `board.html`, `domo-brand-board.png` | Brand board |

## 8. Open items
- Trademark search for "domo" (name and logo) in Tunisia (INNORPI) and the Madrid system before printing.
- Proof the CMYK/Pantone values with the printer.
- Category photography (all categories) to replace the fashion placeholders.
- Native review of the Arabic tagline.
