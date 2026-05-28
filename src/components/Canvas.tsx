/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { useAudioEngine } from "../audio/useAudioEngine";
import { CanvasClip, ChannelRow } from "../types";
import { AVAILABLE_SAMPLES, LANE_HEIGHT_PX, CLIP_HEIGHT_PX, CLIP_TOP_OFFSET_PX } from "../config";
import {
  Layers,
  Trash2,
  Pencil,
  MousePointer,
} from "lucide-react";

import { useClipDrag } from "../hooks/useClipDrag";
import { useClipResize } from "../hooks/useClipResize";
import { ArrangerSourcePicker } from "./ArrangerSourcePicker";
import { ArrangerRuler } from "./ArrangerRuler";
import { ArrangerClip } from "./ArrangerClip";
import { getLibraryManager } from "./SampleBrowser";

import { getAutoSnapResolution } from "../utils/snapUtils";

export interface CanvasProps {
  channels?: ChannelRow[];
  setChannels?: React.Dispatch<React.SetStateAction<ChannelRow[]>>;
  setChannelVols?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setChannelMixers?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  onOpenWindow?: (windowId: "pianoroll" | "sequencer" | "sampler" | "obsidian" | "canvas") => void;
  onOpenPianoRoll?: (channelId: string) => void;
  onOpenSampler?: (channelId: string) => void;
  onOpenObsidian?: (channelId: string) => void;
  onOpenChannelRack?: () => void;
}

