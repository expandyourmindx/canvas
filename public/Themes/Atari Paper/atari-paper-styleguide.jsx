import { useState, useRef } from "react";

// ============================================================
// CANVAS DAW — ATARI PAPER THEME
// Reference: Steinberg Cubase on Atari ST, 1989–1993
// Aesthetic: Sheet music meets software. The DAW as drafting table.
//   Everything is ink on paper. The grid is sacred.
//   Color is reserved for meaning — selection and playhead only.
//   This isn't dark mode. This isn't light mode. This is no mode.
//   It just IS.
// ============================================================

const T = {
  // Paper — warm off-white. Not #fff. Like actual paper under a fluorescent light.
  // The Atari ST monochrome monitor had a slight warmth to its white.
  paper:      "#f0ede4",  // the page itself
  paperDark:  "#e4e1d8",  // sunken panels
  paperDeep:  "#d8d5cc",  // toolbar / chrome areas
  paperPanel: "#ccc9c0",  // deepest surface

  // Ink — what you draw with
  ink:        "#0d0d0d",  // primary — borders, text, note blocks
  inkMid:     "#484844",  // secondary — less critical labels
  inkLight:   "#888880",  // tertiary — grid, dividers
  inkGhost:   "#c0bdb4",  // barely there — background grid

  // Grid hierarchy
  gridBar:    "#5a5a54",  // bar lines — prominent
  gridBeat:   "#9a9890",  // beat lines — visible
  gridSub:    "#ccc9c0",  // subdivisions — subtle

  // The TWO accent colors. Nothing else gets color.
  selection:  "#0000b8",  // Atari GEM blue — selection, active, focus
  playhead:   "#b80000",  // playhead — always findable

  // Note blocks
  note:       "#1a1a18",  // filled note rectangle
  noteSelect: "#0000b8",  // selected note

  // Piano keys
  keyWhite:   "#f0ede4",  // white key — same as paper
  keyBlack:   "#1a1a18",  // black key — same as ink

  font:     "Geneva, 'MS Sans Serif', Tahoma, sans-serif",
  fontMono: "'Courier New', Courier, monospace",
};

// 1px ink border — the only border type
const inkBorder  = { border:  `1px solid ${T.ink}` };
const dimBorder  = { border:  `1px solid ${T.inkLight}` };
const ghostBorder = { border: `1px solid ${T.inkGhost}` };

// Atari GEM "raised" — barely there. Just a 1px white top/left on a gray surface.
// Not the full bevel system — this is much more subtle.
const gemRaised = {
  borderTop:    `1px solid ${T.paper}`,
  borderLeft:   `1px solid ${T.paper}`,
  borderBottom: `1px solid ${T.ink}`,
  borderRight:  `1px solid ${T.ink}`,
};
const gemSunken = {
  borderTop:    `1px solid ${T.ink}`,
  borderLeft:   `1px solid ${T.ink}`,
  borderBottom: `1px solid ${T.paper}`,
  borderRight:  `1px solid ${T.paper}`,
};

function Row({ children, gap = 10 }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap, alignItems: "flex-start" }}>{children}</div>;
}
function Col({ children, gap = 8 }) {
  return <div style={{ display: "flex", flexDirection: "column", gap }}>{children}</div>;
}

