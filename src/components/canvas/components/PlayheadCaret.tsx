import React, { useEffect, useRef } from "react";
import { useAudioEngine } from "../../../audio/useAudioEngine";

interface PlayheadCaretProps {
  beatWidth: number;
  DARK: any;
}

export function PlayheadCaret({ beatWidth, DARK }: PlayheadCaretProps) {
  const { position } = useAudioEngine();
  const playheadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (playheadRef.current) {
      playheadRef.current.style.left = `calc(130px + ${position.beats * beatWidth}px)`;
    }
  }, [position.beats, beatWidth]);

  return (
    <div
      ref={playheadRef}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        width: "1.5px",
        backgroundColor: DARK.accentMaster,
        zIndex: 25,
        pointerEvents: "none",
        overflow: "visible",
        left: "130px",
      }}
    >
      {/* Playhead Arrow Caret */}
      <div style={{ position: "absolute", top: "30px", transform: "translateY(-100%) translateX(-50%)", left: "50%" }}>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon points="0,0 10,0 5,6" fill={DARK.accentMaster} />
        </svg>
      </div>
    </div>
  );
}
