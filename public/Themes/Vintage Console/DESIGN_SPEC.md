# Canvas DAW — Vintage Console Design Spec
**Version:** 0.1  
**Theme:** Vintage Console (Dark + Light)  
**Aesthetic origin:** Early 2010s DAW software. FL Studio 10, Reason 6, early Ableton.  
**Emotional target:** The feeling of opening a DAW on a family PC in 2011. Not a simulation of hardware limitations — a deliberate evocation of that era using modern tools.

---

## For AI Agents: Read This First

You are helping build Canvas DAW, a web-based digital audio workstation. When writing UI code for Canvas, your job is to **match an established design system precisely**. Do not apply your defaults. Do not modernize. Do not "improve" by adding things that aren't in this spec.

The aesthetic is intentional. If something looks like a constraint from 2010, that's the point.

**Before writing any UI code:**
1. Import tokens from `tokens.js` — never hardcode color or spacing values
2. Use the bevel constructors (`raised()`, `sunken()`, `flat()`, `flush()`) — never write border values by hand
3. Check the NEVER list below before reaching for any CSS property
4. If a component type exists in this spec, match it exactly

---

## The One Core Concept

**Depth is created exclusively through border color pairs (bevels). Nothing else.**

A raised element has:
- `borderTop` + `borderLeft` = `bevelLight` (catches the light)
- `borderBottom` + `borderRight` = `bevelDark` (falls into shadow)

A sunken element inverts this.

That's the whole system. Everything else follows from it.

---

## NEVER List

These are hard rules. No exceptions. No "but it would look better with..."

| Property | Rule |
|----------|------|
| `box-shadow` | **NEVER.** All depth comes from bevel borders. |
| `border-radius` | **NEVER on rectangles.** Circles (knobs) stay circular. Everything else: hard edges. |
| `transition` | **NEVER.** State changes are instant. No easing, no fade, no animation. |
| `animation` | **NEVER** for UI state. No loading spinners with CSS animation, no pulse effects. |
| `backdrop-filter` | **NEVER.** |
| `filter` | **NEVER** (excluding SVG use for indicator dots). |
| `radial-gradient` | **NEVER** as a primary depth technique. Knobs use a flat color + one highlight div. |
| Hardcoded hex values | **NEVER.** Use tokens. If the color isn't in tokens, ask before inventing one. |
| Web fonts / @font-face | **NEVER.** Font is `'Courier New', Courier, monospace` — system only. |
| `border-radius > 2px` | **NEVER** on any non-circular element. |
| `linear-gradient` on components | **NEVER** except title bars (2-stop, horizontal only). |

---

## ALWAYS List

| Situation | Rule |
|-----------|------|
| Raised surface | Use `raised(theme)` constructor |
| Sunken / inset surface | Use `sunken(theme)` constructor |
| Neutral border | Use `flat(theme)` constructor |
| Minimal border | Use `flush(theme)` constructor |
| Pressed/active button | Invert bevel: `raised` → `sunken`. Do not change background color alone. |
| Text | `fontFamily: theme.font` — all text, no exceptions |
| Text transform | `textTransform: 'uppercase'` on all labels |
| Letter spacing | `0.08–0.15em` on labels, `0.04–0.08em` on readouts |
| Spacing | Use `SPACE` tokens. Base unit is 4px. |
| Component sizing | Use `SIZE` tokens for channel strips, knobs, VU, faders |

---

## Color Usage

### Surface Hierarchy
```
bg0  — deepest (LCD background, fader track, input field)
bg1  — app background
bg2  — panel background
bg3  — inactive channel strip, default button
bg4  — active/selected channel strip
bg5  — raised inset panel, pressed button background
```
Surfaces step one level in the appropriate direction for each nesting level. Do not skip levels.

### Text Hierarchy
```
textHi    — primary labels, active channel names
textMid   — secondary labels, section headers
textLo    — knob labels, tertiary info
textDim   — disabled, placeholder, inactive states
textGhost — barely-visible rules, decorative text
```

### Accent Colors
Accents are used **only** for:
- Channel identity color strips (the 2px horizontal bar under each channel name)
- Knob indicator dots
- Active state on state-color buttons (mute/solo)

Do not use accents for general UI decoration.

### State Colors
- `stateRed` — mute button active only
- `stateGreen` — solo button active, signal present
- `stateAmber` — -6dB warning level on meters
- `stateHot` — 0dB / clip on meters

---

## Components

### Buttons
**Default state:** `raised(theme)` border, `bg3` background, `textMid` color  
**Pressed state:** `sunken(theme)` border, `bg5` background, `textLo` color  
**Mute active:** `sunken(theme)` border, `stateRed` background, white text  
**Solo active:** `sunken(theme)` border, `stateGreen` background, white text  
**Font:** 8px, bold, uppercase, 0.08em letter-spacing  

> The entire "click" feedback is the bevel inversion. Trust it. Do not add color transitions.

### Knobs
**Structure:** circular div + one highlight div + SVG indicator dot  
**Body:** `knobBody` color, circular bevel border  
**Highlight:** absolutely positioned ellipse, top-left quadrant, `knobHighlight` color (rgba white)  
**Indicator:** SVG `<circle>`, 2px radius, accent color, positioned by rotation math  
**Sizes:** 22px (dense), 26px (standard), 32px (primary)  
**Interaction:** `cursor: ns-resize`, drag vertical  

