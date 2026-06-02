import { useState } from "react";

// ============================================================
// CANVAS DAW — VINTAGE CONSOLE THEME
// Styleguide v0.1
// Aesthetic: Early 2010s DAW software. Budget skeuomorphic.
// "It has to look like this because it's the best we could do
//  without melting your GPU."
// Target hardware: Intel Pentium Dual-Core, Intel GMA graphics,
//  3GB DDR2, 1366x768 LCD. Windows 7.
// ============================================================

// ── TOKENS ──────────────────────────────────────────────────
const T = {
  // Base surfaces
  bg0:        "#060a0f",   // deepest void — window chrome outer
  bg1:        "#0a0f16",   // application background
  bg2:        "#0e1620",   // panel background
  bg3:        "#131c28",   // channel strip (inactive)
  bg4:        "#182030",   // channel strip (active/selected)
  bg5:        "#1a2a3a",   // raised inset panel

  // Bevel lights & shadows (the whole system lives here)
  bevelLight: "#4a6680",   // top/left edge — catches the light
  bevelMid:   "#2a3848",   // mid border — neutral
  bevelDark:  "#0a1018",   // bottom/right edge — falls into shadow

  // Accent colors — channel identity
  accentMaster: "#e8a020",
  accentBlue:   "#4fc3f7",
  accentGreen:  "#81c784",
  accentPurple: "#ce93d8",
  accentOrange: "#ff8a65",

  // State colors
  stateRed:     "#8a2010",   // mute active
  stateGreen:   "#108a38",   // solo active / signal present
  stateAmber:   "#8a6000",   // signal warning
  stateHot:     "#8a1010",   // clip / danger

  // Text hierarchy
  textHi:   "#8ab0d0",   // labels, active text
  textMid:  "#5a7898",   // secondary
  textLo:   "#3a5060",   // tertiary
  textDim:  "#1e3040",   // disabled / placeholder
  textGhost:"#111820",   // barely visible rules / decorative

  // Typography
  fontMono: "'Courier New', Courier, monospace",
};

// ── BEVEL HELPERS ────────────────────────────────────────────
// The entire depth system. No box-shadow. Ever.
const raised = {
  borderTop:    `1px solid ${T.bevelLight}`,
  borderLeft:   `1px solid ${T.bevelLight}`,
  borderBottom: `1px solid ${T.bevelDark}`,
  borderRight:  `1px solid ${T.bevelDark}`,
};
const sunken = {
  borderTop:    `1px solid ${T.bevelDark}`,
  borderLeft:   `1px solid ${T.bevelDark}`,
  borderBottom: `1px solid ${T.bevelLight}`,
  borderRight:  `1px solid ${T.bevelLight}`,
};
const flat = {
  border: `1px solid ${T.bevelMid}`,
};
const flush = {
  border: `1px solid ${T.bevelDark}`,
};

// ── SECTION WRAPPER ──────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      {/* Section header — uses the title bar gradient trick */}
      <div style={{
        padding: "3px 8px",
        background: `linear-gradient(to right, #1a3050, #192840)`,
        borderTop:    `1px solid ${T.bevelLight}`,
        borderLeft:   `1px solid ${T.bevelLight}`,
        borderBottom: `1px solid ${T.bevelDark}`,
        borderRight:  `1px solid ${T.bevelDark}`,
        marginBottom: 1,
      }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textHi, letterSpacing: "0.15em", textTransform: "uppercase" }}>
          {title}
        </span>
      </div>
      <div style={{
        padding: 16,
        background: T.bg2,
        borderLeft:   `1px solid ${T.bevelDark}`,
        borderRight:  `1px solid ${T.bevelLight}`,
        borderBottom: `1px solid ${T.bevelLight}`,
      }}>
        {children}
      </div>
    </div>
  );
}

