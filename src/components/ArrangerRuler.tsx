/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from "react";

// Width in pixels of the sticky lane-label column on the left edge of the ruler.
// Must match the 130px header used in Canvas.tsx so beat math stays aligned.
const LABEL_WIDTH_PX = 130;

interface ArrangerRulerProps {
  totalBeats: number;
  beatWidth: number;
  snapResolution: number;
  loopSettings: { isLooping: boolean; loopStart: number; loopEnd: number };
  setPlayheadPosition: (beat: number) => void;
  setLoop: (isLooping: boolean, start: number, end: number) => void;
  zoomX: number;
  setZoomX: React.Dispatch<React.SetStateAction<number>>;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  scrollLeft: number;
  viewportWidth: number;
}

export function ArrangerRuler({
  totalBeats,
  beatWidth,
  snapResolution,
  loopSettings,
  setPlayheadPosition,
  setLoop,
  zoomX,
  setZoomX,
  scrollContainerRef,
  scrollLeft,
  viewportWidth,
}: ArrangerRulerProps) {
  // Tracks whether we are actively scrubbing the playhead via left-click drag
  const isScrubbingRef = useRef(false);

  // Tracks whether we are actively drafting a loop region via right-click drag
  const [isDraftingLoop, setIsDraftingLoop] = useState(false);
  const loopStartRef = useRef<number>(0);
  const pointerDownXRef = useRef<number>(0);
  const loopDragActiveRef = useRef<boolean>(false);

  // Alt/middle-click panning & zoom
  const rulerDragStateRef = useRef<{
    startX: number;
    startY: number;
    initialScrollLeft: number;
    initialZoomX: number;
    isPanningZooming: boolean;
  } | null>(null);


  /**
   * Convert a raw clientX inside the ruler element into a snapped beat value.
   * Subtracts the 130px sticky label column because the beat grid starts there.
   */
  const clientXToBeat = (clientX: number, rulerRect: DOMRect): number => {
    const offsetX = clientX - rulerRect.left;
    const gridOffsetX = offsetX - LABEL_WIDTH_PX;
    const clampedOffsetX = Math.max(0, gridOffsetX);
    const rawBeat = clampedOffsetX / beatWidth;
    return Math.max(0, Math.min(totalBeats, Math.round(rawBeat / snapResolution) * snapResolution));
  };

  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();

    // Alt / middle-click → pan & zoom
    if (e.altKey || e.button === 1) {
      rulerDragStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialScrollLeft: scrollContainerRef.current ? scrollContainerRef.current.scrollLeft : 0,
        initialZoomX: zoomX,
        isPanningZooming: true,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickedBeat = clientXToBeat(e.clientX, rect);

    // ── LEFT CLICK ── scrub/seek playhead
    if (e.button === 0) {
      isScrubbingRef.current = true;
      setPlayheadPosition(clickedBeat);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    // ── RIGHT CLICK ── begin drafting a loop region
    if (e.button === 2) {
      pointerDownXRef.current = e.clientX;
      loopDragActiveRef.current = false;
      loopStartRef.current = clickedBeat;
      setIsDraftingLoop(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
  };

  const handleRulerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Pan & zoom
    const drag = rulerDragStateRef.current;
    if (drag && drag.isPanningZooming) {
      e.preventDefault();
      const deltaX = e.clientX - drag.startX;
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = drag.initialScrollLeft - deltaX * 1.5;
      }
      const deltaY = drag.startY - e.clientY;
      const newZoom = Math.max(0.5, Math.min(4.0, drag.initialZoomX + deltaY / 150));
      setZoomX(Number(newZoom.toFixed(2)));
      return;
    }

    // Playhead scrubbing
    if (isScrubbingRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const beat = clientXToBeat(e.clientX, rect);
      setPlayheadPosition(beat);
      return;
    }

    // Loop drafting (right-click drag)
    if (!isDraftingLoop) return;
    const movedPx = Math.abs(e.clientX - pointerDownXRef.current);
    if (!loopDragActiveRef.current && movedPx < 4) return;
    loopDragActiveRef.current = true;

    const rect = e.currentTarget.getBoundingClientRect();
    const currentBeat = clientXToBeat(e.clientX, rect);
    const start = Math.max(0, Math.min(loopStartRef.current, currentBeat));
    const end = Math.max(start + snapResolution, Math.max(loopStartRef.current, currentBeat));
    setLoop(true, start, end);
  };

  const handleRulerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = rulerDragStateRef.current;
    if (drag && drag.isPanningZooming) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      rulerDragStateRef.current = null;
      return;
    }

    if (isScrubbingRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      isScrubbingRef.current = false;
      return;
    }

    if (isDraftingLoop) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsDraftingLoop(false);
      loopDragActiveRef.current = false;
    }
  };

  /**
   * Double-click inside the active loop region → clear the loop.
   */
  const handleRulerDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!loopSettings.isLooping) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickedBeat = clientXToBeat(e.clientX, rect);
    if (clickedBeat >= loopSettings.loopStart && clickedBeat <= loopSettings.loopEnd) {
      setLoop(false, 0, 0);
    }
  };

  return (
    <div
      onPointerDown={handleRulerPointerDown}
      onPointerMove={handleRulerPointerMove}
      onPointerUp={handleRulerPointerUp}
      onDoubleClick={handleRulerDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
      className="flex h-7.5 border-[#17181c] border-b pb-1 cursor-pointer select-none sticky top-0 bg-[#0a0b0d] z-20"
    >
      {/* Sticky lane label column */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="w-[130px] shrink-0 flex items-center pl-2 text-zinc-500 font-bold uppercase text-[8.5px] font-mono border-r border-[#17181c] h-full sticky left-0 bg-[#0a0b0d] z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] cursor-default"
      >
        Arranger Lanes
      </div>

      {/* Beat grid area */}
      <div className="flex-1 relative h-full overflow-visible">


        {/* Loop Range visual indicator overlay */}
        {loopSettings.isLooping && (
          <div
            className="absolute top-0 bottom-0 bg-amber-500/10 border-l border-r border-amber-500/40 pointer-events-none z-10"
            style={{
              left: `${loopSettings.loopStart * beatWidth}px`,
              width: `${(loopSettings.loopEnd - loopSettings.loopStart) * beatWidth}px`,
            }}
          >
            <div className="absolute left-0 top-0 bg-amber-500 text-[6px] font-black text-black px-0.5 select-none leading-none rounded-br-xs">
              L
            </div>
            <div className="absolute right-0 top-0 bg-amber-500 text-[6px] font-black text-black px-0.5 select-none leading-none rounded-bl-xs">
              R
            </div>
          </div>
        )}

        {/* Beat tick markers */}
        {(() => {
          const start = Math.max(0, Math.floor(scrollLeft / beatWidth) - 8);
          const end = Math.min(totalBeats, Math.ceil((scrollLeft + viewportWidth) / beatWidth) + 8);
          const visibleBeats = [];
          for (let i = start; i < end; i++) {
            visibleBeats.push(i);
          }
          return visibleBeats;
        })().map((beat) => {
          const isBar = beat % 4 === 0;
          return (
            <div
              key={beat}
              className={`absolute top-0 bottom-0 text-left pl-1 flex flex-col justify-end pointer-events-none select-none ${
                isBar ? "border-l border-zinc-700" : "border-l border-[#191a1e]/50"
              }`}
              style={{ left: `${beat * beatWidth}px`, width: `${beatWidth}px` }}
            >
              {isBar ? (
                <span className="text-cyan-400 font-black font-mono text-[7.5px] leading-tight">
                  BAR {Math.floor(beat / 4) + 1}
                </span>
              ) : (
                <span className="text-zinc-650 font-mono text-[6.5px] leading-none">{beat + 1}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
