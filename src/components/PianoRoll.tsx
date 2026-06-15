/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo, useEffect } from "react";
import { useAudioEngine } from "../audio/useAudioEngine";
import { DAWEvent } from "../audio/AudioEngine";
import { ChannelRow } from "../types";
import { PATTERN_LENGTH_BEATS } from "../config";

import { usePianoRollDrag } from "../hooks/usePianoRollDrag";
import { getAutoSnapResolution } from "../utils/snapUtils";

import { useTheme } from "../theme/ThemeContext";

// ── MIDI note range (high → low) ────────────────────────────────────────────
const MIDI_NOTES: number[] = [];
for (let i = 108; i >= 24; i--) {
  MIDI_NOTES.push(i);
}

const isMidiNoteBlack = (note: number): boolean => {
  const pc = note % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
};

// ── Note name helper ──────────────────────────────────────────────────────────
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const getPitchName = (midi: number): string => {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
};

// ── Snap options ──────────────────────────────────────────────────────────────
const SNAP_OPTIONS = [
  { label: "Auto Snap", value: "auto" as const },
  { label: "1/4 Beat",  value: "1/4"  as const },
  { label: "1/8 Beat",  value: "1/8"  as const },
  { label: "1/16 Beat", value: "1/16" as const },
];

// ── Hex → rgba helper (avoids hardcoded hex in color expressions) ─────────────
const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};



// ── LCD dropdown wrapper ──────────────────────────────────────────────────────
const DropdownWrapper = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => {
  const { theme: DARK, SPACE } = useTheme();
  const lcdLabelStyle: React.CSSProperties = {
    fontFamily: DARK.font,
    fontSize: "7px",
    color: DARK.textLo,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    paddingRight: SPACE.xs,
    userSelect: "none",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: SPACE.xs }}>
      <span style={lcdLabelStyle}>{label}</span>
      {children}
    </div>
  );
};

// ── Zoom button ───────────────────────────────────────────────────────────────
const ZoomButton = ({
  label,
  title,
  onClick,
}: {
  label: string;
  title: string;
  onClick: () => void;
}) => {
  const { theme: DARK, raised, sunken, SPACE } = useTheme();
  const [pressed, setPressed] = useState(false);
  return (
    <button
      title={title}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => { setPressed(false); onClick(); }}
      onMouseLeave={() => setPressed(false)}
      style={{
        ...(pressed ? sunken(DARK) : raised(DARK)),
        backgroundColor: pressed ? DARK.bg5 : DARK.bg3,
        color: DARK.textMid,
        fontFamily: DARK.font,
        fontSize: "8px",
        fontWeight: "bold",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        padding: `${SPACE.xs}px ${SPACE.sm}px`,
        height: "22px",
        cursor: "pointer",
        userSelect: "none",
        border: "none",
      }}
    >
      {label}
    </button>
  );
};

// ── Tool button ───────────────────────────────────────────────────────────────
function ToolButton({
  label, icon, active, title, onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  title: string;
  onClick: () => void;
}) {
  const { theme: DARK, raised, sunken, SPACE } = useTheme();
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        ...(active ? sunken(DARK) : raised(DARK)),
        backgroundColor: active ? DARK.bg0 : DARK.bg3,
        color: active ? DARK.accentBlue : DARK.textMid,
        fontFamily: DARK.font,
        fontSize: "8px",
        fontWeight: "bold",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        display: "flex",
        alignItems: "center",
        gap: SPACE.xs,
        padding: `${SPACE.xs}px ${SPACE.sm}px`,
        height: "22px",
        cursor: "pointer",
        userSelect: "none",
        border: "none",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ── SVG Icons (inline — no external dep) ─────────────────────────────────────
const IconPencil = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);
const IconPointer = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 3l14 9-7 1-4 7-3-17z" />
  </svg>
);
const IconSplit = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="0" />
    <line x1="6" y1="12" x2="18" y2="12" />
    <circle cx="8"  cy="12" r="0.75" fill="currentColor" />
    <circle cx="16" cy="12" r="0.75" fill="currentColor" />
    <circle cx="12" cy="12" r="1"    fill="currentColor" />
  </svg>
);
const IconTrash = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// INLINED PIANO KEYBOARD
// (formerly PianoKeyboard.tsx — logic preserved 1:1, only styles changed)
// ─────────────────────────────────────────────────────────────────────────────
interface InlinedPianoKeyboardProps {
  rowHeight: number;
  activeMidiNotes: Record<number, boolean>;
  handleKeyAudition: (pitch: number) => void;
}

