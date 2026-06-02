import { useState, useEffect, useRef } from "react";

// ============================================================
// CANVAS DAW — NOVA THEME
// Aesthetic: 2026 modern DAW. Flat but alive. Color-forward.
//   Dynamic. Reactive. Every interaction has a response.
//   Influenced by: Bitwig 5, Figma, Linear, Apple visionOS.
//   This is software that knows it's running in a browser in 2026.
// ============================================================

const T = {
  // Surfaces — cool dark, slight blue-purple tint
  s0: "#09090d",   // void
  s1: "#111116",   // app background
  s2: "#18181f",   // panel
  s3: "#202028",   // card / raised
  s4: "#28282f",   // elevated

  // Borders — transparent white overlay system
  border0: "rgba(255,255,255,0.04)",
  border1: "rgba(255,255,255,0.08)",
  border2: "rgba(255,255,255,0.14)",
  border3: "rgba(255,255,255,0.22)",

  // Primary palette — electric violet
  primary:      "#7c5cfc",
  primaryHover: "#8f72fd",
  primaryDim:   "rgba(124,92,252,0.15)",
  primaryGlow:  "rgba(124,92,252,0.3)",

  // Semantic colors
  teal:    "#00d4aa",
  coral:   "#ff5c6e",
  amber:   "#ffad2e",
  mint:    "#00e676",
  sky:     "#38bdf8",
  rose:    "#f472b6",

  // Track identity colors — rich, saturated
  tracks: [
    "#7c5cfc",  // violet
    "#00d4aa",  // teal
    "#ff5c6e",  // coral
    "#ffad2e",  // amber
    "#38bdf8",  // sky
    "#f472b6",  // rose
    "#a3e635",  // lime
    "#fb923c",  // orange
  ],

  // Text — pure white scale
  t1: "rgba(255,255,255,0.95)",
  t2: "rgba(255,255,255,0.6)",
  t3: "rgba(255,255,255,0.35)",
  t4: "rgba(255,255,255,0.18)",

  // Typography — modern system stack
  font: "system-ui, -apple-system, 'SF Pro Display', 'Segoe UI Variable', sans-serif",
  fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",

  // Transitions — everything moves
  ease: "cubic-bezier(0.4, 0, 0.2, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",

  // Radius
  r1: 4,
  r2: 8,
  r3: 12,
  rFull: 9999,
};

// Glass panel — the 2026 material
const glassBg = `rgba(255,255,255,0.03)`;
const glassBlur = "blur(20px)";

function Row({ children, gap = 12 }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap, alignItems: "flex-start" }}>{children}</div>;
}
function Col({ children, gap = 10 }) {
  return <div style={{ display: "flex", flexDirection: "column", gap }}>{children}</div>;
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 12,
      }}>
        <div style={{ width: 3, height: 14, background: T.primary, borderRadius: 2 }} />
        <span style={{
          fontFamily: T.font, fontSize: 10, fontWeight: 600,
          color: T.t2, letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          {title}
        </span>
      </div>
      <div style={{
        padding: 16,
        background: T.s2,
        border: `1px solid ${T.border1}`,
        borderRadius: T.r3,
      }}>
        {children}
      </div>
    </div>
  );
}

function Swatch({ color, name, hex }) {
  return (
    <div style={{ width: 76 }}>
      <div style={{
        width: 76, height: 36,
        background: color,
        borderRadius: T.r2,
        border: `1px solid ${T.border1}`,
        marginBottom: 4,
      }} />
      <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 500, color: T.t2 }}>{name}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.t3 }}>{hex || color}</div>
    </div>
  );
}

