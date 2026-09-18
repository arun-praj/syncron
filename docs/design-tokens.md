# Simplistic SaaS Template — extracted design system

Source inspected: `https://ui.aceternity.com/template-preview/simplistic-saas-template` and its live preview iframe, `https://simplistic-saas-template.vercel.app/`.

Measurements were taken from the rendered DOM with `getComputedStyle()` at 1440×1000 and 375×812. Chromium serializes Tailwind v4 neutrals as `lab()`; the equivalent sRGB hex values below come from the same stylesheet tokens. Transparent colors retain their alpha.

## Colors

### Background layers

| Token | Light | Dark | Observed use |
|---|---:|---:|---|
| Canvas | `#ffffff` / `rgb(255 255 255)` | `#0a0a0a` / `rgb(10 10 10)` | Page and hero (`bg-white`, `dark:bg-neutral-950`) |
| Subtle canvas | `#fafafa` / `rgb(250 250 250)` | `#0a0a0a` | Testimonial scene and subdued full-width regions |
| Surface | `#ffffff` | `#171717` / `rgb(23 23 23)` | Bento cards, feature cards (`dark:bg-neutral-900`) |
| Raised surface | `#ffffff` | `#262626` / `rgb(38 38 38)` | Testimonial cards, secondary button, menus (`dark:bg-neutral-800`) |
| Muted surface | `#f5f5f5` / `rgb(245 245 245)` | `#262626` | Keyboard keys and hover fills |
| Translucent surface | `rgb(255 255 255 / 70%)` | `rgb(23 23 23 / 70%)` | Dashboard preview; `backdrop-filter: blur(8px)` |
| Scrolled navbar | `rgb(255 255 255 / 80%)` | `rgb(23 23 23 / 80%)` | Floating navbar; `backdrop-filter: blur(12px)` |
| Device screen | `#000000` | `#000000` | Phone/tablet mockup screens |

### Text

| Role | Light | Dark | Observed use |
|---|---:|---:|---|
| Primary/strong | `#0a0a0a`, `#171717` | `#ffffff`, `#f5f5f5` | Logo, card headings, CTA heading |
| Primary heading | `#404040` | `#d4d4d4` | Hero, section titles |
| Secondary | `#525252` | `#a3a3a3` | Nav links, supporting headings |
| Body | `#404040` | `#d4d4d4` | Hero and CTA body copy |
| Muted | `#737373` | `#a3a3a3` | Captions, app URL, metadata |
| Faint | `#a3a3a3` | `#525252` | Decorative/logotype text |
| Inverse | `#ffffff` | `#ffffff` | Brand buttons and dark badges |

### Borders and rings

| Value | Use |
|---:|---|
| `#e5e5e5` | Default neutral border and divider |
| `#d4d4d4` | Outline login button and dashed decoration |
| `rgb(212 212 212 / 50%)` | Dashboard preview border |
| `rgb(229 229 229 / 50%)` | Dashboard toolbar divider |
| `rgb(0 0 0 / 5%)` | Subtle ring on pricing and controls |
| `rgb(0 0 0 / 10%)` | Bento card ring |
| `#404040` / `rgb(64 64 64)` | Dark outline border |
| `rgb(64 64 64 / 50%)` | Dark translucent border |
| `rgb(255 255 255 / 5%)` | Dark subtle ring |
| `rgb(255 255 255 / 10%)` | Dark bento/card ring |

### Brand and decorative accents

| Value | Use |
|---:|---|
| `#1e90ff` / `rgb(30 144 255)` | Brand primary, indicators, beam/path accents, gradient end |
| `#5cb3ff` / `rgb(92 179 255)` | Brand secondary and CTA gradient start |
| `#2b7fff` | Blue status/avatar accents (`blue-500`) |
| `#00c950` | Green status and battery progress (`green-500`) |
| `#00bc7d` | Emerald logo mark (`emerald-500`) |
| `#fb2c36` | Dashboard red status dot |
| `#f0b100` | Dashboard yellow status dot |
| `#e5e7eb` | Device mockup gray surface (`gray-200`) |
| `#4285f4`, `#34a853`, `#fbbc05`, `#ea4335` | Google icon fills |

Primary CTAs use `linear-gradient(to bottom in oklab, #5cb3ff 0%, #1e90ff 100%)`.

## Typography

The page preloads variable `Geist` and `Geist Mono` WOFF2 files through Next.js (`next/font` generated classes are present on `<body>`), but the sampled visible elements compute to the system sans stack:

```css
-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
"Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji",
"Segoe UI Symbol", "Noto Color Emoji"
```

Both Geist faces declare `font-weight: 100 900`, normal style, `font-display: swap`. There is no visible `h4` on the rendered page.

