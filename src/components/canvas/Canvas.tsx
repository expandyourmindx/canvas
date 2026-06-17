/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { useAudioEngine } from "../../audio/useAudioEngine";
import { CanvasClip, ChannelRow } from "../../types";
import { useClipDrag } from "../../hooks/useClipDrag";
import { useClipResize } from "../../hooks/useClipResize";
import { ArrangerSourcePicker } from "../ArrangerSourcePicker";
import { ArrangerRuler } from "../ArrangerRuler";
import { useTheme } from "../../theme/ThemeContext";

// Subcomponents
import { CanvasHeader } from "./components/CanvasHeader";
import { TimelineGrid } from "./components/TimelineGrid";
import { PlayheadCaret } from "./components/PlayheadCaret";

// Hooks
import { useCanvasState } from "./hooks/useCanvasState";
import { useArrangerDrop, getSampleName } from "./hooks/useArrangerDrop";

interface GhostClip {
  insertIndex: number;
  laneIndex: number;
  startBeat: number;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export interface CanvasProps {
  channels?: ChannelRow[];
  setChannels?: React.Dispatch<React.SetStateAction<ChannelRow[]>>;
  setChannelVols?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setChannelMixers?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  activeInstrumentId?: string;
  setActiveInstrumentId?: (id: string) => void;
  onOpenWindow?: (windowId: "pianoroll" | "sequencer" | "sampler" | "wam" | "canvas") => void;
  onOpenPianoRoll?: (channelId: string) => void;
  onOpenSampler?: (channelId: string) => void;
  onOpenChannelRack?: () => void;
}

export function Canvas({
  channels = [],
  setChannels,
  setChannelVols,
  setChannelMixers,
  activeInstrumentId,
  setActiveInstrumentId,
  onOpenWindow,
  onOpenPianoRoll,
  onOpenSampler,
}: CanvasProps) {
  const {
    engine,
    canvasClips,
    patterns,
    setCanvasClips,
    addCanvasClip,
    removeCanvasClip,
    getSampleBuffer,
    setPlayheadPosition,
    loopSettings,
    setLoop,
    pushToHistory,
    previewChannel,
    sampleCount,
    notifySampleLoaded,
    focusedChannelId,
    setFocusedChannelId,
    isRecording,
    getRecordingStatus,
    pendingRecordedClips,
    clearPendingRecordedClips,
    laneStates,
    setLaneMute,
    setLaneSolo,
  } = useAudioEngine();

  const { theme: DARK, raised, sunken, flat, SPACE } = useTheme();

  // Viewport and viewport state hooks
  const {
    scrollContainerRef,
    scrollLeft,
    viewportWidth,
    handleScroll,
    zoomX,
    setZoomX,
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
  } = useCanvasState({ canvasClips });

  const getSampleBufferWrapper = React.useCallback((id: string) => {
    const chan = channels.find(c => c.id === id || c.sampleId === id);
    const actualId = chan ? (chan.sampleId || id) : id;
    return getSampleBuffer(actualId);
  }, [channels, getSampleBuffer]);

  // Brush / Stamp properties
  const [selectedClipType, setSelectedClipType] = useState<"pattern" | "sample" | null>(null);
  const [selectedReferenceId, setSelectedReferenceId] = useState<string>("");
  const [clipDurationBeats, setClipDurationBeats] = useState<number>(1);
  const [clipCropStart, setClipCropStart] = useState<number>(0);

  // Hook up Drag and Drop arranger operations
  const {
    handleAudioFileImport,
    handleDropOnLane
  } = useArrangerDrop({
    engine,
    channels,
    setChannels,
    setChannelVols,
    setChannelMixers,
    setActiveInstrumentId,
    setFocusedChannelId,
    onOpenSampler,
    onOpenWindow,
    totalBeats,
    activeSnapResolution,
    setCanvasClips,
    setSelectedIds,
    setSelectedClipType,
    setSelectedReferenceId,
    setClipDurationBeats,
    setClipCropStart,
    pushToHistory,
    notifySampleLoaded,
    getSampleBuffer: getSampleBufferWrapper,
    DARK
  });

  // Ghost clip recording state
  const [ghostClips, setGhostClips] = useState<GhostClip[]>([]);
  const ghostClipsRef = useRef<GhostClip[]>([]);
  const recordTakeCounterRef = useRef(0);

  // Keep ghostClipsRef in sync with ghostClips state
  useEffect(() => { ghostClipsRef.current = ghostClips; }, [ghostClips]);

  // ── PART 2: Lane assignment + ghost clip creation on recording start ──
  useEffect(() => {
    if (!isRecording) return;

    const maxLane = canvasClips.length > 0
      ? canvasClips.reduce((acc, c) => Math.max(acc, c.laneIndex), 0)
      : -1;

    const armedIndices = engine.getArmedInsertIndices();
    const status = getRecordingStatus();
    const startBeat = status.startBeat;

    const newGhosts: GhostClip[] = armedIndices.map((insertIndex, i) => ({
      insertIndex,
      laneIndex: maxLane + 1 + i,
      startBeat,
      canvasRef: React.createRef<HTMLCanvasElement>(),
    }));

    setGhostClips(newGhosts);

    return () => {
      // Ghost clips cleaned up in PART 5 on pendingRecordedClips arrival
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  // ── PART 5: Convert pending recorded clips to real CanvasClips ──
  useEffect(() => {
    if (!pendingRecordedClips || pendingRecordedClips.length === 0) return;

    setCanvasClips((currentClips) => {
      const newClips: CanvasClip[] = pendingRecordedClips.map((result) => {
        const ghost = ghostClips.find(g => g.insertIndex === result.insertIndex);
        const laneIndex = ghost ? ghost.laneIndex : (() => {
          const maxLane = currentClips.length > 0
            ? currentClips.reduce((acc, c) => Math.max(acc, c.laneIndex), 0)
            : -1;
          return maxLane + 1;
        })();

        recordTakeCounterRef.current += 1;
        const takeName = `REC ${String(recordTakeCounterRef.current).padStart(3, '0')}`;

        return {
          id: crypto.randomUUID(),
          type: 'sample' as const,
          startBeat: result.startBeat,
          duration: result.durationBeats,
          laneIndex,
          referenceId: result.sampleId,
          name: takeName,
          color: '#c0392b',
        };
      });

      if (setChannels) {
        const newChannels = pendingRecordedClips.map((result) => {
          const takeName = newClips.find(c => c.referenceId === result.sampleId)?.name || 'REC';
          return {
            id: crypto.randomUUID(),
            name: takeName,
            type: 'sample' as const,
            sampleId: result.sampleId,
            mixerTarget: result.insertIndex,
            instrumentType: 'sampler' as const,
          };
        });
        setChannels(prev => [...prev, ...newChannels]);
      }

      setGhostClips([]);
      clearPendingRecordedClips();

      return [...currentClips, ...newClips];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRecordedClips]);

  // Select first available item by default on load
  useEffect(() => {
    if (selectedClipType && selectedReferenceId) {
      if (selectedClipType === "pattern") {
        const patternExists = patterns.some(p => p.id === selectedReferenceId);
        if (patternExists) return;
      } else if (selectedClipType === "sample") {
        const loadedSamples = engine?.getLoadedSampleIds() || [];
        const sampleExists = loadedSamples.includes(selectedReferenceId);
        const channelExists = (channels || []).some(c => c.id === selectedReferenceId || c.sampleId === selectedReferenceId);
        if (sampleExists || channelExists) return;
      }
    }

    if (patterns && patterns.length > 0) {
      setSelectedClipType("pattern");
      setSelectedReferenceId(patterns[0].id);
      setClipDurationBeats(4);
      setClipCropStart(0);
    } else {
      const loaded = engine?.getLoadedSampleIds() || [];
      if (loaded.length > 0) {
        setSelectedClipType("sample");
        setSelectedReferenceId(loaded[0]);
        setClipDurationBeats(1);
        setClipCropStart(0);
      }
    }
  }, [patterns, engine, selectedClipType, selectedReferenceId, channels]);

  // Resolve metadata (human labels, theme colors) for selected brush element
  const getClipMetadata = React.useCallback((type: "pattern" | "sample", refId: string) => {
    if (type === "sample") {
      return {
        name: getSampleName(refId),
        color: DARK.accentGreen
      };
    } else {
      const match = patterns.find(p => p.id === refId);
      return {
        name: match?.name || "MIDI Pattern",
        color: DARK.accentBlue
      };
    }
  }, [patterns, DARK.accentBlue, DARK.accentGreen]);

  // Double-clicking cells or direct single tapping stamps them
  const handleCellClick = (laneIndex: number, startBeat: number) => {
    if (!selectedClipType) return;

    const duration = clipDurationBeats;

    if (startBeat + duration > totalBeats) return;

    const meta = getClipMetadata(selectedClipType, selectedReferenceId);

    const newClip: CanvasClip = {
      id: `c-clip-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      type: selectedClipType,
      startBeat: startBeat,
      duration: duration,
      laneIndex: laneIndex,
      referenceId: selectedReferenceId,
      name: meta.name,
      color: meta.color,
      cropStart: 0
    };

    addCanvasClip(newClip);
    setSelectedIds([newClip.id]);
  };

  const clearArrangement = () => {
    setCanvasClips([]);
  };

  // Split click handler on clips
  const handleClipSplit = React.useCallback((e: React.PointerEvent<HTMLDivElement>, clip: CanvasClip) => {
    if (e.button !== 0) return;
    const relativeClickBeat = (e.clientX - e.currentTarget.getBoundingClientRect().left) / beatWidth;
    const snap = activeSnapResolution;
    const snappedSplitBeat = clip.startBeat + (snap !== null ? Math.round(relativeClickBeat / snap) * snap : relativeClickBeat);

    const relativeSplitBeat = snappedSplitBeat - clip.startBeat;
    if (relativeSplitBeat > 0 && relativeSplitBeat < clip.duration) {
      const durationA = relativeSplitBeat;
      const durationB = clip.duration - relativeSplitBeat;
      const cropStartB = (clip.cropStart || 0) + relativeSplitBeat;

      const clipA = {
        ...clip,
        duration: durationA
      };

      const clipB: CanvasClip = {
        id: `c-clip-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
        type: clip.type,
        startBeat: snappedSplitBeat,
        duration: durationB,
        laneIndex: clip.laneIndex,
        referenceId: clip.referenceId,
        name: clip.name,
        color: clip.color,
        cropStart: cropStartB
      };

      const updated = canvasClips.map((c) => (c.id === clip.id ? clipA : c));
      setCanvasClips([...updated, clipB]);
      pushToHistory();
      console.log(`Arranger Clip "${clip.name}" split at beat ${snappedSplitBeat}`);
    }
  }, [canvasClips, beatWidth, activeSnapResolution, setCanvasClips, pushToHistory]);

  // Double click arranger clip to reveal the editor
  const handleClipDoubleClick = React.useCallback((clip: CanvasClip) => {
    if (clip.type === "sample") {
      const chan = channels.find(c => c.sampleId === clip.referenceId || c.id === clip.referenceId);
      if (chan) {
        onOpenWindow?.("sampler");
        onOpenSampler?.(chan.id);
        if (setActiveInstrumentId) {
          setActiveInstrumentId(chan.id);
        }
        if (setFocusedChannelId) {
          setFocusedChannelId(chan.id);
        }
      }
      return;
    }

    // Pattern clips double-click
    const pattern = patterns.find(p => p.id === clip.referenceId);
    if (!pattern) return;

    let hasPianoRoll = false;
    let hasStepSeq = false;
    let mainChannelId = channels[0]?.id || "sampler_default";

    pattern.notes.forEach(note => {
      const chan = channels.find(c => c.id === note.channelId);
      if (chan) {
        mainChannelId = chan.id;
        if (chan.instrumentType === "wam") {
          hasPianoRoll = true;
        } else {
          // If sampler has complex timings, chords, or custom durations, it is piano roll
          const isOffGrid = note.time % 0.25 !== 0;
          const isCustomDuration = note.duration !== 0.4 && note.duration !== 0.25;
          const isCustomPitch = note.pitch !== undefined && note.pitch !== 60;

          if (isOffGrid || isCustomDuration || isCustomPitch) {
            hasPianoRoll = true;
          } else {
            hasStepSeq = true;
          }
        }
      }
    });

    if (hasStepSeq) {
      onOpenWindow?.("sequencer");
    } else if (hasPianoRoll) {
      if (onOpenPianoRoll && mainChannelId) {
        onOpenPianoRoll(mainChannelId);
        if (setActiveInstrumentId) {
          setActiveInstrumentId(mainChannelId);
        }
        if (setFocusedChannelId) {
          setFocusedChannelId(mainChannelId);
        }
      }
    } else {
      onOpenWindow?.("sequencer");
    }
  }, [channels, patterns, onOpenWindow, onOpenSampler, onOpenPianoRoll, setActiveInstrumentId, setFocusedChannelId]);

  // Compile active selection label or metadata representation for feedback
  const getActiveSelectionDetails = () => {
    if (!selectedClipType) return "None selected";
    if (selectedClipType === "sample") {
      return `${getSampleName(selectedReferenceId)} (${clipDurationBeats} beat${clipDurationBeats === 1 ? "" : "s"})`;
    } else {
      const target = patterns.find(p => p.id === selectedReferenceId);
      return target ? `${target.name} (4 beats)` : `${selectedReferenceId} (4 beats)`;
    }
  };

  const tracksContainerRef = useRef<HTMLDivElement>(null);

  // Hook integrations
  const {
    lassoDivRef,
    handleGridPointerDown: hookGridPointerDown,
    handleGridPointerMove: hookGridPointerMove,
    handleGridPointerUp: hookGridPointerUp,
    handleClipPointerDown,
    handleClipPointerMove,
    handleClipPointerUp,
  } = useClipDrag({
    activeTool,
    snapResolution: activeSnapResolution,
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
  });

  const handleClipPointerDownWrapper = React.useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    clip: CanvasClip
  ) => {
    setSelectedClipType(clip.type);
    setSelectedReferenceId(clip.referenceId);
    setClipDurationBeats(clip.duration);
    setClipCropStart(clip.cropStart || 0);
    handleClipPointerDown(e, clip);
  }, [handleClipPointerDown]);

  const resizingClipIdRef = useRef<string | null>(null);

  const {
    handleResizeDown,
    handleResizeMove,
    handleResizeUp,
    handleResizeCancel,
    lastResizedClipsRef,
  } = useClipResize({
    canvasClips,
    setCanvasClips,
    beatWidth,
    snapResolution: activeSnapResolution,
    pushToHistory,
    channels,
    selectedIds,
    totalBeats,
  });

  const handleResizeDownWrapper = React.useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    clip: CanvasClip,
    edge: "left" | "right"
  ) => {
    resizingClipIdRef.current = clip.id;
    setSelectedClipType(clip.type);
    setSelectedReferenceId(clip.referenceId);
    setClipDurationBeats(clip.duration);
    setClipCropStart(clip.cropStart || 0);
    handleResizeDown(e, clip, edge);
  }, [handleResizeDown]);

