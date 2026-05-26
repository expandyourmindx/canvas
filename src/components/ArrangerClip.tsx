/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from "react";
import { CanvasClip, PatternData } from "../types";
import { LANE_HEIGHT_PX, CLIP_HEIGHT_PX, CLIP_TOP_OFFSET_PX } from "../config";
import { useAudioEngine } from "../audio/useAudioEngine";

interface ArrangerClipProps {
  clip: CanvasClip;
  beatWidth: number;
  isSelected: boolean;
  activeTool: "pencil" | "pointer" | "split";
  patterns: PatternData[];
  getSampleBuffer: (id: string) => AudioBuffer | undefined;
  removeCanvasClip: (id: string) => void;
  handleClipSplit: (e: React.PointerEvent<HTMLDivElement>, clip: CanvasClip) => void;
  handleClipPointerDown: (e: React.PointerEvent<HTMLDivElement>, clip: CanvasClip) => void;
  handleClipPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleClipPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleClipDoubleClick: (clip: CanvasClip) => void;
  handleResizeDown: (
    e: React.PointerEvent<HTMLDivElement>,
    clip: CanvasClip,
    edge: "left" | "right"
  ) => void;
  handleResizeMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleResizeUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export function ArrangerClip({
  clip,
  beatWidth,
  isSelected,
  activeTool,
  patterns,
  getSampleBuffer,
  removeCanvasClip,
  handleClipSplit,
  handleClipPointerDown,
  handleClipPointerMove,
  handleClipPointerUp,
  handleClipDoubleClick,
  handleResizeDown,
  handleResizeMove,
  handleResizeUp,
}: ArrangerClipProps) {
  const { engine } = useAudioEngine();
  const leftPx = clip.startBeat * beatWidth;
  const widthPx = clip.duration * beatWidth;
  const topPx = clip.laneIndex * LANE_HEIGHT_PX + CLIP_TOP_OFFSET_PX;
  const heightPx = CLIP_HEIGHT_PX;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // High-resolution peak data caching keyed by sampleId
  const peaksCacheRef = useRef<Map<string, { mins: Float32Array; maxs: Float32Array }>>(new Map());

  // Pixel-accurate canvas waveform rendering
  useEffect(() => {
    if (clip.type !== "sample" || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const buffer = getSampleBuffer(clip.referenceId);
    const dpr = window.devicePixelRatio || 1;

    if (!buffer) {
      // Clear canvas if buffer is not loaded/ready
      canvas.width = widthPx * dpr;
      canvas.height = heightPx * dpr;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Set actual pixel dimensions scaled by devicePixelRatio for razor-sharp rendering
    canvas.width = widthPx * dpr;
    canvas.height = heightPx * dpr;

    // Scale canvas context to match physical CSS dimensions
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, widthPx, heightPx);

    const sampleId = clip.referenceId;
    const peaksCache = peaksCacheRef.current;

    // 1. Compute and cache peaks once per unique sampleId
    if (!peaksCache.has(sampleId)) {
      const channelData = buffer.getChannelData(0);
      const N = 4000; // Detailed peak data array resolution
      const step = Math.ceil(channelData.length / N);
      const mins = new Float32Array(N);
      const maxs = new Float32Array(N);

      for (let i = 0; i < N; i++) {
        let min = 0;
        let max = 0;
        let hasData = false;
        const start = i * step;
        const end = Math.min(start + step, channelData.length);
        for (let j = start; j < end; j++) {
          const val = channelData[j];
          if (!hasData) {
            min = val;
            max = val;
            hasData = true;
          } else {
            if (val < min) min = val;
            if (val > max) max = val;
          }
        }
        mins[i] = min;
        maxs[i] = max;
      }
      peaksCache.set(sampleId, { mins, maxs });
    }

    // 2. Draw the pixel-accurate waveform centered around heightPx / 2
    const cache = peaksCache.get(sampleId);
    if (cache) {
      const { mins, maxs } = cache;
      const N = mins.length;

      const clipDurationSeconds = engine.beatsToSeconds(clip.duration);
      const cropStartSeconds = engine.beatsToSeconds(clip.cropStart || 0);
      const sampleDurationSeconds = buffer.duration;

      if (clipDurationSeconds <= 0 || sampleDurationSeconds <= 0) return;

      const ampScale = 0.85; // Standard amplitude scale to keep clean vertical margins
      const midY = heightPx / 2;

      ctx.strokeStyle = "rgba(34, 211, 238, 0.85)"; // High-contrast cyan
      ctx.lineWidth = 1.2;

      for (let i = 0; i < widthPx; i++) {
        const tStart = cropStartSeconds + (i / widthPx) * clipDurationSeconds;
        const tEnd = cropStartSeconds + ((i + 1) / widthPx) * clipDurationSeconds;

        if (tStart < 0 || tStart >= sampleDurationSeconds) {
          continue; // Silence (pre-gap or post-gap)
        }

        let min = 0;
        let max = 0;
        let hasData = false;

        const startIdx = Math.floor((tStart / sampleDurationSeconds) * N);
        const endIdx = Math.ceil((tEnd / sampleDurationSeconds) * N);

        const clampedStart = Math.max(0, Math.min(N - 1, startIdx));
        const clampedEnd = Math.max(1, Math.min(N, endIdx));

        for (let j = clampedStart; j < clampedEnd; j++) {
          if (!hasData) {
            min = mins[j];
            max = maxs[j];
            hasData = true;
          } else {
            if (mins[j] < min) min = mins[j];
            if (maxs[j] > max) max = maxs[j];
          }
        }

        const yMin = midY + min * midY * ampScale;
        const yMax = midY + max * midY * ampScale;

        ctx.beginPath();
        ctx.moveTo(i, yMin);
        ctx.lineTo(i, yMax);
        ctx.stroke();
      }
    }
  }, [clip.referenceId, clip.type, widthPx, heightPx, getSampleBuffer, clip.duration, clip.cropStart, engine]);

  return (
    <div
      data-clip-id={clip.id}
      onContextMenu={(e) => {
        e.preventDefault();
        removeCanvasClip(clip.id);
      }}
      onPointerDown={(e) => {
        if (activeTool === "split") {
          e.stopPropagation();
          handleClipSplit(e, clip);
          return;
        }
        handleClipPointerDown(e, clip);
      }}
      onPointerEnter={(e) => {
        if (e.buttons === 2) {
          removeCanvasClip(clip.id);
        }
      }}
      onPointerMove={handleClipPointerMove}
      onPointerUp={handleClipPointerUp}
      onDoubleClick={(e) => {
        e.stopPropagation();
        handleClipDoubleClick(clip);
      }}
      className={`canvas-clip-body absolute border rounded-none bg-gradient-to-br ${
        clip.color
      } py-0.5 flex flex-col justify-between overflow-hidden shadow-md cursor-grab active:cursor-grabbing select-none touch-none pointer-events-auto ${
        isSelected ? "border-white/60 shadow-[inset_0_0_4px_rgba(255,255,255,0.25)]" : ""
      }`}
      style={{
        left: `${leftPx}px`,
        width: `${widthPx}px`,
        top: `${topPx}px`,
        height: `${heightPx}px`,
      }}
      title="Double-click to edit, Drag handles to crop, Right-click to delete"
    >
      {/* HTML5 Pixel-Accurate Waveform Canvas */}
      {clip.type === "sample" && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
        />
      )}

      {/* Left Crop Handle */}
      <div
        onPointerDown={(e) => handleResizeDown(e, clip, "left")}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeUp}
        className="clip-resize-handle absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/10 z-20 flex items-center justify-center rounded-none"
        title="Drag left edge to crop start"
      />

      {/* Right Duration Handle */}
      <div
        onPointerDown={(e) => handleResizeDown(e, clip, "right")}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeUp}
        className="clip-resize-handle absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/10 z-20 flex items-center justify-center rounded-none"
        title="Drag right edge to crop end / change duration"
      />

