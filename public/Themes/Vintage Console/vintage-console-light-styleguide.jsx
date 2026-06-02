import { useState } from "react";

// ============================================================
// CANVAS DAW — VINTAGE CONSOLE LIGHT THEME
// Styleguide v0.1
// Aesthetic: Early 2010s DAW software — light mode.
// Think: Windows 7 Aero warm gray. HP monitor out of the box.
// WinAmp default skin. Reason 4 rack in daylight.
// Same rules as dark. Different materials.
// ============================================================

const T = {
  // Base surfaces — warm gray scale, slight yellow undertone
  // This is that specific "beige-gray" of 2010 Windows apps
  bg0:        "#f4f0e8",   // lightest — like paper on a desk
  bg1:        "#eceae0",   // app background
  bg2:        "#e0ddd4",   // panel background
  bg3:        "#d4d1c8",   // strip inactive — classic Win7 gray
  bg4:        "#c8c5bc",   // strip active / selected
  bg5:        "#bcb9b0",   // recessed / pressed

  // Bevel — light theme inverts the physics
  // Top/left: bright white catch. Bottom/right: warm mid-gray shadow.
  bevelLight: "#ffffff",   // top/left — pure highlight
  bevelMid:   "#a09c94",   // neutral border
  bevelDark:  "#787068",   // bottom/right — warm shadow

  // Accent colors — same hues, darkened for legibility on light
  accentMaster: "#b06800",   // amber → burnt orange
  accentBlue:   "#1870a8",   // cyan → steel blue
  accentGreen:  "#287040",   // green → forest
  accentPurple: "#683890",   // lavender → violet
  accentOrange: "#b84010",   // orange → rust

  // State colors — slightly muted, still readable
  stateRed:     "#c03020",
  stateGreen:   "#208840",
  stateAmber:   "#a06808",
  stateHot:     "#c01818",

  // Text — dark scale with warm undertone
  textHi:   "#181410",   // near-black — primary labels
  textMid:  "#383430",   // secondary
  textLo:   "#585450",   // tertiary
  textDim:  "#888480",   // disabled
  textGhost:"#b0aca8",   // barely there

  // VU segments — slightly more saturated on light bg
  vuColors: [
    "#1a8430","#1a8430","#1a8430","#1a8430",
    "#1a8430","#1a8430","#5a9818","#5a9818",
    "#b09800","#b09800","#c05800","#981010"
  ],

  fontMono: "'Courier New', Courier, monospace",
};

// ── BEVEL HELPERS ────────────────────────────────────────────
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
const flat = { border: `1px solid ${T.bevelMid}` };
const flush = { border: `1px solid ${T.bevelDark}` };

// ── SHARED COMPONENTS ────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        padding: "3px 8px",
        background: `linear-gradient(to right, #b8c8d8, #c8d8e8)`,
        borderTop:    `1px solid ${T.bevelLight}`,
        borderLeft:   `1px solid ${T.bevelLight}`,
        borderBottom: `1px solid ${T.bevelDark}`,
        borderRight:  `1px solid ${T.bevelDark}`,
        marginBottom: 1,
      }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 9, color: "#203848", letterSpacing: "0.15em", textTransform: "uppercase" }}>
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
      fontFamily: T.fontMono, fontSize: 8,
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

function DemoButton({ label, variant = "default", active = false }) {
  const [pressed, setPressed] = useState(active);
  const styles = {
    default: {
      background: pressed ? T.bg5 : T.bg3,
      ...(pressed ? sunken : raised),
      color: pressed ? T.textLo : T.textMid,
    },
    mute: {
      background: pressed ? T.stateRed : T.bg3,
      ...(pressed ? sunken : raised),
      color: pressed ? "#fff" : T.textDim,
    },
    solo: {
      background: pressed ? T.stateGreen : T.bg3,
      ...(pressed ? sunken : raised),
      color: pressed ? "#fff" : T.textDim,
    },
    toolbar: {
      background: pressed ? T.bg5 : "#c8d4dc",
      ...(pressed ? sunken : raised),
      color: pressed ? T.textLo : "#203848",
    },
  };

  return (
    <button
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        fontFamily: T.fontMono, fontSize: 8, fontWeight: "bold",
        padding: "3px 8px", cursor: "pointer",
        letterSpacing: "0.08em", textTransform: "uppercase",
        ...styles[variant],
      }}
    >
      {label}
    </button>
  );
}

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
        // Light knob: warm mid-gray body, white highlight edge
        background: "#c0bdb4",
        borderTop:    `1px solid ${T.bevelLight}`,
        borderLeft:   `1px solid ${T.bevelLight}`,
        borderBottom: `1px solid ${T.bevelDark}`,
        borderRight:  `1px solid ${T.bevelDark}`,
        position: "relative",
        overflow: "hidden",
        cursor: "ns-resize",
      }}>
        {/* Highlight — brighter on light theme */}
        <div style={{
          position: "absolute",
          top: 2, left: Math.round(size * 0.15),
          width: size * 0.35, height: size * 0.22,
          background: "rgba(255,255,255,0.5)",
          borderRadius: "50%",
        }} />
        <svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0 }}>
          <circle cx={dx} cy={dy} r={2} fill={color} />
        </svg>
      </div>
      {label && (
        <span style={{ fontFamily: T.fontMono, fontSize: 7, color: T.textLo, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
      )}
    </Col>
  );
}

