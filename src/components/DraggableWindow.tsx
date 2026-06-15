/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";

interface DraggableWindowProps {
  id: string;
  title: string;
  isVisible: boolean;
  onClose: () => void;
  onFocus: () => void;
  zIndex: number;
  defaultX: number;
  defaultY: number;
  defaultWidth: number;
  defaultHeight: number;
  minWidth?: number;
  minHeight?: number;
  defaultMaximized?: boolean;
  children: React.ReactNode;
  onPositionChange?: (position: { x: number; y: number }) => void;
}

export function DraggableWindow({
  id,
  title,
  isVisible,
  onClose,
  onFocus,
  zIndex,
  defaultX,
  defaultY,
  defaultWidth,
  defaultHeight,
  minWidth = 350,
  minHeight = 250,
  defaultMaximized = false,
  children,
  onPositionChange,
}: DraggableWindowProps) {
  const { theme: DARK, raised, SPACE, SIZE } = useTheme();
  // Positioning and dimensions states
  const [position, setPosition] = useState({ x: defaultX, y: defaultY });
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight });
  const [isMaximized, setIsMaximized] = useState(defaultMaximized);

  // Hover and drag states
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximizeHovered, setIsMaximizeHovered] = useState(false);
  const [isCloseHovered, setIsCloseHovered] = useState(false);

  // Drag and resize active states
  const dragStart = useRef<{ posX: number; posY: number; winX: number; winY: number } | null>(null);
  const resizeStart = useRef<{ posX: number; posY: number; winW: number; winH: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Handle pointer down on title bar for dragging
  const handleDragDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMaximized) return; // disable drag while maximized
    onFocus();

    // Prevent dragging when clicking a button/interactive element on the header
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("select") || target.closest("input")) {
      return;
    }

    // Capture initial positions
    dragStart.current = {
      posX: e.clientX,
      posY: e.clientY,
      winX: position.x,
      winY: position.y,
    };

    setIsDragging(true);

    // Set pointer capture to track moves outside window bounds
    const element = e.currentTarget;
    element.setPointerCapture(e.pointerId);
    e.stopPropagation();
  };

  // Handle pointer move during drag
  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;

    const deltaX = e.clientX - dragStart.current.posX;
    const deltaY = e.clientY - dragStart.current.posY;

    // Boundary constraints could be set, but let's allow free-form sliding!
    // This supports an unbound desktop arranger style layout perfectly.
    const nextPos = {
      x: dragStart.current.winX + deltaX,
      y: Math.max(0, dragStart.current.winY + deltaY), // allow dragging up to the bottom of top toolbar
    };
    setPosition(nextPos);
    onPositionChange?.(nextPos);
  };

  // Handle pointer up/end during drag
  const handleDragUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStart.current) {
      const element = e.currentTarget;
      element.releasePointerCapture(e.pointerId);
      dragStart.current = null;
      setIsDragging(false);
    }
  };

  // Handle pointer down on resize handle
  const handleResizeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMaximized) return;
    onFocus();

    resizeStart.current = {
      posX: e.clientX,
      posY: e.clientY,
      winW: size.width,
      winH: size.height,
    };

    const element = e.currentTarget;
    element.setPointerCapture(e.pointerId);
    e.stopPropagation();
    e.preventDefault();
  };

  // Handle pointer move during resize
  const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeStart.current) return;

    const deltaX = e.clientX - resizeStart.current.posX;
    const deltaY = e.clientY - resizeStart.current.posY;

    const targetWidth = Math.max(minWidth, resizeStart.current.winW + deltaX);
    const targetHeight = Math.max(minHeight, resizeStart.current.winH + deltaY);

    setSize({
      width: targetWidth,
      height: targetHeight,
    });
  };

  // Handle pointer up/end during resize
  const handleResizeUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (resizeStart.current) {
      const element = e.currentTarget;
      element.releasePointerCapture(e.pointerId);
      resizeStart.current = null;
    }
  };

  const toggleMaximize = () => {
    setIsMaximized((prev) => !prev);
    onFocus();
  };

  // Window styling styles
  const windowStyles: React.CSSProperties = isMaximized
    ? {
      position: "fixed",
      top: "2.75rem", // clearance for toolbar (h-11 = 2.75rem)
      left: "var(--sample-browser-width)",
      right: 0,
      bottom: 0,
      zIndex,
      display: isVisible ? "flex" : "none",
      flexDirection: "column",
      backgroundColor: DARK.bg1,
      boxSizing: "border-box",
      overflow: "hidden",
      pointerEvents: "auto",
    }
    : {
      position: "absolute",
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${size.width}px`,
      height: `${size.height}px`,
      zIndex,
      display: isVisible ? "flex" : "none",
      flexDirection: "column",
      backgroundColor: DARK.bg1,
      boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      boxSizing: "border-box",
      overflow: "hidden",
      pointerEvents: "auto",
      ...raised(DARK),
    };

  const titleTextStyle: React.CSSProperties = {
    fontFamily: DARK.font,
    fontSize: "9px",
    color: DARK.textHi,
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontWeight: "bold",
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={onFocus}
      style={windowStyles}
    >
      {/* Title Bar Dragger Handle */}
      <div
        onPointerDown={handleDragDown}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragUp}
        onDoubleClick={toggleMaximize}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `0 ${SPACE.md}px`,
          height: `${SIZE.titleBarHeight}px`,
          background: DARK.titleBarGradient,
          borderBottom: `1px solid ${DARK.bevelDark}`,
          cursor: isMaximized ? "default" : (isDragging ? "grabbing" : "grab"),
          userSelect: "none",
          flexShrink: 0,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h3 style={titleTextStyle} title={title}>
            {title}
          </h3>
        </div>

        {/* Action Window Hub */}
        <div style={{ display: "flex", alignItems: "center", gap: "2px", height: "100%" }}>
          <button
            onClick={toggleMaximize}
            onMouseEnter={() => setIsMaximizeHovered(true)}
            onMouseLeave={() => setIsMaximizeHovered(false)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: `${SIZE.titleBarHeight}px`,
              height: `${SIZE.titleBarHeight}px`,
              backgroundColor: isMaximizeHovered ? DARK.bg4 : DARK.bg3,
              color: isMaximizeHovered ? DARK.textHi : DARK.textMid,
              cursor: "pointer",
              border: "none",
              boxSizing: "border-box",
              padding: 0,
              ...raised(DARK),
            }}
            title={isMaximized ? "Restore Window Size" : "Maximize Window"}
          >
            {isMaximized ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
          </button>
          <button
            onClick={onClose}
            onMouseEnter={() => setIsCloseHovered(true)}
            onMouseLeave={() => setIsCloseHovered(false)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: `${SIZE.titleBarHeight}px`,
              height: `${SIZE.titleBarHeight}px`,
              backgroundColor: isCloseHovered ? DARK.stateRed : DARK.bg3,
              color: isCloseHovered ? "white" : DARK.textMid,
              cursor: "pointer",
              border: "none",
              boxSizing: "border-box",
              padding: 0,
              ...raised(DARK),
            }}
            title="Minimize Window to Dock"
          >
            <X size={10} />
          </button>
        </div>
      </div>

      {/* Internal Scrollable Content Chamber */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          backgroundColor: DARK.bg1,
          position: "relative",
          minHeight: 0,
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>

      {/* Resize handle bar trigger (hidden when maximized) */}
      {!isMaximized && (
        <div
          onPointerDown={handleResizeDown}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: "16px",
            height: "16px",
            cursor: "se-resize",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            padding: "2px",
            zIndex: 40,
            userSelect: "none",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            style={{ display: "block" }}
          >
            {/* Ridge 3 */}
            <line x1="3" y1="11" x2="11" y2="3" stroke={DARK.bevelLight} strokeWidth="1" />
            <line x1="4" y1="11" x2="11" y2="4" stroke={DARK.bevelDark} strokeWidth="1" />

            {/* Ridge 2 */}
            <line x1="6" y1="11" x2="11" y2="6" stroke={DARK.bevelLight} strokeWidth="1" />
            <line x1="7" y1="11" x2="11" y2="7" stroke={DARK.bevelDark} strokeWidth="1" />

            {/* Ridge 1 */}
            <line x1="9" y1="11" x2="11" y2="9" stroke={DARK.bevelLight} strokeWidth="1" />
            <line x1="10" y1="11" x2="11" y2="10" stroke={DARK.bevelDark} strokeWidth="1" />
          </svg>
        </div>
      )}
    </div>
  );
}