// Modern flat button — 3 variants
function Btn({ label, variant = "default", color, active, icon, size = "md" }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const c = color || T.primary;

  const styles = {
    default: {
      background: hovered ? T.s4 : T.s3,
      border: `1px solid ${hovered ? T.border2 : T.border1}`,
      color: T.t1,
    },
    filled: {
      background: pressed ? c + "cc" : hovered ? c + "ee" : c,
      border: `1px solid transparent`,
      color: "#ffffff",
      boxShadow: hovered && !pressed ? `0 0 16px ${c}55` : "none",
    },
    ghost: {
      background: hovered ? c + "18" : "transparent",
      border: `1px solid ${hovered || active ? c + "60" : T.border1}`,
      color: active ? c : hovered ? T.t1 : T.t2,
    },
    pill: {
      background: active ? c + "25" : hovered ? T.s4 : "transparent",
      border: `1px solid ${active ? c + "50" : T.border1}`,
      color: active ? c : T.t3,
      borderRadius: T.rFull,
    },
  };

  const pad = size === "sm" ? "3px 8px" : size === "lg" ? "8px 18px" : "5px 12px";
  const fs = size === "sm" ? 9 : size === "lg" ? 11 : 10;

  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        fontFamily: T.font, fontSize: fs, fontWeight: 500,
        padding: pad,
        borderRadius: variant === "pill" ? T.rFull : T.r2,
        cursor: "pointer",
        letterSpacing: "0.02em",
        transition: `all 0.15s ${T.ease}`,
        transform: pressed ? "scale(0.97)" : "scale(1)",
        display: "flex", alignItems: "center", gap: 5,
        ...styles[variant],
      }}
    >
      {icon && <span style={{ fontSize: fs + 1 }}>{icon}</span>}
      {label}
    </button>
  );
}