| Role | Desktop (≥768px; 1440 measured) | Mobile (375 measured) |
|---|---|---|
| Hero `h1` | 72px / 72px, 500, −1.8px | 36px / 40px, 500, −0.9px |
| Section display heading (`h1`/`h2`) | 48px / 48px, 400, −1.2px | 24px / 32px, 400, −0.6px |
| Bold section heading | 48px / 48px, 700, −1.2px | 24px / 32px, 700, −0.6px |
| CTA heading | 48px / 48px, 700, −1.2px | 30px / 36px, 700, −0.75px |
| Trust heading | 18px / 28px, 500, normal | 18px / 28px, 500, normal |
| Card `h3` | 14px / 20px, 600, normal | same |
| Device-card `h3` | 16px / 24px, 500, normal | same |
| FAQ group heading | 18px / 28px, 500, normal | same |
| Hero body | 20px / 28px, 400, normal | 16px / 24px, 400, normal |
| Standard body | 14px / 20px, 400, normal | same |
| Large supporting body | 18px / 28px, 400, normal | 14px / 20px, 400, normal |
| Nav link | 14px / 20px, 500, normal | mobile drawer: 16px / 24px, 500 |
| Main button label | 16px / 24px, 500, normal | same |
| Small label | 8px / 12px, 500 | same |
| Caption | 12px / 16px, 400 | same |
| Microcopy in mockups | 7px / 10.5px or 8px / 12px | same |

## Spacing

The underlying Tailwind spacing unit is 4px (`--spacing`). The page mainly uses 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96 and 128px.

| Area | Desktop | Mobile |
|---|---:|---:|
| Standard max-width wrapper | 1280px outer width, 32px inline padding; 1216px usable | 100% width, 16px inline padding; 328px usable at a 360px layout width |
| Hero wrapper | 32px inline, 128px block | 16px inline, 48px block |
| Major section padding | 128px top/bottom at ≥1024; 80px at ≥768 | 40px top/bottom |
| Testimonials section | 64px top/bottom | 64px top/bottom |
| Bento heading → main grid | 48px | 32px |
| Main bento gap | 16px | 16px |
| Bento main grid → small cards | 48px | 16px |
| Small feature card padding | 24px | 24px |
| Pricing outer grid padding | 32px | 16px |
| Pricing grid gap | 16px | 8px |
| Pricing card shell padding | 12px | 4px |
| CTA two-column section | 64px gap; 64px vertical margin; 32px inline padding | 40px gap; 40px vertical margin; 16px inline padding |
| Primary/secondary button | 12px 24px | same |
| Navbar inner padding | 0 32px | 0 16px |

## Layout

- Global content maximum: 1280px (`max-w-7xl`). At 1440px the wrapper begins at x=72.5px because the viewport's layout width was 1425px after the scrollbar; usable content is 1216px after 32px padding on both sides.
- Responsive breakpoints observed in the stylesheet: 640px (`sm`), 768px (`md`), 1024px (`lg`), 1280px and 1536px container bounds.
- Hero uses a full-width, `min-height: 100vh` wrapper. At 1440×1000 its rendered content made the hero 1497.75px tall.
- Bento main grid at 1440: 1216×714.656px; three columns `394.656px 394.672px 394.656px`, two rows of 349.328px, 16px gap. Four cards are placed as tall / half-height stack / tall: card 1 and 3 span two rows; cards 2 and 4 occupy the center column rows.
- Bento at 375: one 328px column, 16px gap; measured card heights 694, 316, 672 and 216px. The three secondary feature cards form another one-column grid with 172px rows and 16px gaps.
- Pricing at 1440: three columns `362.656px 362.672px 362.656px`, 16px gap inside a 1184px grid. At 375 it collapses to one 264px column with 8px gaps.
- CTA section: two 576px columns with 64px gap on desktop; one 328px column with 40px gap on mobile.

## Buttons

| Variant | Computed style |
|---|---|
| Primary | Gradient `#5cb3ff → #1e90ff`; white text; no border; 8px radius; 12px 24px padding; 500 weight; 16/24 type; base shadow none; 200ms `cubic-bezier(.4,0,.2,1)` |
| Secondary | Light: `#fff`, `#404040` text, 1px `#e5e5e5` ring + `0 1px 2px rgb(0 0 0 / 5%)`; dark: `#262626`, `#e5e5e5`, `#404040` ring; 8px radius; 12px 24px; 500; 200ms |
| Outline login | Transparent, `#171717` text, 1px `#d4d4d4`; 14px radius; 14px 16px; 500; color transition 150ms |
| Ghost/nav | Transparent; light `#525252`, dark `#a3a3a3`; no border or shadow; 14/20, 500; 150ms color transition |
| Badge link | `#fff` / dark `#262626`; `#404040` / dark `#d4d4d4`; pill radius; 4px 8px; 12/16; 200ms |