export function Canvas({
  channels = [],
  setChannels,
  setChannelVols,
  setChannelMixers,
  onOpenWindow,
  onOpenPianoRoll,
  onOpenSampler,
  onOpenObsidian,
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
    position,
    sampleCount,
    notifySampleLoaded,
  } = useAudioEngine();

  // Safe wrapper to resolve channel reference ID (e.g. sampler_...) to its actual sampleId
  const getSampleBufferWrapper = React.useCallback((id: string) => {
    const chan = channels.find(c => c.id === id || c.sampleId === id);
    const actualId = chan ? (chan.sampleId || id) : id;
    return getSampleBuffer(actualId);
  }, [channels, getSampleBuffer]);

  const [placingClip, setPlacingClip] = useState<CanvasClip | null>(null);
  const placingClipRef = useRef<CanvasClip | null>(null);
  const placingPointerId = useRef<number | null>(null);

  const updatePlacingClip = (clip: CanvasClip | null) => {
    placingClipRef.current = clip;
    setPlacingClip(clip);
  };

  // Viewport scroll & width tracking
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState<number>(0);
  const [viewportWidth, setViewportWidth] = useState<number>(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft(e.currentTarget.scrollLeft);
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

  const [zoomX, setZoomX] = useState<number>(1.0);
  const beatWidth = 48 * zoomX; // width in pixels of each beat

  const maxClipBeat = React.useMemo(() => {
    if (canvasClips.length === 0) return 0;
    return Math.max(...canvasClips.map((c) => c.startBeat + c.duration));
  }, [canvasClips]);

  // Dynamic grid length calculation
  const totalBeats = React.useMemo(() => {
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

  const minZoomX = React.useMemo(() => {
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
  const setZoomXClamped = React.useCallback((value: React.SetStateAction<number>) => {
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

      const el = scrollContainerRef.current;
      if (!el) return;

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

  const handleAudioFileImport = async (file: File) => {
    if (!engine || !setChannels) return;
    if (!file.type.startsWith("audio/") && !file.name.endsWith(".wav") && !file.name.endsWith(".mp3")) {
      console.warn("Invalid audio file format");
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const cleanFileName = file.name.replace(/\.[^/.]+$/, "");
      const sanitizedId = `sample_${cleanFileName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;

      // 1. Load buffer into AudioEngine registry
      await engine.loadSample(sanitizedId, arrayBuffer);
      if (sampleCount !== undefined) {
        // Notify the reactive system (sampleCount is from context, notifySampleLoaded increments it)
      }

      // 2. Append new channel row state
      const nextIndex = channels.length + 1;
      const newChanId = `sampler_${Date.now()}`;
      const newChannel = {
        id: newChanId,
        name: cleanFileName.slice(0, 20),
        type: "sample" as const,
        sampleId: sanitizedId,
        mixerTarget: Math.min(99, nextIndex),
        instrumentType: "sampler" as const
      };

      setChannels(prev => [...prev, newChannel]);

      // 3. Initialize volumes and mixers in React state
      if (setChannelVols) setChannelVols(prev => ({ ...prev, [newChanId]: 80 }));
      if (setChannelMixers) setChannelMixers(prev => ({ ...prev, [newChanId]: Math.min(99, nextIndex) }));

      // 4. Mirror in engine
      engine.focusedChannelId = newChanId;
      engine.updateChannelVolume(newChanId, 80);
      engine.updateChannelPan(newChanId, 0);
      engine.updateChannelMixerTarget(newChanId, Math.min(99, nextIndex));
      engine.updateChannelSampleId(newChanId, sanitizedId);
      if (engine.updateChannelInstrumentType) {
        engine.updateChannelInstrumentType(newChanId, "sampler");
      }

      // 5. Open Sampler view immediately
      if (onOpenSampler) {
        onOpenSampler(newChanId);
      }

      console.log(`Audio sample "${file.name}" imported and loaded successfully.`);
    } catch (err) {
      console.error("Failed to decode and load audio sample", err);
    }
  };

  const [laneCount, setLaneCount] = useState<number>(50);
  const listLanes = Array.from({ length: laneCount }, (_, i) => i);


  // Snap resolution selection (Default to "auto")
  const [snapResolution, setSnapResolution] = useState<number | "auto">("auto");

  // Derive the active snap resolution based on mode and zoomX
  const activeSnapResolution = snapResolution === "auto"
    ? getAutoSnapResolution(zoomX)
    : snapResolution;

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

    // Add alternating bar shading layer on the very bottom (every 4 bars / 16 beats)
    // The first group of 4 bars is slightly lighter, the second group is transparent/darker, alternating
    gradients.push('linear-gradient(to right, rgba(255, 255, 255, 0.02) 50%, transparent 50%)');
    sizes.push(`${beatWidth * 32}px 100%`);

    return {
      backgroundImage: gradients.join(', '),
      backgroundSize: sizes.join(', ')
    };
  };

  const [selectedClipType, setSelectedClipType] = useState<"pattern" | "sample" | null>(null);
  const [selectedReferenceId, setSelectedReferenceId] = useState<string>("");
  const [clipDurationBeats, setClipDurationBeats] = useState<number>(1);
  const [clipCropStart, setClipCropStart] = useState<number>(0);

  const [activeTool, setActiveTool] = useState<'pencil' | 'pointer' | 'split'>('pencil');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const tracksContainerRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  // Update playhead position dynamically when the global throttled context ticks
  useEffect(() => {
    if (playheadRef.current) {
      playheadRef.current.style.left = `calc(130px + ${position.beats * beatWidth}px)`;
    }
  }, [position.beats, beatWidth]);

  // Get currently loaded samples from the audio engine
  const getSampleName = (id: string) => {
    const preset = AVAILABLE_SAMPLES.find(s => s.id === id);
    if (preset) return preset.name;

    // Extract filename from full path
    const parts = id.split(/[/\\]/);
    const fileName = parts[parts.length - 1] || id;

    return fileName
      .replace(/\.(wav|mp3|ogg|flac|aac|m4a)$/i, "")
      .split(/[-_]/)
      .map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : "")
      .join(" ");
  };

  // Select first available item by default on load
  useEffect(() => {
    if (selectedClipType && selectedReferenceId) {
      if (selectedClipType === "pattern") {
        const patternExists = patterns.some(p => p.id === selectedReferenceId);
        if (patternExists) return;
      } else if (selectedClipType === "sample") {
        const loadedSamples = engine?.getLoadedSampleIds() || [];
        const sampleExists = loadedSamples.includes(selectedReferenceId);
        if (sampleExists) return;
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
  }, [patterns, engine, selectedClipType, selectedReferenceId]);



  // Resolve metadata (human labels, theme colors) for selected brush element
  const getClipMetadata = (type: "pattern" | "sample", refId: string) => {
    if (type === "sample") {
      const match = AVAILABLE_SAMPLES.find(s => s.id === refId);
      if (match) {
        return {
          name: match.name,
          color: match.color
        };
      }
      return {
        name: getSampleName(refId),
        color: "from-neutral-600/25 to-neutral-500/10 border-neutral-700 text-neutral-300"
      };
    } else {
      const match = patterns.find(p => p.id === refId);
      let colorClass = "from-cyan-555/15 to-cyan-500/5 text-cyan-400 border-cyan-500/30";

      return {
        name: match?.name || "MIDI Pattern",
        color: colorClass
      };
    }
  };

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
  const handleClipSplit = (e: React.PointerEvent<HTMLDivElement>, clip: CanvasClip) => {
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
      pushToHistory(channels);
      console.log(`Arranger Clip "${clip.name}" split at beat ${snappedSplitBeat}`);
    }
  };

  // Double click arranger clip to reveal the editor
  const handleClipDoubleClick = (clip: CanvasClip) => {
    if (clip.type === "sample") {
      const chan = channels.find(c => c.sampleId === clip.referenceId || c.id === clip.referenceId);
      if (chan) {
        onOpenWindow?.("sampler");
        onOpenSampler?.(chan.id);
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
        if (chan.instrumentType === "obsidian") {
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
      }
    } else {
      onOpenWindow?.("sequencer");
    }
  };

  // Compile active selection label or metadata representation for feedback
  const getActiveSelectionDetails = () => {
    if (!selectedClipType) return "None selected";
    if (selectedClipType === "sample") {
      return `${getSampleName(selectedReferenceId)} (1 beat)`;
    } else {
      const target = patterns.find(p => p.id === selectedReferenceId);
      return target ? `${target.name} (4 beats)` : `${selectedReferenceId} (4 beats)`;
    }
  };

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

  const handleClipPointerDownWrapper = (e: React.PointerEvent<HTMLDivElement>, clip: CanvasClip) => {
    setSelectedClipType(clip.type);
    setSelectedReferenceId(clip.referenceId);
    setClipDurationBeats(clip.duration);
    setClipCropStart(clip.cropStart || 0);
    handleClipPointerDown(e, clip);
  };

  const resizingClipIdRef = useRef<string | null>(null);

  const {
    handleResizeDown,
    handleResizeMove,
    handleResizeUp,
  } = useClipResize({
    canvasClips,
    setCanvasClips,
    beatWidth,
    snapResolution: activeSnapResolution,
    pushToHistory,
    channels,
    selectedIds,
  });

  const handleResizeDownWrapper = (
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
  };

  const handleResizeUpWrapper = (e: React.PointerEvent<HTMLDivElement>) => {
    handleResizeUp(e);
    if (resizingClipIdRef.current) {
      const updatedClip = canvasClips.find((c) => c.id === resizingClipIdRef.current);
      if (updatedClip) {
        setClipDurationBeats(updatedClip.duration);
        setClipCropStart(updatedClip.cropStart || 0);
      }
      resizingClipIdRef.current = null;
    }
  };

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

  return (
    <div id="daw-canvas-window" className="h-full flex flex-col bg-[#121315] border border-neutral-800 rounded-none p-3 shadow-md gap-3 font-sans overflow-hidden">

      {/* HEADER STRIP */}
      <div className="flex items-center justify-between border-b border-[#1b1c20] pb-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-400" />
          <h3 className="text-xs font-black tracking-wide text-neutral-100 uppercase mr-1">
            Arrangement Canvas
          </h3>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Tool Selector Toggle Group */}
          <div className="flex items-center bg-black/40 border border-[#1b1c20] p-0.5 select-none font-mono">
            <button
              onClick={() => {
                setActiveTool('pencil');
                setSelectedIds([]);
              }}
              className={`px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer select-none rounded-none border-none ${activeTool === 'pencil'
                  ? 'bg-cyan-500 text-black'
                  : 'text-zinc-500 hover:text-zinc-300'
                }`}
              title="Pencil Tool: Draw arranger notes/stamps"
            >
              <Pencil className="h-2.5 w-2.5" />
              <span>Pencil</span>
            </button>
            <button
              onClick={() => {
                setActiveTool('pointer');
              }}
              className={`px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer select-none rounded-none border-none ${activeTool === 'pointer'
                  ? 'bg-cyan-500 text-black'
                  : 'text-zinc-500 hover:text-zinc-350'
                }`}
              title="Pointer Tool: Multiple select / relocation"
            >
              <MousePointer className="h-2.5 w-2.5" />
              <span>Pointer</span>
            </button>
            <button
              onClick={() => {
                setActiveTool('split');
                setSelectedIds([]);
              }}
              className={`px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer select-none rounded-none border-none ${activeTool === 'split'
                  ? 'bg-cyan-500 text-black'
                  : 'text-zinc-500 hover:text-zinc-300'
                }`}
              title="Razor/Split Tool: Slice arranger clips in half"
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

          {/* Snap Resolution Selection Dropdown */}
          <div className="flex items-center gap-1.5 border border-neutral-800 bg-black/40 px-2 py-1 select-none">
            <span className="text-[7.5px] font-mono text-zinc-500 uppercase tracking-widest font-black leading-none mt-0.5">SNAP:</span>
            <select
              value={snapResolution}
              onChange={(e) => {
                const val = e.target.value;
                setSnapResolution(val === "auto" ? "auto" : parseFloat(val));
              }}
              className="bg-transparent text-[8.5px] font-mono text-cyan-400 focus:outline-none border-none py-px cursor-pointer select-none leading-none pr-1"
            >
              <option value="auto" className="bg-[#121315] text-zinc-300">Auto Snap</option>
              <option value="4" className="bg-[#121315] text-zinc-300">1 Bar (4 Beats)</option>
              <option value="1" className="bg-[#121315] text-zinc-300">1/4 (1 Beat)</option>
              <option value="0.5" className="bg-[#121315] text-zinc-300">1/8 (0.5 Beats)</option>
              <option value="0.25" className="bg-[#121315] text-zinc-300">1/16 (0.25 Beats)</option>
              <option value="0.125" className="bg-[#121315] text-zinc-300">1/32 (0.125 Beats)</option>
            </select>
          </div>

          <button
            onClick={clearArrangement}
            className="px-2.5 py-1 bg-[#121316] hover:bg-red-950/20 text-red-400 hover:text-red-300 border border-neutral-850 hover:border-red-900/60 text-[9px] font-black uppercase transition-colors rounded-none cursor-pointer flex items-center justify-center gap-1 select-none"
            title="Clear all clips from timeline"
          >
            <Trash2 className="h-3 w-3" />
            <span>Wipe Arrangement</span>
          </button>
        </div>
      </div>

      {/* TWO COLUMN BENTO LAYOUT */}
      <div className="flex gap-3.5 flex-1 min-h-0">


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
        <div className="flex-1 flex flex-col min-w-0 h-full relative">

          <div ref={scrollContainerRef} onScroll={handleScroll} className="relative select-none border border-neutral-850 bg-[#0a0b0d] p-2 flex-1 overflow-auto scrollbar-thin">
            <div className="relative space-y-1" style={{ width: `${130 + timelineWidth}px` }}>

              <div
                ref={playheadRef}
                className="absolute top-[30px] bottom-0 w-[1.5px] bg-indigo-500 z-30 pointer-events-none shadow-[0_0_12px_rgba(99,102,241,0.6)] overflow-visible"
                style={{
                  left: "130px",
                }}
              >
                {/* ── PLAYHEAD ARROW CARET ── */}
                <div className="absolute top-0 -translate-y-full -translate-x-1/2 left-1/2">
                  <svg
                    width="10"
                    height="6"
                    viewBox="0 0 10 6"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="drop-shadow-[0_0_3px_rgba(99,102,241,0.85)]"
                  >
                    <polygon points="0,0 10,0 5,6" fill="#6366f1" />
                  </svg>
                </div>
              </div>

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
              <div
                ref={tracksContainerRef}
                onPointerDown={handleGridPointerDown}
                onPointerMove={handleGridPointerMove}
                onPointerUp={handleGridPointerUp}
                onContextMenu={(e) => e.preventDefault()}
                className="space-y-1 pt-0.5 relative select-none"
              >
                {listLanes.map((laneIdx) => (
                  <div
                    key={laneIdx}
                    className="flex h-11 relative group items-center hover:bg-[#121316]/40 border-b border-[#14151a]"
                  >
                    {/* Visual Lane Header Label */}
                    <div className="w-[130px] shrink-0 text-left pl-2 flex flex-col justify-center border-r border-[#17181c] h-full z-10 bg-[#0a0b0d] sticky left-0 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest group-hover:text-neutral-200">
                        Lane {laneIdx + 1}
                      </span>
                      <span className="text-[7px] font-mono text-zinc-600 uppercase">
                        Arranger Slot
                      </span>
                    </div>

                    {/* Interactive grid track area */}
                    <div
                      className={`flex-1 relative h-full bg-[#0d0e10]/80 ${activeTool === 'pencil' ? 'cursor-pencil' : 'cursor-default'}`}
                      style={getGridStyle()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                      }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        const dataStr = e.dataTransfer.getData("application/json");
                        if (dataStr) {
                          try {
                            const { id, path, name } = JSON.parse(dataStr);
                            const rect = e.currentTarget.getBoundingClientRect();
                            const offsetX = e.clientX - rect.left;
                            const rawBeat = (offsetX / rect.width) * totalBeats;
                            const snap = activeSnapResolution;
                            const snappedBeat = snap !== null
                              ? Math.round(rawBeat / snap) * snap
                              : rawBeat;

                            let durationBeats = 4;
                            let buffer = getSampleBuffer(id);
                            
                            // Ensure the buffer is fully loaded and decoded in the engine
                            if (!buffer && engine) {
                              try {
                                if (path) {
                                  // Built-in sample: fetch and load
                                  const res = await fetch(path);
                                  if (res.ok) {
                                    const ab = await res.arrayBuffer();
                                    buffer = await engine.loadSample(id, ab);
                                    if (notifySampleLoaded) {
                                      notifySampleLoaded();
                                    }
                                  }
                                } else {
                                  // User sample: load from library
                                  const libraryManager = getLibraryManager();
                                  const node = libraryManager.findNodeByPath(id);
                                  if (node) {
                                    const arrayBuffer = await libraryManager.loadBuffer(node);
                                    buffer = await engine.loadSample(id, arrayBuffer);
                                    if (notifySampleLoaded) {
                                      notifySampleLoaded();
                                    }
                                  }
                                }
                              } catch (loadErr) {
                                console.error("Failed to load sample buffer on timeline drop:", loadErr);
                              }
                            }

                            if (buffer) {
                              durationBeats = engine.secondsToBeats(buffer.duration);
                            }

                            // Find or create a matching channel rack entry for the dropped sample
                            let targetChannelId = id;
                            const existingChannel = channels.find(c => c.sampleId === id || c.id === id);

                            if (existingChannel) {
                              targetChannelId = existingChannel.id;
                            } else if (setChannels) {
                              const nextIndex = channels.length + 1;
                              const newChanId = `sampler_${Date.now()}`;
                              const newChannel = {
                                id: newChanId,
                                name: getSampleName(id).slice(0, 20),
                                type: "sample" as const,
                                sampleId: id,
                                mixerTarget: Math.min(99, nextIndex),
                                instrumentType: "sampler" as const
                              };

                              setChannels(prev => [...prev, newChannel]);

                              if (setChannelVols) setChannelVols(prev => ({ ...prev, [newChanId]: 80 }));
                              if (setChannelMixers) setChannelMixers(prev => ({ ...prev, [newChanId]: Math.min(99, nextIndex) }));

                              engine.updateChannelVolume(newChanId, 80);
                              engine.updateChannelPan(newChanId, 0);
                              engine.updateChannelMixerTarget(newChanId, Math.min(99, nextIndex));
                              engine.updateChannelSampleId(newChanId, id);
                              if (engine.updateChannelInstrumentType) {
                                engine.updateChannelInstrumentType(newChanId, "sampler");
                              }

                              targetChannelId = newChanId;
                            }

                            const newClip = {
                              id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                              laneIndex: laneIdx,
                              startBeat: Math.max(0, Math.min(totalBeats - durationBeats, snappedBeat)),
                              duration: durationBeats,
                              type: "sample" as const,
                              referenceId: targetChannelId,
                              name: getSampleName(id),
                              color: "from-emerald-600/20 to-emerald-500/10 text-emerald-400 border-emerald-500/30",
                              cropStart: 0,
                            };

                            setCanvasClips(prev => {
                              const updated = [...prev, newClip];
                              return updated;
                            });

                            // Select the newly dropped clip exclusively
                            setSelectedIds([newClip.id]);

                            // Load properties into pencil tool for the next placement
                            setSelectedClipType(newClip.type);
                            setSelectedReferenceId(newClip.referenceId);
                            setClipDurationBeats(newClip.duration);
                            setClipCropStart(newClip.cropStart || 0);

                            if (pushToHistory) {
                              const updatedChannels = existingChannel
                                ? channels
                                : [...channels, {
                                    id: targetChannelId,
                                    name: getSampleName(id).slice(0, 20),
                                    type: "sample" as const,
                                    sampleId: id,
                                    mixerTarget: Math.min(99, channels.length + 1),
                                    instrumentType: "sampler" as const
                                  }];
                              pushToHistory(updatedChannels);
                            }
                          } catch (err) {
                            console.error("Error setting canvas clip from sample browser drop", err);
                          }
                        }
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        if (activeTool === 'pointer' || e.ctrlKey) return;
                        if (!selectedClipType) return;

                        e.stopPropagation();

                        const rect = e.currentTarget.getBoundingClientRect();
                        const offsetX = e.clientX - rect.left;
                        const width = rect.width;
                        const rawBeat = (offsetX / width) * totalBeats;
                        const snap = activeSnapResolution;
                        const snappedBeat = snap !== null
                          ? Math.round(rawBeat / snap) * snap
                          : rawBeat;

                        // PENCIL PLACEMENT: Bypasses audio buffer duration lookup and waveform-length snap.
                        // Applies the remembered length and crop start properties as-is from memory.
                        const finalDuration = clipDurationBeats;

                        if (snappedBeat >= 0 && snappedBeat + finalDuration <= totalBeats) {
                          const meta = getClipMetadata(selectedClipType, selectedReferenceId);
                          const tempClip: CanvasClip = {
                            id: `placing-clip-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
                            type: selectedClipType,
                            startBeat: snappedBeat,
                            duration: finalDuration,
                            laneIndex: laneIdx,
                            referenceId: selectedReferenceId,
                            name: meta.name,
                            color: meta.color,
                            cropStart: clipCropStart
                          };
                          updatePlacingClip(tempClip);
                          placingPointerId.current = e.pointerId;
                          e.currentTarget.setPointerCapture(e.pointerId);
                        }
                      }}
                      onPointerMove={(e) => {
                        if (placingPointerId.current === e.pointerId && placingClipRef.current) {
                          e.stopPropagation();
                          const container = tracksContainerRef.current;
                          if (!container) return;

                          const rect = container.getBoundingClientRect();
                          const trackX = e.clientX - rect.left - 130;
                          const rawBeat = trackX / beatWidth;
                          const snap = activeSnapResolution;
                          const snappedBeat = snap !== null
                            ? Math.round(rawBeat / snap) * snap
                            : rawBeat;

                          const trackY = e.clientY - rect.top;
                          const calculatedLane = Math.floor(trackY / LANE_HEIGHT_PX);

                          const finalLane = Math.max(0, Math.min(laneCount - 1, calculatedLane));
                          const finalBeat = Math.max(0, Math.min(totalBeats - placingClipRef.current.duration, snappedBeat));

                          if (placingClipRef.current.laneIndex !== finalLane || placingClipRef.current.startBeat !== finalBeat) {
                            const updated = {
                              ...placingClipRef.current,
                              startBeat: finalBeat,
                              laneIndex: finalLane
                            };
                            updatePlacingClip(updated);
                          }
                        }
                      }}
                      onPointerUp={(e) => {
                        if (placingPointerId.current === e.pointerId) {
                          e.stopPropagation();
                          try {
                            e.currentTarget.releasePointerCapture(e.pointerId);
                          } catch (err) {
                            console.error("Failed to release pointer capture:", err);
                          }

                          if (placingClipRef.current) {
                            addCanvasClip(placingClipRef.current);
                            pushToHistory(channels);

                            // Select the newly placed clip exclusively
                            setSelectedIds([placingClipRef.current.id]);

                            // Load properties into pencil tool for the next placement
                            setSelectedClipType(placingClipRef.current.type);
                            setSelectedReferenceId(placingClipRef.current.referenceId);
                            setClipDurationBeats(placingClipRef.current.duration);
                            setClipCropStart(placingClipRef.current.cropStart || 0);
                          }

                          updatePlacingClip(null);
                          placingPointerId.current = null;
                        }
                      }}
                      onLostPointerCapture={(e) => {
                        if (placingPointerId.current === e.pointerId) {
                          updatePlacingClip(null);
                          placingPointerId.current = null;
                        }
                      }}
                    />
                  </div>
                ))}

                {/* Flat absolute overlay for clips */}
                <div
                  className="absolute left-[130px] right-0 top-0 bottom-0 pointer-events-none z-10"
                  style={{ width: `${timelineWidth}px` }}
                >
                  {canvasClips.map((clip) => {
                    const isSelected = selectedIds.includes(clip.id);

                    return (
                      <ArrangerClip
                        key={clip.id}
                        clip={clip}
                        beatWidth={beatWidth}
                        isSelected={isSelected}
                        activeTool={activeTool}
                        patterns={patterns}
                        getSampleBuffer={getSampleBufferWrapper}
                        removeCanvasClip={removeCanvasClip}
                        handleClipSplit={handleClipSplit}
                        handleClipPointerDown={handleClipPointerDownWrapper}
                        handleClipPointerMove={handleClipPointerMove}
                        handleClipPointerUp={handleClipPointerUp}
                        handleClipDoubleClick={handleClipDoubleClick}
                        handleResizeDown={handleResizeDownWrapper}
                        handleResizeMove={handleResizeMove}
                        handleResizeUp={handleResizeUpWrapper}
                      />
                    );
                  })}

                  {/* Render the ghost clip in a slightly transparent state */}
                  {placingClip && (
                    <div className="opacity-80 pointer-events-none select-none transition-all duration-75">
                      <ArrangerClip
                        clip={placingClip}
                        beatWidth={beatWidth}
                        isSelected={false}
                        activeTool="pencil"
                        patterns={patterns}
                        getSampleBuffer={getSampleBufferWrapper}
                        removeCanvasClip={() => {}}
                        handleClipSplit={() => {}}
                        handleClipPointerDown={() => {}}
                        handleClipPointerMove={() => {}}
                        handleClipPointerUp={() => {}}
                        handleClipDoubleClick={() => {}}
                        handleResizeDown={() => {}}
                        handleResizeMove={() => {}}
                        handleResizeUp={() => {}}
                      />
                    </div>
                  )}
                </div>

                {/* Sticky Add Lane row */}
                <div className="flex h-11 relative items-center">
                  <div className="w-[130px] shrink-0 text-left pl-2 flex items-center border-r border-[#17181c] h-full z-10 bg-[#0a0b0d] sticky left-0">
                    <button
                      onClick={() => setLaneCount((prev) => prev + 1)}
                      className="w-full mr-2 py-1.5 px-1 border border-dashed border-neutral-800 bg-black/40 hover:bg-[#181d26] text-[9.5px] font-black uppercase tracking-wider text-zinc-400 hover:text-cyan-400 transition-all cursor-pointer select-none rounded-none text-center"
                    >
                      + Add Lane
                    </button>
                  </div>
                  <div className="flex-1 h-full bg-transparent pointer-events-none" />
                </div>

                <div
                  ref={lassoDivRef}
                  className="absolute border border-dashed border-cyan-400 bg-cyan-500/10 pointer-events-none z-50 transition-none"
                  style={{ display: "none" }}
                />

              </div>

            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
