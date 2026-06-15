// ============================================================
// CANVAS DAW — DESIGN TOKENS
// Vintage Console Theme (Dark + Light)
// 
// SOURCE OF TRUTH. Do not hardcode any values that exist here.
// If you are an AI agent: import from this file. Do not invent
// color values, spacing, or border styles from scratch.
// ============================================================

// ── SPACING ──────────────────────────────────────────────────
export const SPACE = {
  px: 1,   // hairline / bevel
  xs: 2,   // tight — button gap, segment gap
  sm: 4,   // base unit
  md: 6,   // panel padding
  lg: 12,  // component gap
  xl: 16,  // section padding
  xxl: 24,  // page margin
};

// ── COMPONENT SIZING ─────────────────────────────────────────
export const SIZE = {
  channelStrip: 68,   // px — standard channel
  channelStripMaster: 80,   // px — master channel
  titleBarHeight: 18,
  statusBarHeight: 14,
  fxRowHeight: 20,
  knobSm: 22,
  knobMd: 26,
  knobLg: 32,
  vuSegW: 6,
  vuSegH: 3,
  vuSegGap: 1,
  vuSegCount: 12,
  faderThumbW: 22,
  faderThumbH: 14,
  channelNameWidth: 96,
};

// ── DARK THEME ───────────────────────────────────────────────
export const DARK = {
  // Surfaces — 6-step scale, blue-black with slight warm undertone
  bg0: "#060a0f",
  bg1: "#0a0f16",
  bg2: "#0e1620",
  bg3: "#131c28",
  bg4: "#182030",
  bg5: "#1a2a3a",

  // Bevel — THE depth system. Nothing else creates depth.
  bevelLight: "#4a6680",
  bevelMid: "#2a3848",
  bevelDark: "#0a1018",

  // Channel identity accents
  accentMaster: "#e8a020",
  accentBlue: "#4fc3f7",
  accentGreen: "#81c784",
  accentPurple: "#ce93d8",
  accentOrange: "#ff8a65",

  // State
  stateRed: "#8a2010",
  stateGreen: "#108a38",
  stateAmber: "#8a6000",
  stateHot: "#8a1010",

  // Text hierarchy
  textHi: "#8ab0d0",
  textMid: "#5a7898",
  textLo: "#3a5060",
  textDim: "#1e3040",
  textGhost: "#111820",

  // VU meter segment colors — index 0 = bottom, 11 = top/clip
  vu: [
    "#1a8c30", "#1a8c30", "#1a8c30", "#1a8c30",
    "#1a8c30", "#1a8c30", "#5c9e20", "#5c9e20",
    "#b8a000", "#b8a000", "#c06000", "#9a1010",
  ],
  vuOff: "#0e1620",

  // LCD readout
  lcdBg: "#060a0f",
  lcdText: "#3a6888",

  // Knob body
  knobBody: "#253040",
  knobHighlight: "rgba(255,255,255,0.07)",

  // Title bar gradient (the one allowed gradient)
  titleBarGradient: "linear-gradient(to right, #1a3050, #253a50)",

  font: "'Courier New', Courier, monospace",
  SPACE,
  SIZE,
};

// ── LIGHT THEME ──────────────────────────────────────────────
export const LIGHT = {
  // Surfaces — warm gray scale, slight yellow undertone
  // Reference: Windows 7 Aero, HP monitor default, WinAmp light skin
  bg0: "#f4f0e8",
  bg1: "#eceae0",
  bg2: "#e0ddd4",
  bg3: "#d4d1c8",
  bg4: "#c8c5bc",
  bg5: "#bcb9b0",

  // Bevel — same physics, brighter materials
  bevelLight: "#ffffff",
  bevelMid: "#a09c94",
  bevelDark: "#787068",

  // Channel identity — same hues, darkened for legibility on light
  accentMaster: "#b06800",
  accentBlue: "#1870a8",
  accentGreen: "#287040",
  accentPurple: "#683890",
  accentOrange: "#b84010",

  // State
  stateRed: "#c03020",
  stateGreen: "#208840",
  stateAmber: "#a06808",
  stateHot: "#c01818",

  // Text hierarchy — dark scale, warm undertone
  textHi: "#181410",
  textMid: "#383430",
  textLo: "#585450",
  textDim: "#888480",
  textGhost: "#b0aca8",

  // VU
  vu: [
    "#1a8430", "#1a8430", "#1a8430", "#1a8430",
    "#1a8430", "#1a8430", "#5a9818", "#5a9818",
    "#b09800", "#b09800", "#c05800", "#981010",
  ],
  vuOff: "#c8c4bc",

  // LCD — green on cream (hardware display in a lit room)
  lcdBg: "#d8e8d0",
  lcdText: "#205038",

  // Knob
  knobBody: "#c0bdb4",
  knobHighlight: "rgba(255,255,255,0.5)",

  // Title bar gradient
  titleBarGradient: "linear-gradient(to right, #b8c8d8, #c8d8e8)",

  font: "'Courier New', Courier, monospace",
  SPACE,
  SIZE,
};

// ── SHARED BEVEL CONSTRUCTORS ────────────────────────────────
// Call with a theme object. Returns a border style object.
// Use these. Do not write border values by hand.

export const raised = (t) => ({
  borderTop: `1px solid ${t.bevelLight}`,
  borderLeft: `1px solid ${t.bevelLight}`,
  borderBottom: `1px solid ${t.bevelDark}`,
  borderRight: `1px solid ${t.bevelDark}`,
});

export const sunken = (t) => ({
  borderTop: `1px solid ${t.bevelDark}`,
  borderLeft: `1px solid ${t.bevelDark}`,
  borderBottom: `1px solid ${t.bevelLight}`,
  borderRight: `1px solid ${t.bevelLight}`,
});

export const flat = (t) => ({
  border: `1px solid ${t.bevelMid}`,
});

export const flush = (t) => ({
  border: `1px solid ${t.bevelDark}`,
});

