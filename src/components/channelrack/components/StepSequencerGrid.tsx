/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useTheme } from "../../../theme/ThemeContext";
import { ChannelRow } from "../../../types";

interface StepSequencerGridProps {
  channel: ChannelRow;
  isStepActive: (channel: ChannelRow, index: number) => boolean;
  handleStepToggle: (channel: ChannelRow, index: number) => void;
}

export function StepSequencerGrid({
  channel,
  isStepActive,
  handleStepToggle,
}: StepSequencerGridProps) {
  const { theme: DARK, raised, sunken, SPACE } = useTheme();
  const stepColumns = Array.from({ length: 16 }, (_, i) => i * 0.25);

  return (
    <div 
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "repeat(16, minmax(0, 1fr))",
        gap: `${SPACE.xs}px`,
        height: "100%",
        alignItems: "center",
        paddingLeft: "6px",
        paddingRight: "6px",
        boxSizing: "border-box",
      }}
    >
      {stepColumns.map((_, index) => {
        const isActive = isStepActive(channel, index);
        const isBeatGroupA = Math.floor(index / 4) % 2 === 0;

        const normalBg = isActive 
          ? (channel.type === "sample" ? DARK.stateGreen : DARK.accentBlue)
          : (isBeatGroupA ? DARK.bg3 : DARK.bg2);
        const passingBg = isActive
          ? (channel.type === "sample" ? "#a8f5b4" : "#a0e8ff")
          : DARK.bg5;

        const borderStyle = isActive ? sunken(DARK) : raised(DARK);

        return (
          <button
            key={index}
            data-step-index={index}
            className="step-grid-button"
            onClick={() => handleStepToggle(channel, index)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (isActive) {
                handleStepToggle(channel, index);
              }
            }}
            style={{
              height: "18px",
              width: "100%",
              cursor: "pointer",
              boxSizing: "border-box",
              padding: 0,
              backgroundColor: normalBg,
              ...({
                "--normal-bg": normalBg,
                "--passing-bg": passingBg,
              } as React.CSSProperties),
              ...borderStyle,
            }}
            title={`${channel.name} at Step ${index + 1}`}
          />
        );
      })}
    </div>
  );
}
