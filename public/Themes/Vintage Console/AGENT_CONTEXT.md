# Canvas DAW — AI Agent Context
Paste this at the start of any coding session involving Canvas UI.

---

You are working on **Canvas DAW**, a web-based digital audio workstation with a deliberate **early 2010s DAW aesthetic** (FL Studio 10 era). This is an intentional design choice, not a limitation.

## Critical Rules

**NEVER use:**
- `box-shadow` — depth comes from bevel borders only
- `border-radius` on rectangles — hard edges everywhere
- `transition` or `animation` — all state changes are instant
- `backdrop-filter` or `filter`
- `radial-gradient` as a depth technique
- Hardcoded hex values — import from `tokens.js`
- Web fonts — `'Courier New', Courier, monospace` only

**ALWAYS use:**
- `raised(theme)` / `sunken(theme)` / `flat(theme)` / `flush(theme)` from `tokens.js` for all borders
- `theme.font` for all text
- `SPACE` tokens for spacing
- `SIZE` tokens for component dimensions
- `textTransform: 'uppercase'` on all labels

## Depth System
Raised = `borderTop/Left: bevelLight`, `borderBottom/Right: bevelDark`  
Sunken = inverted  
Pressed state = swap raised → sunken. That's the only press feedback needed.

## Themes
- **Dark:** blue-black surfaces with warm tint. LCD is near-black bg, blue-green text.
- **Light:** warm gray surfaces (yellow undertone, NOT cool gray). LCD is cream bg, forest green text.

## What Breaks It
Adding border-radius, transitions, or box-shadow to "improve" anything immediately destroys the aesthetic. These are not oversights — their absence is the design.

## Full Spec
See `DESIGN_SPEC.md` for complete component specs, token values, and allowed modern enhancements.
