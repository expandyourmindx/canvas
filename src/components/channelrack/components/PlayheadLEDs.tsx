/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from "react";
import { useAudioEngine } from "../../../audio/useAudioEngine";
import { useTheme } from "../../../theme/ThemeContext";

interface PlayheadLEDsProps {
  containerRef: React.RefObject<HTMLDivElement>;
}

export function PlayheadLEDs({ containerRef }: PlayheadLEDsProps) {
  const { theme: DARK, SPACE } = useTheme();
  const { engine, playbackState } = useAudioEngine();

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const pos = engine.getCurrentPosition("beats");
      const newIndex = playbackState === "playing"
        ? Math.floor((pos % 4) / 0.25)
        : -1;
      
      const container = containerRef.current;
      if (container) {
        const nextAttr = String(newIndex);
        if (container.getAttribute("data-active-playhead") !== nextAttr) {
          container.setAttribute("data-active-playhead", nextAttr);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playbackState, engine, containerRef]);

  const stepColumns = Array.from({ length: 16 }, (_, i) => i * 0.25);

  const ledOff = DARK.bg0;
  const ledOffBorder = DARK.bevelDark;
  const ledOn = DARK.accentBlue;
  const ledOnBorder = DARK.bevelLight;

  return (
    <div 
      style={{
        display: "flex",
        alignItems: "center",
        height: "12px",
        userSelect: "none",
        pointerEvents: "none",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        .playhead-led {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background-color: ${ledOff};
          border: 1px solid ${ledOffBorder};
          box-sizing: border-box;
          transition: background-color 0.05s ease;
        }

        .step-container[data-active-playhead="0"] .playhead-led[data-step-index="0"],
        .step-container[data-active-playhead="1"] .playhead-led[data-step-index="1"],
        .step-container[data-active-playhead="2"] .playhead-led[data-step-index="2"],
        .step-container[data-active-playhead="3"] .playhead-led[data-step-index="3"],
        .step-container[data-active-playhead="4"] .playhead-led[data-step-index="4"],
        .step-container[data-active-playhead="5"] .playhead-led[data-step-index="5"],
        .step-container[data-active-playhead="6"] .playhead-led[data-step-index="6"],
        .step-container[data-active-playhead="7"] .playhead-led[data-step-index="7"],
        .step-container[data-active-playhead="8"] .playhead-led[data-step-index="8"],
        .step-container[data-active-playhead="9"] .playhead-led[data-step-index="9"],
        .step-container[data-active-playhead="10"] .playhead-led[data-step-index="10"],
        .step-container[data-active-playhead="11"] .playhead-led[data-step-index="11"],
        .step-container[data-active-playhead="12"] .playhead-led[data-step-index="12"],
        .step-container[data-active-playhead="13"] .playhead-led[data-step-index="13"],
        .step-container[data-active-playhead="14"] .playhead-led[data-step-index="14"],
        .step-container[data-active-playhead="15"] .playhead-led[data-step-index="15"] {
          background-color: ${ledOn} !important;
          border: 1px solid ${ledOnBorder} !important;
        }

        .step-grid-button {
          transition: background-color 0.05s ease;
        }

        .step-container[data-active-playhead="0"] .step-grid-button[data-step-index="0"],
        .step-container[data-active-playhead="1"] .step-grid-button[data-step-index="1"],
        .step-container[data-active-playhead="2"] .step-grid-button[data-step-index="2"],
        .step-container[data-active-playhead="3"] .step-grid-button[data-step-index="3"],
        .step-container[data-active-playhead="4"] .step-grid-button[data-step-index="4"],
        .step-container[data-active-playhead="5"] .step-grid-button[data-step-index="5"],
        .step-container[data-active-playhead="6"] .step-grid-button[data-step-index="6"],
        .step-container[data-active-playhead="7"] .step-grid-button[data-step-index="7"],
        .step-container[data-active-playhead="8"] .step-grid-button[data-step-index="8"],
        .step-container[data-active-playhead="9"] .step-grid-button[data-step-index="9"],
        .step-container[data-active-playhead="10"] .step-grid-button[data-step-index="10"],
        .step-container[data-active-playhead="11"] .step-grid-button[data-step-index="11"],
        .step-container[data-active-playhead="12"] .step-grid-button[data-step-index="12"],
        .step-container[data-active-playhead="13"] .step-grid-button[data-step-index="13"],
        .step-container[data-active-playhead="14"] .step-grid-button[data-step-index="14"],
        .step-container[data-active-playhead="15"] .step-grid-button[data-step-index="15"] {
          background-color: var(--passing-bg) !important;
        }
      `}</style>

      {/* Transparent spacer corresponding to Grab Handle (14px) + Command Strip (240px) */}
      <div style={{ width: "254px", flexShrink: 0 }} />

      {/* Bulbs Grid */}
      <div 
        style={{
          flex: 1,
          paddingLeft: "6px",
          paddingRight: "6px",
          boxSizing: "border-box",
          display: "grid",
          gridTemplateColumns: "repeat(16, minmax(0, 1fr))",
          gap: `${SPACE.xs}px`,
          alignItems: "center",
        }}
      >
        {stepColumns.map((_, i) => (
          <div 
            key={i} 
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "4px",
            }}
          >
            <div
              className="playhead-led"
              data-step-index={i}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
