/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

const isMidiNoteBlack = (note: number): boolean => {
  const pc = note % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
};

const MIDI_NOTES: number[] = [];
for (let i = 108; i >= 24; i--) {
  MIDI_NOTES.push(i);
}

interface PianoKeyboardProps {
  rowHeight: number;
  activeMidiNotes: Record<number, boolean>;
  handleKeyAudition: (pitch: number) => void;
}

export function PianoKeyboard({
  rowHeight,
  activeMidiNotes,
  handleKeyAudition,
}: PianoKeyboardProps) {
  return (
    <div className="sticky left-0 z-20 bg-[#121316] w-14 select-none shrink-0 border-r border-neutral-900 flex flex-col shadow-[4px_0_12px_rgba(0,0,0,0.5)]">
      {/* Top ruler spacer anchor block */}
      <div className="h-6 bg-[#1a1c1e] border-b border-neutral-900 shrink-0 sticky top-0 z-30" />
      
      {/* Keyboard Keys mapping */}
      {MIDI_NOTES.map((note) => {
        const isBlack = isMidiNoteBlack(note);
        const isC = note % 12 === 0;
        const isActive = !!activeMidiNotes?.[note];
        return (
          <button
            key={note}
            onClick={() => handleKeyAudition(note)}
            style={{ height: `${rowHeight}px` }}
            className={`w-full flex items-center justify-between px-1.5 text-[8px] font-mono tracking-tighter shrink-0 border-r-2 border-b border-neutral-900 transition-all uppercase cursor-pointer ${
              isActive
                ? "bg-cyan-400 text-black border-r-cyan-555 shadow-[0_0_8px_#22d3ee] font-black"
                : isBlack
                ? "bg-neutral-950 text-neutral-400 hover:bg-[#1f2127] border-r-neutral-800"
                : "bg-[#eceff4] text-neutral-905 hover:bg-white border-r-[#cfd4de]"
            }`}
            title={`Play MIDI ${note}`}
          >
            <span className="font-bold pointer-events-none text-left">
              {isC ? `C${Math.floor(note / 12) - 1}` : ""}
            </span>
            {isBlack && !isActive && (
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/30 shrink-0 pointer-events-none" />
            )}
          </button>
        );
      })}
    </div>
  );
}
