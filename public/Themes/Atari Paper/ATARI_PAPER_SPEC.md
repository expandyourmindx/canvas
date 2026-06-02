# Canvas DAW — Atari Paper Theme Spec
**Version:** 0.1  
**Theme:** Atari Paper  
**Reference:** Steinberg Cubase on Atari ST, 1989–1993  
**Aesthetic:** Ink on paper. The DAW as drafting table. Sheet music meets software.

---

## For AI Agents: Read This First

This theme is a deliberate evocation of early DAW software on the Atari ST. It is **monochrome by design**. When you reach for a color, stop. Ask whether it is selection blue or playhead red. If it's neither, it doesn't get color.

The most common mistake agents make with this theme: adding color. The second most common: softening edges with border-radius. The third: making VU off-segments invisible.

**Before writing any UI code:**
1. Import from `atari-paper-tokens.js`
2. Use `gemRaised()` / `gemSunken()` / `inkBorder()` constructors
3. Check the NEVER list
4. If something needs color, re-read the Two Accents rule

---

## The One Core Concept

**This is a two-color system. Black ink on warm paper.**

Everything is drawn. Not styled. Not decorated. Drawn.
The background is paper (`#f0ede4`). UI elements are ink (`#0d0d0d`).
Depth comes from the paper/ink border pair — a lighter version of the bevel system.

---

## The Two Accent Colors

These are the only colors in the entire UI. Use them correctly or not at all.

| Color | Value | Use |
|-------|-------|-----|
| `selection` | `#0000b8` | Active state, selected element, focused input, active button fill |
| `playhead` | `#b80000` | Playhead line only. Also: VU hot/clip segments (segs 10–11). Nothing else. |

**Zero other colors.** No track identity colors. No channel accent colors. No hover glow. No gradient fills. Identity comes from position and label, not color.

---

## NEVER List

| Property / Pattern | Rule |
|-------------------|------|
| `box-shadow` | **NEVER** except `gemShadow` (`2px 2px 0 #0d0d0d`) on floating panels only |
| `border-radius` | **NEVER.** Hard rectangular edges on everything. |
| `transition` / `animation` | **NEVER.** This software ran on a 68000 at 8MHz. |
| `backdrop-filter` / `filter` | **NEVER.** |
| `gradient` | **NEVER.** Not even subtle. Flat colors only. |
| Color other than selection/playhead | **NEVER.** Monochrome. |
| Invisible VU off-segments | **NEVER.** Off segments = `paperPanel` (`#ccc9c0`). Visible as a physical segment. |
| Web fonts | **NEVER.** `Geneva, 'MS Sans Serif', Tahoma, sans-serif` only. |
| Monospace for labels | **NEVER** except numeric values and positions. Labels use Geneva. |
| `border-radius` on knobs | Exception: knobs ARE circles. `border-radius: 50%` only. |

---

## ALWAYS List

