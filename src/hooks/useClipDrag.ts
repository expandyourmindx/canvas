/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from "react";
import { CanvasClip, ChannelRow } from "../types";
import { LANE_HEIGHT_PX, CLIP_TOP_OFFSET_PX } from "../config";

interface UseClipDragProps {
  activeTool: 'pencil' | 'pointer' | 'split';
  snapResolution: number | null;
  beatWidth: number;
  totalBeats: number;
  laneCount: number;
  canvasClips: CanvasClip[];
  setCanvasClips: React.Dispatch<React.SetStateAction<CanvasClip[]>>;
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  pushToHistory: (channels: ChannelRow[]) => void;
  channels: ChannelRow[];
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  tracksContainerRef: React.RefObject<HTMLDivElement>;
}

export function useClipDrag({
  activeTool,
  snapResolution,
  beatWidth,
  totalBeats,
  laneCount,
  canvasClips,
  setCanvasClips,
  selectedIds,
  setSelectedIds,
  pushToHistory,
  channels,
  scrollContainerRef,
  tracksContainerRef,
}: UseClipDragProps) {
  const lassoActiveRef = useRef(false);
  const lassoStartXRef = useRef(0);
  const lassoStartYRef = useRef(0);
  const lastTrackXRef = useRef(0);
  const lastTrackYRef = useRef(0);
  const rafActiveRef = useRef(false);
  const lassoDivRef = useRef<HTMLDivElement>(null);

  const selectedIdsRef = useRef<string[]>([]);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  const dragStartRef = useRef<{
    startX: number;
    startLane: number;
    originalClips: { id: string; startBeat: number; laneIndex: number }[];
    clipsAtStart: CanvasClip[];
  } | null>(null);

  const handleGridPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool !== 'pointer' && !e.ctrlKey) return;
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (
      target.closest(".canvas-clip-body") || 
      target.closest(".sticky") || 
      target.closest("button") || 
      target.closest(".clip-resize-handle")
    ) {
      return;
    }

    if (!tracksContainerRef.current) return;
    const rect = tracksContainerRef.current.getBoundingClientRect();
    const trackX = e.clientX - rect.left - 130;
    const trackY = e.clientY - rect.top;

    setSelectedIds([]);

    lassoActiveRef.current = true;
    lassoStartXRef.current = trackX;
    lassoStartYRef.current = trackY;
    lastTrackXRef.current = trackX;
    lastTrackYRef.current = trackY;

    if (lassoDivRef.current) {
      lassoDivRef.current.style.display = "block";
      lassoDivRef.current.style.left = `${trackX + 130}px`;
      lassoDivRef.current.style.top = `${trackY}px`;
      lassoDivRef.current.style.width = "0px";
      lassoDivRef.current.style.height = "0px";
    }

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleGridPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!lassoActiveRef.current) return;

    if (!tracksContainerRef.current) return;
    const rect = tracksContainerRef.current.getBoundingClientRect();
    const trackX = e.clientX - rect.left - 130;
    const trackY = e.clientY - rect.top;

    lastTrackXRef.current = trackX;
    lastTrackYRef.current = trackY;

    if (!rafActiveRef.current) {
      rafActiveRef.current = true;
      requestAnimationFrame(() => {
        rafActiveRef.current = false;
        if (!lassoActiveRef.current) return;

        const startX = lassoStartXRef.current;
        const startY = lassoStartYRef.current;
        const currentX = lastTrackXRef.current;
        const currentY = lastTrackYRef.current;

        const left = Math.min(startX, currentX) + 130;
        const top = Math.min(startY, currentY);
        const width = Math.max(1, Math.abs(startX - currentX));
        const height = Math.max(1, Math.abs(startY - currentY));

        if (lassoDivRef.current) {
          lassoDivRef.current.style.left = `${left}px`;
          lassoDivRef.current.style.top = `${top}px`;
          lassoDivRef.current.style.width = `${width}px`;
          lassoDivRef.current.style.height = `${height}px`;
        }

        const lassoLeft = Math.min(startX, currentX);
        const lassoRight = Math.max(startX, currentX);
        const lassoTop = Math.min(startY, currentY);
        const lassoBottom = Math.max(startY, currentY);

        const newlySelected = canvasClips
          .filter((clip) => {
            const clipLeft = clip.startBeat * beatWidth;
            const clipRight = (clip.startBeat + clip.duration) * beatWidth;
            const clipTop = clip.laneIndex * LANE_HEIGHT_PX;
            const clipBottom = clipTop + (LANE_HEIGHT_PX - 4);

            return !(
              clipRight < lassoLeft ||
              clipLeft > lassoRight ||
              clipBottom < lassoTop ||
              clipTop > lassoBottom
            );
          })
          .map((clip) => clip.id);

        const hasSelectionChanged =
          newlySelected.length !== selectedIdsRef.current.length ||
          newlySelected.some((id, idx) => id !== selectedIdsRef.current[idx]);

        if (hasSelectionChanged) {
          setSelectedIds(newlySelected);
        }
      });
    }
  };

  const handleGridPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lassoActiveRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      lassoActiveRef.current = false;
      if (lassoDivRef.current) {
        lassoDivRef.current.style.display = "none";
      }
    }
  };

  const handleClipPointerDown = (e: React.PointerEvent<HTMLDivElement>, clip: CanvasClip) => {
    if (activeTool !== 'pointer' && activeTool !== 'pencil') return;
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (target.closest(".clip-resize-handle")) return;

    e.stopPropagation();

    if (!tracksContainerRef.current) return;
    const rect = tracksContainerRef.current.getBoundingClientRect();
    const trackX = e.clientX - rect.left - 130;
    const clickBeat = trackX / beatWidth;
    const clickLane = Math.floor((e.clientY - rect.top) / LANE_HEIGHT_PX);

    e.currentTarget.setPointerCapture(e.pointerId);

    // Ctrl+Shift+Click selection building
    if (e.ctrlKey && e.shiftKey) {
      let nextSelected: string[];
      if (selectedIds.includes(clip.id)) {
        nextSelected = selectedIds.filter((id) => id !== clip.id);
      } else {
        nextSelected = [...selectedIds, clip.id];
      }
      setSelectedIds(nextSelected);

      dragStartRef.current = {
        startX: clickBeat,
        startLane: clickLane,
        originalClips: canvasClips
          .filter((c) => nextSelected.includes(c.id))
          .map((c) => ({
            id: c.id,
            startBeat: c.startBeat,
            laneIndex: c.laneIndex,
          })),
        clipsAtStart: canvasClips,
      };
      return;
    }

    // Shift + Drag duplication
    if (e.shiftKey && !e.ctrlKey) {
      const clipsToDuplicate = selectedIds.includes(clip.id)
        ? canvasClips.filter((c) => selectedIds.includes(c.id))
        : [clip];

      const clonedClips = clipsToDuplicate.map((c) => ({
        ...c,
        id: `c-clip-${Date.now()}-${Math.floor(Math.random() * 99999)}`,
      }));

      const clipsAtStart = [...canvasClips, ...clonedClips];

      setCanvasClips(clipsAtStart);

      const clonedIds = clonedClips.map((c) => c.id);
      setSelectedIds(clonedIds);

      dragStartRef.current = {
        startX: clickBeat,
        startLane: clickLane,
        originalClips: clonedClips.map((c) => ({
          id: c.id,
          startBeat: c.startBeat,
          laneIndex: c.laneIndex,
        })),
        clipsAtStart,
      };
      return;
    }

    // Individual drag relocation in Pencil mode
    if (activeTool === 'pencil') {
      setSelectedIds([clip.id]);
      dragStartRef.current = {
        startX: clickBeat,
        startLane: clickLane,
        originalClips: [{ id: clip.id, startBeat: clip.startBeat, laneIndex: clip.laneIndex }],
        clipsAtStart: canvasClips,
      };
      return;
    }

    // Group selection relocation in Pointer mode
    let newSelectedIds = selectedIds;
    if (!selectedIds.includes(clip.id)) {
      newSelectedIds = [clip.id];
      setSelectedIds(newSelectedIds);
    }

    dragStartRef.current = {
      startX: clickBeat,
      startLane: clickLane,
      originalClips: canvasClips
        .filter((c) => newSelectedIds.includes(c.id))
        .map((c) => ({
          id: c.id,
          startBeat: c.startBeat,
          laneIndex: c.laneIndex,
        })),
      clipsAtStart: canvasClips,
    };
  };

  const handleClipPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((activeTool !== 'pointer' && activeTool !== 'pencil') || !dragStartRef.current) return;
    e.stopPropagation();

    const container = scrollContainerRef.current;
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const threshold = 40;
      const scrollSpeed = 10;

      if (e.clientX > containerRect.right - threshold) {
        container.scrollLeft += scrollSpeed;
      } else if (e.clientX < containerRect.left + threshold) {
        container.scrollLeft -= scrollSpeed;
      }

      if (e.clientY > containerRect.bottom - threshold) {
        container.scrollTop += scrollSpeed;
      } else if (e.clientY < containerRect.top + threshold) {
        container.scrollTop -= scrollSpeed;
      }
    }

    if (!tracksContainerRef.current) return;
    const rect = tracksContainerRef.current.getBoundingClientRect();
    const trackX = e.clientX - rect.left - 130;
    const clickBeat = trackX / beatWidth;
    const clickLane = Math.floor((e.clientY - rect.top) / LANE_HEIGHT_PX);

    const drag = dragStartRef.current;
    const deltaBeat = clickBeat - drag.startX;
    const deltaLane = clickLane - drag.startLane;

    const snap = snapResolution;
    const snappedDeltaBeat = snap !== null
      ? Math.round(deltaBeat / snap) * snap
      : deltaBeat;

    const canMoveAll = drag.originalClips.every((orig) => {
      const targetClip = drag.clipsAtStart.find((c) => c.id === orig.id);
      if (!targetClip) return false;
      const computedStartBeat = orig.startBeat + snappedDeltaBeat;
      const newStart = Math.max(0, computedStartBeat);
      const newLane = orig.laneIndex + deltaLane;
      return (
        newStart + targetClip.duration <= totalBeats &&
        newLane >= 0 &&
        newLane < laneCount
      );
    });

    if (canMoveAll) {
      drag.originalClips.forEach((orig) => {
        const el = document.querySelector(`[data-clip-id="${orig.id}"]`) as HTMLDivElement;
        if (el) {
          const computedStartBeat = orig.startBeat + snappedDeltaBeat;
          const newStart = Math.max(0, computedStartBeat);
          const newLane = orig.laneIndex + deltaLane;
          el.style.left = `${newStart * beatWidth}px`;
          el.style.top = `${newLane * LANE_HEIGHT_PX + CLIP_TOP_OFFSET_PX}px`;
        }
      });
    }
  };

  const handleClipPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool !== 'pointer' && activeTool !== 'pencil') return;
    const drag = dragStartRef.current;
    if (drag) {
      e.currentTarget.releasePointerCapture(e.pointerId);

      if (tracksContainerRef.current) {
        const rect = tracksContainerRef.current.getBoundingClientRect();
        const trackX = e.clientX - rect.left - 130;
        const clickBeat = trackX / beatWidth;
        const clickLane = Math.floor((e.clientY - rect.top) / LANE_HEIGHT_PX);

        const deltaBeat = clickBeat - drag.startX;
        const deltaLane = clickLane - drag.startLane;
        const snap = snapResolution;
        const snappedDeltaBeat = snap !== null
          ? Math.round(deltaBeat / snap) * snap
          : deltaBeat;

        setCanvasClips((prevClips) => {
          const canMoveAll = drag.originalClips.every((orig) => {
            const targetClip = prevClips.find((c) => c.id === orig.id);
            if (!targetClip) return false;
            const computedStartBeat = orig.startBeat + snappedDeltaBeat;
            const newStart = Math.max(0, computedStartBeat);
            const newLane = orig.laneIndex + deltaLane;
            return (
              newStart + targetClip.duration <= totalBeats &&
              newLane >= 0 &&
              newLane < laneCount
            );
          });

          if (!canMoveAll) return prevClips;

          return prevClips.map((c) => {
            const orig = drag.originalClips.find((o) => o.id === c.id);
            if (orig) {
              const computedStartBeat = orig.startBeat + snappedDeltaBeat;
              const newStart = Math.max(0, computedStartBeat);
              return {
                ...c,
                startBeat: newStart,
                laneIndex: orig.laneIndex + deltaLane,
              };
            }
            return c;
          });
        });
      }

      dragStartRef.current = null;
      pushToHistory(channels);
    }
  };

  return {
    lassoDivRef,
    handleGridPointerDown,
    handleGridPointerMove,
    handleGridPointerUp,
    handleClipPointerDown,
    handleClipPointerMove,
    handleClipPointerUp,
  };
}