function Label({ children, sub }) {
  return (
    <div style={{ marginBottom: sub ? 4 : 12 }}>
      <div style={{ fontFamily: T.fontMono, fontSize: sub ? 7 : 8, color: sub ? T.textLo : T.textMid, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {children}
      </div>
    </div>
  );
}

function Code({ children }) {
  return (
    <span style={{
      fontFamily: T.fontMono,
      fontSize: 8,
      color: T.accentBlue,
      background: T.bg0,
      padding: "1px 4px",
      ...sunken,
    }}>
      {children}
    </span>
  );
}

function Row({ children, gap = 12 }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap, alignItems: "flex-start" }}>{children}</div>;
}

function Col({ children, gap = 8 }) {
  return <div style={{ display: "flex", flexDirection: "column", gap }}>{children}</div>;
}

// ── COLOR SWATCH ─────────────────────────────────────────────
function Swatch({ color, name, role }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, width: 80 }}>
      <div style={{ width: 80, height: 32, background: color, ...raised }} />
      <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMid }}>{name}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 7, color: T.textLo }}>{color}</div>
      {role && <div style={{ fontFamily: T.fontMono, fontSize: 7, color: T.textDim }}>{role}</div>}
    </div>
  );
}

// ── BUTTON DEMOS ─────────────────────────────────────────────
function DemoButton({ label, variant = "default", active = false }) {
  const [pressed, setPressed] = useState(active);
  const styles = {
    default: {
      background: pressed ? T.bg0 : T.bg5,
      ...(pressed ? sunken : raised),
      color: pressed ? T.textMid : T.textHi,
    },
    mute: {
      background: pressed ? T.stateRed : T.bg1,
      ...(pressed ? sunken : raised),
      color: pressed ? "#fff" : T.textDim,
    },
    solo: {
      background: pressed ? T.stateGreen : T.bg1,
      ...(pressed ? sunken : raised),
      color: pressed ? "#fff" : T.textDim,
    },
    toolbar: {
      background: pressed ? T.bg0 : "#253040",
      ...(pressed ? sunken : raised),
      color: pressed ? T.textMid : T.textHi,
    },
  };

  return (
    <button
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        fontFamily: T.fontMono,
        fontSize: 8,
        fontWeight: "bold",
        padding: "3px 8px",
        cursor: "pointer",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        ...styles[variant],
      }}
    >
      {label}
    </button>
  );
}

// ── KNOB DEMO ────────────────────────────────────────────────
function DemoKnob({ label, color, size = 30, value = 65 }) {
  const angle = -135 + (value / 100) * 270;
  const rad = (angle * Math.PI) / 180;
  const cx = size / 2;
  const dotR = cx - 4;
  const dx = cx + dotR * Math.sin(rad);
  const dy = cx - dotR * Math.cos(rad);

  return (
    <Col gap={3} style={{ alignItems: "center" }}>
      <div style={{
        width: size, height: size,
        borderRadius: "50%",
        background: "#253040",
        borderTop:    `1px solid ${T.bevelLight}`,
        borderLeft:   `1px solid ${T.bevelLight}`,
        borderBottom: `1px solid ${T.bevelDark}`,
        borderRight:  `1px solid ${T.bevelDark}`,
        position: "relative",
        overflow: "hidden",
        cursor: "ns-resize",
      }}>
        <div style={{
          position: "absolute",
          top: 2, left: Math.round(size * 0.15),
          width: size * 0.35,
          height: size * 0.22,
          background: "rgba(255,255,255,0.07)",
          borderRadius: "50%",
        }} />
        <svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0 }}>
          <circle cx={dx} cy={dy} r={2} fill={color} />
        </svg>
      </div>
      <span style={{ fontFamily: T.fontMono, fontSize: 7, color: T.textLo, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
    </Col>
  );
}

