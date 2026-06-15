/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import { useTheme } from "../theme/ThemeContext";

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

function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
  const { theme: DARK, SPACE } = useTheme();
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
      style={{
        display: "flex",
        height: "30px", // matching original height
        border: "none",
        borderBottom: `1px solid ${DARK.bevelMid}`, // flat(DARK) bottom border
        cursor: "pointer",
        userSelect: "none",
        position: "sticky",
        top: 0,
        backgroundColor: DARK.bg1, // Ruler background
        zIndex: 20,
        boxSizing: "border-box",
      }}
    >
      {/* Sticky lane label column */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          width: `${LABEL_WIDTH_PX}px`,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          paddingLeft: `${SPACE.sm}px`,
          color: DARK.textMid, // textMid hierarchy
          fontWeight: "bold",
          textTransform: "uppercase",
          fontSize: "8px",
          fontFamily: DARK.font,
          borderRight: `1px solid ${DARK.bevelDark}`, // flat/dark separator
          height: "100%",
          position: "sticky",
          left: 0,
          backgroundColor: DARK.bg1,
          zIndex: 30,
          cursor: "default",
          boxSizing: "border-box",
        }}
      >
        Arranger Lanes
      </div>

      {/* Beat grid area */}
      <div
        style={{
          flex: 1,
          position: "relative",
          height: "100%",
          overflow: "visible",
          boxSizing: "border-box",
        }}
      >
        {/* Loop Range visual indicator overlay */}
        {loopSettings.isLooping && (
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${loopSettings.loopStart * beatWidth}px`,
              width: `${(loopSettings.loopEnd - loopSettings.loopStart) * beatWidth}px`,
              backgroundColor: hexToRgba(DARK.accentBlue, 0.15), // loop region fill DARK.accentBlue at 15%
              border: "none",
              borderLeft: `1px solid ${DARK.accentBlue}`, // loop bracket lines DARK.accentBlue
              borderRight: `1px solid ${DARK.accentBlue}`,
              pointerEvents: "none",
              zIndex: 10,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                backgroundColor: DARK.accentBlue,
                fontSize: "6px",
                fontWeight: "black",
                color: DARK.bg0,
                padding: `0 ${SPACE.xs}px`,
                userSelect: "none",
                lineHeight: "1.2",
                fontFamily: DARK.font,
                boxSizing: "border-box",
              }}
            >
              L
            </div>
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                backgroundColor: DARK.accentBlue,
                fontSize: "6px",
                fontWeight: "black",
                color: DARK.bg0,
                padding: `0 ${SPACE.xs}px`,
                userSelect: "none",
                lineHeight: "1.2",
                fontFamily: DARK.font,
                boxSizing: "border-box",
              }}
            >
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
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${beat * beatWidth}px`,
                width: `${beatWidth}px`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                paddingLeft: `${SPACE.xs}px`,
                pointerEvents: "none",
                userSelect: "none",
                boxSizing: "border-box",
              }}
            >
              {/* Vertical grid line marker */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  bottom: 0,
                  width: "1px",
                  height: isBar ? "100%" : "8px", // shorter height than bar lines
                  backgroundColor: isBar ? DARK.bevelDark : DARK.bg5, // Bar lines: DARK.bevelDark, beat subdivision lines: DARK.bg5
                }}
              />

              {isBar ? (
                <span
                  style={{
                    fontSize: "8px",
                    color: DARK.textMid, // bar label textMid hierarchy
                    fontFamily: DARK.font,
                    fontWeight: "black",
                    textTransform: "uppercase",
                    lineHeight: "1.0",
                    marginBottom: `${SPACE.xs}px`,
                  }}
                >
                  BAR {Math.floor(beat / 4) + 1}
                </span>
              ) : (
                <span
                  style={{
                    fontSize: "7px", // subdivision beat label textDim hierarchy
                    color: DARK.textDim,
                    fontFamily: DARK.font,
                    textTransform: "uppercase",
                    lineHeight: "1.0",
                    marginBottom: `${SPACE.xs}px`,
                  }}
                >
                  {beat + 1}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