Interaction rules observed in the loaded stylesheet:

- Primary hover preserves the blue gradient and adds `0 1px 2px rgb(0 0 0 / 10%), 0 3px 5px rgb(30 144 255 / 50%), inset 0 1px 0 rgb(255 255 255 / 25%)`.
- Secondary hover uses `#fafafa` and a 1px `#d4d4d4` ring in light mode; dark uses `#171717` with a `#525252` ring.
- Ghost/nav hover changes text to `#171717` and, where applicable, background to `#f5f5f5`; dark changes text to white and background to `#262626`.
- Active buttons scale to `0.98` over the same 150–200ms transition.
- Focus rules use a 2px `#a3a3a3`/`#171717` ring; dark focus variants use `#737373` or `rgb(255 255 255 / 30%)`. Radix controls also expose a 3px ring at 50% opacity.

## Cards

| Card | Background | Radius | Border/ring and shadow | Padding |
|---|---|---:|---|---:|
| Main bento | `#fff`; dark `#171717` | 18px | 1px `rgb(0 0 0 / 10%)`; shadow `0 1px 3px rgb(0 0 0 / 10%), 0 1px 2px -1px rgb(0 0 0 / 10%)`; dark ring `rgb(255 255 255 / 10%)`, shadow tint 5% white | Outer shell 0; content inset measures 24px |
| Small bento | `#fff`; dark `#171717` | 18px | none by default | 24px |
| Secondary feature/security | `#fff`; dark `#171717` | 18px | 1px 5% ring + small shadow | 24px |
| Pricing shell | transparent; featured Pro is `#fff`/`#171717` | 6px | Featured: 1px transparent border, 5% ring, small shadow | 12px desktop, 4px mobile |
| Dashboard glass card | `rgb(255 255 255 / 70%)`; dark `rgb(23 23 23 / 70%)` | 14px | 1px 50%-alpha neutral border | internal rows 12px 16px |
| Testimonial card | `#fff`; dark `#262626` | 14px | 1px 5% ring; `0 10px 15px -3px` and `0 4px 6px -4px`, both 10% black | 20px |

## Navbar

- Fixed, z-index 50, max-width 1280px.
- At the top: transparent, no shadow, no blur, square edge. Height is 64px on desktop (≥640px) and 56px on mobile; mobile outer wrapper adds 8px top and 16px inline padding.
- After scroll: `rgb(255 255 255 / 80%)` or dark `rgb(23 23 23 / 80%)`, `backdrop-filter: blur(12px)`, 24px radius, shadow `0 1px 3px rgb(0 0 0 / 10%), 0 1px 2px -1px rgb(0 0 0 / 10%)` (30% black in dark mode).
- The top/scrolled change uses a 300ms `cubic-bezier(.4,0,.2,1)` color transition.
- Desktop links are a flex row with 24px gap, increasing to 32px at ≥1024px. Mobile replaces them with a 40×40 menu control and full-width drawer links padded 14px 16px.
- There is no computed `border-bottom`; separation comes from the scrolled shadow.

## Motion

- Default Tailwind transition timing is `cubic-bezier(.4,0,.2,1)`.
- Buttons: 200ms for color/background/shadow/transform; active scale 0.98.
- Nav links and menu items: 150ms color transitions.
- Navbar: 300ms color/background transition.
- Resource-menu chevron: 300ms rotation when open.
- Radix navigation/menu enter and exit use the stylesheet `enter`/`exit` keyframes, default 150ms ease, with opacity plus translate/scale. Open state uses 0.95 scale; one popover uses 0.90 scale; directional slides use 8px or 208px offsets depending on component.
- Continuous testimonial/device scenes are client-driven and expose changing transforms/positions in the live DOM. Sampled static elements report `animation: none`; their motion is applied by runtime styles rather than a page-wide CSS keyframe.
- No evidence of a universal scroll-reveal animation was found on headings/cards. Scroll state does control the navbar treatment.

## Assets and decoration

- Hero and multiple diagrams use brand blue beams/paths (`#1e90ff`).
- Primary CTAs use a two-stop vertical brand gradient.
- Device/dashboard frames combine translucent surfaces, 8–12px backdrop blur, subtle neutral rings and small shadows.
- Dot-grid texture: `radial-gradient(circle, rgb(0 0 0 / 8%) 1px, transparent 1px)` on a 24×24px tile; dark mode switches dots to 8% white.
- Dashed/striped rules use repeating 4px-on/4px-off neutral gradients and 1px dashed borders.
- Fade masks use top/bottom/right linear masks beginning at 50% or 90%; selected diagrams use radial masks beginning at 20% or 50%.
- Card elevation is restrained: 1px rings plus Tailwind small/large shadows. Dark cards replace black rings with 5–10% white.
- Device screenshots and product/gallery photos are raster assets from `assets.aceternity.com`; logos are image/SVG assets. No noise texture was present in computed backgrounds.

