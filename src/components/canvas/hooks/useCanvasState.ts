import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { CanvasClip } from "../../../types";
import { getAutoSnapResolution } from "../../../utils/snapUtils";

interface UseCanvasStateProps {
  canvasClips: CanvasClip[];
}

export function useCanvasState({ canvasClips }: UseCanvasStateProps) {
  // Viewport scroll & width tracking
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);
  const [scrollLeft, setScrollLeft] = useState<number>(0);
  const [viewportWidth, setViewportWidth] = useState<number>(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      setScrollLeft(el.scrollLeft);
      scrollRafRef.current = null;
    });
  };

  // Track viewport width via ResizeObserver
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setViewportWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  const [zoomX, setZoomX] = useState<number>(1.0);
  const beatWidth = 48 * zoomX; // width in pixels of each beat

  const maxClipBeat = useMemo(() => {
    if (canvasClips.length === 0) return 0;
    return Math.max(...canvasClips.map((c) => c.startBeat + c.duration));
  }, [canvasClips]);

  // Dynamic grid length calculation
  const totalBeats = useMemo(() => {
    const scrolledBeats = (scrollLeft + viewportWidth) / beatWidth;
    return Math.max(128, Math.ceil(maxClipBeat + 16), Math.ceil(scrolledBeats + 16));
  }, [maxClipBeat, scrollLeft, viewportWidth, beatWidth]);

  const timelineWidth = totalBeats * beatWidth;

  // Middle-Click Panning Refs
  const isMiddleClickPanning = useRef(false);
  const panStartX = useRef(0);
  const panStartY = useRef(0);
  const panScrollLeft = useRef(0);
  const panScrollTop = useRef(0);

  const minZoomX = useMemo(() => {
    if (maxClipBeat === 0 || viewportWidth <= 130) return 0.5;
    const calc = (viewportWidth - 130) / (48 * (maxClipBeat + 8));
    return Math.max(0.05, Math.min(0.5, Number(calc.toFixed(3))));
  }, [maxClipBeat, viewportWidth]);

  // Keep the current zoom level clamped to the dynamic minZoomX bounds
  useEffect(() => {
    if (zoomX < minZoomX) {
      setZoomX(minZoomX);
    }
  }, [minZoomX, zoomX]);

  // Enforce minZoomX boundary on manual Alt / middle-click zooming from ArrangerRuler
  const setZoomXClamped = useCallback((value: React.SetStateAction<number>) => {
    setZoomX(prev => {
      const next = typeof value === "function" ? (value as Function)(prev) : value;
      return Math.max(minZoomX, Math.min(4.0, next));
    });
  }, [minZoomX]);

  // Ctrl + Wheel Zoom Effect
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleCtrlWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const scrollOffset = mouseX + el.scrollLeft;

      const dir = e.deltaY > 0 ? -1 : 1;

      setZoomX(prev => {
        const newZoom = Math.max(minZoomX, Math.min(4.0, Number((prev + dir * 0.1).toFixed(2))));
        const scaleRatio = newZoom / prev;
        // Schedule scroll update after state flush
        requestAnimationFrame(() => {
          el.scrollLeft = scrollOffset * scaleRatio - mouseX;
        });
        return newZoom;
      });
    };

    el.addEventListener("wheel", handleCtrlWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleCtrlWheel);
    };
  }, [minZoomX]);

  // Snap resolution selection (Default to "auto")
  const [snapResolution, setSnapResolution] = useState<number | "auto">("auto");

  // Derive the active snap resolution based on mode and zoomX
  const activeSnapResolution = snapResolution === "auto"
    ? getAutoSnapResolution(zoomX)
    : snapResolution;

  // Memoized grid line CSS background styles
  const gridStyle = useMemo(() => {
    const gradients = [
      'linear-gradient(to right, rgba(74, 102, 128, 0.22) 2px, transparent 2px)', // Bar lines (always drawn)
      'linear-gradient(to right, rgba(74, 102, 128, 0.09) 1px, transparent 1px)' // Beat lines (always drawn)
    ];
    const sizes = [
      `${beatWidth * 4}px 100%`,
      `${beatWidth}px 100%`
    ];

    const res = activeSnapResolution;
    if (res !== null) {
      if (res <= 0.5) {
        gradients.push('linear-gradient(to right, rgba(74, 102, 128, 0.05) 1px, transparent 1px)');
        sizes.push(`${beatWidth * 0.5}px 100%`);
      }
      if (res <= 0.25) {
        gradients.push('linear-gradient(to right, rgba(74, 102, 128, 0.03) 1px, transparent 1px)');
        sizes.push(`${beatWidth * 0.25}px 100%`);
      }
      if (res <= 0.125) {
        gradients.push('linear-gradient(to right, rgba(74, 102, 128, 0.015) 1px, transparent 1px)');
        sizes.push(`${beatWidth * 0.125}px 100%`);
      }
    }

    // Add alternating bar shading layer on the very bottom (every 4 bars / 16 beats)
    gradients.push('linear-gradient(to right, rgba(74, 102, 128, 0.02) 50%, transparent 50%)');
    sizes.push(`${beatWidth * 32}px 100%`);

    return {
      backgroundImage: gradients.join(', '),
      backgroundSize: sizes.join(', ')
    };
  }, [beatWidth, activeSnapResolution]);

  const [activeTool, setActiveTool] = useState<'pencil' | 'pointer' | 'split'>('pencil');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Placing clip state
  const [placingClip, setPlacingClip] = useState<CanvasClip | null>(null);
  const placingClipRef = useRef<CanvasClip | null>(null);
  const placingPointerId = useRef<number | null>(null);

  const updatePlacingClip = useCallback((clip: CanvasClip | null) => {
    placingClipRef.current = clip;
    setPlacingClip(clip);
  }, []);

  const [laneCount, setLaneCount] = useState<number>(50);
  const listLanes = useMemo(
    () => Array.from({ length: laneCount }, (_, i) => i),
    [laneCount]
  );

  return {
    scrollContainerRef,
    scrollLeft,
    viewportWidth,
    handleScroll,
    zoomX,
    setZoomX: setZoomXClamped,
    beatWidth,
    totalBeats,
    timelineWidth,
    snapResolution,
    setSnapResolution,
    activeSnapResolution,
    gridStyle,
    activeTool,
    setActiveTool,
    selectedIds,
    setSelectedIds,
    placingClip,
    updatePlacingClip,
    placingClipRef,
    placingPointerId,
    isMiddleClickPanning,
    panStartX,
    panStartY,
    panScrollLeft,
    panScrollTop,
    laneCount,
    setLaneCount,
    listLanes
  };
}
