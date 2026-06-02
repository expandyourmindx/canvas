/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from "react";
import { CanvasClip, PatternData } from "../types";
import { LANE_HEIGHT_PX, CLIP_HEIGHT_PX, CLIP_TOP_OFFSET_PX, AVAILABLE_SAMPLES } from "../config";
import { useAudioEngine } from "../audio/useAudioEngine";
import { Keyboard, Music } from "lucide-react";
import {
  DARK,
  raised,
  sunken,
  flat,
  flush,
  SPACE,
  SIZE
} from "../../public/Themes/Vintage Console/tokens";

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

function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const getClipAccentColor = (clip: CanvasClip) => {
  const color = clip.color;
  if (color && color.startsWith("#")) {
    return color;
  }
  return clip.type === "sample" ? DARK.accentGreen : DARK.accentBlue;
};

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
  
  // Clip frame width always = clip.duration (set by drag handles). Never changes due to stretch.
  const settings = clip.type === "sample" ? engine.getChannelSamplerSettings(clip.referenceId) : undefined;
  const widthPx = clip.duration * beatWidth;
  
  const topPx = clip.laneIndex * LANE_HEIGHT_PX + CLIP_TOP_OFFSET_PX;
  const heightPx = CLIP_HEIGHT_PX;
  const isLoading = clip.type === "sample" && typeof (engine as any).isClipLoading === "function" && (engine as any).isClipLoading(clip.id);

  const resolvedName = clip.name || (() => {
    if (clip.type === "pattern") {
      const match = patterns.find((p) => p.id === clip.referenceId);
      return match?.name || "MIDI Pattern";
    } else {
      const preset = AVAILABLE_SAMPLES.find((s) => s.id === clip.referenceId);
      if (preset) return preset.name;
      
      const parts = clip.referenceId.split(/[/\\]/);
      const fileName = parts[parts.length - 1] || clip.referenceId;
      
      return fileName
        .replace(/\.(wav|mp3|ogg|flac|aac|m4a)$/i, "")
        .split(/[-_]/)
        .map((w) => w ? w.charAt(0).toUpperCase() + w.slice(1) : "")
        .join(" ");
    }
  })();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // High-resolution peak data caching keyed by sampleId
  const peaksCacheRef = useRef<Map<string, { mins: Float32Array; maxs: Float32Array }>>(new Map());

  const accentColor = getClipAccentColor(clip);

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

    // 2. Draw the pixel-accurate waveform centered around the body below the header
    const cache = peaksCache.get(sampleId);
    if (cache) {
      const { mins, maxs } = cache;
      const N = mins.length;

      // effectiveWidthPx = total canvas pixels that the FULL stretched audio spans.
      // This is the waveform's fixed pixel scale — independent of clip.duration.
      // clip.duration (= widthPx) is just a viewport window sliding over this scaled waveform.
      //
      // Default: use the sample's natural duration at current BPM — never clip.duration.
      // This ensures fresh clips (settings=undefined) also get a fixed waveform scale.
      const secondsPerBeat = engine.beatsToSeconds(1);
      let effectiveWidthPx = secondsPerBeat > 0
        ? (buffer.duration / secondsPerBeat) * beatWidth
        : widthPx;

      if (settings) {
        const stretchTime = settings.stretchTime || 0;
        const multiplier = settings.stretchMul ?? 1.0;
        const pitchCents = settings.stretchPitch || 0;
        const mode = settings.stretchMode?.toUpperCase();

        if (mode === "RESAMPLE") {
          const pitchRatio = Math.pow(2, pitchCents / 1200);
          if (stretchTime > 0) {
            // Fixed target: stretchTime beats of sample plays at multiplier*pitchRatio speed
            // → full buffer spans stretchTime/(multiplier*pitchRatio) beats on the timeline
            effectiveWidthPx = (stretchTime / (multiplier * pitchRatio)) * beatWidth;
          } else {
            // Auto: playbackRate = multiplier*pitchRatio, buffer plays at natural speed scaled
            // Full buffer audible duration = buffer.duration / (multiplier*pitchRatio)
            effectiveWidthPx = secondsPerBeat > 0
              ? (buffer.duration / (multiplier * pitchRatio) / secondsPerBeat) * beatWidth
              : widthPx;
          }
        } else if (mode === "STRETCH") {
          // STRETCH: processed buffer has a different physical duration
          effectiveWidthPx = stretchTime > 0
            ? (stretchTime / multiplier) * beatWidth
            : (clip.duration / multiplier) * beatWidth;
        }
      }

      if (effectiveWidthPx <= 0 || buffer.duration <= 0) return;

      // cropStart in beats → pixel offset into the stretched waveform space
      const cropOffsetPx = (clip.cropStart || 0) * beatWidth;

      const headerHeight = 16;
      const bodyHeight = heightPx - headerHeight;
      const midY = headerHeight + bodyHeight / 2;
      const ampScale = 0.85;

      ctx.strokeStyle = hexToRgba(accentColor, 0.85);
      ctx.lineWidth = 1.2;

      for (let i = 0; i < widthPx; i++) {
        // Map canvas pixel i to a position in the raw buffer.
        // The stretched audio spans effectiveWidthPx pixels total.
        // cropOffsetPx shifts which part of that space is visible.
        const wavePosPx = cropOffsetPx + i;
        const tStart = (wavePosPx / effectiveWidthPx) * buffer.duration;
        const tEnd = ((wavePosPx + 1) / effectiveWidthPx) * buffer.duration;

        if (tStart < 0 || tStart >= buffer.duration) {
          continue; // beyond sample — silence
        }

        let min = 0;
        let max = 0;
        let hasData = false;

        const startIdx = Math.floor((tStart / buffer.duration) * N);
        const endIdx = Math.ceil((tEnd / buffer.duration) * N);

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

        const yMin = midY + min * (bodyHeight / 2) * ampScale;
        const yMax = midY + max * (bodyHeight / 2) * ampScale;

        ctx.beginPath();
        ctx.moveTo(i, yMin);
        ctx.lineTo(i, yMax);
        ctx.stroke();
      }
    }
  }, [clip.referenceId, clip.type, widthPx, heightPx, getSampleBuffer, clip.duration, clip.cropStart, settings, beatWidth, engine, accentColor]);

  const clipBorder = isSelected
    ? raised({ bevelLight: "#ffffff", bevelDark: "#ffffff" })
    : raised({ bevelLight: accentColor, bevelDark: DARK.bevelDark });

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
      className="canvas-clip-body absolute flex flex-col justify-between overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none pointer-events-auto"
      style={{
        left: `${leftPx}px`,
        width: `${widthPx}px`,
        top: `${topPx}px`,
        height: `${heightPx}px`,
        backgroundColor: DARK.bg2,
        boxSizing: "border-box",
        ...clipBorder,
      }}
      title="Double-click to edit, Drag handles to crop, Right-click to delete"
    >
      {/* HTML5 Pixel-Accurate Waveform Canvas */}
      {clip.type === "sample" && (
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 0,
            opacity: isLoading ? 0.3 : 1,
          }}
        />
      )}

      {/* Beautiful Loading State Overlay */}
      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontSize: "8px",
              fontWeight: "bold",
              fontFamily: DARK.font,
              color: accentColor,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
            }}
          >
            Processing...
          </span>
        </div>
      )}

      {/* Left Crop Handle */}
      <div
        onPointerDown={(e) => handleResizeDown(e, clip, "left")}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeUp}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "6px",
          cursor: "ew-resize",
          zIndex: 20,
        }}
        title="Drag left edge to crop start"
      />

      {/* Right Duration Handle */}
      <div
        onPointerDown={(e) => handleResizeDown(e, clip, "right")}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeUp}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: "6px",
          cursor: "ew-resize",
          zIndex: 20,
        }}
        title="Drag right edge to crop end / change duration"
      />

      {/* Sleek Unified Header */}
      <div
        style={{
          width: "100%",
          height: "16px",
          backgroundColor: hexToRgba(accentColor, 0.15),
          display: "flex",
          alignItems: "center",
          paddingLeft: `${SPACE.sm}px`,
          paddingRight: `${SPACE.sm}px`,
          gap: `${SPACE.xs}px`,
          flexShrink: 0,
          zIndex: 10,
          borderBottom: `1px solid ${DARK.bevelDark}`,
          boxSizing: "border-box",
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        {clip.type === "pattern" ? (
          <Keyboard style={{ width: "10px", height: "10px", color: accentColor, flexShrink: 0 }} />
        ) : (
          <Music style={{ width: "10px", height: "10px", color: accentColor, flexShrink: 0 }} />
        )}
        <span
          style={{
            fontSize: "8px",
            fontWeight: "bold",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontFamily: DARK.font,
            color: DARK.textHi,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1,
            marginTop: "1px",
          }}
        >
          {resolvedName}
        </span>
      </div>

      <div
        style={{
          width: "100%",
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "flex-end",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 10,
          paddingBottom: "2px",
          boxSizing: "border-box",
        }}
      >
        {clip.type === "sample" ? (
          <div style={{ width: "100%", height: "20px" }} />
        ) : (
          <div style={{ width: "100%", height: "20px", position: "relative", overflow: "hidden", pointerEvents: "none" }}>
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
                    style={{
                      position: "absolute",
                      left: `${noteLeftPx}px`,
                      width: `${noteWidthPx}px`,
                      top: `${Math.min(85, Math.max(15, topPct))}%`,
                      height: "3px",
                      backgroundColor: accentColor,
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

