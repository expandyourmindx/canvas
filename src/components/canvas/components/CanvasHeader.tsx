import React from "react";
import { Pencil, MousePointer } from "lucide-react";
import { PatternData } from "../../../types";

interface CanvasHeaderProps {
  selectedClipType: "pattern" | "sample" | null;
  selectedReferenceId: string;
  patterns: PatternData[];
  getSampleName: (id: string) => string;
  activeTool: 'pencil' | 'pointer' | 'split';
  setActiveTool: (tool: 'pencil' | 'pointer' | 'split') => void;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  snapResolution: number | "auto";
  setSnapResolution: (val: number | "auto") => void;
  DARK: any;
  raised: (theme: any) => any;
  sunken: (theme: any) => any;
  SPACE: any;
}

export const CanvasHeader = React.memo(function CanvasHeader({
  selectedClipType,
  selectedReferenceId,
  patterns,
  getSampleName,
  activeTool,
  setActiveTool,
  setSelectedIds,
  snapResolution,
  setSnapResolution,
  DARK,
  raised,
  sunken,
  SPACE
}: CanvasHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: DARK.bg2,
        borderBottom: `1px solid ${DARK.bevelDark}`,
        padding: `${SPACE.xs}px ${SPACE.md}px`,
        height: "30px",
        flexShrink: 0,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.sm}px` }}>
        {selectedClipType ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: `${SPACE.xs}px`,
              padding: `2px ${SPACE.sm}px`,
              backgroundColor: DARK.bg0,
              color: DARK.accentMaster,
              fontFamily: DARK.font,
              fontSize: "8px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              boxSizing: "border-box",
              ...sunken(DARK),
            }}
          >
            <div
              style={{
                width: "4px",
                height: "4px",
                borderRadius: "50%",
                backgroundColor: DARK.accentMaster,
                flexShrink: 0,
              }}
            />
            <span style={{ color: DARK.textMid }}>STAMP:</span>
            <span style={{ color: DARK.accentMaster, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "150px" }}>
              {selectedClipType === "pattern" 
                ? (patterns.find(p => p.id === selectedReferenceId)?.name || "MIDI Pattern")
                : getSampleName(selectedReferenceId)}
            </span>
            <span
              style={{
                fontSize: "7px",
                fontFamily: DARK.font,
                color: DARK.textHi,
                backgroundColor: DARK.bg3,
                padding: `1px ${SPACE.xs}px`,
                marginLeft: `${SPACE.sm}px`,
                textTransform: "uppercase",
              }}
            >
              {selectedClipType === "pattern" ? "Pattern" : "Sample"}
            </span>
          </div>
        ) : (
          <div
            style={{
              fontSize: "8px",
              fontFamily: DARK.font,
              color: DARK.textLo,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              paddingLeft: `${SPACE.sm}px`,
              fontWeight: "bold",
            }}
          >
            No Stamp
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.md}px` }}>
        {/* Tool Selector Toggle Group */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            backgroundColor: DARK.bg0,
            padding: `${SPACE.xs}px`,
            boxSizing: "border-box",
            ...sunken(DARK),
          }}
        >
          <button
            onClick={() => {
              setActiveTool('pencil');
              setSelectedIds([]);
            }}
            onMouseEnter={(e) => {
              if (activeTool !== 'pencil') {
                e.currentTarget.style.backgroundColor = DARK.bg4;
                e.currentTarget.style.color = DARK.textHi;
              }
            }}
            onMouseLeave={(e) => {
              if (activeTool !== 'pencil') {
                e.currentTarget.style.backgroundColor = DARK.bg3;
                e.currentTarget.style.color = DARK.textMid;
              }
            }}
            style={{
              padding: `2px ${SPACE.sm}px`,
              fontSize: "8px",
              fontWeight: "bold",
              fontFamily: DARK.font,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              cursor: "pointer",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: `${SPACE.xs}px`,
              backgroundColor: activeTool === 'pencil' ? DARK.bg5 : DARK.bg3,
              color: activeTool === 'pencil' ? DARK.textHi : DARK.textMid,
              boxSizing: "border-box",
              ...(activeTool === 'pencil' ? sunken(DARK) : raised(DARK)),
            }}
            title="Pencil Tool: Draw arranger notes/stamps"
          >
            <Pencil style={{ height: "10px", width: "10px" }} />
            <span>Pencil</span>
          </button>
          <button
            onClick={() => {
              setActiveTool('pointer');
            }}
            onMouseEnter={(e) => {
              if (activeTool !== 'pointer') {
                e.currentTarget.style.backgroundColor = DARK.bg4;
                e.currentTarget.style.color = DARK.textHi;
              }
            }}
            onMouseLeave={(e) => {
              if (activeTool !== 'pointer') {
                e.currentTarget.style.backgroundColor = DARK.bg3;
                e.currentTarget.style.color = DARK.textMid;
              }
            }}
            style={{
              padding: `2px ${SPACE.sm}px`,
              fontSize: "8px",
              fontWeight: "bold",
              fontFamily: DARK.font,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              cursor: "pointer",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: `${SPACE.xs}px`,
              backgroundColor: activeTool === 'pointer' ? DARK.bg5 : DARK.bg3,
              color: activeTool === 'pointer' ? DARK.textHi : DARK.textMid,
              boxSizing: "border-box",
              ...(activeTool === 'pointer' ? sunken(DARK) : raised(DARK)),
            }}
            title="Pointer Tool: Multiple select / relocation"
          >
            <MousePointer style={{ height: "10px", width: "10px" }} />
            <span>Pointer</span>
          </button>
          <button
            onClick={() => {
              setActiveTool('split');
              setSelectedIds([]);
            }}
            onMouseEnter={(e) => {
              if (activeTool !== 'split') {
                e.currentTarget.style.backgroundColor = DARK.bg4;
                e.currentTarget.style.color = DARK.textHi;
              }
            }}
            onMouseLeave={(e) => {
              if (activeTool !== 'split') {
                e.currentTarget.style.backgroundColor = DARK.bg3;
                e.currentTarget.style.color = DARK.textMid;
              }
            }}
            style={{
              padding: `2px ${SPACE.sm}px`,
              fontSize: "8px",
              fontWeight: "bold",
              fontFamily: DARK.font,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              cursor: "pointer",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: `${SPACE.xs}px`,
              backgroundColor: activeTool === 'split' ? DARK.bg5 : DARK.bg3,
              color: activeTool === 'split' ? DARK.textHi : DARK.textMid,
              boxSizing: "border-box",
              ...(activeTool === 'split' ? sunken(DARK) : raised(DARK)),
            }}
            title="Razor/Split Tool: Slice arranger clips in half"
          >
            <svg style={{ height: "10px", width: "10px", flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="1.5" />
              <line x1="6" y1="12" x2="18" y2="12" />
              <circle cx="8" cy="12" r="0.75" fill="currentColor" />
              <circle cx="16" cy="12" r="0.75" fill="currentColor" />
              <circle cx="12" cy="12" r="1" fill="currentColor" />
            </svg>
            <span>Split</span>
          </button>
        </div>

        {/* Snap Resolution Selection Dropdown */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: `${SPACE.sm}px`,
            backgroundColor: DARK.bg3,
            padding: `2px ${SPACE.sm}px`,
            boxSizing: "border-box",
            ...raised(DARK),
          }}
        >
          <span style={{ fontSize: "8px", fontWeight: "bold", fontFamily: DARK.font, color: DARK.textMid, letterSpacing: "0.08em" }}>SNAP:</span>
          <select
            value={snapResolution}
            onChange={(e) => {
              const val = e.target.value;
              setSnapResolution(val === "auto" ? "auto" : parseFloat(val));
            }}
            style={{
              backgroundColor: "transparent",
              color: DARK.accentBlue,
              fontFamily: DARK.font,
              fontSize: "8px",
              fontWeight: "bold",
              border: "none",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="auto" style={{ backgroundColor: DARK.bg3, color: DARK.textMid }}>Auto Snap</option>
            <option value="4" style={{ backgroundColor: DARK.bg3, color: DARK.textMid }}>1 Bar (4 Beats)</option>
            <option value="1" style={{ backgroundColor: DARK.bg3, color: DARK.textMid }}>1/4 (1 Beat)</option>
            <option value="0.5" style={{ backgroundColor: DARK.bg3, color: DARK.textMid }}>1/8 (0.5 Beats)</option>
            <option value="0.25" style={{ backgroundColor: DARK.bg3, color: DARK.textMid }}>1/16 (0.25 Beats)</option>
            <option value="0.125" style={{ backgroundColor: DARK.bg3, color: DARK.textMid }}>1/32 (0.125 Beats)</option>
          </select>
        </div>
      </div>
    </div>
  );
});
