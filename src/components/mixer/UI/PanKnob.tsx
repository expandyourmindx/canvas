import React, { useRef } from "react";
import { useTheme } from "../../../theme/ThemeContext";

interface PanKnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  defaultValue?: number;
  title?: string;
  dotColor?: string;
}

export function PanKnob({ value, min, max, onChange, defaultValue = 0, title, dotColor }: PanKnobProps) {
  const { theme: DARK, raised } = useTheme();
  const knobRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startValue = value;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const deltaValue = Math.round(deltaY * ((max - min) / 100));
      const nextValue = Math.min(max, Math.max(min, startValue + deltaValue));
      onChange(nextValue);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onChange(defaultValue);
  };

  const angleDeg = (value / 50) * 135;
  const angleRad = (angleDeg * Math.PI) / 180;
  
  const cx = 11;
  const cy = 11;
  const R = 6.5;
  const dotX = cx + R * Math.sin(angleRad);
  const dotY = cy - R * Math.cos(angleRad);

  const finalDotColor = dotColor || DARK.accentBlue;

  return (
    <div 
      ref={knobRef}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderTop = `1px solid ${DARK.bevelLight}`;
        e.currentTarget.style.borderLeft = `1px solid ${DARK.bevelLight}`;
        e.currentTarget.style.borderBottom = `1px solid ${DARK.bevelMid}`;
        e.currentTarget.style.borderRight = `1px solid ${DARK.bevelMid}`;
        e.currentTarget.style.backgroundColor = DARK.bg4;
      }}
      onMouseLeave={(e) => {
        const rStyle = raised(DARK);
        e.currentTarget.style.borderTop = rStyle.borderTop || "";
        e.currentTarget.style.borderLeft = rStyle.borderLeft || "";
        e.currentTarget.style.borderBottom = rStyle.borderBottom || "";
        e.currentTarget.style.borderRight = rStyle.borderRight || "";
        e.currentTarget.style.backgroundColor = DARK.knobBody;
      }}
      title={title}
      style={{
        width: "22px",
        height: "22px",
        borderRadius: "50%",
        backgroundColor: DARK.knobBody,
        position: "relative",
        cursor: "ns-resize",
        userSelect: "none",
        boxSizing: "border-box",
        ...raised(DARK),
      }}
    >
      {/* Highlight Ellipse */}
      <div 
        style={{
          position: "absolute",
          top: "2px",
          left: "2px",
          width: "8px",
          height: "4px",
          borderRadius: "50%",
          backgroundColor: DARK.knobHighlight,
          transform: "rotate(-30deg)",
          pointerEvents: "none",
        }}
      />

      {/* Indicator Dot */}
      <svg 
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <circle cx={dotX} cy={dotY} r={1.5} fill={finalDotColor} />
      </svg>
    </div>
  );
}
