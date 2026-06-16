import React, { useRef } from "react";
import { useTheme } from "../../../theme/ThemeContext";

interface VerticalFaderProps {
  value: number;
  onChange: (value: number) => void;
  title?: string;
}

export function VerticalFader({ value, onChange, title }: VerticalFaderProps) {
  const { theme: DARK, raised, sunken, SIZE } = useTheme();
  const trackRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.altKey && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      onChange(100);
      return;
    }

    e.preventDefault();
    updateFromEvent(e.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateFromEvent(moveEvent.clientY);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const updateFromEvent = (clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const percentage = 125 - Math.min(125, Math.max(0, (relativeY / rect.height) * 125));
    onChange(Math.round(percentage));
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(100);
  };

  const trackHeight = 160;
  const thumbHeight = SIZE.faderThumbH;
  const topPx = ((125 - value) / 125) * (trackHeight - thumbHeight);

  return (
    <div 
      ref={trackRef}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      title={title}
      style={{
        width: "12px",
        height: `${trackHeight}px`,
        backgroundColor: DARK.bg0,
        position: "relative",
        cursor: "ns-resize",
        userSelect: "none",
        boxSizing: "border-box",
        ...sunken(DARK),
      }}
    >
      {/* Center Rail */}
      <div 
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          width: "2px",
          height: "100%",
          backgroundColor: DARK.bg5,
          pointerEvents: "none",
        }}
      />

      {/* Unity Notch */}
      <div 
        style={{
          position: "absolute",
          top: "44%",
          left: 0,
          right: 0,
          height: "1px",
          backgroundColor: DARK.accentBlue,
          opacity: 0.2,
          pointerEvents: "none",
        }}
      />

      {/* Fader Thumb */}
      <div 
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          top: `${topPx}px`,
          width: `${SIZE.faderThumbW}px`,
          height: `${thumbHeight}px`,
          backgroundColor: DARK.bg5,
          pointerEvents: "none",
          boxSizing: "border-box",
          ...raised(DARK),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Grip Lines */}
        <div 
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "6px",
            width: "10px",
          }}
        >
          {[1, 2, 3].map((i) => (
            <div 
              key={i} 
              style={{ 
                height: "1px", 
                background: i === 2 ? `${DARK.accentBlue}66` : DARK.bevelLight,
                boxSizing: "border-box",
              }} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}