      <div className="flex flex-col text-left leading-none truncate pointer-events-none z-10 px-1.5 pt-0.5">
        <span className="text-[8.5px] font-black uppercase truncate text-neutral-100">{clip.name}</span>
        <span className="text-[7px] font-mono opacity-50 truncate mt-0.5">
          {clip.type === "pattern" ? `PAT: ${clip.referenceId}` : `WAV: ${clip.referenceId}`}
        </span>
      </div>

      <div className="w-full flex-1 min-h-0 flex items-end pointer-events-none select-none z-10">
        {clip.type === "sample" ? (
          <div className="w-full h-6" />
        ) : (
          <div className="w-full h-6.5 relative bg-black/45 rounded-xs overflow-hidden pointer-events-none mt-0.5 border border-neutral-900/40">
            {(() => {
              const pattern = patterns.find((p) => p.id === clip.referenceId);
              if (!pattern) return null;

              const cropStart = clip.cropStart || 0;
              const pitches = pattern.notes.map((n) => n.pitch).filter((p): p is number => p !== undefined);
              const minPitch = pitches.length > 0 ? Math.min(...pitches) - 1 : 48;
              const maxPitch = pitches.length > 0 ? Math.max(...pitches) + 1 : 72;
              const pitchRange = Math.max(12, maxPitch - minPitch);

              return pattern.notes.map((note, idx) => {
                const visibleTime = note.time - cropStart;
                if (visibleTime < 0 || visibleTime >= clip.duration) return null;

                const noteLeftPx = visibleTime * beatWidth;
                const noteWidthPx = (note.duration || 0.25) * beatWidth;
                const notePitch = note.pitch ?? 60;
                const topPct = 100 - ((notePitch - minPitch) / pitchRange) * 100;

                return (
                  <div
                    key={idx}
                    className="absolute h-[2px] bg-cyan-400/80 shadow-[0_0_2.5px_#22d3ee] rounded-xs"
                    style={{
                      left: `${noteLeftPx}px`,
                      width: `${noteWidthPx}px`,
                      top: `${Math.min(85, Math.max(15, topPct))}%`,
                    }}
                  />
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
