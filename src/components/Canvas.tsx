/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";

// UI-only ghost clip state — not persisted to types.ts
interface GhostClip {
  insertIndex: number;
  laneIndex: number;
  startBeat: number;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}
import { useAudioEngine } from "../audio/useAudioEngine";
import { CanvasClip, ChannelRow } from "../types";
import { AVAILABLE_SAMPLES, LANE_HEIGHT_PX, CLIP_HEIGHT_PX, CLIP_TOP_OFFSET_PX } from "../config";
import {
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
import {
  DARK,
  raised,
  sunken,
  flat,
  flush,
  SPACE,
  SIZE
} from "../../public/Themes/Vintage Console/tokens";

function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
    position,
    sampleCount,
    notifySampleLoaded,
    focusedChannelId,
    setFocusedChannelId,
    isRecording,
    getRecordingStatus,
    pendingRecordedClips,
    clearPendingRecordedClips,
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

  // Ghost clip recording state
  const [ghostClips, setGhostClips] = useState<GhostClip[]>([]);
  const ghostClipsRef = useRef<GhostClip[]>([]);
  const rafRef = useRef<number | null>(null);
  const recordTakeCounterRef = useRef(0);

  // Keep ghostClipsRef in sync with ghostClips state
  useEffect(() => { ghostClipsRef.current = ghostClips; }, [ghostClips]);

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
      if (setActiveInstrumentId) {
        setActiveInstrumentId(newChanId);
      }
      if (setFocusedChannelId) {
        setFocusedChannelId(newChanId);
      }

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

  // ── PART 2: Lane assignment + ghost clip creation on recording start ──
  useEffect(() => {
    if (!isRecording) return;

    const maxLane = canvasClips.length > 0
      ? Math.max(...canvasClips.map(c => c.laneIndex))
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

  // ── PART 3: rAF waveform loop ──
  useEffect(() => {
    if (!isRecording) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const drawFrame = () => {
      const status = getRecordingStatus();
      const ghosts = ghostClipsRef.current;
      const now = engine.getCurrentPosition('beats');

      ghosts.forEach((ghost) => {
        const canvas = ghost.canvasRef.current;
        if (!canvas) return;

        const durationBeats = Math.max(0.01, now - ghost.startBeat);
        const widthPx = durationBeats * beatWidth;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, widthPx * dpr);
        canvas.height = CLIP_HEIGHT_PX * dpr;
        canvas.style.width = `${widthPx}px`;
        canvas.style.height = `${CLIP_HEIGHT_PX}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, widthPx, CLIP_HEIGHT_PX);

        const peakData = status.peakData.get(ghost.insertIndex);
        if (!peakData || peakData.mins.length === 0) return;

        const { mins, maxs } = peakData;
        const N = mins.length;
        const headerHeight = 16;
        const bodyHeight = CLIP_HEIGHT_PX - headerHeight;
        const midY = headerHeight + bodyHeight / 2;
        const ampScale = 0.85;

        ctx.strokeStyle = 'rgba(192, 57, 43, 0.85)';
        ctx.lineWidth = 1.2;

        for (let i = 0; i < widthPx; i++) {
          const peakIdx = Math.floor((i / widthPx) * N);
          if (peakIdx >= N) break;
          const min = mins[peakIdx];
          const max = maxs[peakIdx];
          const yMin = midY - max * (bodyHeight / 2) * ampScale;
          const yMax = midY - min * (bodyHeight / 2) * ampScale;
          ctx.beginPath();
          ctx.moveTo(i, yMin);
          ctx.lineTo(i, Math.max(yMin + 1, yMax));
          ctx.stroke();
        }
      });

      rafRef.current = requestAnimationFrame(drawFrame);
    };

    rafRef.current = requestAnimationFrame(drawFrame);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isRecording, beatWidth, engine, getRecordingStatus]);

  // ── PART 5: Convert pending recorded clips to real CanvasClips ──
  useEffect(() => {
    if (!pendingRecordedClips || pendingRecordedClips.length === 0) return;

    const newClips: CanvasClip[] = pendingRecordedClips.map((result) => {
      const ghost = ghostClips.find(g => g.insertIndex === result.insertIndex);
      const laneIndex = ghost ? ghost.laneIndex : (() => {
        const maxLane = canvasClips.length > 0 ? Math.max(...canvasClips.map(c => c.laneIndex)) : -1;
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

    newClips.forEach(clip => addCanvasClip(clip));

    setGhostClips([]);
    clearPendingRecordedClips();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRecordedClips]);


  // Snap resolution selection (Default to "auto")
  const [snapResolution, setSnapResolution] = useState<number | "auto">("auto");

  // Derive the active snap resolution based on mode and zoomX
  const activeSnapResolution = snapResolution === "auto"
    ? getAutoSnapResolution(zoomX)
    : snapResolution;

  // Helper to construct dynamic grid line CSS background styles
  const getGridStyle = () => {
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
  const getClipMetadata = (type: "pattern" | "sample", refId: string) => {
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: DARK.bg2,
          borderBottom: `1px solid ${DARK.bevelDark}`,
          padding: `${SPACE.xs}px ${SPACE.md}px`,
          height: "30px",
          flexShrink: 0,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.sm}px` }}>
          {selectedClipType ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: `${SPACE.xs}px`,
                padding: `2px ${SPACE.sm}px`,
                backgroundColor: DARK.bg0,
                color: DARK.accentMaster,
                fontFamily: DARK.font,
                fontSize: "8px",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                boxSizing: "border-box",
                ...sunken(DARK),
              }}
            >
              <div
                style={{
                  width: "4px",
                  height: "4px",
                  borderRadius: "50%",
                  backgroundColor: DARK.accentMaster,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: DARK.textMid }}>STAMP:</span>
              <span style={{ color: DARK.accentMaster, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "150px" }}>
                {selectedClipType === "pattern" 
                  ? (patterns.find(p => p.id === selectedReferenceId)?.name || "MIDI Pattern")
                  : getSampleName(selectedReferenceId)}
              </span>
              <span
                style={{
                  fontSize: "7px",
                  fontFamily: DARK.font,
                  color: DARK.textHi,
                  backgroundColor: DARK.bg3,
                  padding: `1px ${SPACE.xs}px`,
                  marginLeft: `${SPACE.sm}px`,
                  textTransform: "uppercase",
                }}
              >
                {selectedClipType === "pattern" ? "Pattern" : "Sample"}
              </span>
            </div>
          ) : (
            <div
              style={{
                fontSize: "8px",
                fontFamily: DARK.font,
                color: DARK.textLo,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                paddingLeft: `${SPACE.sm}px`,
                fontWeight: "bold",
              }}
            >
              No Stamp
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.md}px` }}>
          {/* Tool Selector Toggle Group */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: DARK.bg0,
              padding: `${SPACE.xs}px`,
              boxSizing: "border-box",
              ...sunken(DARK),
            }}
          >
            <button
              onClick={() => {
                setActiveTool('pencil');
                setSelectedIds([]);
              }}
              style={{
                padding: `2px ${SPACE.sm}px`,
                fontSize: "8px",
                fontWeight: "bold",
                fontFamily: DARK.font,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
                border: "none",
                display: "flex",
                alignItems: "center",
                gap: `${SPACE.xs}px`,
                backgroundColor: activeTool === 'pencil' ? DARK.bg5 : DARK.bg3,
                color: activeTool === 'pencil' ? DARK.textHi : DARK.textMid,
                boxSizing: "border-box",
                ...(activeTool === 'pencil' ? sunken(DARK) : raised(DARK)),
              }}
              title="Pencil Tool: Draw arranger notes/stamps"
            >
              <Pencil style={{ height: "10px", width: "10px" }} />
              <span>Pencil</span>
            </button>
            <button
              onClick={() => {
                setActiveTool('pointer');
              }}
              style={{
                padding: `2px ${SPACE.sm}px`,
                fontSize: "8px",
                fontWeight: "bold",
                fontFamily: DARK.font,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
                border: "none",
                display: "flex",
                alignItems: "center",
                gap: `${SPACE.xs}px`,
                backgroundColor: activeTool === 'pointer' ? DARK.bg5 : DARK.bg3,
                color: activeTool === 'pointer' ? DARK.textHi : DARK.textMid,
                boxSizing: "border-box",
                ...(activeTool === 'pointer' ? sunken(DARK) : raised(DARK)),
              }}
              title="Pointer Tool: Multiple select / relocation"
            >
              <MousePointer style={{ height: "10px", width: "10px" }} />
              <span>Pointer</span>
            </button>
            <button
              onClick={() => {
                setActiveTool('split');
                setSelectedIds([]);
              }}
              style={{
                padding: `2px ${SPACE.sm}px`,
                fontSize: "8px",
                fontWeight: "bold",
                fontFamily: DARK.font,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
                border: "none",
                display: "flex",
                alignItems: "center",
                gap: `${SPACE.xs}px`,
                backgroundColor: activeTool === 'split' ? DARK.bg5 : DARK.bg3,
                color: activeTool === 'split' ? DARK.textHi : DARK.textMid,
                boxSizing: "border-box",
                ...(activeTool === 'split' ? sunken(DARK) : raised(DARK)),
              }}
              title="Razor/Split Tool: Slice arranger clips in half"
            >
              <svg style={{ height: "10px", width: "10px", flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: `${SPACE.sm}px`,
              backgroundColor: DARK.bg3,
              padding: `2px ${SPACE.sm}px`,
              boxSizing: "border-box",
              ...raised(DARK),
            }}
          >
            <span style={{ fontSize: "8px", fontWeight: "bold", fontFamily: DARK.font, color: DARK.textMid, letterSpacing: "0.08em" }}>SNAP:</span>
            <select
              value={snapResolution}
              onChange={(e) => {
                const val = e.target.value;
                setSnapResolution(val === "auto" ? "auto" : parseFloat(val));
              }}
              style={{
                backgroundColor: "transparent",
                color: DARK.accentBlue,
                fontFamily: DARK.font,
                fontSize: "8px",
                fontWeight: "bold",
                border: "none",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="auto" style={{ backgroundColor: DARK.bg3, color: DARK.textMid }}>Auto Snap</option>
              <option value="4" style={{ backgroundColor: DARK.bg3, color: DARK.textMid }}>1 Bar (4 Beats)</option>
              <option value="1" style={{ backgroundColor: DARK.bg3, color: DARK.textMid }}>1/4 (1 Beat)</option>
              <option value="0.5" style={{ backgroundColor: DARK.bg3, color: DARK.textMid }}>1/8 (0.5 Beats)</option>
              <option value="0.25" style={{ backgroundColor: DARK.bg3, color: DARK.textMid }}>1/16 (0.25 Beats)</option>
              <option value="0.125" style={{ backgroundColor: DARK.bg3, color: DARK.textMid }}>1/32 (0.125 Beats)</option>
            </select>
          </div>
        </div>
      </div>

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

              <div
                ref={playheadRef}
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  width: "1.5px",
                  backgroundColor: DARK.accentMaster,
                  zIndex: 25,
                  pointerEvents: "none",
                  overflow: "visible",
                  left: "130px",
                }}
              >
                {/* ── PLAYHEAD ARROW CARET ── */}
                <div style={{ position: "absolute", top: "30px", transform: "translateY(-100%) translateX(-50%)", left: "50%" }}>
                  <svg
                    width="10"
                    height="6"
                    viewBox="0 0 10 6"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <polygon points="0,0 10,0 5,6" fill={DARK.accentMaster} />
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
                style={{ position: "relative", userSelect: "none" }}
              >
                {listLanes.map((laneIdx) => (
                  <div
                    key={laneIdx}
                    style={{
                      display: "flex",
                      height: `${LANE_HEIGHT_PX}px`,
                      position: "relative",
                      alignItems: "center",
                      borderBottom: `1px solid ${DARK.bevelDark}`,
                      boxSizing: "border-box",
                    }}
                  >
                    {/* Visual Lane Header Label */}
                    <div
                      style={{
                        width: "130px",
                        flexShrink: 0,
                        textAlign: "left",
                        paddingLeft: `${SPACE.sm}px`,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        height: "100%",
                        zIndex: 30,
                        backgroundColor: DARK.bg2,
                        position: "sticky",
                        left: 0,
                        borderRight: `1px solid ${DARK.bevelDark}`,
                        boxSizing: "border-box",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "8px",
                          fontWeight: "bold",
                          color: DARK.textHi,
                          fontFamily: DARK.font,
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                        }}
                      >
                        Lane {laneIdx + 1}
                      </span>
                      <span
                        style={{
                          fontSize: "7px",
                          fontFamily: DARK.font,
                          color: DARK.textMid,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        Arranger Slot
                      </span>
                    </div>

                    {/* Interactive grid track area */}
                    <div
                      className={activeTool === 'pencil' ? 'cursor-pencil' : ''}
                      style={{
                        ...getGridStyle(),
                        flex: 1,
                        position: "relative",
                        height: "100%",
                        backgroundColor: DARK.bg0,
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                      }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        const dataStr = e.dataTransfer.getData("application/json");
                        if (dataStr) {
                          try {
                            const droppedObj = JSON.parse(dataStr);
                            const rect = e.currentTarget.getBoundingClientRect();
                            const offsetX = e.clientX - rect.left;
                            const rawBeat = (offsetX / rect.width) * totalBeats;
                            const snap = activeSnapResolution;
                            const snappedBeat = snap !== null
                              ? Math.round(rawBeat / snap) * snap
                              : rawBeat;

                            if (droppedObj.type === "pattern") {
                              const patternId = droppedObj.id;
                              const patternName = droppedObj.name;
                              const durationBeats = 4; // Patterns default to 4 beats

                              const newClip = {
                                id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                                laneIndex: laneIdx,
                                startBeat: Math.max(0, Math.min(totalBeats - durationBeats, snappedBeat)),
                                duration: durationBeats,
                                type: "pattern" as const,
                                referenceId: patternId,
                                name: patternName,
                                color: DARK.accentBlue,
                                cropStart: 0,
                              };

                              setCanvasClips(prev => [...prev, newClip]);
                              setSelectedIds([newClip.id]);

                              // Load properties into pencil tool for the next placement
                              setSelectedClipType("pattern");
                              setSelectedReferenceId(patternId);
                              setClipDurationBeats(4);
                              setClipCropStart(0);

                              if (pushToHistory) {
                                pushToHistory(channels);
                              }
                              return;
                            }

                            // Sample drop logic
                            const id = droppedObj.id;
                            const path = droppedObj.path;
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
                              if (setActiveInstrumentId) {
                                setActiveInstrumentId(newChanId);
                              }
                              if (setFocusedChannelId) {
                                setFocusedChannelId(newChanId);
                              }

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
                              color: DARK.accentGreen,
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
                            console.error("Error setting canvas clip from sample drop", err);
                          }
                        }
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        if (activeTool === 'pointer' || activeTool === 'split' || e.ctrlKey) return;
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
                          const clipToPlace = placingClipRef.current;
                          try {
                            e.currentTarget.releasePointerCapture(e.pointerId);
                          } catch (err) {
                            console.error("Failed to release pointer capture:", err);
                          }

                          if (clipToPlace) {
                            addCanvasClip(clipToPlace);
                            pushToHistory(channels);

                            // Select the newly placed clip exclusively
                            setSelectedIds([clipToPlace.id]);

                            // Load properties into pencil tool for the next placement
                            setSelectedClipType(clipToPlace.type);
                            setSelectedReferenceId(clipToPlace.referenceId);
                            setClipDurationBeats(clipToPlace.duration);
                            setClipCropStart(clipToPlace.cropStart || 0);
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
                  style={{
                    position: "absolute",
                    left: "130px",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    pointerEvents: "none",
                    zIndex: 10,
                    width: `${timelineWidth}px`,
                  }}
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
                    <div style={{ opacity: 0.8, pointerEvents: "none", userSelect: "none" }}>
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

                  {/* ── PART 4: Recording ghost clips (live waveform) ── */}
                  {ghostClips.map((ghost) => {
                    const now = position.beats;
                    const durationBeats = Math.max(0.01, now - ghost.startBeat);
                    const leftPx = ghost.startBeat * beatWidth;
                    const widthPx = durationBeats * beatWidth;
                    const topPx = ghost.laneIndex * LANE_HEIGHT_PX + CLIP_TOP_OFFSET_PX;

                    return (
                      <div
                        key={`ghost-${ghost.insertIndex}`}
                        style={{
                          position: 'absolute',
                          left: `${leftPx}px`,
                          top: `${topPx}px`,
                          width: `${widthPx}px`,
                          height: `${CLIP_HEIGHT_PX}px`,
                          backgroundColor: 'rgba(192, 57, 43, 0.15)',
                          border: '1px solid rgba(192, 57, 43, 0.5)',
                          boxSizing: 'border-box',
                          pointerEvents: 'none',
                          overflow: 'hidden',
                        }}
                      >
                        {/* Ghost clip header */}
                        <div style={{
                          height: '16px',
                          backgroundColor: 'rgba(192, 57, 43, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          paddingLeft: '4px',
                          gap: '4px',
                        }}>
                          <span style={{
                            fontSize: '8px',
                            color: '#c0392b',
                            fontFamily: 'Electrolize, monospace',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                          }}>
                            ● REC
                          </span>
                        </div>
                        {/* Live waveform canvas */}
                        <canvas
                          ref={ghost.canvasRef}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            pointerEvents: 'none',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Sticky Add Lane row */}
                <div style={{ display: "flex", height: `${LANE_HEIGHT_PX}px`, position: "relative", alignItems: "center" }}>
                  <div
                    style={{
                      width: "130px",
                      flexShrink: 0,
                      textAlign: "left",
                      paddingLeft: `${SPACE.sm}px`,
                      display: "flex",
                      alignItems: "center",
                      height: "100%",
                      zIndex: 30,
                      backgroundColor: DARK.bg2,
                      position: "sticky",
                      left: 0,
                      borderRight: `1px solid ${DARK.bevelDark}`,
                      boxSizing: "border-box",
                    }}
                  >
                    <button
                      onClick={() => setLaneCount((prev) => prev + 1)}
                      style={{
                        width: "100%",
                        marginRight: `${SPACE.sm}px`,
                        padding: `${SPACE.xs}px ${SPACE.sm}px`,
                        backgroundColor: DARK.bg3,
                        color: DARK.textMid,
                        fontFamily: DARK.font,
                        fontSize: "8px",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        cursor: "pointer",
                        border: `1px dashed ${DARK.bevelMid}`,
                        boxSizing: "border-box",
                      }}
                      title="Add Lane"
                    >
                      + Add Lane
                    </button>
                  </div>
                  <div style={{ flex: 1, height: "100%", backgroundColor: "transparent", pointerEvents: "none" }} />
                </div>

                <div
                  ref={lassoDivRef}
                  style={{
                    position: "absolute",
                    border: `1px dashed ${DARK.accentBlue}`,
                    backgroundColor: "rgba(79, 195, 247, 0.1)",
                    pointerEvents: "none",
                    zIndex: 50,
                    display: "none",
                  }}
                />

              </div>

            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
