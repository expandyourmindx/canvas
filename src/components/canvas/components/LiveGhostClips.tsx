import React, { useEffect, useRef } from "react";
import { useAudioEngine } from "../../../audio/useAudioEngine";
import { LANE_HEIGHT_PX, CLIP_HEIGHT_PX, CLIP_TOP_OFFSET_PX } from "../../../config";

interface GhostClip {
  insertIndex: number;
  laneIndex: number;
  startBeat: number;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

interface LiveGhostClipsProps {
  ghostClips: GhostClip[];
  beatWidth: number;
  engine: any;
  getRecordingStatus: () => any;
  isRecording: boolean;
}

export function LiveGhostClips({
  ghostClips,
  beatWidth,
  engine,
  getRecordingStatus,
  isRecording
}: LiveGhostClipsProps) {
  const { position } = useAudioEngine();
  const rafRef = useRef<number | null>(null);
  const ghostClipsRef = useRef<GhostClip[]>(ghostClips);

  useEffect(() => {
    ghostClipsRef.current = ghostClips;
  }, [ghostClips]);

  useEffect(() => {
    if (!isRecording) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const drawFrame = () => {
      const status = getRecordingStatus();
      const ghosts = ghostClipsRef.current;
      const now = engine.getCurrentPosition('beats');

      ghosts.forEach((ghost) => {
        const canvas = ghost.canvasRef.current;
        if (!canvas) return;

        const durationBeats = Math.max(0.01, now - ghost.startBeat);
        const widthPx = durationBeats * beatWidth;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, widthPx * dpr);
        canvas.height = CLIP_HEIGHT_PX * dpr;
        canvas.style.width = `${widthPx}px`;
        canvas.style.height = `${CLIP_HEIGHT_PX}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, widthPx, CLIP_HEIGHT_PX);

        const peakData = status.peakData.get(ghost.insertIndex);
        if (!peakData || peakData.mins.length === 0) return;

        const { mins, maxs } = peakData;
        const N = mins.length;
        const headerHeight = 16;
        const bodyHeight = CLIP_HEIGHT_PX - headerHeight;
        const midY = headerHeight + bodyHeight / 2;
        const ampScale = 0.85;

        ctx.strokeStyle = 'rgba(192, 57, 43, 0.85)';
        ctx.lineWidth = 1.2;

        for (let i = 0; i < widthPx; i++) {
          const peakIdx = Math.floor((i / widthPx) * N);
          if (peakIdx >= N) break;
          const min = mins[peakIdx];
          const max = maxs[peakIdx];
          const yMin = midY - max * (bodyHeight / 2) * ampScale;
          const yMax = midY - min * (bodyHeight / 2) * ampScale;
          ctx.beginPath();
          ctx.moveTo(i, yMin);
          ctx.lineTo(i, Math.max(yMin + 1, yMax));
          ctx.stroke();
        }
      });

      rafRef.current = requestAnimationFrame(drawFrame);
    };

    rafRef.current = requestAnimationFrame(drawFrame);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isRecording, beatWidth, engine, getRecordingStatus]);

  if (!isRecording || ghostClips.length === 0) return null;

  return (
    <>
      {ghostClips.map((ghost) => {
        const now = position.beats;
        const durationBeats = Math.max(0.01, now - ghost.startBeat);
        const leftPx = ghost.startBeat * beatWidth;
        const widthPx = durationBeats * beatWidth;
        const topPx = ghost.laneIndex * LANE_HEIGHT_PX + CLIP_TOP_OFFSET_PX;

        return (
          <div
            key={`ghost-${ghost.insertIndex}`}
            style={{
              position: 'absolute',
              left: `${leftPx}px`,
              top: `${topPx}px`,
              width: `${widthPx}px`,
              height: `${CLIP_HEIGHT_PX}px`,
              backgroundColor: 'rgba(192, 57, 43, 0.15)',
              border: '1px solid rgba(192, 57, 43, 0.5)',
              boxSizing: 'border-box',
              pointerEvents: 'none',
              overflow: 'hidden',
            }}
          >
            {/* Ghost clip header */}
            <div style={{
              height: '16px',
              backgroundColor: 'rgba(192, 57, 43, 0.25)',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: '4px',
              gap: '4px',
            }}>
              <span style={{
                fontSize: '8px',
                color: '#c0392b',
                fontFamily: 'Electrolize, monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>
                ● REC
              </span>
            </div>
            {/* Live waveform canvas */}
            <canvas
              ref={ghost.canvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            />
          </div>
        );
      })}
    </>
  );
}