function DemoFader({ value = 75, height = 80, label }) {
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
          background: T.bg4,
          borderLeft: `1px solid ${T.bevelDark}`,
        }} />
        <div style={{
          position: "absolute",
          left: 1, right: 1, top: "44%",
          height: 1, background: T.accentBlue, opacity: 0.4,
        }} />
        <div style={{
          position: "absolute",
          left: -4,
          top: Math.round((1 - value / 100) * (height - 16)),
          width: 20, height: 13,
          background: T.bg3,
          borderTop:    `1px solid ${T.bevelLight}`,
          borderLeft:   `1px solid ${T.bevelLight}`,
          borderBottom: `1px solid ${T.bevelDark}`,
          borderRight:  `1px solid ${T.bevelDark}`,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 2,
        }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 1, height: 7, background: T.bevelDark, borderRight: `1px solid ${T.bevelLight}` }} />
          ))}
        </div>
      </div>
      {label && <span style={{ fontFamily: T.fontMono, fontSize: 7, color: T.textLo, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>}
    </Col>
  );
}

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
                // Light theme: off segments are a visible warm gray, not invisible
                background: lit ? T.vuColors[idx] : "#c8c4bc",
                borderTop: lit ? "1px solid rgba(255,255,255,0.4)" : `1px solid ${T.bevelLight}`,
                borderBottom: `1px solid rgba(0,0,0,0.15)`,
                borderLeft: "none", borderRight: "none",
              }} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function LCD({ value, unit }) {
  return (
    <div style={{
      fontFamily: T.fontMono, fontSize: 9,
      // LCD on light: warm cream background like old LCD displays in daylight
      color: "#205038",
      background: "#d8e8d0",
      padding: "2px 5px",
      borderTop:    `1px solid ${T.bevelDark}`,
      borderLeft:   `1px solid ${T.bevelDark}`,
      borderBottom: `1px solid #e8f0e0`,
      borderRight:  `1px solid #e8f0e0`,
      display: "inline-block",
      minWidth: 40,
      textAlign: "right",
      letterSpacing: "0.05em",
    }}>
      {value}<span style={{ fontSize: 7, color: "#406858", marginLeft: 2 }}>{unit}</span>
    </div>
  );
}

