/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { DAWEvent } from "../audio/AudioEngine";
import { ChannelRow } from "../types";
import { PATTERN_LENGTH_BEATS } from "../config";

// Standard semitone MIDI note list C1 to C8
const MIDI_NOTES: number[] = [];
for (let i = 108; i >= 24; i--) {
  MIDI_NOTES.push(i);
}

interface UsePianoRollDragProps {
  events: DAWEvent[];
  setEvents: (ev: DAWEvent[]) => void;
  activeChannelId: string;
  activeChannel: ChannelRow | undefined;
  beatWidth: number;
  rowHeight: number;
  snapIncrement: number | null;
  activeTool: 'pencil' | 'pointer' | 'split';
  selectedNoteIds: string[];
  setSelectedNoteIds: (ids: string[]) => void;
  pushToHistory: () => void;
  handleKeyAudition: (pitch: number) => void;
  filteredEvents: DAWEvent[];
  timelineRef: React.RefObject<HTMLDivElement>;
  gridRef: React.RefObject<HTMLDivElement>;
}

export function usePianoRollDrag({
  events,
  setEvents,
  activeChannelId,
  activeChannel,
  beatWidth,
  rowHeight,
  snapIncrement,
  activeTool,
  selectedNoteIds,
  setSelectedNoteIds,
  pushToHistory,
  handleKeyAudition,
  filteredEvents,
  timelineRef,
  gridRef,
}: UsePianoRollDragProps) {
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [lassoActive, setLassoActive] = useState(false);
  const [lassoBox, setLassoBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const [groupDragStart, setGroupDragStart] = useState<{
    startX: number;
    startPitch: number;
    originalNotes: { id: string; time: number; pitch: number }[];
  } | null>(null);

  // Persistent property memory: keeps track of the last edited note duration
  const lastNoteDurationRef = useRef<number>(1.0);

  // Tracks the active fluid placement operation
  const dragPlacementRef = useRef<{
    eventId: string;
    pointerId: number;
  } | null>(null);

  // Tracks active edge resizing
  const resizeStateRef = useRef<{
    eventId: string;
    pointerId: number;
    edge: "left" | "right";
    initialTime: number;
    initialDuration: number;
    startX: number;
    resizingNotes: { id: string; initialTime: number; initialDuration: number }[];
  } | null>(null);

  // Tracks active relocation (note coordinate dragging)
  const relocateStateRef = useRef<{
    eventId: string;
    pointerId: number;
    offsetBeats: number;
    initialPitch: number;
    duration: number;
  } | null>(null);

  // PLACEMENT: PointerDown instantly instantiates a new MIDI note at the pointer grid coordinates
  const handleGridPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only process left click

    const target = e.target as HTMLElement;
    if (target.closest(".note-block-body") || target.closest(".note-resize-handler")) {
      return;
    }

    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickBeat = x / beatWidth;
    const snappedBeat = snapIncrement !== null
      ? Math.round(clickBeat / snapIncrement) * snapIncrement
      : clickBeat;
    const rowIdx = Math.floor(y / rowHeight);
    const pitch = MIDI_NOTES[rowIdx];

    if (pitch === undefined) return;
    if (snappedBeat >= PATTERN_LENGTH_BEATS || snappedBeat < 0) return;

    // Check for collision at exact same grid spot to prevent duplicates
    const collisionExist = events.some(
      (ev) => ev.pitch === pitch && Math.abs(ev.time - snappedBeat) < 0.01
    );
    if (collisionExist) return;

    // Default note to last logged or default duration
    const initialDuration = lastNoteDurationRef.current;

    const nextEvent: DAWEvent = {
      id: `piano-note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      time: snappedBeat,
      duration: initialDuration,
      pitch,
      velocity: 0.8,
      channelId: activeChannelId,
      ...(activeChannel?.type === "sample" && activeChannel.sampleId
        ? { sampleId: activeChannel.sampleId }
        : {}),
    };

    setEvents([...events, nextEvent]);
    handleKeyAudition(pitch);

    e.currentTarget.setPointerCapture(e.pointerId);
    dragPlacementRef.current = {
      eventId: nextEvent.id,
      pointerId: e.pointerId,
    };
  };

  // PLACEMENT: PointerMove updates both start position (X-axis) and pitch row (Y-axis) in real-time
  const handleGridPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragPlacementRef.current || dragPlacementRef.current.pointerId !== e.pointerId) return;
    if (!gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickBeat = x / beatWidth;
    const snappedBeat = snapIncrement !== null
      ? Math.max(0, Math.min(PATTERN_LENGTH_BEATS - snapIncrement, Math.round(clickBeat / snapIncrement) * snapIncrement))
      : Math.max(0, Math.min(PATTERN_LENGTH_BEATS - 0.001, clickBeat));
    
    const rowIdx = Math.max(0, Math.min(MIDI_NOTES.length - 1, Math.floor(y / rowHeight)));
    const pitch = MIDI_NOTES[rowIdx];

    if (pitch === undefined) return;

    const targetEvent = events.find((ev) => ev.id === dragPlacementRef.current?.eventId);
    if (!targetEvent) return;

    if (targetEvent.pitch !== pitch) {
      handleKeyAudition(pitch);
    }

    if (targetEvent.time !== snappedBeat || targetEvent.pitch !== pitch) {
      const updated = events.map((ev) => {
        if (ev.id === dragPlacementRef.current?.eventId) {
          return { ...ev, time: snappedBeat, pitch };
        }
        return ev;
      });
      setEvents(updated);
    }
  };

  // PLACEMENT: PointerUp releases trace and locks current note stats
  const handleGridPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragPlacementRef.current && dragPlacementRef.current.pointerId === e.pointerId) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      
      const finalNote = events.find((ev) => ev.id === dragPlacementRef.current?.eventId);
      if (finalNote) {
        lastNoteDurationRef.current = finalNote.duration;
      }
      dragPlacementRef.current = null;
      pushToHistory();
    }
  };

  // RESIZING: Click edge zone to start bi-directional resizing
  const handleResizeDown = (
    e: React.PointerEvent<HTMLDivElement>,
    noteEvent: DAWEvent,
    edge: "left" | "right"
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const element = e.currentTarget;
    element.setPointerCapture(e.pointerId);

    resizeStateRef.current = {
      eventId: noteEvent.id,
      pointerId: e.pointerId,
      edge,
      initialTime: noteEvent.time,
      initialDuration: noteEvent.duration,
      startX: e.clientX,
      resizingNotes: selectedNoteIds.includes(noteEvent.id)
        ? events
            .filter((ev) => selectedNoteIds.includes(ev.id))
            .map((ev) => ({
              id: ev.id,
              initialTime: ev.time,
              initialDuration: ev.duration,
            }))
        : [{ id: noteEvent.id, initialTime: noteEvent.time, initialDuration: noteEvent.duration }],
    };
  };

  const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = resizeStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    e.stopPropagation();

    const deltaX = e.clientX - state.startX;
    const deltaBeats = deltaX / beatWidth;

    if (state.edge === "right") {
      const updated = events.map((ev) => {
        const orig = state.resizingNotes.find((rn) => rn.id === ev.id);
        if (orig) {
          const rawDur = Math.max(snapIncrement !== null ? snapIncrement : 0.001, orig.initialDuration + deltaBeats);
          const snappedDur = snapIncrement !== null
            ? Math.round(rawDur / snapIncrement) * snapIncrement
            : rawDur;
          if (ev.id === state.eventId) {
            lastNoteDurationRef.current = snappedDur;
          }
          return { ...ev, duration: snappedDur };
        }
        return ev;
      });
      setEvents(updated);
    } else {
      const updated = events.map((ev) => {
        const orig = state.resizingNotes.find((rn) => rn.id === ev.id);
        if (orig) {
          const rightAnchor = orig.initialTime + orig.initialDuration;
          const rawTime = orig.initialTime + deltaBeats;
          const snappedTime = snapIncrement !== null
            ? Math.round(rawTime / snapIncrement) * snapIncrement
            : rawTime;

          const maxSnappedTime = rightAnchor - (snapIncrement !== null ? snapIncrement : 0.001);
          const finalTime = Math.max(0, Math.min(maxSnappedTime, snappedTime));
          const finalDuration = rightAnchor - finalTime;

          if (ev.id === state.eventId) {
            lastNoteDurationRef.current = finalDuration;
          }
          return { ...ev, time: finalTime, duration: finalDuration };
        }
        return ev;
      });
      setEvents(updated);
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

  // RELOCATION: Move existing notes after they are placed
  const handleNotePointerDown = (e: React.PointerEvent<HTMLDivElement>, noteEvent: DAWEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    const target = e.target as HTMLElement;
    if (target.closest(".left-resize-zone") || target.closest(".right-resize-zone")) {
      return;
    }

    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorBeat = cursorX / beatWidth;

    const offsetBeats = cursorBeat - noteEvent.time;

    // Shift + Drag duplication
    if (e.shiftKey) {
      const clonedNote: DAWEvent = {
        ...noteEvent,
        id: `piano-note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      };
      setEvents([...events, clonedNote]);
      e.currentTarget.setPointerCapture(e.pointerId);
      setDraggingNoteId(clonedNote.id);

      relocateStateRef.current = {
        eventId: clonedNote.id,
        pointerId: e.pointerId,
        offsetBeats,
        initialPitch: clonedNote.pitch || 60,
        duration: clonedNote.duration,
      };
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingNoteId(noteEvent.id);

    relocateStateRef.current = {
      eventId: noteEvent.id,
      pointerId: e.pointerId,
      offsetBeats,
      initialPitch: noteEvent.pitch || 60,
      duration: noteEvent.duration,
    };
  };

  const handleNotePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = relocateStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    e.stopPropagation();

    const container = timelineRef.current;
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

    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const rawBeat = (cursorX / beatWidth) - state.offsetBeats;
    const snappedBeat = snapIncrement !== null
      ? Math.max(0, Math.min(32 - state.duration, Math.round(rawBeat / snapIncrement) * snapIncrement))
      : Math.max(0, Math.min(32 - state.duration, rawBeat));

    const rowIdx = Math.max(0, Math.min(MIDI_NOTES.length - 1, Math.floor(cursorY / rowHeight)));
    const pitch = MIDI_NOTES[rowIdx];

    if (pitch === undefined) return;

    const targetEvent = events.find((ev) => ev.id === state.eventId);
    if (!targetEvent) return;

    if (targetEvent.pitch !== pitch) {
      handleKeyAudition(pitch);
    }

    if (targetEvent.time !== snappedBeat || targetEvent.pitch !== pitch) {
      const updated = events.map((ev) => {
        if (ev.id === state.eventId) {
          return { ...ev, time: snappedBeat, pitch };
        }
        return ev;
      });
      setEvents(updated);
    }
  };

  const handleNotePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = relocateStateRef.current;
    if (state && state.pointerId === e.pointerId) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      relocateStateRef.current = null;
      setDraggingNoteId(null);
      pushToHistory();
    }
  };

  // Pointer Mode Lasso
  const handleGridPointerDownPointerMode = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool !== 'pointer' && !e.ctrlKey) return;
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (target.closest(".note-block-body") || target.closest(".note-resize-handler")) {
      return;
    }

    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const trackX = e.clientX - rect.left;
    const trackY = e.clientY - rect.top;

    setSelectedNoteIds([]);

    setLassoActive(true);
    setLassoBox({
      startX: trackX,
      startY: trackY,
      currentX: trackX,
      currentY: trackY,
    });

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleGridPointerMovePointerMode = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!lassoActive || !lassoBox) return;

    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const trackX = e.clientX - rect.left;
    const trackY = e.clientY - rect.top;

    const currentLasso = { ...lassoBox, currentX: trackX, currentY: trackY };
    setLassoBox(currentLasso);

    const lassoLeft = Math.min(currentLasso.startX, currentLasso.currentX);
    const lassoRight = Math.max(currentLasso.startX, currentLasso.currentX);
    const lassoTop = Math.min(currentLasso.startY, currentLasso.currentY);
    const lassoBottom = Math.max(currentLasso.startY, currentLasso.currentY);

    const newlySelected = filteredEvents
      .filter((note) => {
        const noteLeft = note.time * beatWidth;
        const noteRight = (note.time + note.duration) * beatWidth;
        const rowIdx = MIDI_NOTES.indexOf(note.pitch || 60);
        if (rowIdx === -1) return false;
        const noteTop = rowIdx * rowHeight;
        const noteBottom = noteTop + rowHeight;

        return !(
          noteRight < lassoLeft ||
          noteLeft > lassoRight ||
          noteBottom < lassoTop ||
          noteTop > lassoBottom
        );
      })
      .map((note) => note.id);

    setSelectedNoteIds(newlySelected);
  };

  const handleGridPointerUpPointerMode = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lassoActive) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setLassoActive(false);
      setLassoBox(null);
    }
  };

  // Relocation in Pointer Mode
  const handleNotePointerDownPointerMode = (e: React.PointerEvent<HTMLDivElement>, noteEvent: DAWEvent) => {
    if (activeTool !== 'pointer' && !selectedNoteIds.includes(noteEvent.id) && !e.shiftKey) return;
    if (e.button !== 0) return;
    e.stopPropagation();

    const target = e.target as HTMLElement;
    if (target.closest(".left-resize-zone") || target.closest(".right-resize-zone")) {
      return;
    }

    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    
    const clickBeat = cursorX / beatWidth;
    const clickRow = Math.floor(cursorY / rowHeight);
    const clickPitch = MIDI_NOTES[clickRow];

    e.currentTarget.setPointerCapture(e.pointerId);

    let newSelectedIds = selectedNoteIds;
    if (!selectedNoteIds.includes(noteEvent.id)) {
      newSelectedIds = [noteEvent.id];
      setSelectedNoteIds(newSelectedIds);
    }

    if (e.shiftKey) {
      const notesToDuplicate = events.filter((n) => newSelectedIds.includes(n.id) || n.id === noteEvent.id);
      const clonedNotes = notesToDuplicate.map((n) => ({
        ...n,
        id: `piano-note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      }));

      setEvents([...events, ...clonedNotes]);

      const clonedIds = clonedNotes.map((n) => n.id);
      setSelectedNoteIds(clonedIds);

      setGroupDragStart({
        startX: clickBeat,
        startPitch: clickPitch || 60,
        originalNotes: clonedNotes.map((n) => ({
          id: n.id,
          time: n.time,
          pitch: n.pitch || 60,
        })),
      });
      return;
    }

    setGroupDragStart({
      startX: clickBeat,
      startPitch: clickPitch || 60,
      originalNotes: events
        .filter((ev) => newSelectedIds.includes(ev.id))
        .map((ev) => ({
          id: ev.id,
          time: ev.time,
          pitch: ev.pitch || 60,
        })),
    });
  };

  const handleNotePointerMovePointerMode = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!groupDragStart) return;
    e.stopPropagation();

    const container = timelineRef.current;
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

    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const clickBeat = cursorX / beatWidth;
    const clickRow = Math.floor(cursorY / rowHeight);
    const clickPitch = MIDI_NOTES[clickRow];
    if (clickPitch === undefined) return;

    const deltaBeat = clickBeat - groupDragStart.startX;
    const deltaPitch = clickPitch - groupDragStart.startPitch;

    const snappedDeltaBeat = snapIncrement !== null
      ? Math.round(deltaBeat / snapIncrement) * snapIncrement
      : deltaBeat;

    const canMoveAll = groupDragStart.originalNotes.every((orig) => {
      const targetNote = events.find((n) => n.id === orig.id);
      if (!targetNote) return false;
      const newTime = orig.time + snappedDeltaBeat;
      const newPitch = orig.pitch + deltaPitch;
      return (
        newTime >= 0 &&
        newTime + targetNote.duration <= PATTERN_LENGTH_BEATS &&
        MIDI_NOTES.includes(newPitch)
      );
    });

    if (canMoveAll) {
      const updated = events.map((n) => {
        const orig = groupDragStart.originalNotes.find((o) => o.id === n.id);
        if (orig) {
          return {
            ...n,
            time: orig.time + snappedDeltaBeat,
            pitch: orig.pitch + deltaPitch,
          };
        }
        return n;
      });
      setEvents(updated);
    }
  };

  const handleNotePointerUpPointerMode = (e: React.PointerEvent<HTMLDivElement>) => {
    if (groupDragStart) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setGroupDragStart(null);
      pushToHistory();
    }
  };

  return {
    lassoActive,
    lassoBox,
    draggingNoteId,
    handleGridPointerDown,
    handleGridPointerMove,
    handleGridPointerUp,
    handleNotePointerDown,
    handleNotePointerMove,
    handleNotePointerUp,
    handleGridPointerDownPointerMode,
    handleGridPointerMovePointerMode,
    handleGridPointerUpPointerMode,
    handleNotePointerDownPointerMode,
    handleNotePointerMovePointerMode,
    handleNotePointerUpPointerMode,
    handleResizeDown,
    handleResizeMove,
    handleResizeUp,
  };
}
