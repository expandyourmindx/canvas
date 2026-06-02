// ============================================================
// CANVAS DAW — ATARI PAPER THEME TOKENS
// Reference: Steinberg Cubase, Atari ST, 1989–1993
// SOURCE OF TRUTH. Do not hardcode any values that exist here.
// ============================================================

// ── SURFACES — warm paper scale ──────────────────────────────
export const paper      = "#f0ede4";   // the page — main background
export const paperDark  = "#e4e1d8";   // sunken panels, input fields
export const paperDeep  = "#d8d5cc";   // toolbar chrome, button fill
export const paperPanel = "#ccc9c0";   // deepest surface

// ── INK — drawing colors ─────────────────────────────────────
export const ink        = "#0d0d0d";   // primary — borders, text, filled notes
export const inkMid     = "#484844";   // secondary — labels, less-critical UI
export const inkLight   = "#888880";   // tertiary — grid lines, dividers
export const inkGhost   = "#c0bdb4";   // barely there — background grid, empty VU

// ── THE TWO ACCENT COLORS — nothing else gets color ──────────
export const selection  = "#0000b8";   // Atari GEM blue — active, selected, focused
export const playhead   = "#b80000";   // playhead — always findable on the page

// ── NOTE / CLIP BLOCKS ───────────────────────────────────────
export const note       = "#1a1a18";   // filled note/clip rectangle
export const noteSelect = "#0000b8";   // selected note — uses selection color

// ── PIANO KEYS ───────────────────────────────────────────────
export const keyWhite   = "#f0ede4";   // white key — same as paper
export const keyBlack   = "#1a1a18";   // black key — same as ink

// ── GRID HIERARCHY ───────────────────────────────────────────
export const gridBar    = "#5a5a54";   // bar lines — most prominent
export const gridBeat   = "#9a9890";   // beat lines — visible
export const gridSub    = "#ccc9c0";   // subdivisions — subtle

// ── VU METER SEGMENTS ────────────────────────────────────────
// Light = off segment (visible as paperDeep, not invisible)
// Standard = ink
// Warning = inkMid
// Hot/clip = alert (the ONLY use of red outside the playhead)
export const vuOff      = paperPanel;
export const vuNormal   = ink;
export const vuWarn     = inkMid;     // segs 8–9
export const vuHot      = "#b80000";  // segs 10–11 — same as playhead red

// ── TYPOGRAPHY ───────────────────────────────────────────────
export const font     = "Geneva, 'MS Sans Serif', Tahoma, sans-serif";
export const fontMono = "'Courier New', Courier, monospace";

// ── SPACING ──────────────────────────────────────────────────
// Base unit: 4px. Everything derives from this.
export const SPACE = {
  px:  1,
  xs:  2,
  sm:  4,
  md:  6,
  lg:  10,
  xl:  14,
  xxl: 20,
};

// ── COMPONENT SIZING ─────────────────────────────────────────
export const SIZE = {
  channelStrip:       56,
  channelStripMaster: 66,
  titleBarHeight:     16,
  statusBarHeight:    14,
  fxRowHeight:        18,
  knobSm:             20,
  knobMd:             24,
  knobLg:             30,
  vuSegW:             6,
  vuSegH:             3,
  vuSegGap:           1,
  vuSegCount:         12,
  faderThumbW:        20,
  faderThumbH:        14,
  gemButtonH:         13,
  gemDropShadow:      "2px 2px 0",
};

// ── BEVEL CONSTRUCTORS ───────────────────────────────────────
// GEM raise/sunken — lighter touch than Vintage Console.
// Uses paper/ink only. No mid-tone bevel color.

export const gemRaised = () => ({
  borderTop:    `1px solid ${paper}`,
  borderLeft:   `1px solid ${paper}`,
  borderBottom: `1px solid ${ink}`,
  borderRight:  `1px solid ${ink}`,
});

export const gemSunken = () => ({
  borderTop:    `1px solid ${ink}`,
  borderLeft:   `1px solid ${ink}`,
  borderBottom: `1px solid ${paper}`,
  borderRight:  `1px solid ${paper}`,
});

export const inkBorder = () => ({
  border: `1px solid ${ink}`,
});

export const ghostBorder = () => ({
  border: `1px solid ${inkGhost}`,
});

// ── WINDOW DROP SHADOW ───────────────────────────────────────
// Floating panels ONLY. 2px offset, zero blur. Pure GEM.
export const gemShadow = `2px 2px 0 ${ink}`;

// ── THEME OBJECT (for passing to components) ─────────────────
export const ATARI_PAPER = {
  paper, paperDark, paperDeep, paperPanel,
  ink, inkMid, inkLight, inkGhost,
  selection, playhead,
  note, noteSelect,
  keyWhite, keyBlack,
  gridBar, gridBeat, gridSub,
  vuOff, vuNormal, vuWarn, vuHot,
  font, fontMono,
  SPACE, SIZE,
  gemRaised, gemSunken, inkBorder, ghostBorder, gemShadow,
};

export default ATARI_PAPER;
