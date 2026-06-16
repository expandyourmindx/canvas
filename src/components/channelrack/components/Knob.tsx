/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from "react";
import { useTheme } from "../../../theme/ThemeContext";

interface KnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  label: string;
  title?: string;
  color?: "cyan" | "amber";
  defaultValue?: number;
}

export function Knob({ value, min, max, onChange, label, title, color = "cyan", defaultValue }: KnobProps) {
  const { theme: DARK, raised } = useTheme();
  const knobRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.altKey && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      const def = defaultValue !== undefined ? defaultValue : (min <= 0 && max >= 0 ? 0 : (min === 0 && max === 100 ? 80 : min));
      onChange(def);
      return;
    }
    e.preventDefault();
    isDragging.current = true;
    startY.current = e.clientY;
    startValue.current = value;
    knobRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const deltaY = startY.current - e.clientY; // drag up increases
    const range = max - min;
    const dragDistance = 120; // pixels for full sweep
    const valueDelta = (deltaY / dragDistance) * range;
    const newValue = Math.max(min, Math.min(max, Math.round(startValue.current + valueDelta)));
    onChange(newValue);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging.current) {
      isDragging.current = false;
      knobRef.current?.releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? -1 : 1;
    const step = (max - min) <= 100 ? 5 : 2;
    const newValue = Math.max(min, Math.min(max, value + dir * step));
    onChange(newValue);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const def = defaultValue !== undefined ? defaultValue : (min <= 0 && max >= 0 ? 0 : (min === 0 && max === 100 ? 80 : min));
    onChange(def);
  };

  // Convert value to degrees for rotation (sweep from -135deg to +135deg)
  const percent = (value - min) / (max - min);
  const angleDeg = -135 + percent * 270;
  const angleRad = (angleDeg * Math.PI) / 180;
  const cx = 11;
  const cy = 11;
  const R = 6.5;
  const dotX = cx + R * Math.sin(angleRad);
  const dotY = cy - R * Math.cos(angleRad);

  const dotColor = color === "cyan" ? DARK.accentBlue : DARK.accentMaster;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "24px", flexShrink: 0, userSelect: "none" }}>
      <span 
        style={{ 
          fontSize: "6px", 
          color: DARK.textLo, 
          fontWeight: "bold", 
          textTransform: "uppercase", 
          marginBottom: "2px", 
          fontFamily: DARK.font, 
          letterSpacing: "0.08em" 
        }}
      >
        {label}
      </span>
      <div
        ref={knobRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
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
        title={`${title}: ${value} (Double-click to reset)`}
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
          <circle cx={dotX} cy={dotY} r={1.5} fill={dotColor} />
        </svg>
      </div>
    </div>
  );
}