// Modern arc knob
function ArcKnob({ label, value = 65, color, size = 36 }) {
  const [val, setVal] = useState(value);
  const [hovered, setHovered] = useState(false);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);
  const c = color || T.primary;

  const angle = -135 + (val / 100) * 270;
  const startAngle = -135;
  const r = size / 2 - 4;
  const cx = size / 2, cy = size / 2;

  // Arc path
  const polarToXY = (a, radius) => {
    const rad = (a - 90) * Math.PI / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };
  const start = polarToXY(startAngle + 360, r);
  const end = polarToXY(angle + 360, r);
  const largeArc = (val / 100) * 270 > 180 ? 1 : 0;

  const onMouseDown = (e) => {
    dragging.current = true;
    startY.current = e.clientY;
    startVal.current = val;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const onMove = (e) => {
    if (!dragging.current) return;
    const delta = (startY.current - e.clientY);
    setVal(Math.max(0, Math.min(100, startVal.current + delta)));
  };
  const onUp = () => {
    dragging.current = false;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };

  return (
    <Col gap={3} style={{ alignItems: "center" }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onMouseDown={onMouseDown}
        style={{
          width: size, height: size,
          position: "relative",
          cursor: "ns-resize",
          transition: `transform 0.15s ${T.spring}`,
          transform: hovered ? "scale(1.08)" : "scale(1)",
        }}
      >
        <svg width={size} height={size}>
          {/* Track */}
          <path
            d={`M ${polarToXY(startAngle + 360, r).x} ${polarToXY(startAngle + 360, r).y}
                A ${r} ${r} 0 1 1 ${polarToXY(45 + 360, r).x} ${polarToXY(45 + 360, r).y}`}
            fill="none" stroke={T.border2} strokeWidth={2.5}
            strokeLinecap="round"
          />
          {/* Active arc */}
          {val > 0 && (
            <path
              d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`}
              fill="none" stroke={c} strokeWidth={2.5}
              strokeLinecap="round"
              style={{ filter: hovered ? `drop-shadow(0 0 4px ${c})` : "none", transition: `filter 0.2s` }}
            />
          )}
          {/* Center dot */}
          <circle cx={cx} cy={cy} r={size / 2 - 8}
            fill={T.s3}
            stroke={T.border2} strokeWidth={1}
          />
          {/* Indicator line */}
          <line
            x1={cx} y1={cy}
            x2={cx + (size / 2 - 10) * Math.cos((angle - 90) * Math.PI / 180)}
            y2={cy + (size / 2 - 10) * Math.sin((angle - 90) * Math.PI / 180)}
            stroke={hovered ? c : T.t3}
            strokeWidth={1.5}
            strokeLinecap="round"
            style={{ transition: `stroke 0.15s` }}
          />
        </svg>
      </div>
      {label && (
        <span style={{
          fontFamily: T.font, fontSize: 8, fontWeight: 500,
          color: T.t3, textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          {label}
        </span>
      )}
    </Col>
  );
}

// Modern fader — thin track, pill thumb
function ModFader({ value = 75, height = 120, color }) {
  const [val, setVal] = useState(value);
  const [hovered, setHovered] = useState(false);
  const trackRef = useRef(null);
  const dragging = useRef(false);
  const c = color || T.primary;

  const thumbY = Math.round((1 - val / 100) * (height - 20));

  const onMouseDown = () => {
    dragging.current = true;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const onMove = (e) => {
    if (!dragging.current || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    setVal(Math.round((1 - y / rect.height) * 100));
  };
  const onUp = () => {
    dragging.current = false;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };

  return (
    <div
      ref={trackRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={onMouseDown}
      style={{
        width: 4, height,
        background: T.border1,
        borderRadius: T.rFull,
        position: "relative",
        cursor: "ns-resize",
        margin: "0 10px",
      }}
    >
      {/* Fill */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: `${val}%`,
        background: `linear-gradient(to top, ${c}, ${c}60)`,
        borderRadius: T.rFull,
        transition: "height 0.05s",
      }} />
      {/* Thumb */}
      <div style={{
        position: "absolute",
        left: "50%",
        top: thumbY,
        transform: "translateX(-50%)",
        width: hovered ? 18 : 16,
        height: 18,
        background: T.t1,
        borderRadius: T.rFull,
        border: `2px solid ${hovered ? c : T.border3}`,
        transition: `all 0.15s ${T.spring}`,
        boxShadow: hovered ? `0 0 10px ${c}66` : `0 2px 6px rgba(0,0,0,0.4)`,
      }} />
    </div>
  );
}

// Gradient VU meter — thin, colorful
function NovaMeter({ level = 7, color }) {
  const c = color || T.mint;
  return (
    <div style={{
      width: 4, height: 60,
      background: T.border0,
      borderRadius: T.rFull,
      overflow: "hidden",
      position: "relative",
    }}>
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: `${(level / 12) * 100}%`,
        background: level >= 11 ? T.coral : level >= 9 ? T.amber : `linear-gradient(to top, ${c}, ${c}80)`,
        borderRadius: T.rFull,
        transition: "height 0.08s",
        boxShadow: level > 3 ? `0 0 6px ${c}80` : "none",
      }} />
    </div>
  );
}

// The modern channel strip
function NovaChannel({ name, color, volume = 75, pan = 50, muted, solo }) {
  const [m, setM] = useState(muted || false);
  const [s, setS] = useState(solo || false);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 64,
        background: T.s2,
        border: `1px solid ${hovered ? T.border2 : T.border1}`,
        borderRadius: T.r3,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transition: `border-color 0.2s`,
      }}
    >
      {/* Color header */}
      <div style={{
        width: "100%",
        height: 4,
        background: m ? T.border2 : color,
        transition: "background 0.2s",
      }} />

      <div style={{ padding: "6px 4px", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        {/* Name */}
        <span style={{
          fontFamily: T.font, fontSize: 8, fontWeight: 600,
          color: m ? T.t4 : T.t2,
          textTransform: "uppercase", letterSpacing: "0.06em",
          transition: "color 0.2s",
        }}>
          {name}
        </span>

        {/* Meters */}
        <div style={{ display: "flex", gap: 3 }}>
          <NovaMeter level={m ? 0 : Math.round(volume * 0.12)} color={color} />
          <NovaMeter level={m ? 0 : Math.round(volume * 0.11)} color={color} />
        </div>

        {/* Pan */}
        <ArcKnob value={pan} color={m ? T.t4 : color} size={30} label="PAN" />

        {/* Fader */}
        <ModFader value={volume} height={90} color={m ? T.t3 : color} />

        {/* dB */}
        <span style={{
          fontFamily: T.fontMono, fontSize: 8,
          color: m ? T.t4 : T.t2,
          background: T.s1,
          padding: "1px 5px",
          borderRadius: T.r1,
          border: `1px solid ${T.border1}`,
        }}>
          {m ? "−∞" : ((volume / 100 * 12 - 6).toFixed(1))}
        </span>

        {/* M/S */}
        <div style={{ display: "flex", gap: 3 }}>
          {[["M", m, T.coral, () => setM(!m)], ["S", s, T.mint, () => setS(!s)]].map(([l, on, c, fn]) => (
            <button key={l} onClick={fn} style={{
              width: 22, height: 16,
              fontFamily: T.font, fontSize: 8, fontWeight: 700,
              background: on ? c + "25" : "transparent",
              border: `1px solid ${on ? c + "60" : T.border1}`,
              borderRadius: T.r1,
              color: on ? c : T.t4,
              cursor: "pointer",
              transition: `all 0.15s ${T.ease}`,
              boxShadow: on ? `0 0 8px ${c}44` : "none",
            }}>{l}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Mini arrangement view
function NovaArrangement() {
  const tracks = [
    { name: "KICK", color: T.tracks[0], clips: [[0,4],[8,6],[20,4],[28,4]] },
    { name: "SNARE", color: T.tracks[1], clips: [[2,3],[10,5],[22,3]] },
    { name: "HI-HAT", color: T.tracks[2], clips: [[0,8],[12,8],[24,8]] },
    { name: "BASS", color: T.tracks[3], clips: [[4,6],[16,6]] },
    { name: "LEAD SYNTH", color: T.tracks[4], clips: [[8,8],[24,6]] },
  ];

  const BARS = 32, CW = 13, LH = 20, LW = 60;

  return (
    <div style={{ background: T.s1, borderRadius: T.r2, overflow: "hidden", border: `1px solid ${T.border1}` }}>
      {/* Ruler */}
      <div style={{ display: "flex", borderBottom: `1px solid ${T.border1}` }}>
        <div style={{ width: LW, flexShrink: 0, background: T.s2, borderRight: `1px solid ${T.border1}` }} />
        <div style={{ flex: 1, height: 16, position: "relative", background: T.s2 }}>
          <svg width={BARS * CW} height={16}>
            {Array.from({ length: BARS + 1 }).map((_, i) => (
              <g key={i}>
                <line x1={i*CW} y1={i%4===0?4:8} x2={i*CW} y2={16}
                  stroke={i%4===0 ? T.t3 : T.border2} strokeWidth={0.5} />
                {i%4===0 && i>0 && (
                  <text x={i*CW+2} y={12} fontFamily={T.font} fontSize={7} fill={T.t3} fontWeight={500}>{i}</text>
                )}
              </g>
            ))}
          </svg>
        </div>
      </div>

      {tracks.map((track, ti) => (
        <div key={ti} style={{
          display: "flex",
          borderBottom: `1px solid ${ti === tracks.length-1 ? "transparent" : T.border0}`,
          height: LH,
        }}>
          <div style={{
            width: LW, flexShrink: 0,
            display: "flex", alignItems: "center",
            paddingLeft: 8, gap: 5,
            background: T.s2,
            borderRight: `1px solid ${T.border1}`,
          }}>
            <div style={{ width: 3, height: 10, background: track.color, borderRadius: 2 }} />
            <span style={{ fontFamily: T.font, fontSize: 8, fontWeight: 600, color: T.t2, letterSpacing: "0.04em" }}>
              {track.name}
            </span>
          </div>
          <div style={{ flex: 1, background: T.s1, position: "relative" }}>
            <svg width={BARS * CW} height={LH}>
              {Array.from({ length: BARS + 1 }).map((_, i) => (
                <line key={i} x1={i*CW} y1={0} x2={i*CW} y2={LH}
                  stroke={i%4===0 ? T.border1 : T.border0} strokeWidth={0.5} />
              ))}
              {track.clips.map(([s, l], ci) => (
                <g key={ci}>
                  <rect x={s*CW+1} y={2} width={l*CW-2} height={LH-4}
                    fill={track.color + "30"} rx={2}
                    stroke={track.color + "80"} strokeWidth={1} />
                  <rect x={s*CW+1} y={2} width={l*CW-2} height={3}
                    fill={track.color + "60"} rx={2} />
                </g>
              ))}
              <line x1={8*CW} y1={0} x2={8*CW} y2={LH} stroke={T.primary} strokeWidth={1} opacity={0.8} />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NovaStyleguide() {
  return (
    <div style={{ background: T.s1, minHeight: "100vh", padding: 24, fontFamily: T.font }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36,
            background: `linear-gradient(135deg, ${T.primary}, ${T.teal})`,
            borderRadius: T.r2,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 20px ${T.primary}66`,
          }}>
            <span style={{ fontFamily: T.font, fontSize: 13, fontWeight: 800, color: "#fff" }}>C</span>
          </div>
          <div>
            <div style={{ fontFamily: T.font, fontSize: 16, fontWeight: 700, color: T.t1, letterSpacing: "-0.01em" }}>
              Canvas DAW
            </div>
            <div style={{ fontFamily: T.font, fontSize: 10, color: T.t3, letterSpacing: "0.04em" }}>
              Nova Theme · v0.1 · 2026
            </div>
          </div>
        </div>
        <div style={{ fontSize: 10, color: T.t3, lineHeight: 1.8 }}>
          Modern flat DAW design. Color-forward. Every interaction responds. Transitions everywhere.<br />
          Influenced by Bitwig 5, Figma, Linear. Designed for screens, not hardware emulation.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* LEFT */}
        <div>
          {/* Arrangement */}
          <Section title="Arrangement View">
            <NovaArrangement />
            <div style={{ fontSize: 9, color: T.t3, marginTop: 8, lineHeight: 1.7 }}>
              Tracks have color identity. Clips use the track color at low opacity with a colored top edge.<br />
              Playhead is primary violet. Grid lines are transparent-white overlays.
            </div>
          </Section>

          {/* Mixer */}
          <Section title="Mixer — Channel Strips">
            <Row gap={4} style={{ alignItems: "flex-start" }}>
              {[
                { name: "MASTER", color: T.tracks[0], volume: 85, pan: 50 },
                { name: "KICK",   color: T.tracks[1], volume: 92, pan: 45 },
                { name: "SNARE",  color: T.tracks[2], volume: 78, pan: 55 },
                { name: "BASS",   color: T.tracks[3], volume: 88, pan: 48 },
                { name: "LEAD",   color: T.tracks[4], volume: 72, pan: 58, muted: true },
              ].map((ch, i) => <NovaChannel key={i} {...ch} />)}
            </Row>
            <div style={{ fontSize: 9, color: T.t3, marginTop: 10, lineHeight: 1.7 }}>
              4px color header. Fader fill gradient matches track color. Meters glow in track color.<br />
              Muted state desaturates everything. M/S use semantic colors (coral/mint).
            </div>
          </Section>
        </div>

        {/* RIGHT */}
        <div>

          {/* Color system */}
          <Section title="Color System">
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: T.t3, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Surfaces
              </div>
              <Row gap={6}>
                {[["s0","#09090d"],["s1","#111116"],["s2","#18181f"],["s3","#202028"],["s4","#28282f"]].map(([n,c]) => (
                  <Swatch key={n} color={c} name={n} hex={c} />
                ))}
              </Row>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: T.t3, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Semantic
              </div>
              <Row gap={6}>
                <Swatch color={T.primary} name="primary" hex="#7c5cfc" />
                <Swatch color={T.teal}    name="teal"    hex="#00d4aa" />
                <Swatch color={T.coral}   name="coral"   hex="#ff5c6e" />
                <Swatch color={T.amber}   name="amber"   hex="#ffad2e" />
                <Swatch color={T.mint}    name="mint"    hex="#00e676" />
                <Swatch color={T.sky}     name="sky"     hex="#38bdf8" />
              </Row>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 600, color: T.t3, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Track Colors
              </div>
              <Row gap={4}>
                {T.tracks.map((c, i) => (
                  <div key={i} style={{
                    width: 28, height: 28,
                    background: c,
                    borderRadius: T.r2,
                    boxShadow: `0 0 10px ${c}66`,
                  }} />
                ))}
              </Row>
            </div>
          </Section>

          {/* Buttons */}
          <Section title="Buttons">
            <div style={{ fontSize: 9, color: T.t3, marginBottom: 12, lineHeight: 1.7 }}>
              Four variants. All transition on hover. Filled has a glow. Ghost activates with color fill.
              Transforms on press (scale 0.97). Try hovering each.
            </div>
            <Col gap={10}>
              <div>
                <div style={{ fontSize: 8, color: T.t4, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Default</div>
                <Row gap={6}>
                  <Btn label="Load Sample" icon="↑" />
                  <Btn label="Export" />
                  <Btn label="Settings" icon="⚙" />
                </Row>
              </div>
              <div>
                <div style={{ fontSize: 8, color: T.t4, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Filled</div>
                <Row gap={6}>
                  <Btn label="▶ Play" variant="filled" color={T.mint} />
                  <Btn label="● Record" variant="filled" color={T.coral} />
                  <Btn label="Render" variant="filled" size="lg" />
                </Row>
              </div>
              <div>
                <div style={{ fontSize: 8, color: T.t4, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Ghost / Pill</div>
                <Row gap={6}>
                  <Btn label="PAT" variant="pill" />
                  <Btn label="SONG" variant="pill" active />
                  <Btn label="EQ" variant="ghost" color={T.teal} />
                  <Btn label="COMP" variant="ghost" color={T.sky} active />
                </Row>
              </div>
            </Col>
          </Section>

          {/* Knobs */}
          <Section title="Arc Knobs">
            <div style={{ fontSize: 9, color: T.t3, marginBottom: 12, lineHeight: 1.7 }}>
              No bevel. Arc track shows range. Active arc in track color. Scale up on hover.
              Glow on hover matches arc color.
            </div>
            <Row gap={16}>
              <ArcKnob label="MASTER" value={80} color={T.tracks[0]} size={44} />
              <ArcKnob label="VOL"    value={75} color={T.tracks[1]} size={38} />
              <ArcKnob label="PAN"    value={50} color={T.tracks[2]} size={32} />
              <ArcKnob label="ATK"    value={30} color={T.tracks[3]} size={28} />
              <ArcKnob label="CUT"    value={65} color={T.tracks[4]} size={26} />
              <ArcKnob label="RES"    value={40} color={T.tracks[5]} size={24} />
            </Row>
          </Section>

          {/* Typography */}
          <Section title="Typography">
            <div style={{ fontSize: 9, color: T.t3, marginBottom: 10, lineHeight: 1.7 }}>
              system-ui / SF Pro — the native OS font. Weights do the work, not decoration.
              Mono for values only.
            </div>
            <Col gap={10}>
              {[
                [22, T.t1, 700, T.font, "Canvas DAW", "-0.02em"],
                [15, T.t1, 600, T.font, "Arrangement Canvas", "-0.01em"],
                [12, T.t2, 500, T.font, "LANE 1 — ARRANGER SLOT", "0.02em"],
                [10, T.t2, 500, T.font, "Insert FX · Reverb · Delay", "0"],
                [10, T.t3, 400, T.font, "44100 Hz · 32-bit float · ASIO", "0"],
                [11, T.mint, 500, T.fontMono, "−6.0 dB", "0.04em"],
                [10, T.primary, 600, T.fontMono, "1:01:000", "0.04em"],
              ].map(([size, color, weight, font, sample, ls], i) => (
                <div key={i} style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
                  <span style={{ fontFamily: T.font, fontSize: 8, color: T.t4, width: 36 }}>{size}px/{weight}</span>
                  <span style={{ fontFamily: font, fontSize: size, color, fontWeight: weight, letterSpacing: ls }}>{sample}</span>
                </div>
              ))}
            </Col>
          </Section>

          {/* Rules */}
          <Section title="Design Rules">
            {[
              ["Color tells the story.", "Each track owns a color. That color appears on the header, clips, fader fill, meter glow, and knob arc."],
              ["Transitions everywhere.", `0.15s ${T.ease} on hover states. 0.15s spring on press. Nothing snaps.`],
              ["Surfaces through opacity.", "Depth is rgba white overlays on a dark base, not different hex values."],
              ["Arc knobs, not bevel knobs.", "The indicator is an SVG arc. The value is shown by how much arc is filled."],
              ["Pill thumb faders.", "Thin 4px track, rounded pill thumb. Clean. The fill gradient shows the level."],
              ["Glow is semantic.", "box-shadow glow only on active states and hover — never decorative."],
              ["No bevels, no chrome.", "Box-shadow allowed for glow. Gradients allowed for fills. No skeuomorphic surfaces."],
              ["Weight-based hierarchy.", "700 for display. 600 for headings. 500 for labels. 400 for meta. No decoration needed."],
            ].map(([rule, desc], i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 7 }}>
                <span style={{
                  fontFamily: T.fontMono, fontSize: 8,
                  color: T.primary, width: 16, flexShrink: 0, opacity: 0.7,
                }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <span style={{ fontFamily: T.font, fontSize: 9, color: T.t1, fontWeight: 600 }}>{rule} </span>
                  <span style={{ fontFamily: T.font, fontSize: 9, color: T.t3 }}>{desc}</span>
                </div>
              </div>
            ))}
          </Section>

        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 12, padding: "8px 16px",
        background: T.s2,
        borderTop: `1px solid ${T.border1}`,
        borderRadius: T.r2,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontFamily: T.font, fontSize: 9, color: T.t3 }}>Canvas DAW · Nova Theme · v0.1</span>
        <div style={{ display: "flex", gap: 4 }}>
          {T.tracks.slice(0,5).map((c, i) => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: c, boxShadow: `0 0 4px ${c}` }} />
          ))}
        </div>
        <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.t3 }}>44100 Hz · 32-bit · ASIO</span>
      </div>
    </div>
  );
}