  const handleResizeUpWrapper = React.useCallback((
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    handleResizeUp(e);
    if (resizingClipIdRef.current) {
      const source = lastResizedClipsRef.current ?? canvasClips;
      const updatedClip = source.find((c) => c.id === resizingClipIdRef.current);
      if (updatedClip) {
        setClipDurationBeats(updatedClip.duration);
        setClipCropStart(updatedClip.cropStart || 0);
      }
      resizingClipIdRef.current = null;
    }
  }, [handleResizeUp, canvasClips]);

  // Middle-Click Panning overrides
  const handleGridPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      isMiddleClickPanning.current = true;
      panStartX.current = e.clientX;
      panStartY.current = e.clientY;
      panScrollLeft.current = scrollContainerRef.current ? scrollContainerRef.current.scrollLeft : 0;
      panScrollTop.current = scrollContainerRef.current ? scrollContainerRef.current.scrollTop : 0;
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    hookGridPointerDown(e);
  };

  const handleGridPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMiddleClickPanning.current) {
      e.preventDefault();
      const deltaX = e.clientX - panStartX.current;
      const deltaY = e.clientY - panStartY.current;
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = panScrollLeft.current - deltaX;
        scrollContainerRef.current.scrollTop = panScrollTop.current - deltaY;
      }
      return;
    }
    hookGridPointerMove(e);
  };

  const handleGridPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMiddleClickPanning.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      isMiddleClickPanning.current = false;
      return;
    }
    hookGridPointerUp(e);
  };

  const setZoomXClamped = React.useCallback((value: React.SetStateAction<number>) => {
    setZoomX(value);
  }, [setZoomX]);

  return (
    <div
      id="daw-canvas-window"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: DARK.bg1,
        color: DARK.textMid,
        fontFamily: DARK.font,
        fontSize: "11px",
        userSelect: "none",
        position: "relative",
        boxSizing: "border-box",
        padding: `${SPACE.md}px`,
        gap: `${SPACE.md}px`,
        overflow: "hidden",
        ...flat(DARK),
      }}
    >
      {/* HEADER STRIP */}
      <CanvasHeader
        selectedClipType={selectedClipType}
        selectedReferenceId={selectedReferenceId}
        patterns={patterns}
        getSampleName={getSampleName}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        setSelectedIds={setSelectedIds}
        snapResolution={snapResolution}
        setSnapResolution={setSnapResolution}
        DARK={DARK}
        raised={raised}
        sunken={sunken}
        SPACE={SPACE}
      />

      {/* TWO COLUMN BENTO LAYOUT */}
      <div
        style={{
          display: "flex",
          gap: `${SPACE.md}px`,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* LEFT COLUMN: AVAILABLE SOURCE PICKER */}
        <ArrangerSourcePicker
          patterns={patterns}
          engine={engine}
          channels={channels}
          onOpenPianoRoll={onOpenPianoRoll}
          onOpenSampler={onOpenSampler}
          onOpenWindow={onOpenWindow}
          selectedClipType={selectedClipType}
          setSelectedClipType={setSelectedClipType}
          selectedReferenceId={selectedReferenceId}
          setSelectedReferenceId={setSelectedReferenceId}
          setClipDurationBeats={setClipDurationBeats}
          getActiveSelectionDetails={getActiveSelectionDetails}
          getSampleName={getSampleName}
          handleAudioFileImport={handleAudioFileImport}
          sampleCount={sampleCount}
        />

        {/* RIGHT COLUMN: ARRANGEMENT TIMELINE */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, height: "100%", position: "relative" }}>
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            style={{
              position: "relative",
              userSelect: "none",
              backgroundColor: DARK.bg0,
              flex: 1,
              overflow: "auto",
              boxSizing: "border-box",
              ...sunken(DARK),
            }}
          >
            <div style={{ position: "relative", width: `${130 + timelineWidth}px` }}>
              
              {/* PLAYHEAD LINE CARET */}
              <PlayheadCaret beatWidth={beatWidth} DARK={DARK} />

              {/* TIMELINE RULER */}
              <ArrangerRuler
                totalBeats={totalBeats}
                beatWidth={beatWidth}
                snapResolution={activeSnapResolution !== null ? activeSnapResolution : 0.001}
                loopSettings={loopSettings}
                setPlayheadPosition={setPlayheadPosition}
                setLoop={setLoop}
                zoomX={zoomX}
                setZoomX={setZoomXClamped}
                scrollContainerRef={scrollContainerRef}
                scrollLeft={scrollLeft}
                viewportWidth={viewportWidth}
              />

              {/* STAGE LANES GRID CONTAINER */}
              <TimelineGrid
                totalBeats={totalBeats}
                beatWidth={beatWidth}
                timelineWidth={timelineWidth}
                activeSnapResolution={activeSnapResolution}
                gridStyle={gridStyle}
                listLanes={listLanes}
                laneStates={laneStates}
                setLaneMute={setLaneMute}
                setLaneSolo={setLaneSolo}
                setLaneCount={setLaneCount}
                activeTool={activeTool}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                canvasClips={canvasClips}
                placingClip={placingClip}
                ghostClips={ghostClips}
                isRecording={isRecording}
                engine={engine}
                getRecordingStatus={getRecordingStatus}
                lassoDivRef={lassoDivRef}
                tracksContainerRef={tracksContainerRef}
                handleGridPointerDown={handleGridPointerDown}
                handleGridPointerMove={handleGridPointerMove}
                handleGridPointerUp={handleGridPointerUp}
                selectedClipType={selectedClipType}
                selectedReferenceId={selectedReferenceId}
                clipDurationBeats={clipDurationBeats}
                clipCropStart={clipCropStart}
                setSelectedClipType={setSelectedClipType}
                setSelectedReferenceId={setSelectedReferenceId}
                setClipDurationBeats={setClipDurationBeats}
                setClipCropStart={setClipCropStart}
                updatePlacingClip={updatePlacingClip}
                placingClipRef={placingClipRef}
                placingPointerId={placingPointerId}
                patterns={patterns}
                getSampleBufferWrapper={getSampleBufferWrapper}
                removeCanvasClip={removeCanvasClip}
                handleClipSplit={handleClipSplit}
                handleClipPointerDownWrapper={handleClipPointerDownWrapper}
                handleClipPointerMove={handleClipPointerMove}
                handleClipPointerUp={handleClipPointerUp}
                handleClipDoubleClick={handleClipDoubleClick}
                handleResizeDownWrapper={handleResizeDownWrapper}
                handleResizeMove={handleResizeMove}
                handleResizeUpWrapper={handleResizeUpWrapper}
                handleResizeCancel={handleResizeCancel}
                handleDropOnLane={handleDropOnLane}
                getClipMetadata={getClipMetadata}
                addCanvasClip={addCanvasClip}
                pushToHistory={pushToHistory}
                DARK={DARK}
                SPACE={SPACE}
              />

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
