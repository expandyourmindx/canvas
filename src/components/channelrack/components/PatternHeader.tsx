/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Plus, Copy, Trash2 } from "lucide-react";
import { useTheme } from "../../../theme/ThemeContext";
import { PatternData } from "../../../types";

interface PatternHeaderProps {
  activePatternId: string;
  setActivePatternId: (id: string) => void;
  patterns: PatternData[];
  handleAddNewPattern: () => void;
  handleCloneActivePattern: () => void;
  deletePattern: (id: string) => void;
  clearEvents: () => void;
}

export function PatternHeader({
  activePatternId,
  setActivePatternId,
  patterns,
  handleAddNewPattern,
  handleCloneActivePattern,
  deletePattern,
  clearEvents,
}: PatternHeaderProps) {
  const { theme: DARK, raised, SPACE } = useTheme();

  return (
    <header 
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: DARK.bg2,
        borderBottom: `1px solid ${DARK.bevelDark}`,
        padding: `0 ${SPACE.md}px`,
        height: "30px",
        flexShrink: 0,
        userSelect: "none",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.sm}px` }}>
        <span 
          style={{
            color: DARK.textHi,
            fontWeight: "bold",
            fontSize: "9px",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            fontFamily: DARK.font,
          }}
        >
          Channel Rack
        </span>

        {/* Selector select input */}
        <select
          value={activePatternId}
          onChange={(e) => setActivePatternId(e.target.value)}
          onWheel={(e) => {
            e.preventDefault();
            const currentIndex = patterns.findIndex(p => p.id === activePatternId);
            if (e.deltaY < 0) {
              const prevIndex = Math.max(0, currentIndex - 1);
              setActivePatternId(patterns[prevIndex].id);
            } else {
              const nextIndex = Math.min(patterns.length - 1, currentIndex + 1);
              setActivePatternId(patterns[nextIndex].id);
            }
          }}
          style={{
            backgroundColor: DARK.bg3,
            color: DARK.textMid,
            fontFamily: DARK.font,
            fontSize: "9px",
            height: "20px",
            padding: `0 ${SPACE.sm}px`,
            outline: "none",
            cursor: "pointer",
            border: "none",
            boxSizing: "border-box",
            ...raised(DARK),
            maxWidth: "100px",
          }}
        >
          {patterns.map(p => (
            <option key={p.id} value={p.id} style={{ backgroundColor: DARK.bg3, color: DARK.textMid }}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Plus Add Pattern Button */}
        <button
          onClick={handleAddNewPattern}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "20px",
            height: "20px",
            backgroundColor: DARK.bg3,
            color: DARK.accentGreen,
            cursor: "pointer",
            border: "none",
            boxSizing: "border-box",
            ...raised(DARK),
          }}
          title="Add Pattern"
        >
          <Plus size={12} />
        </button>

        {/* Clone Pattern Button */}
        <button
          onClick={handleCloneActivePattern}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "20px",
            height: "20px",
            backgroundColor: DARK.bg3,
            color: DARK.accentBlue,
            cursor: "pointer",
            border: "none",
            boxSizing: "border-box",
            ...raised(DARK),
          }}
          title="Clone/Duplicate Active Pattern"
        >
          <Copy size={11} />
        </button>

        {/* Delete Pattern Button */}
        <button
          onClick={() => deletePattern(activePatternId)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "20px",
            height: "20px",
            backgroundColor: DARK.bg3,
            color: DARK.stateRed,
            cursor: "pointer",
            border: "none",
            boxSizing: "border-box",
            ...raised(DARK),
          }}
          title="Delete Pattern"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Global Toolbar actions */}
      <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.sm}px` }}>
        <button
          onClick={() => {
            clearEvents();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: `${SPACE.xs}px`,
            padding: `0 ${SPACE.md}px`,
            height: "20px",
            backgroundColor: DARK.bg3,
            color: DARK.stateRed,
            fontFamily: DARK.font,
            fontSize: "8px",
            fontWeight: "bold",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            cursor: "pointer",
            border: "none",
            boxSizing: "border-box",
            ...raised(DARK),
          }}
          title="Clear Patterns"
        >
          <Trash2 size={10} />
          <span>Clear</span>
        </button>
      </div>
    </header>
  );
}