function InlinedPianoKeyboard({
  rowHeight,
  activeMidiNotes,
  handleKeyAudition,
}: InlinedPianoKeyboardProps) {
  const { theme: DARK, raised, sunken, flat, flush, SPACE, SIZE } = useTheme();
  return (
    <div
      style={{
        position: "sticky",
        left: 0,
        zIndex: 20,
        backgroundColor: DARK.bg2,
        width: "56px",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderRight: `1px solid ${DARK.bevelDark}`,
        userSelect: "none",
      }}
    >
      {/* Top ruler-height spacer that matches the ruler row */}
      <div
        style={{
          height: "24px",
          backgroundColor: DARK.bg1,
          borderBottom: `1px solid ${DARK.bevelMid}`,
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      />

      {MIDI_NOTES.map((note) => {
        const isBlack  = isMidiNoteBlack(note);
        const isC      = note % 12 === 0;
        const isActive = !!activeMidiNotes?.[note];

        const bg = isActive
          ? (isBlack ? DARK.bg1 : DARK.bg5)
          : (isBlack ? DARK.bg0 : DARK.bg4);

        return (
          <button
            key={note}
            onClick={() => handleKeyAudition(note)}
            title={`Play MIDI ${note}`}
            style={{
              height: `${rowHeight}px`,
              width: "100%",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              paddingLeft: `${SPACE.sm}px`,
              paddingRight: `${SPACE.xs}px`,
              backgroundColor: bg,
              borderLeft: isActive
                ? `2px solid ${DARK.accentBlue}`
                : `2px solid transparent`,
              borderRight: "none",
              borderTop: "none",
              borderBottom: `1px solid ${DARK.bevelDark}`,
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            {isC && (
              <span
                style={{
                  fontFamily: DARK.font,
                  fontSize: "7px",
                  color: DARK.textLo,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  pointerEvents: "none",
                }}
              >
                {`C${Math.floor(note / 12) - 1}`}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INLINED PIANO ROLL NOTE BLOCK
// (formerly PianoRollNote.tsx — logic preserved 1:1, only styles changed)
// ─────────────────────────────────────────────────────────────────────────────
interface InlinedPianoRollNoteProps {
  noteEvent: DAWEvent;
  beatWidth: number;
  rowHeight: number;
  activeTool: "pencil" | "pointer" | "split";
  isSelected: boolean;
  isDragging: boolean;
  setEvents: (events: DAWEvent[]) => void;
  events: DAWEvent[];
  pushToHistory: () => void;
  channels: ChannelRow[];
  handleNoteRightClick: (e: React.MouseEvent, noteId: string) => void;
  handleNoteSplit: (e: React.PointerEvent<HTMLDivElement>, noteEvent: DAWEvent) => void;
  handleNotePointerDown: (e: React.PointerEvent<HTMLDivElement>, noteEvent: DAWEvent) => void;
  handleNotePointerDownPointerMode: (e: React.PointerEvent<HTMLDivElement>, noteEvent: DAWEvent) => void;
  handleNotePointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleNotePointerMovePointerMode: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleNotePointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleNotePointerUpPointerMode: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleResizeDown: (e: React.PointerEvent<HTMLDivElement>, noteEvent: DAWEvent, edge: "left" | "right") => void;
  handleResizeMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleResizeUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}

function InlinedPianoRollNote({
  noteEvent,
  beatWidth,
  rowHeight,
  activeTool,
  isSelected,
  isDragging,
  setEvents,
  events,
  pushToHistory,
  channels,
  handleNoteRightClick,
  handleNoteSplit,
  handleNotePointerDown,
  handleNotePointerDownPointerMode,
  handleNotePointerMove,
  handleNotePointerMovePointerMode,
  handleNotePointerUp,
  handleNotePointerUpPointerMode,
  handleResizeDown,
  handleResizeMove,
  handleResizeUp,
}: InlinedPianoRollNoteProps) {
  const { theme: DARK, raised, sunken, flat, flush, SPACE, SIZE } = useTheme();
  if (noteEvent.pitch === undefined) return null;
  const noteIndex = MIDI_NOTES.indexOf(noteEvent.pitch);
  if (noteIndex === -1) return null;

  const leftPx  = noteEvent.time     * beatWidth;
  const widthPx = noteEvent.duration * beatWidth;
  const topPx   = noteIndex          * rowHeight;

  const noteLabel = getPitchName(noteEvent.pitch);

  // Note color: accentBlue@70% default, accentMaster selected/dragging
  const noteBg = (isSelected || isDragging)
    ? hexToRgba(DARK.accentMaster, 0.85)
    : hexToRgba(DARK.accentBlue,   0.70);

  const noteBorder = (isSelected || isDragging)
    ? `1px solid ${DARK.accentMaster}`
    : `1px solid ${DARK.accentBlue}`;

  const noteCursor = isDragging
    ? "grabbing"
    : activeTool === "split"
    ? "crosshair"
    : "grab";

  return (
    <div
      onContextMenu={(e) => handleNoteRightClick(e, noteEvent.id)}
      onPointerDown={(e) => {
        if (activeTool === "split") {
          e.stopPropagation();
          handleNoteSplit(e, noteEvent);
          return;
        }
        handleNotePointerDownPointerMode(e, noteEvent);
      }}
      onPointerEnter={(e) => {
        if (e.buttons === 2) {
          setEvents(events.filter((ev) => ev.id !== noteEvent.id));
          pushToHistory();
        }
      }}
      onPointerMove={handleNotePointerMovePointerMode}
      onPointerUp={handleNotePointerUpPointerMode}
      style={{
        position: "absolute",
        left:   `${leftPx}px`,
        width:  `${widthPx}px`,
        top:    `${topPx + 2}px`,
        height: `${rowHeight - 4}px`,
        // border-radius: 2px is the ONE intentional exception to the NEVER list
        borderRadius: "2px",
        backgroundColor: noteBg,
        border: noteBorder,
        zIndex: 10,
        userSelect: "none",
        touchAction: "none",
        cursor: noteCursor,
        overflow: "hidden",
      }}
      title={`MIDI: ${noteEvent.pitch} (${noteLabel}), Beat: ${noteEvent.time.toFixed(2)}, Dur: ${noteEvent.duration.toFixed(2)} (Drag body to move, Drag edges to resize, Right-click to delete)`}
    >
      {/* LEFT RESIZE ZONE */}
      <div
        onPointerDown={(e) => handleResizeDown(e, noteEvent, "left")}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeUp}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "10px",
          cursor: "ew-resize",
          zIndex: 30,
        }}
        title="Drag left edge to adjust start time"
      />

      {/* Note label — only when wide enough */}
      {widthPx > 24 && (
        <span
          style={{
            position: "absolute",
            left: `${SPACE.xs}px`,
            top:  "1px",
            fontFamily: DARK.font,
            fontSize: "7px",
            color: "white",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            userSelect: "none",
            pointerEvents: "none",
            lineHeight: 1,
          }}
        >
          {noteLabel}
        </span>
      )}

      {/* RIGHT RESIZE ZONE */}
      <div
        onPointerDown={(e) => handleResizeDown(e, noteEvent, "right")}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeUp}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: "10px",
          cursor: "ew-resize",
          zIndex: 30,
        }}
        title="Drag right edge to adjust duration"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PIANO ROLL PROPS
// ─────────────────────────────────────────────────────────────────────────────
interface PianoRollProps {
  channels: ChannelRow[];
  activeChannelId: string;
  setActiveChannelId: (id: string) => void;
  channelVols: Record<string, number>;
  channelPans: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PIANO ROLL — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function PianoRoll({
  channels,
  activeChannelId,
  setActiveChannelId,
  channelVols,
  channelPans,
}: PianoRollProps) {
  const { theme: DARK, raised, sunken, flat, flush, SPACE, SIZE } = useTheme();
  const lcdSelectStyle: React.CSSProperties = {
    ...sunken(DARK),
    backgroundColor: DARK.bg0,
    color: DARK.lcdText,
    fontFamily: DARK.font,
    fontSize: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    padding: `${SPACE.xs}px ${SPACE.sm}px`,
    height: "22px",
    outline: "none",
    cursor: "pointer",
    appearance: "none" as const,
  };
  const lcdLabelStyle: React.CSSProperties = {
    fontFamily: DARK.font,
    fontSize: "7px",
    color: DARK.textLo,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    paddingRight: SPACE.xs,
    userSelect: "none",
  };
  const {
    engine,
    events,
    setEvents,
    previewChannel,
    activeMidiNotes,
    activePatternId,
    setActivePatternId,
    patterns,
    canvasClips,
    playbackState,
    playbackMode,
    pushToHistory,
    position,
    setPlayheadPosition,
  } = useAudioEngine();

  const [gridSnap, setGridSnap]   = useState<"auto" | "1/4" | "1/8" | "1/16">("auto");
  const [zoomX,    setZoomX]      = useState<number>(1.0);
  const [zoomY,    setZoomY]      = useState<number>(1.0);
  const [scrollLeft, setScrollLeft] = useState<number>(0);

  const beatWidth = 160 * zoomX;
  const rowHeight = 24  * zoomY;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft(e.currentTarget.scrollLeft);
  };

  const timelineRef = useRef<HTMLDivElement>(null);
  const gridRef     = useRef<HTMLDivElement>(null);

  // Middle-click panning refs
  const isMiddleClickPanning = useRef(false);
  const panStartX    = useRef(0);
  const panStartY    = useRef(0);
  const panScrollLeft = useRef(0);
  const panScrollTop  = useRef(0);

  const [viewportWidth, setViewportWidth] = useState<number>(0);

  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setViewportWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [timelineRef]);

  const activeChannel = useMemo(() => {
    return channels.find((c) => c.id === activeChannelId);
  }, [channels, activeChannelId]);

  const filteredEvents = useMemo(() => {
    if (!activeChannel) return [];
    return events.filter((e) => e.channelId === activeChannel.id);
  }, [events, activeChannel]);

  const maxNoteBeat = useMemo(() => {
    if (filteredEvents.length === 0) return 0;
    return Math.max(...filteredEvents.map((e) => e.time + e.duration));
  }, [filteredEvents]);

  const totalBeats = useMemo(() => {
    const scrolledBeats = (scrollLeft + viewportWidth) / beatWidth;
    return Math.max(32, Math.ceil(maxNoteBeat + 16), Math.ceil(scrolledBeats + 16));
  }, [maxNoteBeat, scrollLeft, viewportWidth, beatWidth]);

  const patternLength = useMemo(() => {
    if (filteredEvents.length === 0) return 4;
    let maxBeat = 4;
    for (const e of filteredEvents) {
      const endBeat = e.time + e.duration;
      if (endBeat > maxBeat) maxBeat = endBeat;
    }
    return Math.max(4, Math.ceil(maxBeat / 4) * 4);
  }, [filteredEvents]);

  const visibleBeats = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollLeft / beatWidth) - 8);
    const end   = Math.min(totalBeats, Math.ceil((scrollLeft + viewportWidth) / beatWidth) + 8);
    const arr: number[] = [];
    for (let i = start; i < end; i++) arr.push(i);
    return arr;
  }, [scrollLeft, beatWidth, viewportWidth, totalBeats]);

  const minZoomX = useMemo(() => {
    if (maxNoteBeat === 0 || viewportWidth <= 56) return 0.5;
    const calc = (viewportWidth - 56) / (160 * (maxNoteBeat + 8));
    return Math.max(0.05, Math.min(0.5, Number(calc.toFixed(3))));
  }, [maxNoteBeat, viewportWidth]);

  // Center Middle C (MIDI 60) on active channel change
  useEffect(() => {
    const container = timelineRef.current;
    if (!container) return;
    const midi60Idx = MIDI_NOTES.indexOf(60);
    if (midi60Idx === -1) return;
    const rowOffset = midi60Idx * rowHeight;
    const containerHeight = container.clientHeight;
    container.scrollTop = rowOffset - containerHeight / 2 + rowHeight / 2;
  }, [activeChannelId, rowHeight]);

  const playheadLineRef = useRef<HTMLDivElement>(null);
  const isRulerScrubbingRef = useRef(false);

  // Playhead position update
  useEffect(() => {
    let playheadBeat = 0;
    let active = false;

    if (playbackState === "playing") {
      if (playbackMode === "pattern") {
        active = true;
        playheadBeat = position.beats % patternLength;
      } else {
        const clips = canvasClips || [];
        const activeClip = clips.find(
          (clip) =>
            clip.type === "pattern" &&
            clip.referenceId === activePatternId &&
            position.beats >= clip.startBeat &&
            position.beats < clip.startBeat + clip.duration
        );
        if (activeClip) {
          active = true;
          playheadBeat = (position.beats - activeClip.startBeat) + (activeClip.cropStart || 0);
          playheadBeat = Math.min(activeClip.duration, Math.max(0, playheadBeat));
        }
      }
    }

    const leftPx = playheadBeat * beatWidth;
    if (playheadLineRef.current) {
      playheadLineRef.current.style.left    = `${leftPx}px`;
      playheadLineRef.current.style.display = active ? "block" : "none";
    }
  }, [position.beats, playbackState, playbackMode, beatWidth, activePatternId, canvasClips, patternLength]);

  // ── Ruler scrub ──────────────────────────────────────────────────────────
  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isRulerScrubbingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const beat = Math.max(0, Math.min(totalBeats, (e.clientX - rect.left) / beatWidth));
    setPlayheadPosition(beat);
  };

  const handleRulerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isRulerScrubbingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const beat = Math.max(0, Math.min(totalBeats, (e.clientX - rect.left) / beatWidth));
    setPlayheadPosition(beat);
  };

  const handleRulerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isRulerScrubbingRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      isRulerScrubbingRef.current = false;
    }
  };

  const [activeTool, setActiveTool]   = useState<"pencil" | "pointer" | "split">("pencil");
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);

  // Clamp zoom to min
  useEffect(() => {
    if (zoomX < minZoomX) setZoomX(minZoomX);
  }, [minZoomX, zoomX]);

  // Ctrl+Wheel horizontal zoom
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;

    const handleCtrlWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const scrollOffset = mouseX + el.scrollLeft;
        const dir = e.deltaY > 0 ? -1 : 1;
        setZoomX((prev) => {
          const newZoom = Math.max(minZoomX, Math.min(4.0, Number((prev + dir * 0.1).toFixed(2))));
          const scaleRatio = newZoom / prev;
          requestAnimationFrame(() => { el.scrollLeft = scrollOffset * scaleRatio - mouseX; });
          return newZoom;
        });
      }
    };

    el.addEventListener("wheel", handleCtrlWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleCtrlWheel);
  }, [minZoomX]);

  // ── Snap resolution ────────────────────────────────────────────────────────
  const activeSnapResolution = useMemo(() => {
    if (gridSnap === "auto") return getAutoSnapResolution(zoomX);
    if (gridSnap === "1/4") return 1.0;
    if (gridSnap === "1/8") return 0.5;
    return 0.25;
  }, [gridSnap, zoomX]);

  const snapIncrement = activeSnapResolution;

  // ── Grid style: token-based beat/bar lines ────────────────────────────────
  // We use CSS background-image gradients for vertical grid lines.
  // Bar lines: DARK.bevelMid (slightly more visible)
  // Beat lines: DARK.bevelDark (subtle)
  // Sub-beat lines: even more subtle
  const getGridStyle = (): React.CSSProperties => {
    const gradients: string[] = [
      // Bar lines (every 4 beats) — bevelMid, slightly more visible
      `linear-gradient(to right, ${DARK.bevelMid} 1px, transparent 1px)`,
      // Beat lines — bevelDark, subtle
      `linear-gradient(to right, ${DARK.bevelDark} 1px, transparent 1px)`,
    ];
    const sizes: string[] = [
      `${beatWidth * 4}px 100%`,
      `${beatWidth}px 100%`,
    ];

    const res = activeSnapResolution;
    if (res !== null) {
      if (res <= 0.5) {
        gradients.push(`linear-gradient(to right, ${hexToRgba(DARK.bevelDark, 0.5)} 1px, transparent 1px)`);
        sizes.push(`${beatWidth * 0.5}px 100%`);
      }
      if (res <= 0.25) {
        gradients.push(`linear-gradient(to right, ${hexToRgba(DARK.bevelDark, 0.3)} 1px, transparent 1px)`);
        sizes.push(`${beatWidth * 0.25}px 100%`);
      }
      if (res <= 0.125) {
        gradients.push(`linear-gradient(to right, ${hexToRgba(DARK.bevelDark, 0.15)} 1px, transparent 1px)`);
        sizes.push(`${beatWidth * 0.125}px 100%`);
      }
    }

    return {
      backgroundImage: gradients.join(", "),
      backgroundSize:  sizes.join(", "),
    };
  };

  // ── Key audition ──────────────────────────────────────────────────────────
  const handleKeyAudition = (pitch: number) => {
    if (!activeChannel) return;
    previewChannel(
      activeChannel.id,
      activeChannel.sampleId,
      channelVols[activeChannel.id] ?? 80,
      channelPans[activeChannel.id] ?? 0,
      { pitch: pitch - 60, sampleStart: 0, envelopeOn: false }
    );
  };

  // ── Note split ────────────────────────────────────────────────────────────
  const handleNoteSplit = (e: React.PointerEvent<HTMLDivElement>, noteEvent: DAWEvent) => {
    if (e.button !== 0) return;
    const relativeClickBeat = (e.clientX - e.currentTarget.getBoundingClientRect().left) / beatWidth;
    const snappedSplitBeat = noteEvent.time + (
      snapIncrement !== null
        ? Math.round(relativeClickBeat / snapIncrement) * snapIncrement
        : relativeClickBeat
    );

    if (snappedSplitBeat > noteEvent.time && snappedSplitBeat < noteEvent.time + noteEvent.duration) {
      const targetNotes = selectedNoteIds.includes(noteEvent.id)
        ? events.filter((ev) => selectedNoteIds.includes(ev.id) && ev.pitch !== undefined)
        : [noteEvent];

      let nextEvents = [...events];

      targetNotes.forEach((tgtNote) => {
        const relSplitBeat = snappedSplitBeat - tgtNote.time;
        if (relSplitBeat > 0 && relSplitBeat < tgtNote.duration) {
          const durationA = relSplitBeat;
          const durationB = tgtNote.duration - relSplitBeat;

          const noteA = { ...tgtNote, duration: durationA };
          const noteB: DAWEvent = {
            id:        `piano-note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            time:      snappedSplitBeat,
            duration:  durationB,
            pitch:     tgtNote.pitch,
            velocity:  tgtNote.velocity,
            channelId: tgtNote.channelId,
            sampleId:  tgtNote.sampleId,
          };

          nextEvents = nextEvents.map((n) => (n.id === tgtNote.id ? noteA : n));
          nextEvents.push(noteB);
        }
      });

      setEvents(nextEvents);
      pushToHistory();
      console.log(`MIDI note(s) split in half at beat ${snappedSplitBeat}`);
    }
  };

  // ── Note right-click delete ───────────────────────────────────────────────
  const handleNoteRightClick = (e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setEvents(events.filter((ev) => ev.id !== noteId));
    pushToHistory();
  };

  // ── Drag hook ─────────────────────────────────────────────────────────────
  const {
    lassoActive,
    lassoBox,
    draggingNoteId,
    handleGridPointerDown:           hookGridPointerDown,
    handleGridPointerMove:           hookGridPointerMove,
    handleGridPointerUp:             hookGridPointerUp,
    handleNotePointerDown,
    handleNotePointerMove,
    handleNotePointerUp,
    handleGridPointerDownPointerMode,
    handleGridPointerMovePointerMode,
    handleGridPointerUpPointerMode,
    handleNotePointerDownPointerMode,
    handleNotePointerMovePointerMode,
    handleNotePointerUpPointerMode,
    handleResizeDown,
    handleResizeMove,
    handleResizeUp,
  } = usePianoRollDrag({
    events,
    setEvents,
    activeChannelId,
    activeChannel,
    beatWidth,
    rowHeight,
    snapIncrement,
    activeTool,
    selectedNoteIds,
    setSelectedNoteIds,
    pushToHistory,
    channels,
    handleKeyAudition,
    filteredEvents,
    timelineRef,
    gridRef,
    totalBeats,
  });

  // ── Grid pointer (middle-click panning + tool dispatch) ───────────────────
  const handleGridPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      isMiddleClickPanning.current = true;
      panStartX.current = e.clientX;
      panStartY.current = e.clientY;
      panScrollLeft.current = timelineRef.current ? timelineRef.current.scrollLeft : 0;
      panScrollTop.current  = timelineRef.current ? timelineRef.current.scrollTop  : 0;
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (activeTool === "pointer" || e.ctrlKey) {
      handleGridPointerDownPointerMode(e);
    } else {
      hookGridPointerDown(e);
    }
  };

  const handleGridPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMiddleClickPanning.current) {
      e.preventDefault();
      const deltaX = e.clientX - panStartX.current;
      const deltaY = e.clientY - panStartY.current;
      if (timelineRef.current) {
        timelineRef.current.scrollLeft = panScrollLeft.current - deltaX;
        timelineRef.current.scrollTop  = panScrollTop.current  - deltaY;
      }
      return;
    }
    if (activeTool === "pointer" || lassoActive) {
      handleGridPointerMovePointerMode(e);
    } else {
      hookGridPointerMove(e);
    }
  };

  const handleGridPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMiddleClickPanning.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      isMiddleClickPanning.current = false;
      return;
    }
    if (activeTool === "pointer" || lassoActive) {
      handleGridPointerUpPointerMode(e);
    } else {
      hookGridPointerUp(e);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      id="piano-roll-container"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: DARK.bg2,
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* ── TOOLBAR ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: DARK.bg2,
          // raised bottom border only (toolbar separator)
          borderTop:    `1px solid ${DARK.bevelLight}`,
          borderLeft:   `1px solid ${DARK.bevelLight}`,
          borderBottom: `1px solid ${DARK.bevelDark}`,
          borderRight:  `1px solid ${DARK.bevelDark}`,
          padding: `${SPACE.sm}px ${SPACE.md}px`,
          flexShrink: 0,
          gap: `${SPACE.sm}px`,
          zIndex: 10,
        }}
      >
        {/* Left side: title + dropdowns + zoom */}
        <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.sm}px`, flexWrap: "wrap" }}>

          {/* Label */}
          <span
            style={{
              fontFamily: DARK.font,
              fontSize: "9px",
              fontWeight: "bold",
              color: DARK.textMid,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              paddingRight: `${SPACE.sm}px`,
            }}
          >
            Piano Roll
          </span>

          {/* TARGET dropdown */}
          <DropdownWrapper label="Target:">
            <select
              value={activeChannelId}
              onChange={(e) => setActiveChannelId(e.target.value)}
              style={lcdSelectStyle}
            >
              {channels.map((chan) => (
                <option key={chan.id} value={chan.id}
                  style={{ backgroundColor: DARK.bg0, color: DARK.lcdText, fontFamily: DARK.font }}
                >
                  {chan.name}
                </option>
              ))}
            </select>
          </DropdownWrapper>

          {/* PATTERN dropdown */}
          <DropdownWrapper label="Pattern:">
            <select
              value={activePatternId}
              onChange={(e) => setActivePatternId(e.target.value)}
              style={lcdSelectStyle}
            >
              {patterns.map((pat) => (
                <option key={pat.id} value={pat.id}
                  style={{ backgroundColor: DARK.bg0, color: DARK.lcdText, fontFamily: DARK.font }}
                >
                  {pat.name}
                </option>
              ))}
            </select>
          </DropdownWrapper>

          {/* ZOOM buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.xs}px` }}>
            <span style={lcdLabelStyle}>Zoom:</span>
            <ZoomButton label="H-" title="Zoom Out Horizontally"
              onClick={() => setZoomX((prev) => Math.max(minZoomX, Number((prev - 0.1).toFixed(2))))} />
            <ZoomButton label="H+" title="Zoom In Horizontally"
              onClick={() => setZoomX((prev) => Math.min(4.0, Number((prev + 0.1).toFixed(2))))} />
            <ZoomButton label="V-" title="Zoom Out Vertically"
              onClick={() => setZoomY((prev) => Math.max(0.6, Number((prev - 0.1).toFixed(2))))} />
            <ZoomButton label="V+" title="Zoom In Vertically"
              onClick={() => setZoomY((prev) => Math.min(2.5, Number((prev + 0.1).toFixed(2))))} />
          </div>
        </div>

        {/* Right side: tools + snap + delete */}
        <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.sm}px`, flexWrap: "wrap" }}>

          {/* Tool selector */}
          <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.xs}px` }}>
            <ToolButton
              label="Pencil" icon={<IconPencil />}
              active={activeTool === "pencil"}
              title="Pencil/Draw Tool"
              onClick={() => { setActiveTool("pencil"); setSelectedNoteIds([]); }}
            />
            <ToolButton
              label="Pointer" icon={<IconPointer />}
              active={activeTool === "pointer"}
              title="Pointer/Select Tool"
              onClick={() => setActiveTool("pointer")}
            />
            <ToolButton
              label="Split" icon={<IconSplit />}
              active={activeTool === "split"}
              title="Razor/Split Tool"
              onClick={() => { setActiveTool("split"); setSelectedNoteIds([]); }}
            />
          </div>

          {/* AUTO SNAP dropdown */}
          <DropdownWrapper label="Snap:">
            <select
              value={gridSnap}
              onChange={(e) => setGridSnap(e.target.value as any)}
              style={lcdSelectStyle}
            >
              {SNAP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}
                  style={{ backgroundColor: DARK.bg0, color: DARK.lcdText, fontFamily: DARK.font }}
                >
                  {opt.label}
                </option>
              ))}
            </select>
          </DropdownWrapper>

          {/* DELETE MELODIES button */}
          <DeleteMelodiesButton
            onClick={() => {
              if (activeChannel) {
                const updatedEvents = activeChannel.type === "sample"
                  ? events.filter((ev) => ev.sampleId !== activeChannel.sampleId)
                  : events;
                setEvents(updatedEvents);
                pushToHistory();
              }
            }}
          />
        </div>
      </div>

      {/* ── SCROLLABLE CANVAS ────────────────────────────────────────────── */}
      <div
        style={{ flex: 1, overflow: "auto", minHeight: 0, position: "relative", userSelect: "none" }}
        ref={timelineRef}
        onScroll={handleScroll}
      >
        <div style={{ position: "relative", display: "flex", width: "fit-content", minWidth: "100%" }}>

          {/* PIANO KEYBOARD (inlined) */}
          <InlinedPianoKeyboard
            rowHeight={rowHeight}
            activeMidiNotes={activeMidiNotes}
            handleKeyAudition={handleKeyAudition}
          />

          {/* TIMELINE MATRIX */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              position: "relative",
              width: `${totalBeats * beatWidth}px`,
            }}
          >
            {/* RULER */}
            <div
              style={{
                height: "24px",
                backgroundColor: DARK.bg1,
                borderBottom: `1px solid ${DARK.bevelMid}`,
                display: "flex",
                alignItems: "center",
                position: "sticky",
                top: 0,
                zIndex: 20,
                cursor: "pointer",
                overflow: "visible",
                userSelect: "none",
              }}
              onPointerDown={handleRulerPointerDown}
              onPointerMove={handleRulerPointerMove}
              onPointerUp={handleRulerPointerUp}
              onContextMenu={(e) => e.preventDefault()}
            >
              {visibleBeats.map((beatIdx) => {
                const bar      = Math.floor(beatIdx / 4) + 1;
                const beat     = (beatIdx % 4) + 1;
                const isBarStart = beat === 1;

                return (
                  <div
                    key={beatIdx}
                    style={{
                      position: "absolute",
                      left:   `${beatIdx * beatWidth}px`,
                      width:  `${beatWidth}px`,
                      top: 0,
                      bottom: 0,
                      // Bar line: bevelDark, 1px right border; beat: bg5 (shorter, inline div below)
                      borderRight: isBarStart
                        ? `1px solid ${DARK.bevelDark}`
                        : `1px solid ${DARK.bg5}`,
                      padding: `0 ${SPACE.xs}px`,
                      display: "flex",
                      alignItems: "center",
                      pointerEvents: "none",
                    }}
                  >
                    {isBarStart ? (
                      <span
                        style={{
                          fontFamily: DARK.font,
                          fontSize: "8px",
                          fontWeight: "bold",
                          color: DARK.textMid,
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                        }}
                      >
                        Bar {bar}
                      </span>
                    ) : (
                      /* Beat subdivision: smaller tick via partial height div */
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          bottom: 0,
                          width: "1px",
                          height: "8px",
                          backgroundColor: DARK.bg5,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* PLAYHEAD */}
            <div
              ref={playheadLineRef}
              style={{
                position: "absolute",
                top: "24px",
                bottom: 0,
                width: "1px",
                backgroundColor: DARK.accentBlue,
                zIndex: 30,
                pointerEvents: "none",
                display: "none",
                overflow: "visible",
              }}
            >
              {/* Caret */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translate(-50%, -100%)",
                }}
              >
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <polygon points="0,0 10,0 5,6" fill={DARK.accentBlue} />
                </svg>
              </div>
            </div>

            {/* GRID MATRIX */}
            <div
              ref={gridRef}
              onPointerDown={handleGridPointerDown}
              onPointerMove={handleGridPointerMove}
              onPointerUp={handleGridPointerUp}
              onContextMenu={(e) => e.preventDefault()}
              style={{
                position: "relative",
                flex: 1,
                backgroundColor: DARK.bg2,
                userSelect: "none",
                touchAction: "none",
                cursor: activeTool === "pencil" ? "crosshair" : "default",
              }}
            >
              {/* ROW STRIPES — keyboard mapping: black key rows = bg1, white key rows = bg2 */}
              {MIDI_NOTES.map((note) => {
                const isBlack = isMidiNoteBlack(note);
                return (
                  <div
                    key={note}
                    style={{
                      height: `${rowHeight}px`,
                      width: "100%",
                      position: "relative",
                      flexShrink: 0,
                      backgroundColor: isBlack ? DARK.bg1 : DARK.bg2,
                      borderBottom: `1px solid ${DARK.bevelDark}`,
                      pointerEvents: "none",
                      ...getGridStyle(),
                    }}
                  />
                );
              })}

              {/* NOTE BLOCKS (inlined) */}
              {filteredEvents.map((noteEvent) => {
                const isSelected = selectedNoteIds.includes(noteEvent.id);
                const isDragging = draggingNoteId === noteEvent.id;

                return (
                  <InlinedPianoRollNote
                    key={noteEvent.id}
                    noteEvent={noteEvent}
                    beatWidth={beatWidth}
                    rowHeight={rowHeight}
                    activeTool={activeTool}
                    isSelected={isSelected}
                    isDragging={isDragging}
                    setEvents={setEvents}
                    events={events}
                    pushToHistory={pushToHistory}
                    channels={channels}
                    handleNoteRightClick={handleNoteRightClick}
                    handleNoteSplit={handleNoteSplit}
                    handleNotePointerDown={handleNotePointerDown}
                    handleNotePointerDownPointerMode={handleNotePointerDownPointerMode}
                    handleNotePointerMove={handleNotePointerMove}
                    handleNotePointerMovePointerMode={handleNotePointerMovePointerMode}
                    handleNotePointerUp={handleNotePointerUp}
                    handleNotePointerUpPointerMode={handleNotePointerUpPointerMode}
                    handleResizeDown={handleResizeDown}
                    handleResizeMove={handleResizeMove}
                    handleResizeUp={handleResizeUp}
                  />
                );
              })}

              {/* LASSO SELECTION BOX */}
              {lassoActive && lassoBox && (
                <div
                  style={{
                    position: "absolute",
                    left:   `${Math.min(lassoBox.startX, lassoBox.currentX)}px`,
                    top:    `${Math.min(lassoBox.startY, lassoBox.currentY)}px`,
                    width:  `${Math.max(1, Math.abs(lassoBox.startX - lassoBox.currentX))}px`,
                    height: `${Math.max(1, Math.abs(lassoBox.startY - lassoBox.currentY))}px`,
                    border: `1px dashed ${DARK.accentBlue}`,
                    backgroundColor: hexToRgba(DARK.accentBlue, 0.08),
                    pointerEvents: "none",
                    zIndex: 50,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE MELODIES BUTTON
// Separated for clarity — raised, stateRed text, no hover transitions
// ─────────────────────────────────────────────────────────────────────────────
function DeleteMelodiesButton({ onClick }: { onClick: () => void }) {
  const { theme: DARK, raised, sunken, flat, flush, SPACE, SIZE } = useTheme();
  const [pressed, setPressed] = useState(false);
  return (
    <button
      title="Clear Active Channel's Melodic Sequence Notes"
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => { setPressed(false); onClick(); }}
      onMouseLeave={() => setPressed(false)}
      style={{
        ...(pressed ? sunken(DARK) : raised(DARK)),
        backgroundColor: pressed ? DARK.bg5 : DARK.bg3,
        color: DARK.stateRed,
        fontFamily: DARK.font,
        fontSize: "8px",
        fontWeight: "bold",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        display: "flex",
        alignItems: "center",
        gap: `${SPACE.xs}px`,
        padding: `${SPACE.xs}px ${SPACE.sm}px`,
        height: "22px",
        cursor: "pointer",
        userSelect: "none",
        border: "none",
      }}
    >
      <IconTrash />
      Delete Melodies
    </button>
  );
}