// Floating panel — 1px drop shadow, no blur. Pure Atari GEM.
function Panel({ title, children, style }) {
  return (
    <div style={{
      background: T.paper,
      ...inkBorder,
      // The GEM drop shadow: 1px offset, no blur, solid black
      boxShadow: `2px 2px 0 ${T.ink}`,
      ...style,
    }}>
      {title && (
        <div style={{
          background: T.ink,
          padding: "2px 6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span style={{ fontFamily: T.font, fontSize: 9, color: T.paper, letterSpacing: "0.04em" }}>
            {title}
          </span>
          {/* GEM close box */}
          <div style={{
            width: 10, height: 10,
            background: T.paper,
            ...inkBorder,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}>
            <div style={{ width: 4, height: 4, background: T.ink }} />
          </div>
        </div>
      )}
      <div style={{ padding: title ? 0 : 0 }}>{children}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        padding: "2px 8px",
        background: T.paperDeep,
        borderTop:    `1px solid ${T.paper}`,
        borderLeft:   `1px solid ${T.paper}`,
        borderBottom: `1px solid ${T.inkLight}`,
        borderRight:  `1px solid ${T.inkLight}`,
        marginBottom: 1,
      }}>
        <span style={{ fontFamily: T.font, fontSize: 9, color: T.ink, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {title}
        </span>
      </div>
      <div style={{
        padding: 14,
        background: T.paper,
        borderLeft:   `1px solid ${T.inkLight}`,
        borderRight:  `1px solid ${T.inkLight}`,
        borderBottom: `1px solid ${T.inkLight}`,
      }}>
        {children}
      </div>
    </div>
  );
}

function Swatch({ color, name, role }) {
  return (
    <div style={{ width: 80 }}>
      <div style={{ width: 80, height: 28, background: color, ...inkBorder }} />
      <div style={{ fontFamily: T.font, fontSize: 8, color: T.inkMid, marginTop: 2 }}>{name}</div>
      <div style={{ fontFamily: T.font, fontSize: 7, color: T.inkLight }}>{color}</div>
      {role && <div style={{ fontFamily: T.font, fontSize: 7, color: T.selection }}>{role}</div>}
    </div>
  );
}

// GEM button — plain rectangle, subtle raise
function GemButton({ label, active, wide, icon }) {
  const [pressed, setPressed] = useState(false);
  const on = pressed || active;
  return (
    <button
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        fontFamily: T.font, fontSize: 9,
        padding: "2px 8px",
        minWidth: wide ? 60 : 28,
        background: on ? T.ink : T.paperDeep,
        ...(on ? gemSunken : gemRaised),
        color: on ? T.paper : T.ink,
        cursor: "pointer",
        letterSpacing: "0.04em",
        display: "flex", alignItems: "center", gap: 3,
      }}
    >
      {icon && <span style={{ fontSize: 8 }}>{icon}</span>}
      {label}
    </button>
  );
}

// Transport button — chunky, like the Atari transport buttons
function TransportButton({ symbol, active, wide }) {
  const [pressed, setPressed] = useState(false);
  const on = pressed || active;
  return (
    <button
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        fontFamily: T.fontMono, fontSize: 11,
        width: wide ? 36 : 26, height: 22,
        background: on ? T.ink : T.paperDeep,
        ...(on ? gemSunken : gemRaised),
        color: on ? T.paper : T.ink,
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 0,
      }}
    >
      {symbol}
    </button>
  );
}

// LCD readout — black on paper, monospace
function Readout({ value, label, wide }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      ...gemSunken,
      padding: "1px 4px",
      background: T.paperDark,
      minWidth: wide ? 80 : 50,
    }}>
      {label && (
        <span style={{ fontFamily: T.font, fontSize: 6, color: T.inkLight, letterSpacing: "0.06em" }}>
          {label}
        </span>
      )}
      <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.ink, letterSpacing: "0.06em" }}>
        {value}
      </span>
    </div>
  );
}

