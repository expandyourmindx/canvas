import React, { useRef, useEffect } from "react";
import { useTheme } from "../../../theme/ThemeContext";
import { useAudioEngine } from "../../../audio/useAudioEngine";

interface LevelMeterProps {
  insertIndex: number;
  isMuted: boolean;
}

export function LevelMeter({ insertIndex, isMuted }: LevelMeterProps) {
  const { theme: DARK, sunken } = useTheme();
  const { engine } = useAudioEngine();
  const rawMeterRef = useRef<HTMLDivElement>(null);
  const peakLineRef = useRef<HTMLDivElement>(null);
  const clipLedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrameId: number;
    let peakHoldValue = 0;
    let lastClipTime = 0;

    const updateMeter = () => {
      if (!engine) return;

      const levels = engine.getInsertLevels(insertIndex);
      const rms = isMuted ? 0 : levels.rms;
      const peak = isMuted ? 0 : levels.peak;

      // Map RMS to percentage
      const rmsHeight = Math.min(100, Math.pow(rms, 0.6) * 100);
      
      // Decay peak hold line
      if (peak > peakHoldValue) {
        peakHoldValue = peak;
      } else {
        peakHoldValue = Math.max(0, peakHoldValue - 0.015); // slow decay
      }
      const peakHeight = Math.min(100, Math.pow(peakHoldValue, 0.6) * 100);

      // Render RMS stacked segments
      const activeSegments = Math.round((rmsHeight / 100) * 12);
      if (rawMeterRef.current) {
        const segments = rawMeterRef.current.children;
        for (let i = 0; i < 12; i++) {
          const segment = segments[11 - i] as HTMLDivElement; // index 11 is top, index 0 is bottom
          if (segment) {
            const isLit = i < activeSegments;
            segment.style.backgroundColor = isLit ? DARK.vu[i] : DARK.vuOff;
            segment.style.borderTop = isLit ? `1px solid rgba(255,255,255,0.12)` : `1px solid ${DARK.bevelDark}`;
          }
        }
      }

      // Render Peak Hold thin line
      if (peakLineRef.current) {
        peakLineRef.current.style.bottom = `${peakHeight}%`;
        peakLineRef.current.style.display = peakHeight > 1 ? "block" : "none";
      }

      // Clipping LED check (0dBFS threshold is 1.0 amplitude)
      const now = Date.now();
      if (peak >= 0.99) {
        lastClipTime = now;
      }

      // Light up clipping LED if clipping occurred in the last 1000ms
      if (clipLedRef.current) {
        const isClipping = (now - lastClipTime) < 1000;
        if (isClipping) {
          clipLedRef.current.style.backgroundColor = DARK.stateHot;
        } else {
          clipLedRef.current.style.backgroundColor = DARK.bg0;
        }
      }

      animationFrameId = requestAnimationFrame(updateMeter);
    };

    updateMeter();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [engine, insertIndex, isMuted, DARK]);

  return (
    <div 
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        width: "14px",
        backgroundColor: DARK.bg0,
        ...sunken(DARK),
        height: "176px",
        paddingTop: "6px",
        paddingBottom: "6px",
        position: "relative",
        userSelect: "none",
        boxSizing: "border-box",
      }}
    >
      {/* 1S Hold clipping LED */}
      <div 
        ref={clipLedRef} 
        style={{
          width: "6px",
          height: "4px",
          backgroundColor: DARK.bg0,
          marginBottom: "6px",
        }}
        title="0dBFS CLIP INDICATOR (HOLDS FOR 1S)"
      />

      {/* Meter Cage */}
      <div 
        style={{
          flex: 1,
          width: "6px",
          position: "relative",
          backgroundColor: DARK.bg0,
          overflow: "hidden",
        }}
      >
        {/* Stacked segments container */}
        <div 
          ref={rawMeterRef}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1px",
            height: "100%",
            width: "6px",
          }}
        >
          {Array.from({ length: 12 }).map((_, i) => {
            const idx = 11 - i;
            return (
              <div 
                key={idx}
                style={{
                  flex: 1,
                  backgroundColor: DARK.vuOff,
                  borderTop: `1px solid ${DARK.bevelDark}`,
                }}
              />
            );
          })}
        </div>

        {/* Peak Hold Line */}
        <div 
          ref={peakLineRef}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: "2px",
            backgroundColor: DARK.accentBlue,
            pointerEvents: "none",
            zIndex: 10,
            display: "none",
          }}
        />
      </div>
    </div>
  );
}