// ── FADER DEMO ───────────────────────────────────────────────
function DemoFader({ label, value = 75, height = 80 }) {
  return (
    <Col gap={3} style={{ alignItems: "center" }}>
      <div style={{
        width: 12, height,
        background: T.bg0,
        ...sunken,
        position: "relative",
      }}>
        <div style={{
          position: "absolute",
          left: "50%", top: 4, bottom: 4,
          width: 2, marginLeft: -1,
          background: T.bg5,
          borderLeft: `1px solid ${T.bevelDark}`,
        }} />
        <div style={{
          position: "absolute",
          left: 1, right: 1,
          top: "44%",
          height: 1,
          background: "#2a4060",
        }} />
        <div style={{
          position: "absolute",
          left: -4,
          top: Math.round((1 - value / 100) * (height - 16)),
          width: 20,
          height: 13,
          background: "#3a5068",
          borderTop:    `1px solid ${T.bevelLight}`,
          borderLeft:   `1px solid ${T.bevelLight}`,
          borderBottom: `1px solid ${T.bevelDark}`,
          borderRight:  `1px solid ${T.bevelDark}`,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 2,
        }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 1, height: 7, background: "#6a8aaa", borderRight: `1px solid ${T.bevelDark}` }} />
          ))}
        </div>
      </div>
      <span style={{ fontFamily: T.fontMono, fontSize: 7, color: T.textLo, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
    </Col>
  );
}

// ── VU DEMO ──────────────────────────────────────────────────
const VU_C = ["#1a8c30","#1a8c30","#1a8c30","#1a8c30","#1a8c30","#1a8c30","#5c9e20","#5c9e20","#b8a000","#b8a000","#c06000","#9a1010"];

