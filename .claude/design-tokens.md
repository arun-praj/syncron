# Syncron — Design Tokens
Popup auth screens (400×600px), light "Simplistic SaaS" aesthetic (Aceternity-style).

## Color
| Token | Value | Use |
|---|---|---|
| `--bg` | `#ffffff` | Page/card background |
| `--border` | `#ececec` | Card border |
| `--border-input` | `#e4e4e7` | Input/button borders |
| `--border-input-hover` | `#d4d4d8` | Secondary button hover border |
| `--text-primary` | `#0a0a0a` | Headings, body text |
| `--text-secondary` | `#71717a` | Subtext, footer copy |
| `--text-label` | `#3f3f46` | Field labels |
| `--text-placeholder` | `#a1a1aa` | Input placeholders, muted icons |
| `--accent` | `#2563eb` | Links ("Sign up", "Sign in") |
| `--brand-gradient-top` | `#3b82f6` | Primary button gradient start |
| `--brand-gradient-bottom` | `#1d4ed8` | Primary button gradient end |
| `--brand-glow` | `rgba(30,144,255,0.5)` | Primary button hover glow |
| `--focus-ring` | `rgba(10,10,10,0.06)` | Input focus ring |

## Typography
Font: **Inter** (400/500/600/700), Google Fonts.

| Element | Size | Weight | Notes |
|---|---|---|---|
| Logo wordmark | 16px | 700 | letter-spacing -0.01em |
| H1 | 20px | 700 | letter-spacing -0.02em, `white-space:nowrap` |
| Subtext | 12.5px | 400 | color secondary, line-height 1.4 |
| Field label | 12px | 500 | color label |
| Input text | 13px | 400 | |
| Button text | 13.5px | 600 | |
| Divider label | 10px | 400 | uppercase, letter-spacing 0.05em |
| Footer/links | 12.5px | 400 (600 for link) | |

## Radius
- Card: `16px`
- Inputs / secondary (Google) button: `9px`
- Primary button: `6px` (rounded-md, matches reference)

## Shadows
- Card: `0 1px 2px rgba(0,0,0,.03), 0 10px 24px -12px rgba(0,0,0,.08)`
- Primary button (rest): `0 1px 2px rgba(0,0,0,.1), inset 0 1px 0 rgba(255,255,255,.25)`
- Primary button (hover): `0 1px 2px rgba(0,0,0,.1), 0 3px 8px var(--brand-glow), inset 0 1px 0 rgba(255,255,255,.25)`
- Primary button text-shadow: `0 1px 2px rgba(0,0,0,.2)`

## Components
**Primary button** — full width, `background: linear-gradient(to bottom, var(--brand-gradient-top), var(--brand-gradient-bottom))`, white text, radius 6px, padding `10px 14px`, transitions box-shadow only.

**Secondary (OAuth) button** — white bg, `1px solid var(--border-input)`, radius 9px, icon + label, hover bg `#fafafa` + border `var(--border-input-hover)`.

**Input** — white bg, `1px solid var(--border-input)`, radius 9px, padding `9px 12px` (or `9px 40px 9px 12px` with trailing icon/button), focus: border `--text-primary` + `box-shadow: 0 0 0 3px var(--focus-ring)`.

**Divider** — 1px line `--border` either side of small uppercase label.

## Layout
- Canvas: fixed `400×600px` (Chrome extension popup).
- Card padding: `20px`.
- Vertical rhythm: logo → h1 → subtext → card → footer link, gaps ~12–20px.
