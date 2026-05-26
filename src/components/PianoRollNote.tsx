/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { DAWEvent } from "../audio/AudioEngine";

const getPitchName = (midi: number): string => {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const noteName = names[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${noteName}${octave}`;
};

const MIDI_NOTES: number[] = [];
for (let i = 108; i >= 24; i--) {
  MIDI_NOTES.push(i);
}

interface PianoRollNoteProps {
  noteEvent: DAWEvent;
  beatWidth: number;
  rowHeight: number;
  activeTool: "pencil" | "pointer" | "split";
  isSelected: boolean;
  isDragging: boolean;
  setEvents: (events: DAWEvent[]) => void;
  events: DAWEvent[];
  pushToHistory: () => void;
  handleNoteRightClick: (e: React.MouseEvent, noteId: string) => void;
  handleNoteSplit: (e: React.PointerEvent<HTMLDivElement>, noteEvent: DAWEvent) => void;
  handleNotePointerDown: (e: React.PointerEvent<HTMLDivElement>, noteEvent: DAWEvent) => void;
  handleNotePointerDownPointerMode: (e: React.PointerEvent<HTMLDivElement>, noteEvent: DAWEvent) => void;
  handleNotePointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleNotePointerMovePointerMode: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleNotePointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleNotePointerUpPointerMode: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleResizeDown: (
    e: React.PointerEvent<HTMLDivElement>,
    noteEvent: DAWEvent,
    edge: "left" | "right"
  ) => void;
  handleResizeMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleResizeUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export function PianoRollNote({
  noteEvent,
  beatWidth,
  rowHeight,
  activeTool,
  isSelected,
  isDragging,
  setEvents,
  events,
  pushToHistory,
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
}: PianoRollNoteProps) {
  if (noteEvent.pitch === undefined) return null;
  const noteIndex = MIDI_NOTES.indexOf(noteEvent.pitch);
  if (noteIndex === -1) return null;

  const leftPx = noteEvent.time * beatWidth;
  const widthPx = noteEvent.duration * beatWidth;
  const topPx = noteIndex * rowHeight;

  const noteLabel = getPitchName(noteEvent.pitch);

  return (
    <div
      onContextMenu={(e) => handleNoteRightClick(e, noteEvent.id)}
      onPointerDown={(e) => {
        if (activeTool === "split") {
          e.stopPropagation();
          handleNoteSplit(e, noteEvent);
          return;
        }
        if (activeTool === "pointer" || isSelected || e.shiftKey) {
          handleNotePointerDownPointerMode(e, noteEvent);
        } else {
          handleNotePointerDown(e, noteEvent);
        }
      }}
      onPointerEnter={(e) => {
        if (e.buttons === 2) {
          setEvents(events.filter((ev) => ev.id !== noteEvent.id));
          pushToHistory();
        }
      }}
      onPointerMove={
        activeTool === "pointer" ? handleNotePointerMovePointerMode : handleNotePointerMove
      }
      onPointerUp={
        activeTool === "pointer" ? handleNotePointerUpPointerMode : handleNotePointerUp
      }
      style={{
        left: `${leftPx}px`,
        width: `${widthPx}px`,
        top: `${topPx + 2}px`,
        height: `${rowHeight - 4}px`,
      }}
      className={`absolute note-block-body border rounded-none shadow-[0_0_8px_rgba(34,211,238,0.35)] flex items-center justify-between z-10 transition-colors group select-none touch-none ${
        isDragging
          ? "bg-cyan-400 cursor-grabbing border-cyan-350"
          : isSelected
          ? "bg-[#0bc5ea] border-white ring-2 ring-white scale-[0.98]"
          : "bg-cyan-500 hover:bg-cyan-400 border-cyan-300/35 cursor-grab active:cursor-grabbing"
      }`}
      title={`MIDI: ${noteEvent.pitch} (${noteLabel}), Beat: ${noteEvent.time.toFixed(
        2
      )}, Dur: ${noteEvent.duration.toFixed(
        2
      )} (Drag body to move, Drag edges to resize, Right-click to delete)`}
    >
      {/* LEFT RESIZE ZONE */}
      <div
        onPointerDown={(e) => handleResizeDown(e, noteEvent, "left")}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeUp}
        className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-white/20 flex items-center justify-center select-none z-30 transition-colors rounded-none group/left left-resize-zone"
        title="Drag left edge to adjust start time"
      >
        <div className="w-[1.5px] h-3 bg-cyan-900/45 group-hover/left:bg-white/60" />
      </div>

      <span className="text-[7.5px] font-black text-cyan-950 font-mono tracking-tighter truncate select-none pointer-events-none mx-auto text-center px-1">
        {noteLabel}
      </span>

      {/* RIGHT RESIZE ZONE */}
      <div
        onPointerDown={(e) => handleResizeDown(e, noteEvent, "right")}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeUp}
        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-white/20 flex items-center justify-center select-none z-30 transition-colors rounded-none group/right right-resize-zone"
        title="Drag right edge to adjust duration"
      >
        <div className="w-[1.5px] h-3 bg-cyan-900/45 group-hover/right:bg-white/60" />
      </div>
    </div>
  );
}
