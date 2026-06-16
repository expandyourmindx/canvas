// ============================================================
// CANVAS DAW — ATARI PAPER DARK THEME TOKENS
// Reference: Atari ST GEM desktop, lights off.
// Same two-accent ink/paper duality as Atari Paper — inverted polarity.
// SOURCE OF TRUTH. Do not hardcode any values that exist here.
// ============================================================

// ── SURFACES — warm charcoal scale (was: warm paper scale) ───
// "paper" now means the dark page, not a light one. Same role,
// same relative ordering (paper lightest of the four, paperPanel
// darkest/deepest) — just confined to the dark end of the range.
export const paper      = "#3a3222";   // the page — main background (now dark)
export const paperDark  = "#2d271c";   // sunken panels, input fields
export const paperDeep  = "#221d16";   // toolbar chrome, button fill
export const paperPanel = "#181410";   // deepest surface / desktop floor

// ── INK — drawing colors (was: dark ink, now: bright ink) ────
// Ink is still the dominant, high-contrast tone — it's just
// light now instead of black. textHi is a pale warm cream,
// not pure white (avoids the "amateur dark theme" glare).
export const ink        = "#e8e1cf";   // primary — borders, text, filled notes
export const inkMid     = "#b3a888";   // secondary — labels, less-critical UI
export const inkLight   = "#7c7258";   // tertiary — grid lines, dividers
export const inkGhost   = "#443a26";   // barely there — background grid, empty VU

// ── THE TWO ACCENT COLORS — nothing else gets color ──────────
// Hue preserved from Atari Paper, brightened for legibility against
// near-black surfaces. #0000b8 and #b80000 would nearly vanish here.
export const selection  = "#4d5fff";   // Atari GEM blue, brightened — active, selected, focused
export const playhead   = "#ff3030";   // playhead — always findable on the page

// ── NOTE / CLIP BLOCKS ───────────────────────────────────────
export const note       = "#cfc6a8";   // filled note/clip rectangle — light on dark page
export const noteSelect = "#4d5fff";   // selected note — uses selection color

// ── PIANO KEYS ───────────────────────────────────────────────
// DEVIATION FROM LITERAL INVERSION: the original reuses paper for
// keyWhite and note for keyBlack. A literal swap here would make
// white keys darker than black keys, which is wrong regardless of
// theme. These are anchored to correct relative brightness instead.
export const keyWhite   = "#cfc6a8";   // white key — same as note (light)
export const keyBlack   = "#181410";   // black key — same as paperPanel (dark)

// ── GRID HIERARCHY ───────────────────────────────────────────
export const gridBar    = "#8a7f64";   // bar lines — most prominent
export const gridBeat   = "#5c5340";   // beat lines — visible
export const gridSub    = "#181410";   // subdivisions — subtle, blends with floor

// ── VU METER SEGMENTS ────────────────────────────────────────
// Off = paperPanel — on a dark theme this reads as nearly invisible
// against the floor, which is the correct dark-theme convention.
// Standard = ink. Warning = inkMid. Hot/clip = alert.
export const vuOff      = paperPanel;
export const vuNormal   = ink;
export const vuWarn     = inkMid;     // segs 6–7
export const vuHot      = "#ff3030";  // segs 10–11 — same as playhead red

// ── TYPOGRAPHY ───────────────────────────────────────────────
// Unchanged. GEM's character doesn't depend on light vs dark.
export const font     = "Geneva, 'MS Sans Serif', Tahoma, sans-serif";
export const fontMono = "'Courier New', Courier, monospace";

// ── SPACING ──────────────────────────────────────────────────
// Unchanged — copy directly, no reason to touch layout for a color flip.
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
  channelNameWidth:   96,
};

// ── BEVEL CONSTRUCTORS ───────────────────────────────────────
// DEVIATION FROM LITERAL INVERSION: in Atari Paper, raised() puts
// paper (light) on top/left and ink (dark) on bottom/right — correct,
// because paper was the light tone. Here ink is the light tone, so
// the edges are swapped to preserve the actual lit/shadow physics,
// not the original variable names.

export const gemRaised = () => ({
  borderTop:    `1px solid ${ink}`,
  borderLeft:   `1px solid ${ink}`,
  borderBottom: `1px solid ${paper}`,
  borderRight:  `1px solid ${paper}`,
});

export const gemSunken = () => ({
  borderTop:    `1px solid ${paper}`,
  borderLeft:   `1px solid ${paper}`,
  borderBottom: `1px solid ${ink}`,
  borderRight:  `1px solid ${ink}`,
});

export const inkBorder = () => ({
  border: `1px solid ${ink}`,
});

export const ghostBorder = () => ({
  border: `1px solid ${inkGhost}`,
});

// ── WINDOW DROP SHADOW ───────────────────────────────────────
// DEVIATION FROM LITERAL INVERSION: the original reuses ink (black)
// for the shadow. Ink is now bright, and a shadow has to stay dark
// regardless of theme — so this is hardcoded to black, not derived.
export const gemShadow = `2px 2px 0 #000000`;

// Bevel functions compatibility with Vintage Console
export const raised = (t) => ({
  borderTop:    `1px solid ${t.bevelLight}`,
  borderLeft:   `1px solid ${t.bevelLight}`,
  borderBottom: `1px solid ${t.bevelDark}`,
  borderRight:  `1px solid ${t.bevelDark}`,
});

export const sunken = (t) => ({
  borderTop:    `1px solid ${t.bevelDark}`,
  borderLeft:   `1px solid ${t.bevelDark}`,
  borderBottom: `1px solid ${t.bevelLight}`,
  borderRight:  `1px solid ${t.bevelLight}`,
});

export const flat = (t) => ({
  border: `1px solid ${t.bevelMid}`,
});

export const flush = (t) => ({
  border: `1px solid ${t.bevelDark}`,
});

// ── THEME OBJECT (for passing to components) ─────────────────
export const ATARI_PAPER_DARK = {
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

  // Surface scale
  bg0: paperPanel,
  bg1: paperDeep,
  bg2: paperDark,
  bg3: paper,
  bg4: "#463c28",
  bg5: "#564a30",

  // Bevel — swapped vs. Atari Paper (see comment above gemRaised)
  bevelLight: ink,
  bevelMid: inkLight,
  bevelDark: paper,

  // Accents
  accentMaster: playhead,
  accentBlue: selection,
  accentGreen: "#44c074",
  accentPurple: "#b454d6",
  accentOrange: "#ff7038",

  // State
  stateRed: playhead,
  stateGreen: "#34d468",
  stateAmber: "#ffb020",
  stateHot: playhead,

  // Text hierarchy
  textHi: ink,
  textMid: inkMid,
  textLo: inkLight,
  textDim: inkGhost,
  textGhost: paperDeep,

  // VU meter
  vu: [ink, ink, ink, ink, ink, ink, inkMid, inkMid, "#ffb020", "#ffb020", playhead, playhead],

  // LCD
  lcdBg: paperDark,
  lcdText: selection,

  // Knob
  knobBody: paperDeep,
  knobHighlight: "rgba(255,255,255,0.07)",

  // Title bar
  titleBarGradient: "none",

  // Font
  font,
};

export default ATARI_PAPER_DARK;