## Drop-in CSS tokens

```css
:root {
  color-scheme: light;

  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji",
    "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
  --font-geist: "Geist", "Geist Fallback", Arial, sans-serif;
  --font-geist-mono: "Geist Mono", "Geist Mono Fallback", monospace;

  --color-canvas: #ffffff;
  --color-canvas-subtle: #fafafa;
  --color-surface: #ffffff;
  --color-surface-raised: #ffffff;
  --color-surface-muted: #f5f5f5;
  --color-surface-glass: rgb(255 255 255 / 70%);
  --color-navbar-glass: rgb(255 255 255 / 80%);

  --color-text-strong: #0a0a0a;
  --color-text-primary: #404040;
  --color-text-secondary: #525252;
  --color-text-muted: #737373;
  --color-text-faint: #a3a3a3;
  --color-text-inverse: #ffffff;

  --color-border: #e5e5e5;
  --color-border-strong: #d4d4d4;
  --color-border-subtle: rgb(0 0 0 / 5%);
  --color-border-card: rgb(0 0 0 / 10%);

  --color-brand-primary: #1e90ff;
  --color-brand-secondary: #5cb3ff;
  --color-success: #00c950;
  --color-danger: #fb2c36;
  --color-warning: #f0b100;

  --gradient-brand: linear-gradient(to bottom in oklab, #5cb3ff 0%, #1e90ff 100%);
  --gradient-dot-grid: radial-gradient(circle, rgb(0 0 0 / 8%) 1px, transparent 1px);

  --space-unit: 4px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;
  --space-32: 128px;

  --container-max: 1280px;
  --container-padding: 32px;
  --container-padding-mobile: 16px;
  --grid-gap: 16px;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;
  --radius-xl: 14px;
  --radius-2xl: 18px;
  --radius-navbar: 24px;
  --radius-pill: 9999px;

  --shadow-xs: 0 1px 2px rgb(0 0 0 / 5%);
  --shadow-sm: 0 1px 3px rgb(0 0 0 / 10%), 0 1px 2px -1px rgb(0 0 0 / 10%);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 10%), 0 4px 6px -4px rgb(0 0 0 / 10%);
  --shadow-brand-hover: 0 1px 2px rgb(0 0 0 / 10%),
    0 3px 5px rgb(30 144 255 / 50%), inset 0 1px 0 rgb(255 255 255 / 25%);

  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --duration-fast: 150ms;
  --duration-base: 200ms;
  --duration-slow: 300ms;

  --text-hero: 72px;
  --leading-hero: 72px;
  --tracking-hero: -1.8px;
  --text-display: 48px;
  --leading-display: 48px;
  --tracking-display: -1.2px;
  --text-body-lg: 20px;
  --leading-body-lg: 28px;
  --text-body: 14px;
  --leading-body: 20px;
  --text-label: 12px;
  --leading-label: 16px;
}

@media (max-width: 767px) {
  :root {
    --container-padding: 16px;
    --text-hero: 36px;
    --leading-hero: 40px;
    --tracking-hero: -0.9px;
    --text-display: 24px;
    --leading-display: 32px;
    --tracking-display: -0.6px;
    --text-body-lg: 16px;
    --leading-body-lg: 24px;
  }
}

.dark {
  color-scheme: dark;
  --color-canvas: #0a0a0a;
  --color-canvas-subtle: #0a0a0a;
  --color-surface: #171717;
  --color-surface-raised: #262626;
  --color-surface-muted: #262626;
  --color-surface-glass: rgb(23 23 23 / 70%);
  --color-navbar-glass: rgb(23 23 23 / 80%);
  --color-text-strong: #ffffff;
  --color-text-primary: #d4d4d4;
  --color-text-secondary: #a3a3a3;
  --color-text-muted: #a3a3a3;
  --color-text-faint: #525252;
  --color-border: #404040;
  --color-border-strong: #525252;
  --color-border-subtle: rgb(255 255 255 / 5%);
  --color-border-card: rgb(255 255 255 / 10%);
  --gradient-dot-grid: radial-gradient(circle, rgb(255 255 255 / 8%) 1px, transparent 1px);
  --shadow-sm: 0 1px 3px rgb(0 0 0 / 30%), 0 1px 2px -1px rgb(0 0 0 / 30%);
}
```