function DemoVU({ level = 8 }) {
  return (
    <div style={{ display: "flex", gap: 1 }}>
      {[level, Math.max(0, level - 1)].map((l, mi) => (
        <div key={mi} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {Array.from({ length: 12 }).map((_, i) => {
            const idx = 11 - i;
            const lit = idx < l;
            return (
              <div key={i} style={{
                width: 6, height: 3,
                background: lit ? VU_C[idx] : "#0e1620",
                borderTop: lit ? "1px solid rgba(255,255,255,0.12)" : `1px solid ${T.bevelDark}`,
                borderBottom: `1px solid rgba(0,0,0,0.3)`,
                borderLeft: "none", borderRight: "none",
              }} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── LCD READOUT ──────────────────────────────────────────────
function LCD({ value, unit }) {
  return (
    <div style={{
      fontFamily: T.fontMono,
      fontSize: 9,
      color: "#3a6888",
      background: T.bg0,
      padding: "2px 5px",
      ...sunken,
      display: "inline-block",
      minWidth: 40,
      textAlign: "right",
      letterSpacing: "0.05em",
    }}>
      {value}<span style={{ fontSize: 7, color: T.textDim, marginLeft: 2 }}>{unit}</span>
    </div>
  );
}

// ── INPUT ────────────────────────────────────────────────────
function DemoInput({ placeholder }) {
  return (
    <input
      placeholder={placeholder}
      style={{
        fontFamily: T.fontMono,
        fontSize: 8,
        color: T.textHi,
        background: T.bg0,
        padding: "3px 6px",
        ...sunken,
        outline: "none",
        letterSpacing: "0.05em",
        width: 120,
      }}
    />
  );
}

// ── PANEL VARIANTS ───────────────────────────────────────────
function PanelDemo({ label, bevel, bg }) {
  return (
    <div style={{
      padding: "8px 10px",
      background: bg,
      ...bevel,
      width: 100,
    }}>
      <span style={{ fontFamily: T.fontMono, fontSize: 7, color: T.textLo, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
    </div>
  );
}

// ── TYPOGRAPHY DEMO ──────────────────────────────────────────
function TypeDemo({ size, role, sample, color }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
      <span style={{ fontFamily: T.fontMono, fontSize: 7, color: T.textDim, width: 60, textTransform: "uppercase", letterSpacing: "0.1em" }}>{role}</span>
      <span style={{ fontFamily: T.fontMono, fontSize: size, color: color || T.textHi, letterSpacing: "0.08em" }}>{sample}</span>
      <span style={{ fontFamily: T.fontMono, fontSize: 7, color: T.textGhost }}>{size}px</span>
    </div>
  );
}

// ── RULES CARD ───────────────────────────────────────────────
function Rule({ number, text }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 6 }}>
      <span style={{ fontFamily: T.fontMono, fontSize: 8, color: T.accentMaster, width: 16, flexShrink: 0 }}>
        {String(number).padStart(2, "0")}
      </span>
      <span style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMid, lineHeight: 1.6, letterSpacing: "0.04em" }}>
        {text}
      </span>
    </div>
  );
}

// ── MAIN STYLEGUIDE ──────────────────────────────────────────
export default function Styleguide() {
  return (
    <div style={{
      background: T.bg1,
      minHeight: "100vh",
      padding: 24,
      fontFamily: T.fontMono,
    }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          padding: "6px 12px",
          background: "linear-gradient(to right, #1a3050, #253a50)",
          borderTop:    `1px solid ${T.bevelLight}`,
          borderLeft:   `1px solid ${T.bevelLight}`,
          borderBottom: `1px solid ${T.bevelDark}`,
          borderRight:  `1px solid ${T.bevelDark}`,
          display: "inline-block",
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 9, color: T.textHi, letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Canvas DAW
          </span>
          <span style={{ fontSize: 9, color: T.textLo, letterSpacing: "0.1em", marginLeft: 12 }}>
            Vintage Console Theme
          </span>
          <span style={{ fontSize: 8, color: T.textDim, marginLeft: 12 }}>
            Styleguide v0.1
          </span>
        </div>
        <div style={{ fontSize: 8, color: T.textDim, letterSpacing: "0.08em", lineHeight: 1.8 }}>
          Aesthetic origin: Early 2010s DAW software · FL Studio 10, Reason 6, early Ableton<br />
          Design constraint: Intel GMA integrated graphics · No GPU acceleration assumed<br />
          Philosophy: "It has to look like this. This is the best we can do without melting your computer."
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, columnGap: 24 }}>

        {/* LEFT COLUMN */}
        <div>

          {/* DESIGN RULES */}
          <Section title="Design Rules">
            <Rule number={1} text="No box-shadow. Ever. Depth is communicated exclusively through border color pairs." />
            <Rule number={2} text="No border-radius on rectangular elements. Circles stay circles. Everything else is hard-edged." />
            <Rule number={3} text="No CSS transitions or animations. State changes are instant. The hardware can't afford to ease." />
            <Rule number={4} text="No radial-gradient. Knob depth uses a flat color + one highlight div + a border bevel." />
            <Rule number={5} text="No blur, filter, or backdrop-filter. The integrated GPU does not have a filter pipeline." />
            <Rule number={6} text="Simple linear-gradient allowed only for title bars (2-stop, horizontal). Everything else is flat solid." />
            <Rule number={7} text="VU segments are individual flat divs. No glow. Off state is a dark rectangle." />
            <Rule number={8} text="Fader thumbs are flat rectangles with grip lines. No shine. No depth beyond the bevel." />
            <Rule number={9} text="All text is monospace. This is a tool, not a marketing page." />
            <Rule number={10} text="Information density is a feature. Trust the user to read the UI. Don't simplify." />
          </Section>

          {/* COLOR PALETTE */}
          <Section title="Color Palette — Surfaces">
            <Label sub>Background Scale</Label>
            <Row gap={8} style={{ marginBottom: 16 }}>
              <Swatch color={T.bg0} name="bg0" role="Window void" />
              <Swatch color={T.bg1} name="bg1" role="App bg" />
              <Swatch color={T.bg2} name="bg2" role="Panel" />
              <Swatch color={T.bg3} name="bg3" role="Strip inactive" />
              <Swatch color={T.bg4} name="bg4" role="Strip active" />
              <Swatch color={T.bg5} name="bg5" role="Raised inset" />
            </Row>
            <Label sub>Bevel System</Label>
            <Row gap={8} style={{ marginBottom: 16 }}>
              <Swatch color={T.bevelLight} name="bevelLight" role="top / left" />
              <Swatch color={T.bevelMid}   name="bevelMid"   role="neutral" />
              <Swatch color={T.bevelDark}  name="bevelDark"  role="bottom / right" />
            </Row>
            <Label sub>Accent — Channel Identity</Label>
            <Row gap={8} style={{ marginBottom: 16 }}>
              <Swatch color={T.accentMaster} name="Master" role="Master/Send" />
              <Swatch color={T.accentBlue}   name="Blue"   role="Drums/Perc" />
              <Swatch color={T.accentGreen}  name="Green"  role="Bass/Low" />
              <Swatch color={T.accentPurple} name="Purple" role="Synth/Pad" />
              <Swatch color={T.accentOrange} name="Orange" role="FX/Return" />
            </Row>
            <Label sub>State Colors</Label>
            <Row gap={8}>
              <Swatch color={T.stateRed}   name="Mute"    role="Active mute" />
              <Swatch color={T.stateGreen} name="Solo/Sig" role="Solo / signal" />
              <Swatch color={T.stateAmber} name="Warn"    role="-6dB warning" />
              <Swatch color={T.stateHot}   name="Clip"    role="0dB / clip" />
            </Row>
          </Section>

          {/* TYPOGRAPHY */}
          <Section title="Typography">
            <div style={{ marginBottom: 8, fontSize: 7, color: T.textDim, letterSpacing: "0.08em" }}>
              Font family: 'Courier New', Courier, monospace — system font only, no web fonts loaded
            </div>
            <Col gap={10}>
              <TypeDemo size={9}  role="Title bar"   sample="MIXER — MASTER" color={T.textHi} />
              <TypeDemo size={8}  role="Label"       sample="CHANNEL NAME" color={T.textMid} />
              <TypeDemo size={8}  role="LCD readout" sample="-6.0 dB" color="#3a6888" />
              <TypeDemo size={7}  role="Secondary"   sample="INSERT / SEND" color={T.textLo} />
              <TypeDemo size={7}  role="Knob label"  sample="PAN   VOL   ATK" color={T.textLo} />
              <TypeDemo size={7}  role="Tertiary"    sample="44100 Hz · 32-bit · ASIO" color={T.textDim} />
              <TypeDemo size={6}  role="Ghost"       sample="20Hz ————— 20kHz" color={T.textGhost} />
            </Col>
            <div style={{ marginTop: 12, padding: "6px 8px", background: T.bg0, ...sunken }}>
              <div style={{ fontSize: 7, color: T.textDim, lineHeight: 1.8 }}>
                letter-spacing: 0.1em on uppercase labels<br />
                letter-spacing: 0.04–0.08em on readouts<br />
                text-transform: uppercase on ALL labels<br />
                No italic. No bold except button labels.
              </div>
            </div>
          </Section>

        </div>

        {/* RIGHT COLUMN */}
        <div>

          {/* BEVEL SYSTEM */}
          <Section title="Bevel System — The Depth Engine">
            <div style={{ marginBottom: 10, fontSize: 7, color: T.textDim, lineHeight: 1.8 }}>
              All depth is created with 1px border pairs. Light edge catches virtual overhead light.
              Dark edge falls into shadow. No box-shadow. No gradient on the element itself.
            </div>
            <Row gap={16} style={{ marginBottom: 16 }}>
              <Col gap={6}>
                <PanelDemo label="Raised" bevel={raised} bg={T.bg5} />
                <div style={{ fontSize: 7, color: T.textDim }}>
                  <Code>borderTop: bevelLight</Code><br />
                  <Code>borderLeft: bevelLight</Code><br />
                  <Code>borderBottom: bevelDark</Code><br />
                  <Code>borderRight: bevelDark</Code>
                </div>
                <div style={{ fontSize: 7, color: T.textLo }}>Use: buttons, panels, fader thumbs, knobs</div>
              </Col>
              <Col gap={6}>
                <PanelDemo label="Sunken" bevel={sunken} bg={T.bg0} />
                <div style={{ fontSize: 7, color: T.textDim }}>
                  <Code>borderTop: bevelDark</Code><br />
                  <Code>borderLeft: bevelDark</Code><br />
                  <Code>borderBottom: bevelLight</Code><br />
                  <Code>borderRight: bevelLight</Code>
                </div>
                <div style={{ fontSize: 7, color: T.textLo }}>Use: fader track, LCD readout, EQ display, inputs</div>
              </Col>
              <Col gap={6}>
                <PanelDemo label="Flat" bevel={flat} bg={T.bg2} />
                <div style={{ fontSize: 7, color: T.textDim }}>
                  <Code>border: 1px solid bevelMid</Code>
                </div>
                <div style={{ fontSize: 7, color: T.textLo }}>Use: inactive fx slots, separators</div>
              </Col>
              <Col gap={6}>
                <PanelDemo label="Flush" bevel={flush} bg={T.bg2} />
                <div style={{ fontSize: 7, color: T.textDim }}>
                  <Code>border: 1px solid bevelDark</Code>
                </div>
                <div style={{ fontSize: 7, color: T.textLo }}>Use: (none) slots, empty states</div>
              </Col>
            </Row>
            <div style={{ padding: "6px 8px", background: T.bg0, ...sunken, fontSize: 7, color: T.textDim, lineHeight: 1.8 }}>
              Active/pressed state: swap raised → sunken on same element.<br />
              Never change background color alone to show press state — always invert the bevel.<br />
              Title bars get the one exception: <Code>linear-gradient(to right, #1a3050, #253a50)</Code>
            </div>
          </Section>

          {/* COMPONENTS */}
          <Section title="Components">

            {/* Buttons */}
            <Label>Buttons</Label>
            <Row gap={6} style={{ marginBottom: 16 }}>
              <DemoButton label="Default" variant="default" />
              <DemoButton label="Toolbar" variant="toolbar" />
              <DemoButton label="Mute" variant="mute" />
              <DemoButton label="Solo" variant="solo" />
              <DemoButton label="Active ↓" variant="default" active />
            </Row>
            <div style={{ fontSize: 7, color: T.textDim, marginBottom: 16, lineHeight: 1.8 }}>
              Click any button — pressed state inverts the bevel (raised → sunken), no color change on default.<br />
              Mute/Solo use state colors only when active. Inactive state is near-invisible.
            </div>

            {/* Knobs */}
            <Label>Knobs</Label>
            <Row gap={16} style={{ marginBottom: 16 }}>
              <DemoKnob label="Vol"  color={T.accentMaster} value={80} size={32} />
              <DemoKnob label="Pan"  color={T.accentBlue}   value={50} size={28} />
              <DemoKnob label="Atk"  color={T.accentGreen}  value={30} size={26} />
              <DemoKnob label="Rel"  color={T.accentPurple} value={60} size={24} />
              <DemoKnob label="Frq"  color={T.accentOrange} value={70} size={22} />
            </Row>
            <div style={{ fontSize: 7, color: T.textDim, marginBottom: 16, lineHeight: 1.8 }}>
              Knob depth: flat <Code>#253040</Code> fill + bevel border + one highlight div (rgba white, ellipse, top-left, opacity 0.07).<br />
              Indicator: SVG circle in accent color only. No arc. No tick marks. No gradient.<br />
              Sizes: 22px (dense), 24–26px (standard), 28–32px (primary). Always circular.
            </div>

            {/* Faders */}
            <Label>Faders</Label>
            <Row gap={16} style={{ marginBottom: 16 }}>
              <DemoFader label="100%" value={100} height={80} />
              <DemoFader label="75%"  value={75}  height={80} />
              <DemoFader label="50%"  value={50}  height={80} />
              <DemoFader label="0dB"  value={50}  height={100} />
              <DemoFader label="Off"  value={0}   height={80} />
            </Row>
            <div style={{ fontSize: 7, color: T.textDim, marginBottom: 16, lineHeight: 1.8 }}>
              Track: sunken, <Code>bg0</Code> fill. Center rail: 2px wide, <Code>bg5</Code>.<br />
              Unity notch at ~44% from top. Thumb: raised rectangle, 3 grip lines in <Code>bevelLight</Code>.<br />
              Muted fader thumb goes dark — no color, bevel barely visible.
            </div>

            {/* VU Meters */}
            <Label>VU Meters</Label>
            <Row gap={12} style={{ marginBottom: 16 }}>
              {[3, 5, 7, 9, 10, 11, 12].map(l => (
                <Col key={l} gap={3} style={{ alignItems: "center" }}>
                  <DemoVU level={l} />
                  <span style={{ fontSize: 7, color: T.textDim }}>{l}/12</span>
                </Col>
              ))}
            </Row>
            <div style={{ fontSize: 7, color: T.textDim, marginBottom: 16, lineHeight: 1.8 }}>
              12 segments. Each 3px tall, 6px wide, 1px gap.<br />
              Segs 0–5: <Code>#1a8c30</Code> (green) · 6–7: <Code>#5c9e20</Code> (yellow-green) · 8–9: <Code>#b8a000</Code> (amber) · 10: <Code>#c06000</Code> (orange) · 11: <Code>#9a1010</Code> (red)<br />
              Off segment: <Code>#0e1620</Code> with dark top border. No glow on any state.
            </div>

            {/* LCD + Input */}
            <Label>Readouts & Inputs</Label>
            <Row gap={12}>
              <Col gap={6}>
                <LCD value="-6.0" unit="dB" />
                <LCD value="127" unit="BPM" />
                <LCD value="1:01:000" unit="" />
              </Col>
              <Col gap={6}>
                <DemoInput placeholder="Track name..." />
                <DemoInput placeholder="Search patches..." />
              </Col>
            </Row>

          </Section>

          {/* SPACING */}
          <Section title="Spacing & Grid">
            <div style={{ fontSize: 7, color: T.textDim, lineHeight: 2, marginBottom: 8 }}>
              Base unit: <Code>4px</Code><br />
              Component gap (dense): <Code>1px</Code> — channel strip internals, VU segments<br />
              Component gap (standard): <Code>2–3px</Code> — button rows, knob groups<br />
              Component gap (loose): <Code>4–6px</Code> — panel sections<br />
              Panel padding: <Code>5–6px</Code><br />
              Section padding: <Code>16px</Code><br />
              Channel strip width: <Code>54px</Code> standard · <Code>64px</Code> master<br />
              Title bar height: <Code>18px</Code><br />
              Status bar height: <Code>14px</Code>
            </div>
            <Row gap={4}>
              {[1,2,3,4,6,8,12,16,24].map(n => (
                <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ width: n * 4, height: 12, background: T.accentBlue, opacity: 0.6 }} />
                  <span style={{ fontSize: 6, color: T.textGhost }}>{n * 4}</span>
                </div>
              ))}
            </Row>
          </Section>

        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 16,
        padding: "4px 8px",
        background: T.bg0,
        borderTop: `1px solid ${T.bevelDark}`,
        display: "flex",
        justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 7, color: T.textGhost }}>Canvas DAW · Vintage Console · Styleguide v0.1</span>
        <span style={{ fontSize: 7, color: T.textGhost }}>Built for 2010 hardware. Rendered on something that would make a Pentium E5500 weep.</span>
      </div>

    </div>
  );
}