// THE centerpiece — mini piano roll in Atari style
function PianoRoll() {
  const NOTES = ["C", "B", "A#", "A", "G#", "G", "F#", "F", "E", "D#", "D", "C#"];
  const BLACK = ["A#", "G#", "F#", "D#", "C#"];
  const ROWS = 24;
  const COLS = 32;
  const CELL_W = 14;
  const CELL_H = 10;
  const KEY_W = 28;

  // Some demo notes: [row, startCol, length]
  const noteData = [
    [2, 0, 4], [2, 8, 6], [2, 20, 4],
    [4, 2, 3], [4, 12, 5], [4, 22, 6],
    [6, 4, 4], [6, 16, 3],
    [7, 0, 2], [7, 6, 4], [7, 18, 5],
    [9, 3, 6], [9, 14, 4], [9, 26, 3],
    [10, 1, 3], [10, 10, 7], [10, 24, 4],
    [12, 5, 4], [12, 20, 5],
    [14, 0, 3], [14, 8, 6], [14, 22, 4],
    [15, 4, 5], [15, 16, 3],
    [17, 2, 4], [17, 12, 4], [17, 24, 5],
    [19, 6, 3], [19, 18, 6],
    [21, 1, 5], [21, 14, 4],
    [23, 3, 7], [23, 20, 4],
  ];

  const [playPos, setPlayPos] = useState(8);

  return (
    <div style={{ display: "flex", background: T.paper, ...inkBorder, overflow: "hidden" }}>

      {/* Piano keyboard */}
      <div style={{
        width: KEY_W,
        flexShrink: 0,
        background: T.paper,
        borderRight: `1px solid ${T.ink}`,
      }}>
        {Array.from({ length: ROWS }).map((_, i) => {
          const note = NOTES[i % 12];
          const isBlack = BLACK.includes(note);
          return (
            <div key={i} style={{
              height: CELL_H,
              background: isBlack ? T.keyBlack : T.keyWhite,
              borderBottom: `1px solid ${isBlack ? T.inkMid : T.inkGhost}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingRight: 3,
              position: "relative",
            }}>
              {!isBlack && (
                <span style={{
                  fontFamily: T.font, fontSize: 6,
                  color: T.inkMid,
                  lineHeight: 1,
                }}>
                  {note}{Math.floor((ROWS - i) / 12) + 3}
                </span>
              )}
              {isBlack && (
                <div style={{
                  position: "absolute", right: 0,
                  width: "65%", height: "100%",
                  background: T.keyBlack,
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Grid + notes */}
      <div style={{ position: "relative", overflow: "hidden" }}>
        {/* Background grid */}
        <svg
          width={COLS * CELL_W}
          height={ROWS * CELL_H}
          style={{ display: "block", position: "absolute", top: 0, left: 0 }}
        >
          {/* Row backgrounds - alternating for black/white keys */}
          {Array.from({ length: ROWS }).map((_, i) => {
            const note = NOTES[i % 12];
            const isBlack = BLACK.includes(note);
            return (
              <rect key={i}
                x={0} y={i * CELL_H}
                width={COLS * CELL_W} height={CELL_H}
                fill={isBlack ? T.paperDark : T.paper}
              />
            );
          })}

          {/* Vertical grid lines */}
          {Array.from({ length: COLS + 1 }).map((_, i) => {
            const isBar = i % 4 === 0;
            const isBeat = i % 2 === 0;
            return (
              <line key={i}
                x1={i * CELL_W} y1={0}
                x2={i * CELL_W} y2={ROWS * CELL_H}
                stroke={isBar ? T.gridBar : isBeat ? T.gridBeat : T.gridSub}
                strokeWidth={isBar ? 1 : 0.5}
              />
            );
          })}

          {/* Horizontal grid lines */}
          {Array.from({ length: ROWS + 1 }).map((_, i) => (
            <line key={i}
              x1={0} y1={i * CELL_H}
              x2={COLS * CELL_W} y2={i * CELL_H}
              stroke={T.inkGhost}
              strokeWidth={0.5}
            />
          ))}

          {/* Notes */}
          {noteData.map(([row, col, len], i) => (
            <g key={i}>
              <rect
                x={col * CELL_W + 1}
                y={row * CELL_H + 1}
                width={len * CELL_W - 2}
                height={CELL_H - 2}
                fill={T.note}
              />
              {/* Note highlight edge */}
              <rect
                x={col * CELL_W + 1}
                y={row * CELL_H + 1}
                width={len * CELL_W - 2}
                height={1}
                fill="rgba(255,255,255,0.2)"
              />
            </g>
          ))}

          {/* Playhead */}
          <line
            x1={playPos * CELL_W} y1={0}
            x2={playPos * CELL_W} y2={ROWS * CELL_H}
            stroke={T.playhead}
            strokeWidth={1}
          />
        </svg>

        {/* Invisible div for dimensions */}
        <div style={{ width: COLS * CELL_W, height: ROWS * CELL_H }} />
      </div>
    </div>
  );
}

// Arrangement view mini demo
function ArrangementView() {
  const lanes = [
    { name: "KICK", color: T.ink, clips: [[0,4],[8,6],[20,4],[28,4]] },
    { name: "SNARE", color: T.ink, clips: [[2,3],[10,5],[22,3]] },
    { name: "HI-HAT", color: T.ink, clips: [[0,8],[12,8],[24,8]] },
    { name: "BASS", color: T.ink, clips: [[4,6],[16,6]] },
    { name: "LEAD", color: T.ink, clips: [[8,4],[20,8]] },
  ];

  const BARS = 32;
  const CELL_W = 12;
  const LANE_H = 16;
  const LABEL_W = 42;

  return (
    <div style={{ background: T.paper, ...inkBorder, overflow: "hidden" }}>
      {/* Ruler */}
      <div style={{
        display: "flex",
        borderBottom: `1px solid ${T.ink}`,
        background: T.paperDeep,
      }}>
        <div style={{ width: LABEL_W, flexShrink: 0, borderRight: `1px solid ${T.ink}` }} />
        <div style={{ position: "relative", width: BARS * CELL_W, height: 14 }}>
          <svg width={BARS * CELL_W} height={14} style={{ display: "block" }}>
            {Array.from({ length: BARS + 1 }).map((_, i) => {
              const isBar = i % 4 === 0;
              return (
                <g key={i}>
                  <line x1={i * CELL_W} y1={isBar ? 4 : 8} x2={i * CELL_W} y2={14}
                    stroke={T.gridBar} strokeWidth={isBar ? 1 : 0.5} />
                  {isBar && i > 0 && (
                    <text x={i * CELL_W + 2} y={10}
                      fontFamily={T.font} fontSize={7} fill={T.inkMid}>
                      {i}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Lanes */}
      {lanes.map((lane, li) => (
        <div key={li} style={{
          display: "flex",
          borderBottom: `1px solid ${li === lanes.length - 1 ? T.ink : T.inkGhost}`,
          height: LANE_H,
        }}>
          {/* Label */}
          <div style={{
            width: LABEL_W, flexShrink: 0,
            borderRight: `1px solid ${T.ink}`,
            background: T.paperDeep,
            display: "flex", alignItems: "center",
            paddingLeft: 4,
          }}>
            <span style={{ fontFamily: T.font, fontSize: 7, color: T.inkMid, letterSpacing: "0.04em" }}>
              {lane.name}
            </span>
          </div>

          {/* Clip area */}
          <div style={{ position: "relative", flex: 1, background: T.paper }}>
            <svg width={BARS * CELL_W} height={LANE_H} style={{ display: "block" }}>
              {/* Grid lines */}
              {Array.from({ length: BARS + 1 }).map((_, i) => (
                <line key={i}
                  x1={i * CELL_W} y1={0} x2={i * CELL_W} y2={LANE_H}
                  stroke={i % 4 === 0 ? T.gridBeat : T.gridSub}
                  strokeWidth={0.5}
                />
              ))}
              {/* Clips */}
              {lane.clips.map(([start, len], ci) => (
                <g key={ci}>
                  <rect
                    x={start * CELL_W + 1} y={1}
                    width={len * CELL_W - 2} height={LANE_H - 3}
                    fill={T.note} stroke={T.ink} strokeWidth={0.5}
                  />
                  <rect
                    x={start * CELL_W + 1} y={1}
                    width={len * CELL_W - 2} height={2}
                    fill="rgba(255,255,255,0.15)"
                  />
                </g>
              ))}
              {/* Playhead */}
              <line x1={96} y1={0} x2={96} y2={LANE_H} stroke={T.playhead} strokeWidth={1} />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}

// Toolbar icons — pixel art approximations using SVG
function ToolbarIcons() {
  const tools = [
    { icon: "↖", label: "SELECT" },
    { icon: "✏", label: "PENCIL" },
    { icon: "⌫", label: "ERASE" },
    { icon: "✂", label: "SPLIT" },
    { icon: "⊞", label: "LOOP" },
    { icon: "🔍", label: "ZOOM" },
  ];

  const [active, setActive] = useState(1);

  return (
    <div style={{
      display: "inline-flex",
      background: T.paperDeep,
      border: `1px solid ${T.inkLight}`,
      borderTop: `1px solid ${T.paper}`,
      borderLeft: `1px solid ${T.paper}`,
      padding: 2,
      gap: 1,
    }}>
      {tools.map((tool, i) => (
        <button
          key={i}
          onClick={() => setActive(i)}
          title={tool.label}
          style={{
            width: 22, height: 20,
            background: active === i ? T.ink : T.paperDeep,
            ...(active === i ? gemSunken : gemRaised),
            color: active === i ? T.paper : T.ink,
            fontSize: 10,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 0,
            border: active === i ? `1px solid ${T.inkLight}` : undefined,
          }}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  );
}

// Transport bar
function TransportBar() {
  const [playing, setPlaying] = useState(false);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 4,
      padding: "3px 6px",
      background: T.paperDeep,
      border: `1px solid ${T.inkLight}`,
      borderTop: `1px solid ${T.paper}`,
      borderLeft: `1px solid ${T.paper}`,
    }}>
      <TransportButton symbol="◀◀" />
      <TransportButton symbol="◀" />
      <TransportButton symbol="■" active={!playing} onClick={() => setPlaying(false)} />
      <TransportButton symbol="▶" active={playing} onClick={() => setPlaying(true)} />
      <TransportButton symbol="▶▶" />
      <TransportButton symbol="●" />
      <div style={{ width: 1, height: 16, background: T.inkLight, margin: "0 2px" }} />
      <Readout value="18. 1. 0" label="POSITION" />
      <Readout value="120" label="TEMPO" />
      <Readout value="4/4" label="TIME SIG" />
      <Readout value="0:02:45" label="SMPTE" />
    </div>
  );
}

export default function AtariPaperStyleguide() {
  return (
    <div style={{ background: T.paper, minHeight: "100vh", padding: 20, fontFamily: T.font }}>

      {/* Menu bar — classic Atari GEM */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "2px 0",
        background: T.paper,
        borderBottom: `1px solid ${T.ink}`,
        marginBottom: 20,
      }}>
        {["Desk", "File", "Edit", "Structure", "Functions", "Options", "Windows"].map((item, i) => (
          <div key={i} style={{
            padding: "1px 8px",
            fontFamily: T.font, fontSize: 9,
            color: T.ink,
            cursor: "pointer",
            background: i === 0 ? T.ink : "transparent",
            color: i === 0 ? T.paper : T.ink,
          }}>
            {item}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: T.font, fontSize: 8, color: T.inkMid, paddingRight: 8 }}>
          CANVAS DAW · ATARI PAPER · v0.1
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* LEFT */}
        <div>
          {/* Piano roll — the centerpiece */}
          <Section title="Piano Roll">
            <div style={{ fontSize: 8, color: T.inkMid, marginBottom: 8, lineHeight: 1.7 }}>
              White keys = paper. Black keys = paperDark. Notes = solid ink rectangles.<br />
              Playhead = the only red element. Grid hierarchy: bar → beat → subdivision.
            </div>
            <Panel title="KEY — NEED  18.1.0 → 26.1.0">
              <PianoRoll />
            </Panel>
          </Section>

          {/* Arrangement */}
          <Section title="Arrangement View">
            <Panel title="ARRANGEMENT CANVAS">
              <ArrangementView />
            </Panel>
          </Section>

          {/* Transport */}
          <Section title="Transport">
            <TransportBar />
            <div style={{ fontSize: 7, color: T.inkLight, marginTop: 6, lineHeight: 1.7 }}>
              Transport buttons use the GEM raise/sunken system. Active state = filled black.<br />
              Readouts are sunken panels with monospace values.
            </div>
          </Section>
        </div>

        {/* RIGHT */}
        <div>

          {/* Color palette */}
          <Section title="Color System — Ink & Paper">
            <div style={{ fontSize: 8, color: T.inkMid, marginBottom: 10, lineHeight: 1.7 }}>
              This is a two-color system. Black ink on warm paper.<br />
              Blue = selection. Red = playhead. That's it. That's all the color there is.
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 7, color: T.inkLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>Paper Scale</div>
              <Row gap={8}>
                <Swatch color={T.paper}      name="paper"      role="the page" />
                <Swatch color={T.paperDark}  name="paperDark"  role="panels" />
                <Swatch color={T.paperDeep}  name="paperDeep"  role="chrome" />
                <Swatch color={T.paperPanel} name="paperPanel" role="deep" />
              </Row>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 7, color: T.inkLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>Ink Scale</div>
              <Row gap={8}>
                <Swatch color={T.ink}      name="ink"      role="primary" />
                <Swatch color={T.inkMid}   name="inkMid"   role="secondary" />
                <Swatch color={T.inkLight} name="inkLight" role="tertiary" />
                <Swatch color={T.inkGhost} name="inkGhost" role="grid" />
              </Row>
            </div>
            <div>
              <div style={{ fontSize: 7, color: T.inkLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>The Two Accents</div>
              <Row gap={8}>
                <Swatch color={T.selection} name="selection" role="GEM blue — active/focus/select" />
                <Swatch color={T.playhead}  name="playhead"  role="always findable" />
              </Row>
            </div>
          </Section>

          {/* Controls */}
          <Section title="Controls">
            <div style={{ fontSize: 8, color: T.inkMid, marginBottom: 10, lineHeight: 1.7 }}>
              GEM buttons: subtle raise/sunken using paper/ink border pair (not the full bevel system).<br />
              Active = black fill, paper text. No color. No glow. Just inverted.
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 7, color: T.inkLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>Toolbar</div>
              <ToolbarIcons />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 7, color: T.inkLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>Buttons</div>
              <Row gap={4}>
                <GemButton label="KEEP" />
                <GemButton label="CANCEL" />
                <GemButton label="FUNCTION" wide />
                <GemButton label="INFO" active />
                <GemButton label="LOOP" />
              </Row>
            </div>
            <div>
              <div style={{ fontSize: 7, color: T.inkLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>Readouts</div>
              <Row gap={4}>
                <Readout value="18.1.0" label="START" />
                <Readout value="26.1.0" label="END" />
                <Readout value="125" label="TEMPO" />
                <Readout value="4/4" label="TIME" />
                <Readout value="0:01:43" label="SMPTE" wide />
              </Row>
            </div>
          </Section>

          {/* Typography */}
          <Section title="Typography">
            <div style={{ fontSize: 7, color: T.inkLight, marginBottom: 10, lineHeight: 1.7 }}>
              Geneva / MS Sans Serif — the Atari GEM system font. Small, proportional, not monospace.<br />
              Monospace (Courier New) for values, positions, and readouts only.
            </div>
            <Col gap={8}>
              {[
                [11, T.ink,    T.font,     "ARRANGEMENT CANVAS", "bold"],
                [9,  T.ink,    T.font,     "KEY TRACK 1 — PATTERN A"],
                [9,  T.inkMid, T.font,     "SNAP 32   QUANT 16"],
                [8,  T.inkMid, T.font,     "LANE 1  ARRANGER SLOT"],
                [9,  T.ink,    T.fontMono, "18. 1. 183"],
                [9,  T.selection, T.fontMono, "0:02:43  4/4"],
                [7,  T.inkLight, T.font,   "F1:HELP  F2:ARRANGE  F9:PLAY"],
              ].map(([size, color, font, sample, weight], i) => (
                <div key={i} style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
                  <span style={{ fontFamily: T.font, fontSize: 7, color: T.inkGhost, width: 38 }}>{size}px</span>
                  <span style={{ fontFamily: font, fontSize: size, color, fontWeight: weight || "normal" }}>
                    {sample}
                  </span>
                </div>
              ))}
            </Col>
          </Section>

          {/* Design Rules */}
          <Section title="Design Rules">
            {[
              ["Ink on paper.", "The background is warm paper white (#f0ede4). Not dark. Not gray. The page."],
              ["Two accents only.", "GEM blue (#0000b8) for selection/focus. Playhead red (#b80000) always visible. Nothing else gets color."],
              ["1px lines only.", "No thick borders. No bevel gradients. Everything is drawn, not styled."],
              ["GEM depth is subtle.", "Raised = paper top/left edge + ink bottom/right. Much lighter touch than the Vintage Console bevel system."],
              ["Drop shadow = 2px offset, no blur.", "Floating panels get boxShadow: '2px 2px 0 ink'. That's the GEM window. No spread, no blur."],
              ["Grid hierarchy.", "Bar lines darkest. Beat lines mid. Subdivision lines ghost. The grid tells you where you are."],
              ["Note blocks are filled ink.", "No color coding for different instruments. Identity comes from which row/lane they're in."],
              ["Geneva, not Courier.", "System sans-serif for labels. Monospace only for values and positions."],
            ].map(([rule, desc], i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <span style={{ fontFamily: T.fontMono, fontSize: 8, color: T.inkLight, width: 16, flexShrink: 0 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <span style={{ fontFamily: T.font, fontSize: 8, color: T.ink, fontWeight: "bold" }}>{rule} </span>
                  <span style={{ fontFamily: T.font, fontSize: 8, color: T.inkMid }}>{desc}</span>
                </div>
              </div>
            ))}
          </Section>

        </div>
      </div>

      {/* Status bar */}
      <div style={{
        marginTop: 8,
        padding: "2px 8px",
        background: T.paperDeep,
        borderTop: `1px solid ${T.inkLight}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span style={{ fontFamily: T.font, fontSize: 8, color: T.inkMid }}>
          CANVAS DAW · Atari Paper Theme · v0.1
        </span>
        <span style={{ fontFamily: T.fontMono, fontSize: 8, color: T.inkMid }}>
          44100 Hz · 32-bit · SONG MODE
        </span>
      </div>
    </div>
  );
}
