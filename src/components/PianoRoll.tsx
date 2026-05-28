/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo, useEffect } from "react";
import { useAudioEngine } from "../audio/useAudioEngine";
import { DAWEvent } from "../audio/AudioEngine";
import { ChannelRow } from "../types";
import { Keyboard, Grid, Trash2, Pencil, MousePointer } from "lucide-react";
import { PATTERN_LENGTH_BEATS } from "../config";

import { usePianoRollDrag } from "../hooks/usePianoRollDrag";
import { PianoKeyboard } from "./PianoKeyboard";
import { PianoRollNote } from "./PianoRollNote";
import { getAutoSnapResolution } from "../utils/snapUtils";

interface PianoRollProps {
  channels: ChannelRow[];
  activeChannelId: string;
  setActiveChannelId: (id: string) => void;
  channelVols: Record<string, number>;
  channelPans: Record<string, number>;
}

const MIDI_NOTES: number[] = [];
for (let i = 108; i >= 24; i--) {
  MIDI_NOTES.push(i);
}

const isMidiNoteBlack = (note: number): boolean => {
  const pc = note % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
};

const SNAP_OPTIONS = [
  { label: "Auto Snap", value: "auto" as const },
  { label: "1/4 Beat", value: "1/4" as const },
  { label: "1/8 Beat", value: "1/8" as const },
  { label: "1/16 Beat", value: "1/16" as const },
];

