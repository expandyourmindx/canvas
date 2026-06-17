import React from "react";

interface TrackLaneHeaderProps {
  laneIdx: number;
  laneStates: Record<number, { isMuted: boolean; isSoloed: boolean }>;
  setLaneMute: (laneIdx: number, isMuted: boolean) => void;
  setLaneSolo: (laneIdx: number, isSoloed: boolean) => void;
  DARK: any;
  SPACE: any;
}

export const TrackLaneHeader = React.memo(function TrackLaneHeader({
  laneIdx,
  laneStates,
  setLaneMute,
  setLaneSolo,
  DARK,
  SPACE
}: TrackLaneHeaderProps) {
  const laneState = laneStates[laneIdx] || { isMuted: false, isSoloed: false };
  const isMuted = laneState.isMuted;
  const isSoloed = laneState.isSoloed;

  return (
    <div
      style={{
        width: "130px",
        flexShrink: 0,
        paddingLeft: `${SPACE.sm}px`,
        paddingRight: `${SPACE.sm}px`,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        height: "100%",
        zIndex: 30,
        backgroundColor: DARK.bg2,
        position: "sticky",
        left: 0,
        borderRight: `1px solid ${DARK.bevelDark}`,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: "8px",
            fontWeight: "bold",
            color: DARK.textHi,
            fontFamily: DARK.font,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Lane {laneIdx + 1}
        </span>
        <span
          style={{
            fontSize: "7px",
            fontFamily: DARK.font,
            color: DARK.textMid,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Arranger Slot
        </span>
      </div>

      <button
        onClick={() => setLaneMute(laneIdx, !isMuted)}
        onContextMenu={(e) => {
          e.preventDefault();
          setLaneSolo(laneIdx, !isSoloed);
        }}
        style={{
          width: "14px",
          height: "14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "8px",
          fontWeight: "bold",
          fontFamily: DARK.fontMono || "monospace",
          cursor: "pointer",
          boxSizing: "border-box",
          border: isSoloed
            ? `1px solid ${DARK.accentBlue}`
            : isMuted
            ? `1px solid ${DARK.textHi}`
            : `1px solid ${DARK.bevelDark}`,
          backgroundColor: isSoloed
            ? DARK.accentBlue
            : isMuted
            ? DARK.textHi
            : DARK.bg1,
          color: isSoloed || isMuted ? DARK.bg0 : DARK.textMid,
          borderRadius: "1px",
          padding: 0,
          lineHeight: 1,
          outline: "none",
          boxShadow: "none",
          transition: "all 0.05s ease",
        }}
        title="Left-click to Mute, Right-click to Solo"
      >
        {isSoloed ? "S" : isMuted ? "M" : "•"}
      </button>
    </div>
  );
});
