/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from "react";
import { CanvasClip, ChannelRow } from "../types";

interface UseClipResizeProps {
  canvasClips: CanvasClip[];
  setCanvasClips: React.Dispatch<React.SetStateAction<CanvasClip[]>>;
  beatWidth: number;
  snapResolution: number | null;
  pushToHistory: (channels: ChannelRow[]) => void;
  channels: ChannelRow[];
}

export function useClipResize({
  canvasClips,
  setCanvasClips,
  beatWidth,
  snapResolution,
  pushToHistory,
  channels,
}: UseClipResizeProps) {
  const resizeStateRef = useRef<{
    clipId: string;
    pointerId: number;
    edge: "left" | "right";
    initialStartBeat: number;
    initialDuration: number;
    initialCropStart: number;
    startX: number;
  } | null>(null);

  const handleResizeDown = (
    e: React.PointerEvent<HTMLDivElement>,
    clip: CanvasClip,
    edge: "left" | "right"
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const element = e.currentTarget;
    element.setPointerCapture(e.pointerId);

    resizeStateRef.current = {
      clipId: clip.id,
      pointerId: e.pointerId,
      edge,
      initialStartBeat: clip.startBeat,
      initialDuration: clip.duration,
      initialCropStart: clip.cropStart || 0,
      startX: e.clientX,
    };
  };

  const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = resizeStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    e.stopPropagation();

    const deltaX = e.clientX - state.startX;
    const deltaBeats = deltaX / beatWidth;

    const currentClips = [...canvasClips];

    const snap = snapResolution;
    if (state.edge === "right") {
      const rawDur = state.initialDuration + deltaBeats;
      const snappedDur = snap !== null
        ? Math.max(snap, Math.round(rawDur / snap) * snap)
        : Math.max(0.001, rawDur);

      const updated = currentClips.map((c) =>
        c.id === state.clipId ? { ...c, duration: snappedDur } : c
      );
      setCanvasClips(updated);
    } else {
      const rightAnchor = state.initialStartBeat + state.initialDuration;
      const rawStart = state.initialStartBeat + deltaBeats;

      const snapLimit = snap !== null ? snap : 0.001;
      const snappedStart = snap !== null
        ? Math.round(rawStart / snap) * snap
        : rawStart;

      const maxSnappedStart = rightAnchor - snapLimit;
      const finalStart = Math.max(0, Math.min(maxSnappedStart, snappedStart));
      const finalDuration = rightAnchor - finalStart;
      const cropOffset = finalStart - state.initialStartBeat;
      const finalCropStart = state.initialCropStart + cropOffset;

      const updated = currentClips.map((c) =>
        c.id === state.clipId
          ? { ...c, startBeat: finalStart, duration: finalDuration, cropStart: finalCropStart }
          : c
      );
      setCanvasClips(updated);
    }
  };

  const handleResizeUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (resizeStateRef.current && resizeStateRef.current.pointerId === e.pointerId) {
      const element = e.currentTarget;
      element.releasePointerCapture(e.pointerId);
      resizeStateRef.current = null;
      pushToHistory(channels);
    }
  };

  return {
    handleResizeDown,
    handleResizeMove,
    handleResizeUp,
  };
}
