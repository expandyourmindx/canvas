import React, { useRef } from "react";
import { CanvasClip, ChannelRow } from "../types";

interface UseClipResizeProps {
  canvasClips: CanvasClip[];
  setCanvasClips: React.Dispatch<React.SetStateAction<CanvasClip[]>>;
  beatWidth: number;
  snapResolution: number | null;
  pushToHistory: () => void;
  channels: ChannelRow[];
  selectedIds: string[];
  totalBeats: number;
}

export function useClipResize({
  canvasClips,
  setCanvasClips,
  beatWidth,
  snapResolution,
  pushToHistory,
  channels,
  selectedIds,
  totalBeats,
}: UseClipResizeProps) {
  const resizeStateRef = useRef<{
    clipId: string;
    pointerId: number;
    edge: "left" | "right";
    startX: number;
    originalClips: {
      id: string;
      initialStartBeat: number;
      initialDuration: number;
      initialCropStart: number;
    }[];
  } | null>(null);

  const lastResizedClipsRef = useRef<CanvasClip[] | null>(null);

  const handleResizeDown = (
    e: React.PointerEvent<HTMLDivElement>,
    clip: CanvasClip,
    edge: "left" | "right"
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const element = e.currentTarget;
    element.setPointerCapture(e.pointerId);

    const isSelectionResize = selectedIds.includes(clip.id);
    const clipsToResize = isSelectionResize
      ? canvasClips.filter((c) => selectedIds.includes(c.id))
      : [clip];

    resizeStateRef.current = {
      clipId: clip.id,
      pointerId: e.pointerId,
      edge,
      startX: e.clientX,
      originalClips: clipsToResize.map((c) => ({
        id: c.id,
        initialStartBeat: c.startBeat,
        initialDuration: c.duration,
        initialCropStart: c.cropStart || 0,
      })),
    };
  };

  const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = resizeStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    e.stopPropagation();

    const deltaX = e.clientX - state.startX;
    const deltaBeats = deltaX / beatWidth;

    const snap = snapResolution;
    const minDuration = snap !== null ? snap : 0.001;

    if (state.edge === "right") {
      const draggedOrig = state.originalClips.find((o) => o.id === state.clipId);
      if (!draggedOrig) return;

      const rawDur = draggedOrig.initialDuration + deltaBeats;
      const snappedDur = snap !== null
        ? Math.round(rawDur / snap) * snap
        : rawDur;

      let snappedDelta = snappedDur - draggedOrig.initialDuration;

      // Minimum length constraint: clamp the delta to ensure no clip goes below minDuration
      state.originalClips.forEach((orig) => {
        const minDelta = minDuration - orig.initialDuration;
        if (snappedDelta < minDelta) {
          snappedDelta = minDelta;
        }
      });

      // Maximum length constraint: clamp the delta so no clip extends past timeline end
      state.originalClips.forEach((orig) => {
        const maxDelta = totalBeats - orig.initialStartBeat - orig.initialDuration;
        if (snappedDelta > maxDelta) {
          snappedDelta = maxDelta;
        }
      });

      const origMap = new Map(state.originalClips.map((o) => [o.id, o]));
      setCanvasClips((prev) => {
        const next = prev.map((c) => {
          const orig = origMap.get(c.id);
          if (orig) {
            return { ...c, duration: orig.initialDuration + snappedDelta };
          }
          return c;
        });
        lastResizedClipsRef.current = next;
        return next;
      });
    } else {
      const draggedOrig = state.originalClips.find((o) => o.id === state.clipId);
      if (!draggedOrig) return;

      const rawStart = draggedOrig.initialStartBeat + deltaBeats;
      const snappedStart = snap !== null
        ? Math.round(rawStart / snap) * snap
        : rawStart;

      let snappedDelta = snappedStart - draggedOrig.initialStartBeat;

      // Apply constraints across all clips in the selection:
      // 1. Prevent start beat from going negative (snappedDelta >= -initialStartBeat)
      // 2. Prevent crop start from going negative (snappedDelta >= -initialCropStart)
      // 3. Prevent duration from falling below minDuration (snappedDelta <= initialDuration - minDuration)
      state.originalClips.forEach((orig) => {
        const minDeltaStart = -orig.initialStartBeat;
        const minDeltaCrop = -orig.initialCropStart;
        const maxDeltaDur = orig.initialDuration - minDuration;

        if (snappedDelta < minDeltaStart) {
          snappedDelta = minDeltaStart;
        }
        if (snappedDelta < minDeltaCrop) {
          snappedDelta = minDeltaCrop;
        }
        if (snappedDelta > maxDeltaDur) {
          snappedDelta = maxDeltaDur;
        }
      });

      const origMap = new Map(state.originalClips.map((o) => [o.id, o]));
      setCanvasClips((prev) => {
        const next = prev.map((c) => {
          const orig = origMap.get(c.id);
          if (orig) {
            return {
              ...c,
              startBeat: orig.initialStartBeat + snappedDelta,
              duration: orig.initialDuration - snappedDelta,
              cropStart: orig.initialCropStart + snappedDelta,
            };
          }
          return c;
        });
        lastResizedClipsRef.current = next;
        return next;
      });
    }
  };

  const handleResizeUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (resizeStateRef.current && resizeStateRef.current.pointerId === e.pointerId) {
      const element = e.currentTarget;
      element.releasePointerCapture(e.pointerId);
      resizeStateRef.current = null;
      pushToHistory();
    }
  };

  const handleResizeCancel = () => {
    const state = resizeStateRef.current;
    if (!state) return;

    const origMap = new Map(state.originalClips.map((o) => [o.id, o]));
    setCanvasClips((prev) =>
      prev.map((c) => {
        const orig = origMap.get(c.id);
        if (orig) {
          return {
            ...c,
            startBeat: orig.initialStartBeat,
            duration: orig.initialDuration,
            cropStart: orig.initialCropStart,
          };
        }
        return c;
      })
    );

    resizeStateRef.current = null;
    lastResizedClipsRef.current = null;
  };

  return {
    handleResizeDown,
    handleResizeMove,
    handleResizeUp,
    handleResizeCancel,
    lastResizedClipsRef,
  };
}