| Situation | Rule |
|-----------|------|
| Raised surface (button, panel) | `gemRaised()` — paper top/left, ink bottom/right |
| Sunken surface (input, track, LCD) | `gemSunken()` — ink top/left, paper bottom/right |
| Hard border | `inkBorder()` — 1px solid ink |
| Soft border | `ghostBorder()` — 1px solid inkGhost |
| Active button | Invert bevel + fill background with `selection` blue + text becomes `paper` |
| Floating panel | `boxShadow: gemShadow` — 2px offset, zero blur, no spread |
| Text — labels | `Geneva, 'MS Sans Serif', Tahoma, sans-serif` |
| Text — values/positions | `'Courier New', Courier, monospace` |
| Text transform | lowercase for channel names, UPPERCASE for toolbar labels |
| VU off-segment | `paperPanel` (#ccc9c0) — NEVER transparent or bg-colored |

---

## Color System

### Paper Scale
```
paper      #f0ede4   main background — "the page"
paperDark  #e4e1d8   sunken panels, input backgrounds
paperDeep  #d8d5cc   toolbar chrome, button fill
paperPanel #ccc9c0   deepest surface, VU off-segments
```
**Important:** The paper scale has a warm yellow-beige undertone. Do NOT substitute `#f0f0f0` or `#ececec` — those are cool gray and will break the aesthetic.

### Ink Scale
```
ink        #0d0d0d   primary — borders, text, filled notes
inkMid     #484844   secondary — labels, less-critical text
inkLight   #888880   tertiary — grid lines, status text
inkGhost   #c0bdb4   grid background, barely-there dividers
```

### Grid Hierarchy
```
gridBar    #5a5a54   bar lines — most visible
gridBeat   #9a9890   beat lines — mid
gridSub    #ccc9c0   subdivision lines — subtle
```
The grid reads as three distinct levels of visual weight. Do not collapse them to one uniform line color.

---

## Components

### Title Bar
**Background:** `ink` (solid black fill)  
**Text:** `paper` color  
**Height:** 16px  
**Close/zoom boxes:** 10×10px paper-filled squares with `inkBorder`, right-aligned  
**Do not** use any gradient or partial fill. Pure black bar.

### Buttons (GEM Style)
**Default:** `gemRaised()`, `paperDeep` background, `inkMid` text  
**Pressed:** `gemSunken()`, `paperDeep` background  
**Active (toggle on):** `gemSunken()`, `selection` blue fill, `paper` text  
**Active (mute/alert):** `gemSunken()`, `playhead` red fill, `paper` text  
**Font:** Geneva, 7–9px, no bold except M/S toggle labels  

> The entire press/active feedback is the bevel inversion + fill change. No color transition. No scale. Instant.

### Knobs
**Structure:** SVG circle with tick marks + indicator line  
**Body:** `paperDeep` fill, `inkMid` stroke, 1px  
**Tick marks:** 7 marks at even intervals, `inkGhost` color, 0.5px  
**Indicator:** line from center to edge, `ink` color, 1.5px, round cap  
**Center cap:** small circle, `inkMid` fill  
**No highlight div. No gradient. No dot indicator — the line IS the indicator.**  
**Sizes:** 20px (dense), 24px (standard), 30px (primary)

### Faders
**Track:** `gemSunken()`, `paperDark` fill  
**Center rail:** 1px, `inkGhost` color  
**Unity notch:** 1px horizontal at 44% from top, `inkLight` color  
**Thumb:** `gemRaised()`, `paperPanel` fill, 3 grip lines in `inkMid` with paper right-border  
**Muted thumb:** same structure, grip lines become `inkGhost`  

### VU Meters
**12 segments.** 6×3px each, 1px gap.  
**Segs 0–7 (lit):** `ink` — green zone  
**Segs 8–9 (lit):** `inkMid` — warning zone  
**Segs 10–11 (lit):** `playhead` red — clip zone  
**Off segments:** `paperPanel` — **always visible as physical segments**  
**Top border on lit:** `1px solid inkLight` (subtle highlight). Off: `1px solid paperDeep`.  
**No glow. No box-shadow.**

### LCD Readouts
**Background:** `paperDark`  
**Border:** `gemSunken()`  
**Text:** `ink`, `Courier New`, 8–9px, right-aligned  
**Do not** use green text or any other color for LCD values. Ink on paper.

### Channel Strips
**Width:** 56px standard, 66px master  
**Dividers:** right `1px solid inkGhost`, left `1px solid paper`  
**Active/selected:** `paperDark` background (one step darker than paper)  
**No color strip** under channel name. Identity = position + label only.  
**Content order:** index → name → divider → VU meters → pan knob → fader → LCD → M/S buttons

### Floating Panels (EQ, dialogs)
**Border:** `inkBorder()`  
**Drop shadow:** `boxShadow: '2px 2px 0 #0d0d0d'` — no blur, no spread, no color change  
**This is the GEM window. It is the only place box-shadow is used.**

### EQ Display
**Background:** `paperDark`, `gemSunken()` border  
**Grid lines:** `inkGhost`, 1px, both axes  
**Curve:** SVG `<polyline>` in `inkMid`, 1px  
**Fill under curve:** `inkGhost` with 0.4 opacity  
**No smooth bezier curves. Polyline only. This is vector graphics on a 1989 computer.**

---

## Typography

| Role | Size | Font | Color | Case |
|------|------|------|-------|------|
| Window title | 9px | Geneva | paper (on ink bg) | Title Case |
| Section header | 9px | Geneva | ink | UPPERCASE |
| Channel name | 7px | Geneva | inkMid | Title Case |
| Knob label | 6–7px | Geneva | inkLight | UPPERCASE |
| Button label | 7–9px | Geneva | varies | UPPERCASE |
| LCD / readout | 8–9px | Courier New | ink | — |
| Status bar | 7px | Geneva | inkLight | mixed |
| Grid markers | 6–7px | Courier New | inkMid | — |

**Letter-spacing:** 0.04–0.08em on labels. 0.06em on Courier New values.  
**No bold** except window title and M/S button labels.

---

## What Breaks the Aesthetic

**Adding color.** Any color that isn't selection blue or playhead red is wrong. "But the channel needs identity" — the position and label provide that.

**Invisible VU off-segments.** The meter must read as a physical grid of segments, not a progress bar. Off segments must be visible as `paperPanel`.

**Smooth curves in the EQ.** Use `<polyline>` not `<path d="M...C...">`. The Atari drew lines, not bezier curves.

**Soft drop shadows.** `boxShadow: '0 4px 12px rgba(0,0,0,0.3)'` is 2026 design. The Atari shadow is `'2px 2px 0 #0d0d0d'`. Hard offset, zero blur.

**Cool gray surfaces.** `#f0f0f0` looks like Windows 95. This paper is warm (`#f0ede4`). The yellow-beige undertone is not optional.

**Using Courier New for labels.** Geneva for labels, Courier for values. Mixing them in the wrong direction breaks the visual hierarchy.

---

## File Reference

| File | Purpose |
|------|---------|
| `atari-paper-tokens.js` | All values — import from here |
| `ATARI_PAPER_SPEC.md` | This file |
| `ATARI_PAPER_CONTEXT.md` | Short-form context for AI sessions |