function DemoInput({ placeholder }) {
  return (
    <input
      placeholder={placeholder}
      style={{
        fontFamily: T.fontMono, fontSize: 8,
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

function PanelDemo({ label, bevel, bg }) {
  return (
    <div style={{ padding: "8px 10px", background: bg, ...bevel, width: 100 }}>
      <span style={{ fontFamily: T.fontMono, fontSize: 7, color: T.textLo, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
    </div>
  );
}

function TypeDemo({ size, role, sample, color }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
      <span style={{ fontFamily: T.fontMono, fontSize: 7, color: T.textDim, width: 60, textTransform: "uppercase", letterSpacing: "0.1em" }}>{role}</span>
      <span style={{ fontFamily: T.fontMono, fontSize: size, color: color || T.textHi, letterSpacing: "0.08em" }}>{sample}</span>
      <span style={{ fontFamily: T.fontMono, fontSize: 7, color: T.textGhost }}>{size}px</span>
    </div>
  );
}

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

// ── MAIN ─────────────────────────────────────────────────────
export default function StyleguideLight() {
  return (
    <div style={{ background: T.bg1, minHeight: "100vh", padding: 24, fontFamily: T.fontMono }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          padding: "6px 12px",
          background: "linear-gradient(to right, #b8c8d8, #c8d8e8)",
          borderTop:    `1px solid ${T.bevelLight}`,
          borderLeft:   `1px solid ${T.bevelLight}`,
          borderBottom: `1px solid ${T.bevelDark}`,
          borderRight:  `1px solid ${T.bevelDark}`,
          display: "inline-block",
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 9, color: "#182838", letterSpacing: "0.2em", textTransform: "uppercase" }}>Canvas DAW</span>
          <span style={{ fontSize: 9, color: "#485868", letterSpacing: "0.1em", marginLeft: 12 }}>Vintage Console — Light</span>
          <span style={{ fontSize: 8, color: "#788898", marginLeft: 12 }}>Styleguide v0.1</span>
        </div>
        <div style={{ fontSize: 8, color: T.textDim, letterSpacing: "0.08em", lineHeight: 1.8 }}>
          Color reference: Windows 7 Aero warm gray · HP monitor default · WinAmp classic light skin<br />
          Same rules as dark. Warm gray surfaces instead of deep blue-black.<br />
          LCD readout gets the green-on-cream treatment — like a hardware display in a bright room.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, columnGap: 24 }}>

        {/* LEFT */}
        <div>
          <Section title="Design Rules — Light Addenda">
            <Rule number={1}  text="All dark theme rules apply. No box-shadow, no border-radius on rectangles, no transitions." />
            <Rule number={2}  text="Bevel light edge is pure white (#ffffff). Shadow edge is warm gray (#787068). Same physics, brighter contrast." />
            <Rule number={3}  text="Surfaces use a warm gray scale with a slight yellow undertone — not cool blue-gray, not stark white. Think HP monitor out of the box." />
            <Rule number={4}  text="Knob highlight opacity increases to ~0.5 on light (was 0.07 on dark). The highlight is more visible and earns its keep." />
            <Rule number={5}  text="VU off-segments are visible warm gray (#c8c4bc), not near-black. On a light surface, invisible segments look broken." />
            <Rule number={6}  text="LCD readout uses green-on-cream (#205038 on #d8e8d0) — the color of a hardware display in a lit room, not a dark studio." />
            <Rule number={7}  text="Title bar gradient flips to a cool steel blue (#b8c8d8 → #c8d8e8) — the one place color punches against the warm gray field." />
            <Rule number={8}  text="Accent colors shift darker: accentBlue #1870a8, accentMaster #b06800. Same hues, more contrast against light backgrounds." />
            <Rule number={9}  text="Channel color strips remain the same hue family but feel more saturated against the light surface. Do not desaturate them." />
            <Rule number={10} text="Information density stays identical. Light mode is not an excuse to space things out or round the corners." />
          </Section>

          <Section title="Color Palette — Surfaces">
            <Label sub>Background Scale — Warm Gray</Label>
            <Row gap={8} style={{ marginBottom: 16 }}>
              <Swatch color={T.bg0} name="bg0" role="Paper white" />
              <Swatch color={T.bg1} name="bg1" role="App bg" />
              <Swatch color={T.bg2} name="bg2" role="Panel" />
              <Swatch color={T.bg3} name="bg3" role="Strip inactive" />
              <Swatch color={T.bg4} name="bg4" role="Strip active" />
              <Swatch color={T.bg5} name="bg5" role="Recessed" />
            </Row>
            <Label sub>Bevel System</Label>
            <Row gap={8} style={{ marginBottom: 16 }}>
              <Swatch color={T.bevelLight} name="bevelLight" role="top / left" />
              <Swatch color={T.bevelMid}   name="bevelMid"   role="neutral" />
              <Swatch color={T.bevelDark}  name="bevelDark"  role="bottom / right" />
            </Row>
            <Label sub>Accent — Channel Identity</Label>
            <Row gap={8} style={{ marginBottom: 16 }}>
              <Swatch color={T.accentMaster} name="Master" role="Burnt amber" />
              <Swatch color={T.accentBlue}   name="Blue"   role="Steel blue" />
              <Swatch color={T.accentGreen}  name="Green"  role="Forest" />
              <Swatch color={T.accentPurple} name="Purple" role="Violet" />
              <Swatch color={T.accentOrange} name="Orange" role="Rust" />
            </Row>
            <Label sub>State Colors</Label>
            <Row gap={8}>
              <Swatch color={T.stateRed}   name="Mute"     role="Active mute" />
              <Swatch color={T.stateGreen} name="Solo/Sig"  role="Solo / signal" />
              <Swatch color={T.stateAmber} name="Warn"     role="-6dB warning" />
              <Swatch color={T.stateHot}   name="Clip"     role="0dB / clip" />
            </Row>
          </Section>

          <Section title="Typography">
            <div style={{ marginBottom: 8, fontSize: 7, color: T.textDim, letterSpacing: "0.08em" }}>
              Font family unchanged: 'Courier New', Courier, monospace. No web fonts.
            </div>
            <Col gap={10}>
              <TypeDemo size={9}  role="Title bar"   sample="MIXER — MASTER"       color="#182838" />
              <TypeDemo size={8}  role="Label"       sample="CHANNEL NAME"         color={T.textMid} />
              <TypeDemo size={8}  role="LCD readout" sample="-6.0 dB"              color="#205038" />
              <TypeDemo size={7}  role="Secondary"   sample="INSERT / SEND"        color={T.textLo} />
              <TypeDemo size={7}  role="Knob label"  sample="PAN   VOL   ATK"      color={T.textLo} />
              <TypeDemo size={7}  role="Tertiary"    sample="44100 Hz · 32-bit · ASIO" color={T.textDim} />
              <TypeDemo size={6}  role="Ghost"       sample="20Hz ————— 20kHz"     color={T.textGhost} />
            </Col>
            <div style={{ marginTop: 12, padding: "6px 8px", background: T.bg0, ...sunken }}>
              <div style={{ fontSize: 7, color: T.textDim, lineHeight: 1.8 }}>
                All typographic rules identical to dark theme.<br />
                Text colors scale from near-black (#181410) down to warm ghost (#b0aca8).<br />
                No color inversion quirks — warm gray text on warm gray bg reads cleanly at all levels.
              </div>
            </div>
          </Section>
        </div>

        {/* RIGHT */}
        <div>
          <Section title="Bevel System">
            <div style={{ marginBottom: 10, fontSize: 7, color: T.textDim, lineHeight: 1.8 }}>
              Same logic. Different materials. White catch light, warm gray shadow.
              The bevel is more visually prominent on light surfaces — lean into it.
            </div>
            <Row gap={16} style={{ marginBottom: 16 }}>
              <Col gap={6}>
                <PanelDemo label="Raised" bevel={raised} bg={T.bg3} />
                <div style={{ fontSize: 7, color: T.textDim }}>
                  <Code>borderTop: #ffffff</Code><br />
                  <Code>borderLeft: #ffffff</Code><br />
                  <Code>borderBottom: #787068</Code><br />
                  <Code>borderRight: #787068</Code>
                </div>
              </Col>
              <Col gap={6}>
                <PanelDemo label="Sunken" bevel={sunken} bg={T.bg0} />
                <div style={{ fontSize: 7, color: T.textDim }}>
                  <Code>borderTop: #787068</Code><br />
                  <Code>borderLeft: #787068</Code><br />
                  <Code>borderBottom: #ffffff</Code><br />
                  <Code>borderRight: #ffffff</Code>
                </div>
              </Col>
              <Col gap={6}>
                <PanelDemo label="Flat" bevel={flat} bg={T.bg2} />
                <div style={{ fontSize: 7, color: T.textDim }}>
                  <Code>border: 1px solid #a09c94</Code>
                </div>
              </Col>
              <Col gap={6}>
                <PanelDemo label="Flush" bevel={flush} bg={T.bg2} />
                <div style={{ fontSize: 7, color: T.textDim }}>
                  <Code>border: 1px solid #787068</Code>
                </div>
              </Col>
            </Row>
            <div style={{ padding: "6px 8px", background: T.bg0, ...sunken, fontSize: 7, color: T.textDim, lineHeight: 1.8 }}>
              Press state still inverts raised → sunken. Background shifts one step darker (bg3 → bg5).<br />
              The white top border disappearing on press is the entire "click" feedback. Trust it.
            </div>
          </Section>

          <Section title="Components">

            <Label>Buttons</Label>
            <Row gap={6} style={{ marginBottom: 16 }}>
              <DemoButton label="Default"  variant="default" />
              <DemoButton label="Toolbar"  variant="toolbar" />
              <DemoButton label="Mute"     variant="mute" />
              <DemoButton label="Solo"     variant="solo" />
              <DemoButton label="Active ↓" variant="default" active />
            </Row>

            <Label>Knobs</Label>
            <Row gap={16} style={{ marginBottom: 16 }}>
              <DemoKnob label="Vol"  color={T.accentMaster} value={80} size={32} />
              <DemoKnob label="Pan"  color={T.accentBlue}   value={50} size={28} />
              <DemoKnob label="Atk"  color={T.accentGreen}  value={30} size={26} />
              <DemoKnob label="Rel"  color={T.accentPurple} value={60} size={24} />
              <DemoKnob label="Frq"  color={T.accentOrange} value={70} size={22} />
            </Row>
            <div style={{ fontSize: 7, color: T.textDim, marginBottom: 16, lineHeight: 1.8 }}>
              Knob body: <Code>#c0bdb4</Code> — one step darker than bg3 so it reads as a physical object.<br />
              Highlight div opacity 0.5 (was 0.07 dark). The light catches more on a light surface.
            </div>

            <Label>Faders</Label>
            <Row gap={16} style={{ marginBottom: 16 }}>
              <DemoFader label="100%" value={100} height={80} />
              <DemoFader label="75%"  value={75}  height={80} />
              <DemoFader label="50%"  value={50}  height={80} />
              <DemoFader label="0dB"  value={50}  height={100} />
              <DemoFader label="Off"  value={0}   height={80} />
            </Row>
            <div style={{ fontSize: 7, color: T.textDim, marginBottom: 16, lineHeight: 1.8 }}>
              Grip lines use <Code>bevelDark</Code> + <Code>bevelLight</Code> pair — same trick, reads as engraved.<br />
              Track fill is <Code>bg0</Code> (paper white) — deepest surface, most contrast for the sunken well.
            </div>

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
              Off segments: <Code>#c8c4bc</Code> — warm gray, not invisible.<br />
              On a light surface, invisible off-segments look like broken hardware. Show the grid.
            </div>

            <Label>LCD Readouts & Inputs</Label>
            <Row gap={12}>
              <Col gap={6}>
                <LCD value="-6.0" unit="dB" />
                <LCD value="127"  unit="BPM" />
                <LCD value="1:01:000" unit="" />
              </Col>
              <Col gap={6}>
                <DemoInput placeholder="Track name..." />
                <DemoInput placeholder="Search patches..." />
              </Col>
            </Row>
            <div style={{ fontSize: 7, color: T.textDim, marginTop: 8, lineHeight: 1.8 }}>
              LCD: green-on-cream (<Code>#205038</Code> on <Code>#d8e8d0</Code>).<br />
              Not green-on-black. In a lit room, that's how these displays actually looked.
            </div>

          </Section>

          <Section title="Side by Side — Key Differences">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                ["bg1 (app)", "#0a0f16", T.bg1],
                ["bevelLight", "#4a6680", T.bevelLight],
                ["bevelDark",  "#0a1018", T.bevelDark],
                ["textHi",    "#8ab0d0", T.textHi],
                ["LCD bg",    "#060a0f", "#d8e8d0"],
                ["LCD text",  "#3a6888", "#205038"],
                ["Knob body", "#253040", "#c0bdb4"],
                ["VU off",    "#0e1620", "#c8c4bc"],
              ].map(([label, dark, light]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 20, height: 14, background: dark, ...raised, flexShrink: 0 }} />
                  <div style={{ fontFamily: T.fontMono, fontSize: 7, color: T.textDim, width: 6 }}>→</div>
                  <div style={{ width: 20, height: 14, background: light, ...raised, flexShrink: 0 }} />
                  <span style={{ fontFamily: T.fontMono, fontSize: 7, color: T.textLo }}>{label}</span>
                </div>
              ))}
            </div>
          </Section>

        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 16, padding: "4px 8px",
        background: T.bg0,
        borderTop: `1px solid ${T.bevelDark}`,
        display: "flex", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 7, color: T.textGhost }}>Canvas DAW · Vintage Console Light · Styleguide v0.1</span>
        <span style={{ fontSize: 7, color: T.textGhost }}>Same rules. Different room. Still running on a Pentium in your head.</span>
      </div>

    </div>
  );
}