Do not add arc tracks, tick marks, or value rings. The dot is sufficient.

### Faders
**Track:** `sunken(theme)`, `bg0` fill, vertical  
**Center rail:** 2px wide, `bg5` color  
**Unity notch:** 1px horizontal line at 44% from top, accent blue at low opacity  
**Thumb:** `raised(theme)`, `bg3` fill, 3 grip lines using bevel colors  
**Thumb muted:** same structure, colors desaturated toward bg  
**Interaction:** `cursor: ns-resize`, drag within track bounds  

### VU Meters
**Segments:** 12 total, 6×3px each, 1px gap  
**Colors:** `theme.vu[index]` where 0 = bottom (green) → 11 = top (red clip)  
**Off state:** `theme.vuOff` — NOT transparent, NOT `bg0`. Must be visible as a physical segment.  
**Border:** lit segments get `rgba(255,255,255,0.12)` top border only (subtle highlight). Off segments get flat dark top border.  
**No glow. No box-shadow on any state.**

### LCD Readouts
**Background:** `theme.lcdBg`  
**Text:** `theme.lcdText`  
**Border:** `sunken(theme)`  
**Font:** 9px monospace, right-aligned  
**Unit label:** 7px, `textDim` color, small left margin  

> Dark theme: near-black bg, blue-green text.  
> Light theme: cream bg, forest green text — a hardware LCD in a lit room.  
> Do not swap these. Do not make both themes use the same LCD colors.

### Channel Strips
**Width:** `SIZE.channelStrip` (54px) standard, `SIZE.channelStripMaster` (64px) for master  
**Dividers:** `borderRight: 1px solid bg0` (dark edge), `borderLeft: 1px solid bg2` (light edge)  
**Active/selected:** `bg4` background  
**Content order (top to bottom):** index label → channel name → color strip → VU meters → pan knob → fader → dB readout → M/S buttons  

### Title Bars
**Background:** `theme.titleBarGradient` (the one allowed gradient)  
**Border:** `raised(theme)`  
**Height:** `SIZE.titleBarHeight` (18px)  
**Text:** 9px, `textHi`, uppercase, 0.2em letter-spacing  

### FX Insert Rows
**Active slot:** `raised(theme)`, `bg5` background, `textMid` color  
**Empty slot:** `flush(theme)`, `bg1` background, `textDim` color, text "(none)"  
**Height:** `SIZE.fxRowHeight` (20px)  

---

## What Breaks the Aesthetic

These are the specific ways AI agents typically violate this design system. Know them.

**The Modernization Drift** — Adding `border-radius: 4px` to "soften" buttons. Adding `transition: 0.2s` because "it feels more polished." Adding `box-shadow` to "add depth." All of these immediately destroy the era feel. They are not improvements.

**The Flat Collapse** — Removing bevels and replacing with a single uniform border color. This makes the UI look like a bad Bootstrap clone, not a 2010 DAW.

**The Wrong Dark** — Using pure `#000000` or blue-black `#0d0d1a` for backgrounds. The dark theme has a specific warm-tinted blue-black. Use the tokens.

**The Cool Gray Light** — Using `#f0f0f0` or `#e8e8e8` for the light theme. The light theme surfaces have a yellow-warm undertone. `#eceae0`, not `#ececec`. The difference is everything.

**Web Font Creep** — Importing Inter, Roboto, or any Google Font. Courier New only. The monospace constraint is load-bearing for the aesthetic.

**Shadow Cheating** — Using `border: 2px solid` with a single color to fake depth. The bevel system requires two different border colors (light + dark) applied to different sides. One color = flat. Use the constructors.

**Accent Overuse** — Putting accent colors on backgrounds, hover states, or decorative elements. Accents appear only on channel strips, knob dots, and active state buttons.

---

## Allowed Modern Enhancements

These are places where breaking the strict 2010 constraint is acceptable because the *feeling* is preserved:

- **Subtle gradient on knob body** — a very gentle 2-stop linear-gradient (not radial) on the knob circle is acceptable if it adds warmth without looking modern. Test against: does it look like a 2010 developer was proud of this? If yes, keep it.
- **SVG paths for EQ curves** — smooth bezier curves in the EQ display are fine. 2010 software would have wanted this, they just couldn't afford it.
- **Semi-transparent overlays** — rgba backgrounds for modals/overlays are acceptable.
- **Subtle box-shadow on floating windows** — a single `0 4px 12px rgba(0,0,0,0.4)` on top-level floating panels only. Not on inline components.

When in doubt: ask "does this make it look like a modern web app?" If yes, don't do it.

---

## File Reference

| File | Purpose |
|------|---------|
| `tokens.js` | All color values, spacing, sizing — import from here |
| `DESIGN_SPEC.md` | This file — rules and component specs |
| `AGENT_CONTEXT.md` | Short-form context for pasting into AI sessions |

---

## Version History
- v0.1 — Initial spec, Vintage Console dark + light themes
