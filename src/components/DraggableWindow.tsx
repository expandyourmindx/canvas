/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { X, Maximize2, Minimize2 } from "lucide-react";

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
}: DraggableWindowProps) {
  // Positioning and dimensions states
  const [position, setPosition] = useState({ x: defaultX, y: defaultY });
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight });
  const [isMaximized, setIsMaximized] = useState(defaultMaximized);

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
    setPosition({
      x: dragStart.current.winX + deltaX,
      y: Math.max(0, dragStart.current.winY + deltaY), // allow dragging up to the bottom of top toolbar
    });
  };

  // Handle pointer up/end during drag
  const handleDragUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStart.current) {
      const element = e.currentTarget;
      element.releasePointerCapture(e.pointerId);
      dragStart.current = null;
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
    }
    : {
      position: "absolute",
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${size.width}px`,
      height: `${size.height}px`,
      zIndex,
      display: isVisible ? "flex" : "none",
    };

  return (
    <div
      ref={containerRef}
      onPointerDown={onFocus}
      style={windowStyles}
      className={`flex-col bg-[#121315]/95 border ${isMaximized ? "border-transparent" : "border-neutral-800 rounded-sm shadow-2xl"
        } backdrop-blur-md overflow-hidden transition-shadow duration-300 pointer-events-auto`}
    >
      {/* Title Bar Dragger Handle */}
      <div
        onPointerDown={handleDragDown}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragUp}
        onDoubleClick={toggleMaximize}
        className={`flex items-center justify-between px-2.5 h-7.5 bg-[#1a1c1e] shrink-0 border-b border-neutral-800/80 cursor-grab active:cursor-grabbing select-none ${isMaximized ? "" : "rounded-t-sm"
          }`}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] font-black font-sans tracking-wide text-[#eceff4] uppercase truncate max-w-[240px]">
            {title}
          </h3>
        </div>

        {/* Action Window Hub */}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleMaximize}
            className="p-0.5 hover:bg-neutral-800 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title={isMaximized ? "Restore Window Size" : "Maximize Window"}
          >
            {isMaximized ? <Minimize2 className="h-2.5 w-2.5" /> : <Maximize2 className="h-2.5 w-2.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-0.5 hover:bg-red-500/20 rounded text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
            title="Minimize Window to Dock"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      {/* Internal Scrollable Content Chamber */}
      <div className="flex-1 overflow-auto bg-[#0a0b0d]/90 p-1 min-h-0 relative">
        {children}
      </div>

      {/* Resize handle bar trigger (hidden when maximized) */}
      {!isMaximized && (
        <div
          onPointerDown={handleResizeDown}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1.5 z-40 group select-none"
        >
          {/* Bottom right resize accent representation */}
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            className="text-neutral-700 hover:text-indigo-400 transition-colors"
          >
            <path
              d="M6 0 L8 0 L8 8 L0 8 L0 6 L6 6 Z"
              fill="currentColor"
              fillRule="evenodd"
              opacity="0.6"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