export function PianoRoll({
  channels,
  activeChannelId,
  setActiveChannelId,
  channelVols,
  channelPans,
}: PianoRollProps) {
  const { 
    engine, 
    events, 
    setEvents, 
    previewChannel, 
    activeMidiNotes, 
    activePatternId, 
    setActivePatternId, 
    patterns,
    canvasClips,
    playbackState,
    playbackMode,
    pushToHistory,
    position,
    setPlayheadPosition,
  } = useAudioEngine();
  
  const [gridSnap, setGridSnap] = useState<"auto" | "1/4" | "1/8" | "1/16">("auto");
  const [zoomX, setZoomX] = useState<number>(1.0);
  const [zoomY, setZoomY] = useState<number>(1.0);

  const beatWidth = 160 * zoomX;
  const rowHeight = 24 * zoomY;

  const timelineRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Middle-Click Panning Refs
  const isMiddleClickPanning = useRef(false);
  const panStartX = useRef(0);
  const panStartY = useRef(0);
  const panScrollLeft = useRef(0);
  const panScrollTop = useRef(0);

  // Wheel horizontal zoom effect via Ctrl+Wheel (centered on cursor)
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;

    const handleCtrlWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();

        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const scrollOffset = mouseX + el.scrollLeft;

        const dir = e.deltaY > 0 ? -1 : 1;

        setZoomX(prev => {
          const newZoom = Math.max(0.5, Math.min(4.0, Number((prev + dir * 0.1).toFixed(2))));
          const scaleRatio = newZoom / prev;
          // Schedule scroll update after state flush
          requestAnimationFrame(() => {
            el.scrollLeft = scrollOffset * scaleRatio - mouseX;
          });
          return newZoom;
        });
      }
    };

    el.addEventListener("wheel", handleCtrlWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleCtrlWheel);
    };
  }, []);

  // Smoothly center Middle C (MIDI 60) vertically on open and active channel swaps
  useEffect(() => {
    const container = timelineRef.current;
    if (!container) return;

    const midi60Idx = MIDI_NOTES.indexOf(60);
    if (midi60Idx === -1) return;

    const rowOffset = midi60Idx * rowHeight;
    const containerHeight = container.clientHeight;

    container.scrollTop = rowOffset - containerHeight / 2 + rowHeight / 2;
  }, [activeChannelId, rowHeight]);

  const playheadLineRef = useRef<HTMLDivElement>(null);

  // Ruler scrub state
  const isRulerScrubbingRef = useRef(false);

  // Update playhead position dynamically when the global throttled context ticks
  useEffect(() => {
    // Resolve the beat position relative to the pattern being displayed
    let playheadBeat = 0;
    let active = false;

    if (playbackState === "playing") {
      if (playbackMode === "pattern") {
        active = true;
        playheadBeat = position.beats % PATTERN_LENGTH_BEATS;
      } else {
        const clips = canvasClips || [];
        const activeClip = clips.find(
          (clip) =>
            clip.type === "pattern" &&
            clip.referenceId === activePatternId &&
            position.beats >= clip.startBeat &&
            position.beats < clip.startBeat + clip.duration
        );
        if (activeClip) {
          active = true;
          playheadBeat = (position.beats - activeClip.startBeat) + (activeClip.cropStart || 0);
          playheadBeat = Math.min(PATTERN_LENGTH_BEATS, Math.max(0, playheadBeat));
        }
      }
    }

    const leftPx = playheadBeat * beatWidth;

    if (playheadLineRef.current) {
      playheadLineRef.current.style.left = `${leftPx}px`;
      playheadLineRef.current.style.display = active ? "block" : "none";
    }
  }, [position.beats, playbackState, playbackMode, beatWidth, activePatternId, canvasClips]);

  // ── Piano Roll ruler scrub handlers ──
  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isRulerScrubbingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const beat = Math.max(0, Math.min(PATTERN_LENGTH_BEATS, (e.clientX - rect.left) / beatWidth));
    setPlayheadPosition(beat);
  };

  const handleRulerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isRulerScrubbingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const beat = Math.max(0, Math.min(PATTERN_LENGTH_BEATS, (e.clientX - rect.left) / beatWidth));
    setPlayheadPosition(beat);
  };

  const handleRulerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isRulerScrubbingRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      isRulerScrubbingRef.current = false;
    }
  };

  const [activeTool, setActiveTool] = useState<'pencil' | 'pointer' | 'split'>('pencil');
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);

  // Active channel row lookup
  const activeChannel = useMemo(() => {
    return channels.find((c) => c.id === activeChannelId);
  }, [channels, activeChannelId]);

  // Filter events related to the active channel strictly by channel ID
  const filteredEvents = useMemo(() => {
    if (!activeChannel) return [];
    return events.filter((e) => e.channelId === activeChannel.id);
  }, [events, activeChannel]);

  // Derive the active snap resolution based on mode and zoomX
  const activeSnapResolution = useMemo(() => {
    if (gridSnap === "auto") {
      return getAutoSnapResolution(zoomX);
    }
    if (gridSnap === "1/4") return 1.0;
    if (gridSnap === "1/8") return 0.5;
    return 0.25;
  }, [gridSnap, zoomX]);

  // Duration snap configuration multiplier
  const snapIncrement = activeSnapResolution;

  // Helper to construct dynamic grid line CSS background styles
  const getGridStyle = () => {
    const gradients = [
      'linear-gradient(to right, #1c1d24 2px, transparent 2px)', // Bar lines (always drawn)
      'linear-gradient(to right, rgba(19, 20, 24, 0.6) 1px, transparent 1px)' // Beat lines (always drawn)
    ];
    const sizes = [
      `${beatWidth * 4}px 100%`,
      `${beatWidth}px 100%`
    ];

    const res = activeSnapResolution;
    if (res !== null) {
      if (res <= 0.5) {
        gradients.push('linear-gradient(to right, rgba(19, 20, 24, 0.35) 1px, transparent 1px)');
        sizes.push(`${beatWidth * 0.5}px 100%`);
      }
      if (res <= 0.25) {
        gradients.push('linear-gradient(to right, rgba(19, 20, 24, 0.2) 1px, transparent 1px)');
        sizes.push(`${beatWidth * 0.25}px 100%`);
      }
      if (res <= 0.125) {
        gradients.push('linear-gradient(to right, rgba(19, 20, 24, 0.1) 1px, transparent 1px)');
        sizes.push(`${beatWidth * 0.125}px 100%`);
      }
    }

    return {
      backgroundImage: gradients.join(', '),
      backgroundSize: sizes.join(', ')
    };
  };

  // Key-click auditioning trigger
  const handleKeyAudition = (pitch: number) => {
    if (!activeChannel) return;
    previewChannel(
      activeChannel.id,
      activeChannel.sampleId,
      channelVols[activeChannel.id] ?? 80,
      channelPans[activeChannel.id] ?? 0,
      {
        pitch: pitch - 60, // transpose relative to Middle C (60)
        sampleStart: 0,
        envelopeOn: false,
      }
    );
  };

  // Split logic
  const handleNoteSplit = (e: React.PointerEvent<HTMLDivElement>, noteEvent: DAWEvent) => {
    if (e.button !== 0) return;
    const relativeClickBeat = (e.clientX - e.currentTarget.getBoundingClientRect().left) / beatWidth;
    const snappedSplitBeat = noteEvent.time + (
      snapIncrement !== null
        ? Math.round(relativeClickBeat / snapIncrement) * snapIncrement
        : relativeClickBeat
    );
    
    if (snappedSplitBeat > noteEvent.time && snappedSplitBeat < noteEvent.time + noteEvent.duration) {
      const targetNotes = selectedNoteIds.includes(noteEvent.id)
        ? events.filter(ev => selectedNoteIds.includes(ev.id) && ev.pitch !== undefined)
        : [noteEvent];

      let nextEvents = [...events];

      targetNotes.forEach((tgtNote) => {
        const relSplitBeat = snappedSplitBeat - tgtNote.time;
        if (relSplitBeat > 0 && relSplitBeat < tgtNote.duration) {
          const durationA = relSplitBeat;
          const durationB = tgtNote.duration - relSplitBeat;

          const noteA = {
            ...tgtNote,
            duration: durationA
          };

          const noteB: DAWEvent = {
            id: `piano-note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            time: snappedSplitBeat,
            duration: durationB,
            pitch: tgtNote.pitch,
            velocity: tgtNote.velocity,
            channelId: tgtNote.channelId,
            sampleId: tgtNote.sampleId
          };

          nextEvents = nextEvents.map(n => n.id === tgtNote.id ? noteA : n);
          nextEvents.push(noteB);
        }
      });

      setEvents(nextEvents);
      pushToHistory(channels);
      console.log(`MIDI note(s) split in half at beat ${snappedSplitBeat}`);
    }
  };

  // Note block removal trigger
  const handleNoteRightClick = (e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setEvents(events.filter((ev) => ev.id !== noteId));
    pushToHistory(channels);
  };

  // Hook Integration
  const {
    lassoActive,
    lassoBox,
    draggingNoteId,
    handleGridPointerDown: hookGridPointerDown,
    handleGridPointerMove: hookGridPointerMove,
    handleGridPointerUp: hookGridPointerUp,
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
  } = usePianoRollDrag({
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
    channels,
    handleKeyAudition,
    filteredEvents,
    timelineRef,
    gridRef,
  });

  // Middle click panning overrides
  const handleGridPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      isMiddleClickPanning.current = true;
      panStartX.current = e.clientX;
      panStartY.current = e.clientY;
      panScrollLeft.current = timelineRef.current ? timelineRef.current.scrollLeft : 0;
      panScrollTop.current = timelineRef.current ? timelineRef.current.scrollTop : 0;
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (activeTool === 'pointer' || e.ctrlKey) {
      handleGridPointerDownPointerMode(e);
    } else {
      hookGridPointerDown(e);
    }
  };

  const handleGridPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMiddleClickPanning.current) {
      e.preventDefault();
      const deltaX = e.clientX - panStartX.current;
      const deltaY = e.clientY - panStartY.current;
      if (timelineRef.current) {
        timelineRef.current.scrollLeft = panScrollLeft.current - deltaX;
        timelineRef.current.scrollTop = panScrollTop.current - deltaY;
      }
      return;
    }
    if (activeTool === 'pointer' || lassoActive) {
      handleGridPointerMovePointerMode(e);
    } else {
      hookGridPointerMove(e);
    }
  };

  const handleGridPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMiddleClickPanning.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      isMiddleClickPanning.current = false;
      return;
    }
    if (activeTool === 'pointer' || lassoActive) {
      handleGridPointerUpPointerMode(e);
    } else {
      hookGridPointerUp(e);
    }
  };

  return (
    <div id="piano-roll-container" className="flex flex-col h-full bg-[#08090a] border border-neutral-900 overflow-hidden text-neutral-300 font-sans select-none">
      
      {/* DENSE TOP TOOLBAR HEADER */}
      <div className="flex flex-wrap items-center justify-between border-b border-neutral-900 bg-[#121316] px-3.5 py-1.5 shrink-0 gap-2 z-10">
        
        {/* Left Side: Controls & Selector Dropdown */}
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-amber-500/10 border border-amber-500/20 text-amber-500">
            <Keyboard className="h-3 w-3" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-[#eceff4] mr-2">
            Piano Roll
          </span>

          {/* Active Channel Dropdown */}
          <div className="flex items-center gap-1.5 bg-[#0a0a0c] border border-neutral-850 px-2 py-1 h-7 rounded-sm">
            <span className="text-[8px] font-mono tracking-wider uppercase text-zinc-500">Target:</span>
            <select
              value={activeChannelId}
              onChange={(e) => setActiveChannelId(e.target.value)}
              className="bg-transparent text-[9px] font-bold text-neutral-200 outline-none hover:text-white cursor-pointer"
            >
              {channels.map((chan) => (
                <option key={chan.id} value={chan.id} className="bg-[#0f1012] text-neutral-200 font-sans">
                  {chan.name}
                </option>
              ))}
            </select>
          </div>

          {/* Active Pattern Dropdown */}
          <div className="flex items-center gap-1.5 bg-[#0a0a0c] border border-neutral-850 px-2 py-1 h-7 rounded-sm ml-1">
            <span className="text-[8px] font-mono tracking-wider uppercase text-zinc-500">Pattern:</span>
            <select
              value={activePatternId}
              onChange={(e) => setActivePatternId(e.target.value)}
              className="bg-transparent text-[9px] font-bold text-neutral-200 outline-none hover:text-white cursor-pointer"
            >
              {patterns.map((pat) => (
                <option key={pat.id} value={pat.id} className="bg-[#0f1012] text-neutral-200 font-sans">
                  {pat.name}
                </option>
              ))}
            </select>
          </div>

          {/* H & V Zoom Buttons */}
          <div className="flex items-center bg-[#0a0a0c] border border-neutral-855 p-0.5 select-none h-7 rounded-sm ml-1 text-[8.5px]">
            <span className="text-[7.5px] text-zinc-500 font-bold uppercase tracking-wider px-1">ZOOM:</span>
            <button 
              onClick={() => setZoomX(prev => Math.max(0.5, Number((prev - 0.1).toFixed(2))))} 
              className="px-1.5 h-full font-black cursor-pointer bg-[#141519] border border-neutral-850 text-zinc-450 hover:text-white"
              title="Zoom Out Horizontally"
            >
              H-
            </button>
            <button 
              onClick={() => setZoomX(prev => Math.min(4.0, Number((prev + 0.1).toFixed(2))))} 
              className="px-1.5 h-full font-black cursor-pointer bg-[#141519] border border-neutral-855 text-zinc-450 hover:text-white"
              title="Zoom In Horizontally"
            >
              H+
            </button>
            <button 
              onClick={() => setZoomY(prev => Math.max(0.6, Number((prev - 0.1).toFixed(2))))} 
              className="px-1.5 h-full font-black cursor-pointer bg-[#141519] border border-neutral-850 text-zinc-450 hover:text-white border-l border-neutral-800"
              title="Zoom Out Vertically"
            >
              V-
            </button>
            <button 
              onClick={() => setZoomY(prev => Math.min(2.5, Number((prev + 0.1).toFixed(2))))} 
              className="px-1.5 h-full font-black cursor-pointer bg-[#141519] border border-neutral-850 text-zinc-450 hover:text-white"
              title="Zoom In Vertically"
            >
              V+
            </button>
          </div>
        </div>

        {/* Right Side: Grid Snaps & Controls */}
        <div className="flex items-center gap-2">
          {/* Tool Selector Toggle Group */}
          <div className="flex items-center bg-black/40 border border-neutral-855 p-0.5 select-none font-mono h-7">
            <button
              onClick={() => {
                setActiveTool('pencil');
                setSelectedNoteIds([]);
              }}
              className={`px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer select-none rounded-none border-none h-full ${
                activeTool === 'pencil'
                  ? 'bg-cyan-500 text-black'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Pencil/Draw Tool"
            >
              <Pencil className="h-2.5 w-2.5" />
              <span>Pencil</span>
            </button>
            <button
              onClick={() => {
                setActiveTool('pointer');
              }}
              className={`px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer select-none rounded-none border-none h-full ${
                activeTool === 'pointer'
                  ? 'bg-cyan-500 text-black'
                  : 'text-zinc-500 hover:text-zinc-350'
              }`}
              title="Pointer/Select Tool"
            >
              <MousePointer className="h-2.5 w-2.5" />
              <span>Pointer</span>
            </button>
            <button
              onClick={() => {
                setActiveTool('split');
                setSelectedNoteIds([]);
              }}
              className={`px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer select-none rounded-none border-none h-full ${
                activeTool === 'split'
                  ? 'bg-cyan-500 text-black'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Razor/Split Tool: Cut notes in half"
            >
              <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="1.5" />
                <line x1="6" y1="12" x2="18" y2="12" />
                <circle cx="8" cy="12" r="0.75" fill="currentColor" />
                <circle cx="16" cy="12" r="0.75" fill="currentColor" />
                <circle cx="12" cy="12" r="1" fill="currentColor" />
              </svg>
              <span>Split</span>
            </button>
          </div>

          {/* Subdivisions Info */}
          <div className="flex items-center gap-1.5 bg-[#0a0a0c] border border-neutral-850 px-2 py-1 h-7 rounded-sm text-[9px]">
            <Grid className="h-3 w-3 text-zinc-500" />
            <select
              value={gridSnap}
              onChange={(e) => setGridSnap(e.target.value as any)}
              className="bg-transparent text-[9px] font-bold text-neutral-200 outline-none cursor-pointer"
            >
              {SNAP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#0f1012] text-neutral-200 text-[9px]">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Helpers */}
          <button
            onClick={() => {
              if (activeChannel) {
                const updatedEvents = activeChannel.type === "sample"
                  ? events.filter((ev) => ev.sampleId !== activeChannel.sampleId)
                  : events;
                setEvents(updatedEvents);
                pushToHistory(channels);
              }
            }}
            className="h-7 px-2 border border-neutral-850 bg-[#0d0e10] hover:bg-neutral-800 text-[9px] font-bold uppercase tracking-wider text-zinc-400 hover:text-red-400 cursor-pointer flex items-center gap-1 transition-colors"
            title="Clear Active Channel's Melodic Sequence Notes"
          >
            <Trash2 className="h-3 w-3" />
            <span className="hidden sm:inline">Delete Melodies</span>
          </button>
        </div>
      </div>

      {/* SCROLLABLE CANVAS CONTAINER */}
      <div className="flex-1 overflow-auto min-h-0 relative select-none" ref={timelineRef}>
        <div className="relative flex" style={{ width: "fit-content", minWidth: "100%" }}>
          
          {/* STICKY PIANO KEYBOARD ROW PANEL */}
          <PianoKeyboard
            rowHeight={rowHeight}
            activeMidiNotes={activeMidiNotes}
            handleKeyAudition={handleKeyAudition}
          />

          {/* B. DYNAMIC TIMELINE MATRIX PORTAL */}
          <div className="flex flex-col relative" style={{ width: `${PATTERN_LENGTH_BEATS * beatWidth}px` }}>
            
            {/* Horizontal Beats Number Indicator ruler — scrub-able */}
            <div
              className="h-6 bg-[#18191c] border-b border-neutral-900 flex items-center relative select-none sticky top-0 z-20 cursor-pointer overflow-visible"
              onPointerDown={handleRulerPointerDown}
              onPointerMove={handleRulerPointerMove}
              onPointerUp={handleRulerPointerUp}
              onContextMenu={(e) => e.preventDefault()}
            >

              {Array.from({ length: PATTERN_LENGTH_BEATS }).map((_, beatIdx) => {
                const bar = Math.floor(beatIdx / 4) + 1;
                const beat = (beatIdx % 4) + 1;
                const isBarStart = beat === 1;
                return (
                  <div
                    key={beatIdx}
                    style={{ left: `${beatIdx * beatWidth}px`, width: `${beatWidth}px` }}
                    className="absolute top-0 bottom-0 border-r border-[#101113] p-1 text-[8px] font-mono select-none pointer-events-none"
                  >
                    {isBarStart ? (
                      <span className="text-cyan-400 font-black font-sans tracking-wide">BAR {bar}</span>
                    ) : (
                      <span className="text-zinc-500 font-medium">{bar}.{beat}</span>
                    )}
                  </div>
                );
              })}
            </div>

              {/* Playhead Line container with nested caret absolute to matrix portal container */}
              <div
                ref={playheadLineRef}
                className="absolute top-[24px] bottom-0 w-[1.5px] bg-red-500/80 shadow-[0_0_4px_rgba(239,68,68,0.7)] z-30 pointer-events-none overflow-visible"
                style={{ display: "none" }}
              >
                {/* ── PLAYHEAD ARROW CARET ── */}
                <div className="absolute top-0 -translate-y-full -translate-x-1/2 left-1/2">
                  <svg
                    width="10"
                    height="6"
                    viewBox="0 0 10 6"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="drop-shadow-[0_0_3px_rgba(239,68,68,0.85)]"
                  >
                    <polygon points="0,0 10,0 5,6" fill="#ef4444" />
                  </svg>
                </div>
              </div>

            {/* Scrolling matrix core area */}
            <div
              ref={gridRef}
              onPointerDown={handleGridPointerDown}
              onPointerMove={handleGridPointerMove}
              onPointerUp={handleGridPointerUp}
              onContextMenu={(e) => e.preventDefault()}
              className="relative flex-1 bg-[#101115] select-none touch-none"
            >

              {MIDI_NOTES.map((note) => {
                const isBlack = isMidiNoteBlack(note);
                return (
                  <div
                    key={note}
                    style={{ height: `${rowHeight}px`, ...getGridStyle() }}
                    className={`w-full relative shrink-0 border-b border-neutral-900/40 ${
                      activeTool === 'pencil' ? 'cursor-pencil' : 'cursor-default'
                    } ${
                      isBlack ? "bg-[#090a0d]/65" : "bg-[#101114]/95"
                    } hover:bg-neutral-800/10 pointer-events-none`}
                  />
                );
              })}

              {/* ABSOLUTE FLOATING ACTION MELODY NOTE BLOCKS */}
              {filteredEvents.map((noteEvent) => {
                const isSelected = selectedNoteIds.includes(noteEvent.id);
                const isDragging = draggingNoteId === noteEvent.id;

                return (
                  <PianoRollNote
                    key={noteEvent.id}
                    noteEvent={noteEvent}
                    beatWidth={beatWidth}
                    rowHeight={rowHeight}
                    activeTool={activeTool}
                    isSelected={isSelected}
                    isDragging={isDragging}
                    setEvents={setEvents}
                    events={events}
                    pushToHistory={pushToHistory}
                    channels={channels}
                    handleNoteRightClick={handleNoteRightClick}
                    handleNoteSplit={handleNoteSplit}
                    handleNotePointerDown={handleNotePointerDown}
                    handleNotePointerDownPointerMode={handleNotePointerDownPointerMode}
                    handleNotePointerMove={handleNotePointerMove}
                    handleNotePointerMovePointerMode={handleNotePointerMovePointerMode}
                    handleNotePointerUp={handleNotePointerUp}
                    handleNotePointerUpPointerMode={handleNotePointerUpPointerMode}
                    handleResizeDown={handleResizeDown}
                    handleResizeMove={handleResizeMove}
                    handleResizeUp={handleResizeUp}
                  />
                );
              })}

              {lassoActive && lassoBox && (
                <div
                  className="absolute border border-dashed border-cyan-400 bg-cyan-500/10 pointer-events-none z-50 transition-none"
                  style={{
                    left: `${Math.min(lassoBox.startX, lassoBox.currentX)}px`,
                    top: `${Math.min(lassoBox.startY, lassoBox.currentY)}px`,
                    width: `${Math.max(1, Math.abs(lassoBox.startX - lassoBox.currentX))}px`,
                    height: `${Math.max(1, Math.abs(lassoBox.startY - lassoBox.currentY))}px`,
                  }}
                />
              )}
            </div>

          </div>

        </div>
      </div>

    </div>
  );
}
