import React, { useRef } from "react";
import { useTheme } from "../../../theme/ThemeContext";

interface InputGainKnobProps {
  value: number; // 0.0 to 2.0
  onChange: (value: number) => void;
  title?: string;
  dotColor?: string;
  hasRing?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function InputGainKnob({ 
  value, 
  onChange, 
  title, 
  dotColor, 
  hasRing, 
  onContextMenu, 
  onDragStart, 
  onDragEnd 
}: InputGainKnobProps) {
  const { theme: DARK, raised } = useTheme();
  const knobRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    e.preventDefault();
    const startY = e.clientY;
    const startValue = value;

    onDragStart?.();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const deltaValue = deltaY * (2.0 / 100);
      const nextValue = Math.min(2.0, Math.max(0.0, startValue + deltaValue));
      onChange(Math.round(nextValue * 100) / 100);
    };

    const handleMouseUp = () => {
      onDragEnd?.();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onChange(1.0);
  };

  const angleDeg = (value - 1.0) * 135;
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
      onContextMenu={onContextMenu}
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

      {/* Send Relationship Ring */}
      {hasRing && (
        <svg
          style={{
            position: "absolute",
            top: "-3px",
            left: "-3px",
            width: "28px",
            height: "28px",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <circle
            cx={14}
            cy={14}
            r={12}
            stroke="#108a38"
            strokeWidth={2}
            fill="none"
          />
        </svg>
      )}
    </div>
  );
}
