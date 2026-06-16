/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useTheme } from "../../../theme/ThemeContext";
import { ChannelRow, DAWEvent } from "../../../types";

interface PianoRollPreviewProps {
  channel: ChannelRow;
  channelEvents: DAWEvent[];
  onOpenPianoRoll?: (channelId: string) => void;
  setActiveInstrumentId: (id: string) => void;
  setFocusedChannelId: (id: string) => void;
}

export function PianoRollPreview({
  channel,
  channelEvents,
  onOpenPianoRoll,
  setActiveInstrumentId,
  setFocusedChannelId,
}: PianoRollPreviewProps) {
  const { theme: DARK, sunken, SPACE } = useTheme();

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (onOpenPianoRoll) {
          onOpenPianoRoll(channel.id);
        }
        setActiveInstrumentId(channel.id);
        setFocusedChannelId(channel.id);
      }}
      style={{
        flex: 1,
        height: "20px",
        backgroundColor: DARK.bg0,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: `${SPACE.sm}px`,
        paddingRight: `${SPACE.sm}px`,
        cursor: "pointer",
        boxSizing: "border-box",
        ...sunken(DARK),
      }}
      title="Piano Roll active (Click to open Piano Roll)"
    >
      {/* Grid lines */}
      <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "space-between", pointerEvents: "none", opacity: 0.05 }}>
        <div style={{ width: "1px", height: "100%", backgroundColor: DARK.bevelLight, marginLeft: "25%" }} />
        <div style={{ width: "1px", height: "100%", backgroundColor: DARK.bevelLight, marginLeft: "50%" }} />
        <div style={{ width: "1px", height: "100%", backgroundColor: DARK.bevelLight, marginLeft: "75%" }} />
      </div>

      {/* SVG/Micro MIDI notes */}
      <div style={{ position: "absolute", inset: 0, paddingTop: "2px", paddingBottom: "2px", paddingLeft: "10px", paddingRight: "10px", pointerEvents: "none" }}>
        {(() => {
          const pitches = channelEvents.map(e => e.pitch).filter((p): p is number => p !== undefined);
          const minPitch = pitches.length > 0 ? Math.min(...pitches) - 1 : 55;
          const maxPitch = pitches.length > 0 ? Math.max(...pitches) + 1 : 65;
          const pitchRange = Math.max(8, maxPitch - minPitch);

          return channelEvents.map((e, idx) => {
            if (e.pitch === undefined) return null;
            const leftPercent = Math.min(100, (e.time / 4) * 100);
            const widthPercent = Math.min(100 - leftPercent, ((e.duration ?? 0.25) / 4) * 100);
            const topPercent = 100 - ((e.pitch - minPitch) / pitchRange) * 100;

            return (
              <div
                key={e.id || idx}
                style={{
                  position: "absolute",
                  height: "2px",
                  backgroundColor: DARK.accentBlue,
                  border: `1px solid ${DARK.bevelLight}`,
                  boxSizing: "border-box",
                  left: `${leftPercent}%`,
                  width: `${Math.max(2.5, widthPercent)}%`,
                  top: `${Math.min(85, Math.max(15, topPercent))}%`,
                }}
              />
            );
          });
        })()}
      </div>

      <span 
        style={{
          fontSize: "8px",
          color: DARK.textMid,
          fontWeight: "bold",
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          fontFamily: DARK.font,
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        Piano Roll Active
      </span>
    </div>
  );
}
