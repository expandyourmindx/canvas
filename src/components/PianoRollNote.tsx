/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { DAWEvent } from "../audio/AudioEngine";
import { ChannelRow } from "../types";

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
  channels: ChannelRow[];
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
        left: `${leftPx}px`,
        width: `${widthPx}px`,
        top: `${topPx + 2}px`,
        height: `${rowHeight - 4}px`,
        borderRadius: "2px",
      }}
      className={`absolute note-block-body border z-10 transition-colors select-none touch-none ${
        isDragging
          ? "bg-[#E8956D] border-[#CD7E57] cursor-grabbing shadow-md"
          : isSelected
          ? "bg-[#E8956D] border-[#CD7E57] cursor-grab active:cursor-grabbing"
          : "bg-[#C8B89A] border-[#9E8E70] cursor-grab active:cursor-grabbing hover:bg-[#D0BF9F] hover:border-[#A49475]"
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
        className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-gradient-to-r hover:from-white/12 hover:to-transparent select-none z-30 transition-colors rounded-none left-resize-zone"
        title="Drag left edge to adjust start time"
      />

      {/* Note Label in Upper Left */}
      {widthPx > 28 && (
        <span className={`absolute left-1 top-0.5 text-[8.5px] font-black select-none pointer-events-none tracking-tight leading-none uppercase ${
          isSelected ? "text-[#3B1F13]" : "text-[#544633]"
        }`}>
          {noteLabel}
        </span>
      )}

      {/* RIGHT RESIZE ZONE */}
      <div
        onPointerDown={(e) => handleResizeDown(e, noteEvent, "right")}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeUp}
        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-gradient-to-l hover:from-white/12 hover:to-transparent select-none z-30 transition-colors rounded-none right-resize-zone"
        title="Drag right edge to adjust duration"
      />
    </div>
  );
}
