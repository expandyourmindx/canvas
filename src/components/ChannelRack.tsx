/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { useAudioEngine } from "../audio/useAudioEngine";
import { DAWEvent } from "../audio/AudioEngine";
import { ChannelRow } from "../types";
import { getLibraryManager } from "./SampleBrowser";
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  Volume2,
  Plus,
  GripVertical,
  Copy
} from "lucide-react";
import {
  DARK,
  raised,
  sunken,
  flat,
  flush,
  SPACE,
  SIZE
} from "../../public/Themes/Vintage Console/tokens";

export interface InstrumentDefinition {
  id: string;
  name: string;
  type: "sampler" | "wam";
  url?: string;
  description?: string;
}

export const LOCAL_INSTRUMENTS: InstrumentDefinition[] = [
  { id: "sampler", name: "Sampler", type: "sampler", description: "Built-in sample player" },
  { id: "obsidian", name: "Obsidian", type: "wam", url: "https://expandyourmindx.github.io/obsidian-wam/index.js", description: "Virtual analog synthesizer" },
  { 
    id: "distortion", 
    name: "Simple Distortion", 
    type: "wam" as const, 
    url: "https://expandyourmindx.github.io/canvas-plugins/burns-audio/distortion/index.js", 
    description: "Waveshaper distortion" 
  }
];

const DEFAULT_CHANNELS: ChannelRow[] = [
  { id: "sampler_default", name: "Sampler", type: "sample", sampleId: "sampler_default_sample", mixerTarget: 0, instrumentType: "sampler" }
];

interface KnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  label: string;
  title?: string;
  color?: "cyan" | "amber";
  defaultValue?: number;
}

export function Knob({ value, min, max, onChange, label, title, color = "cyan", defaultValue }: KnobProps) {
  const knobRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.altKey && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      const def = defaultValue !== undefined ? defaultValue : (min <= 0 && max >= 0 ? 0 : (min === 0 && max === 100 ? 80 : min));
      onChange(def);
      return;
    }
    e.preventDefault();
    isDragging.current = true;
    startY.current = e.clientY;
    startValue.current = value;
    knobRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const deltaY = startY.current - e.clientY; // drag up increases
    const range = max - min;
    const dragDistance = 120; // pixels for full sweep
    const valueDelta = (deltaY / dragDistance) * range;
    const newValue = Math.max(min, Math.min(max, Math.round(startValue.current + valueDelta)));
    onChange(newValue);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging.current) {
      isDragging.current = false;
      knobRef.current?.releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? -1 : 1;
    const step = (max - min) <= 100 ? 5 : 2;
    const newValue = Math.max(min, Math.min(max, value + dir * step));
    onChange(newValue);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const def = defaultValue !== undefined ? defaultValue : (min <= 0 && max >= 0 ? 0 : (min === 0 && max === 100 ? 80 : min));
    onChange(def);
  };

  // Convert value to degrees for rotation (sweep from -135deg to +135deg)
  const percent = (value - min) / (max - min);
  const angleDeg = -135 + percent * 270;
  const angleRad = (angleDeg * Math.PI) / 180;
  const cx = 11;
  const cy = 11;
  const R = 6.5;
  const dotX = cx + R * Math.sin(angleRad);
  const dotY = cy - R * Math.cos(angleRad);

  const dotColor = color === "cyan" ? DARK.accentBlue : DARK.accentMaster;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "24px", flexShrink: 0, userSelect: "none" }}>
      <span 
        style={{ 
          fontSize: "6px", 
          color: DARK.textLo, 
          fontWeight: "bold", 
          textTransform: "uppercase", 
          marginBottom: "2px", 
          fontFamily: DARK.font, 
          letterSpacing: "0.08em" 
        }}
      >
        {label}
      </span>
      <div
        ref={knobRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          backgroundColor: DARK.knobBody,
          position: "relative",
          cursor: "ns-resize",
          userSelect: "none",
          boxSizing: "border-box",
          ...raised(DARK),
        }}
        title={`${title}: ${value} (Double-click to reset)`}
      >
        {/* Highlight Ellipse */}
        <div 
          style={{
            position: "absolute",
            top: "2px",
            left: "2px",
            width: "8px",
            height: "4px",
            borderRadius: "50%",
            backgroundColor: DARK.knobHighlight,
            transform: "rotate(-30deg)",
            pointerEvents: "none",
          }}
        />
        {/* Indicator Dot */}
        <svg 
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          <circle cx={dotX} cy={dotY} r={1.5} fill={dotColor} />
        </svg>
      </div>
    </div>
  );
}

export interface ChannelRackProps {
  channels?: ChannelRow[];
  setChannels?: React.Dispatch<React.SetStateAction<ChannelRow[]>>;
  channelMixers?: Record<string, number>;
  setChannelMixers?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  channelPans?: Record<string, number>;
  setChannelPans?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  channelVols?: Record<string, number>;
  setChannelVols?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  mutedChannels?: Record<string, boolean>;
  setMutedChannels?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  soloedChannels?: Record<string, boolean>;
  setSoloedChannels?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  activeInstrumentId?: string;
  setActiveInstrumentId?: (id: string) => void;
  onOpenSampler?: (channelId: string) => void;
  onOpenPianoRoll?: (channelId: string) => void;
  onOpenWAM?: (channelId: string) => void;
}


export function ChannelRack({
  channels = DEFAULT_CHANNELS,
  setChannels = () => { },
  channelMixers = {},
  setChannelMixers = () => { },
  channelPans = {},
  setChannelPans = () => { },
  channelVols = {},
  setChannelVols = () => { },
  mutedChannels = {},
  setMutedChannels = () => { },
  soloedChannels = {},
  setSoloedChannels = () => { },
  activeInstrumentId = "sampler_default",
  setActiveInstrumentId = () => { },
  onOpenSampler,
  onOpenPianoRoll,
  onOpenWAM,
}: ChannelRackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    engine,
    playbackState,
    events,
    setEvents,
    addEvent,
    clearEvents,
    activePatternId,
    setActivePatternId,
    patterns,
    createPattern,
    renamePattern,
    deletePattern,
    focusedChannelId,
    setFocusedChannelId,
    pushToHistory,
    notifySampleLoaded,
  } = useAudioEngine();

  const activePlayheadIndexRef = useRef<number>(-1);
  const [, forceStepUpdate] = useState(0);

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const pos = engine.getCurrentPosition("beats");
      const newIndex = playbackState === "playing"
        ? Math.floor((pos % 4) / 0.25)
        : -1;
      if (newIndex !== activePlayheadIndexRef.current) {
        activePlayheadIndexRef.current = newIndex;
        forceStepUpdate(n => n + 1);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playbackState, engine]);

  // Pattern renaming state helpers
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // 5. Custom context menu state for Instrument buttons
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    channelId: string;
  } | null>(null);

  // State to track if the instrument selection dropdown is open
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [remoteInstruments, setRemoteInstruments] = useState<InstrumentDefinition[]>([]);

  // 6. Drag and drop file loading states
  const [draggingOverChannelId, setDraggingOverChannelId] = useState<string | null>(null);
  const [draggedChannelId, setDraggedChannelId] = useState<string | null>(null);

  const handleFileDrop = async (file: File, channel: ChannelRow) => {
    if (!file.type.startsWith("audio/") && !file.name.endsWith(".wav") && !file.name.endsWith(".mp3")) {
      console.warn("Dropped file is invalid audio sample format.");
      return;
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const sampleId = `${channel.id}_sample_${Date.now()}`;

      await engine.loadSample(sampleId, arrayBuffer);

      setChannels((prevChannels: ChannelRow[]) =>
        prevChannels.map((c) =>
          c.id === channel.id
            ? { ...c, name: file.name.replace(/\.[^/.]+$/, ""), sampleId: sampleId, type: "sample" as const }
            : c
        )
      );

      console.log(`Dropped sample file decoded successfully: ${file.name}`);
    } catch (err) {
      console.error("Drop sample decode exception error:", err);
    }
  };

  // Audio preview helpers
  const playSamplePreview = (sampleId: string, channelId: string) => {
    try {
      const buffer = engine.getSampleBuffer(sampleId);
      const volVal = channelVols[channelId] !== undefined ? channelVols[channelId] : 80;
      const panVal = channelPans[channelId] !== undefined ? channelPans[channelId] : 0;

      if (!buffer) {
        // Fallback tone for custom sampler channels to ensure audio feedback is still interactive!
        engine.triggerTonePreview(channelId, 125, 0.15, "sine");
        return;
      }

      // Delegate to optimized engine preview routing (honoring pan and volume faders)
      engine.previewChannel(
        channelId,
        sampleId,
        volVal,
        panVal
      );
    } catch (e) {
      console.warn("Direct sample preview failed:", e);
    }
  };

  const playPitchPreview = (pitch: number, channelId: string) => {
    try {
      const channel = channels.find(c => c.id === channelId);
      if (channel && channel.instrumentType === "wam") {
        engine.previewChannel(
          channelId,
          undefined,
          channelVols[channelId] ?? 80,
          channelPans[channelId] ?? 0,
          { pitch: pitch - 60 }
        );
        return;
      }

      const freq = 440 * Math.pow(2, (pitch - 69) / 12);
      engine.triggerTonePreview(channelId, freq, 0.3, "sawtooth");
    } catch (e) {
      console.warn("Direct pitch preview failed:", e);
    }
  };

  const fetchRemoteInstruments = async () => {
    if (remoteInstruments.length > 0) return;
    try {
      const BASE = "https://www.webaudiomodules.com/community/";
      const res = await fetch(`${BASE}plugins.json`);
      if (res.ok) {
        const data: any[] = await res.json();
        setRemoteInstruments(
          data
            .filter(p => p.category?.includes("Instrument"))
            .map(p => ({
              id: p.identifier,
              name: p.name,
              type: "wam" as const,
              url: `${BASE}${p.path}`,
              description: p.description,
            }))
        );
      }
    } catch {
      // fail silently
    }
  };

  // Add a dynamic channel builder for the selected instrument type
  const addChannelWithInstrument = async (instrument: InstrumentDefinition) => {
    const nextIndex = channels.length + 1;
    const newChanId = `${instrument.type}_${Date.now()}`;
    const newChannel: ChannelRow = {
      id: newChanId,
      name: instrument.type === "sampler" ? `Sampler ${nextIndex}` : instrument.name,
      type: instrument.type === "sampler" ? "sample" : "pitch",
      sampleId: instrument.type === "sampler" ? `sample_${newChanId}` : undefined,
      pitch: instrument.type === "wam" ? 60 : undefined,
      mixerTarget: 0,
      instrumentType: instrument.type,
      wamUrl: instrument.type === "wam" ? instrument.url : undefined
    };

    setChannels([...channels, newChannel]);
    setActiveInstrumentId(newChanId);

    // Initializer maps matching this new unique key
    setChannelVols(prev => ({ ...prev, [newChanId]: 80 }));
    setChannelMixers(prev => ({ ...prev, [newChanId]: 0 }));

    // Update the audio engine registry on new channel creation
    if (engine) {
      engine.updateChannelVolume(newChanId, 80);
      engine.updateChannelPan(newChanId, 0);
      engine.updateChannelMixerTarget(newChanId, 0);
      if (engine.updateChannelInstrumentType) {
        engine.updateChannelInstrumentType(newChanId, instrument.type);
      }
    }

    // Toggle window visibility for the newly created instrument plugin
    if (instrument.type === "wam" && instrument.url) {
      if (engine) {
        try {
          await engine.loadWAM(newChanId, instrument.url);
          // Only open the window if load succeeded
          if (onOpenWAM) {
            onOpenWAM(newChanId);
          }
        } catch (err) {
          console.error("Failed to load WAM instrument on channel creation", err);
          // Don't open an empty window
        }
      }
    } else if (instrument.type === "sampler") {
      if (onOpenSampler) {
        onOpenSampler(newChanId);
      }
    }
  };

  // 16 Grid Columns representing 4 beats total
  const gridBeatsCount = 16;
  const stepColumns = Array.from({ length: gridBeatsCount }, (_, i) => i * 0.25);

  const hasNoteInGrid = (pitch: number, beat: number): boolean => {
    return events.some(
      (e) => Math.abs(e.time - beat) < 0.05 && e.pitch === pitch
    );
  };

  const hasSampleInGrid = (sampleId: string, beat: number): boolean => {
    return events.some(
      (e) => Math.abs(e.time - beat) < 0.05 && e.sampleId === sampleId
    );
  };

  const handleStepToggle = (channel: ChannelRow, stepIndex: number) => {
    const targetBeat = stepIndex * 0.25;



    if (channel.type === "sample") {
      const sampleId = channel.sampleId!;
      const existingIdx = events.findIndex(
        (e) => Math.abs(e.time - targetBeat) < 0.05 && e.sampleId === sampleId
      );

      if (existingIdx > -1) {
        const nextEvents = events.filter((_, idx) => idx !== existingIdx);
        setEvents([...nextEvents]);
      } else {
        const velMultiplier = (channelVols[channel.id] ?? 80) / 100;
        const newEvent: DAWEvent = {
          id: `custom-sample-${sampleId}-${Date.now()}-${stepIndex}`,
          time: targetBeat,
          duration: 0.4,
          sampleId: sampleId,
          velocity: velMultiplier,
          channelId: channel.id
        };
        addEvent(newEvent);
        // Play preview audibly for feedback
        playSamplePreview(sampleId, channel.id);
      }
    } else {
      const pitch = channel.pitch!;
      const existingIdx = events.findIndex(
        (e) => Math.abs(e.time - targetBeat) < 0.05 && e.pitch === pitch
      );

      if (existingIdx > -1) {
        const nextEvents = events.filter((_, idx) => idx !== existingIdx);
        setEvents([...nextEvents]);
      } else {
        const velMultiplier = (channelVols[channel.id] ?? 80) / 100;
        const newEvent: DAWEvent = {
          id: `custom-note-${pitch}-${Date.now()}-${stepIndex}`,
          time: targetBeat,
          duration: 0.25,
          pitch: pitch,
          velocity: velMultiplier * 0.8,
          channelId: channel.id
        };
        addEvent(newEvent);
        playPitchPreview(pitch, channel.id);
      }
    }
  };

  const handleRightClick = (e: React.MouseEvent, channelId: string) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setContextMenu({
      visible: true,
      x,
      y,
      channelId,
    });
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
      setAddDropdownOpen(false);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
    };
  }, []);

  const clearChannelNotes = (channel: ChannelRow) => {
    if (channel.type === "sample") {
      setEvents(events.filter(e => e.sampleId !== channel.sampleId));
    } else {
      setEvents(events.filter(e => e.channelId !== channel.id));
    }
  };

  const deleteChannelRow = (channelId: string) => {
    const target = channels.find(c => c.id === channelId);
    if (!target) return;
    clearChannelNotes(target);
    setChannels(prev => prev.filter(c => c.id !== channelId));
  };

  // Dynamic stepper actions for active pattern
  const prevPattern = () => {
    const currentIndex = patterns.findIndex(p => p.id === activePatternId);
    if (currentIndex > 0) {
      setActivePatternId(patterns[currentIndex - 1].id);
    }
  };

  const nextPattern = () => {
    const currentIndex = patterns.findIndex(p => p.id === activePatternId);
    if (currentIndex < patterns.length - 1) {
      setActivePatternId(patterns[currentIndex + 1].id);
    }
  };

  const handleAddNewPattern = () => {
    const nextNum = patterns.length + 1;
    const patId = `pattern_${nextNum}`;
    const patName = `Pattern ${nextNum}`;
    createPattern(patId, patName);
    setActivePatternId(patId);
  };

  const handleCloneActivePattern = () => {
    const currentPat = patterns.find(p => p.id === activePatternId);
    if (!currentPat) return;

    const nextNum = patterns.length + 1;
    const newPatId = `pattern_${Date.now()}`;
    const newPatName = `${currentPat.name} (Copy)`;

    // 1. Create the new empty pattern in the engine and React state
    createPattern(newPatId, newPatName);

    // 2. Fetch the active pattern events and copy them
    if (engine) {
      const currentEvents = engine.getPatterns()[activePatternId] || [];
      const clonedEvents = currentEvents.map(e => ({
        ...e,
        id: `event-clone-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        channelId: e.channelId // preserve channel mapping
      }));

      // 3. Switch active focus to newly cloned pattern and set its events reactively
      setActivePatternId(newPatId);
      setEvents(clonedEvents);
      pushToHistory(channels);
    }
  };

  const startRename = () => {
    const currentPat = patterns.find(p => p.id === activePatternId);
    if (currentPat) {
      setRenameValue(currentPat.name);
      setIsRenaming(true);
    }
  };

  const handleRenameSubmit = () => {
    if (renameValue.trim()) {
      renamePattern(activePatternId, renameValue.trim());
    }
    setIsRenaming(false);
  };

  return (
    <div 
      ref={containerRef} 
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
        ...flat(DARK),
      }}
    >

      {/* 2. PATTERN SELECTOR HEADER */}
      <header 
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: DARK.bg2,
          borderBottom: `1px solid ${DARK.bevelDark}`,
          padding: `0 ${SPACE.md}px`,
          height: "30px",
          flexShrink: 0,
          userSelect: "none",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.sm}px` }}>
          <span 
            style={{
              color: DARK.textHi,
              fontWeight: "bold",
              fontSize: "9px",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              fontFamily: DARK.font,
            }}
          >
            Channel Rack
          </span>

          {/* Selector select input */}
          <select
            value={activePatternId}
            onChange={(e) => setActivePatternId(e.target.value)}
            onWheel={(e) => {
              e.preventDefault();
              const currentIndex = patterns.findIndex(p => p.id === activePatternId);
              if (e.deltaY < 0) {
                // Scroll up — go to previous pattern
                const prevIndex = Math.max(0, currentIndex - 1);
                setActivePatternId(patterns[prevIndex].id);
              } else {
                // Scroll down — go to next pattern
                const nextIndex = Math.min(patterns.length - 1, currentIndex + 1);
                setActivePatternId(patterns[nextIndex].id);
              }
            }}
            style={{
              backgroundColor: DARK.bg3,
              color: DARK.textMid,
              fontFamily: DARK.font,
              fontSize: "9px",
              height: "20px",
              padding: `0 ${SPACE.sm}px`,
              outline: "none",
              cursor: "pointer",
              border: "none",
              boxSizing: "border-box",
              ...raised(DARK),
              maxWidth: "100px",
            }}
          >
            {patterns.map(p => (
              <option key={p.id} value={p.id} style={{ backgroundColor: DARK.bg3, color: DARK.textMid }}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Plus Add Pattern Button */}
          <button
            onClick={handleAddNewPattern}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "20px",
              height: "20px",
              backgroundColor: DARK.bg3,
              color: DARK.accentGreen,
              cursor: "pointer",
              border: "none",
              boxSizing: "border-box",
              ...raised(DARK),
            }}
            title="Add Pattern"
          >
            <Plus size={12} />
          </button>

          {/* Clone Pattern Button */}
          <button
            onClick={handleCloneActivePattern}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "20px",
              height: "20px",
              backgroundColor: DARK.bg3,
              color: DARK.accentBlue,
              cursor: "pointer",
              border: "none",
              boxSizing: "border-box",
              ...raised(DARK),
            }}
            title="Clone/Duplicate Active Pattern"
          >
            <Copy size={11} />
          </button>

          {/* Delete Pattern Button */}
          <button
            onClick={() => deletePattern(activePatternId)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "20px",
              height: "20px",
              backgroundColor: DARK.bg3,
              color: DARK.stateRed,
              cursor: "pointer",
              border: "none",
              boxSizing: "border-box",
              ...raised(DARK),
            }}
            title="Delete Pattern"
          >
            <Trash2 size={12} />
          </button>
        </div>

        {/* Global Toolbar actions */}
        <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.sm}px` }}>
          <button
            onClick={() => {
              clearEvents();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: `${SPACE.xs}px`,
              padding: `0 ${SPACE.md}px`,
              height: "20px",
              backgroundColor: DARK.bg3,
              color: DARK.stateRed,
              fontFamily: DARK.font,
              fontSize: "8px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              cursor: "pointer",
              border: "none",
              boxSizing: "border-box",
              ...raised(DARK),
            }}
            title="Clear Patterns"
          >
            <Trash2 size={10} />
            <span>Clear</span>
          </button>
        </div>
      </header>

      {/* THE MAIN CHANNELS CONTAINER GRID */}
      <main 
        style={{
          flex: 1,
          overflowY: "auto",
          padding: `${SPACE.md}px`,
          backgroundColor: DARK.bg1,
          display: "flex",
          flexDirection: "column",
          gap: `${SPACE.xs}px`,
          boxSizing: "border-box",
        }}
      >

        {/* Playhead LED Bulbs Track Row */}
        <div 
          style={{
            display: "flex",
            alignItems: "center",
            height: "12px",
            userSelect: "none",
            pointerEvents: "none",
            boxSizing: "border-box",
          }}
        >
          {/* Transparent spacer corresponding to Grab Handle (14px) + Command Strip (240px) */}
          <div style={{ width: "254px", flexShrink: 0 }} />

          {/* Bulbs Grid */}
          <div 
            style={{
              flex: 1,
              paddingLeft: "6px",
              paddingRight: "6px",
              boxSizing: "border-box",
              display: "grid",
              gridTemplateColumns: "repeat(16, minmax(0, 1fr))",
              gap: `${SPACE.xs}px`,
              alignItems: "center",
            }}
          >
            {stepColumns.map((_, i) => {
              const isCurrent = playbackState === "playing" && activePlayheadIndexRef.current === i;
              return (
                <div 
                  key={i} 
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "4px",
                  }}
                >
                  <div
                    style={{
                      width: "4px",
                      height: "4px",
                      borderRadius: "50%",
                      backgroundColor: isCurrent ? DARK.accentBlue : DARK.bg0,
                      border: isCurrent ? `1px solid ${DARK.bevelLight}` : `1px solid ${DARK.bevelDark}`,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Render Channels Rows */}
        {channels.map((channel) => {
          const isSelected = activeInstrumentId === channel.id;
          const isMuted = !!mutedChannels[channel.id];
          const isSomeSoloed = Object.values(soloedChannels).some(Boolean);
          const isSoloed = !!soloedChannels[channel.id];
          const isFocused = focusedChannelId === channel.id;

          // An channel is effectively active if it is not muted, AND if some channel is soloed, this channel is one of them.
          const isEffectivelyMuted = isMuted || (isSomeSoloed && !isSoloed);

          const channelEvents = events.filter(e => e.channelId === channel.id);
          const hasPianoRollEvents = channel.instrumentType === "wam" || channelEvents.some(e => {
            if (e.pitch !== undefined && e.pitch !== channel.pitch) return true;
            if (e.time % 0.25 !== 0) return true;
            if (channel.type === "sample" && e.duration !== 0.4) return true;
            if (channel.type === "pitch" && e.duration !== 0.25) return true;
            return false;
          });

          return (
            <div
              key={channel.id}
              data-channel-row=""
              onClick={() => setFocusedChannelId(channel.id)}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const draggedId = draggedChannelId || e.dataTransfer.getData("text/plain");
                if (draggedId && draggedId !== channel.id) {
                  const draggedIndex = channels.findIndex(c => c.id === draggedId);
                  const dropIndex = channels.findIndex(c => c.id === channel.id);
                  if (draggedIndex !== -1 && dropIndex !== -1) {
                    const updated = [...channels];
                    const [removed] = updated.splice(draggedIndex, 1);
                    updated.splice(dropIndex, 0, removed);
                    setChannels(updated);
                  }
                }
                setDraggedChannelId(null);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                height: "32px",
                userSelect: "none",
                cursor: "pointer",
                padding: "2px",
                opacity: isEffectivelyMuted ? 0.45 : 1,
                boxSizing: "border-box",
                backgroundColor: isFocused ? DARK.bg4 : DARK.bg3,
                ...(isFocused ? raised(DARK) : flat(DARK)),
              }}
            >

              {/* Grab Handle */}
              <div
                draggable
                onDragStart={(e) => {
                  setDraggedChannelId(channel.id);
                  e.dataTransfer.setData("text/plain", channel.id);
                  e.dataTransfer.effectAllowed = "move";

                  // Use the entire channel row as the drag ghost instead of just the handle
                  const row = e.currentTarget.closest("[data-channel-row]") as HTMLElement;
                  if (row) {
                    e.dataTransfer.setDragImage(row, 20, row.offsetHeight / 2);
                  }
                }}
                onDragEnd={() => {
                  setDraggedChannelId(null);
                }}
                style={{
                  width: "14px",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "grab",
                  color: DARK.textLo,
                  flexShrink: 0,
                  boxSizing: "border-box",
                }}
                title="Drag to rearrange channel"
              >
                <GripVertical size={12} />
              </div>

              {/* LEFT SIDE COMMAND STRIP WORKPLACE WITH DRAG AND DROP CAPABILITY */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDraggingOverChannelId(channel.id);
                }}
                onDragLeave={() => {
                  setDraggingOverChannelId(null);
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  setDraggingOverChannelId(null);
                  
                  const sampleDataStr = e.dataTransfer.getData("application/json");
                  if (sampleDataStr) {
                    try {
                      const { id, path, name } = JSON.parse(sampleDataStr);
                      
                      // Ensure the buffer is fully loaded and decoded in the engine before mapping
                      if (engine) {
                        const cached = engine.getSampleBuffer(id);
                        if (!cached) {
                          try {
                            if (path) {
                              // Built-in sample: fetch and load
                              const res = await fetch(path);
                              if (res.ok) {
                                const ab = await res.arrayBuffer();
                                await engine.loadSample(id, ab);
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
                                await engine.loadSample(id, arrayBuffer);
                                if (notifySampleLoaded) {
                                  notifySampleLoaded();
                                }
                              }
                            }
                          } catch (loadErr) {
                            console.error("Failed to load sample buffer on drop:", loadErr);
                          }
                        }
                      }

                      setChannels((prevChannels: ChannelRow[]) =>
                        prevChannels.map((c) =>
                          c.id === channel.id
                            ? { ...c, name: name, sampleId: id, type: "sample" as const }
                            : c
                        )
                      );
                      if (engine) {
                        engine.updateChannelSampleId(channel.id, id);
                      }
                      if (pushToHistory) {
                        pushToHistory(channels);
                      }
                      console.log(`Mapped browser sample to channel rack slot: ${name}`);
                    } catch (err) {
                      console.error("Failed to map sample browser drop to channel", err);
                    }
                  } else {
                    const file = e.dataTransfer.files[0];
                    if (file) {
                      await handleFileDrop(file, channel);
                    }
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: `${SPACE.sm}px`,
                  width: "240px",
                  flexShrink: 0,
                  padding: "2px",
                  boxSizing: "border-box",
                  backgroundColor: draggingOverChannelId === channel.id ? DARK.bg0 : "transparent",
                  ...(draggingOverChannelId === channel.id ? sunken(DARK) : {}),
                }}
              >

                {/* 0. MIDI Focus Target Indicator LED */}
                <button
                  id={`midi-focus-indicator-${channel.id}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFocusedChannelId(channel.id);
                  }}
                  style={{
                    width: "16px",
                    height: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: DARK.bg0,
                    cursor: "pointer",
                    border: "none",
                    boxSizing: "border-box",
                    ...sunken(DARK),
                  }}
                  title={isFocused ? "MIDI Data actively routed here" : "Click to route PC MIDI to this channel"}
                >
                  <div
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: isFocused ? DARK.accentMaster : DARK.bg2,
                      border: isFocused ? `1px solid ${DARK.bevelLight}` : `1px solid ${DARK.bevelDark}`,
                      boxSizing: "border-box",
                    }}
                  />
                </button>

                {/* A. MIXER TARGET ROUTER */}
                <div
                  onWheel={(e) => {
                    e.preventDefault();
                    const dir = e.deltaY > 0 ? -1 : 1;
                    setChannelMixers(prev => ({
                      ...prev,
                      [channel.id]: Math.max(0, Math.min(99, (prev[channel.id] ?? channel.mixerTarget) + dir))
                    }));
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setChannelMixers(prev => ({
                      ...prev,
                      [channel.id]: Math.max(0, Math.min(99, (prev[channel.id] ?? channel.mixerTarget) + 1))
                    }));
                  }}
                  style={{
                    width: "20px",
                    height: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: DARK.lcdBg,
                    color: DARK.lcdText,
                    fontFamily: DARK.font,
                    fontSize: "9px",
                    fontWeight: "bold",
                    cursor: "ns-resize",
                    boxSizing: "border-box",
                    ...sunken(DARK),
                  }}
                  title="Mixer channel router (Click to increase, hover and scroll to change)"
                >
                  {channelMixers[channel.id] ?? channel.mixerTarget}
                </div>

                {/* B. MUTE / SOLO TOGGLE LEDS */}
                <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.xs}px` }}>
                  {/* Mute Button (M) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMutedChannels(prev => ({ ...prev, [channel.id]: !prev[channel.id] }));
                    }}
                    style={{
                      width: "18px",
                      height: "20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: DARK.font,
                      fontSize: "8px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      userSelect: "none",
                      boxSizing: "border-box",
                      ...(isMuted
                        ? { ...sunken(DARK), backgroundColor: DARK.stateRed, color: "#ffffff" }
                        : { ...raised(DARK), backgroundColor: DARK.bg3, color: DARK.textMid }
                      ),
                    }}
                    title="Mute Channel (M)"
                  >
                    M
                  </button>

                  {/* Solo Button (S) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSoloedChannels(prev => ({ ...prev, [channel.id]: !prev[channel.id] }));
                    }}
                    style={{
                      width: "18px",
                      height: "20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: DARK.font,
                      fontSize: "8px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      userSelect: "none",
                      boxSizing: "border-box",
                      ...(isSoloed
                        ? { ...sunken(DARK), backgroundColor: DARK.stateGreen, color: "#ffffff" }
                        : { ...raised(DARK), backgroundColor: DARK.bg3, color: DARK.textMid }
                      ),
                    }}
                    title="Solo Channel (S)"
                  >
                    S
                  </button>
                </div>

                {/* C. PAN / VOL LEVELERS */}
                <div 
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: `${SPACE.sm}px`, 
                    width: "56px", 
                    flexShrink: 0,
                    boxSizing: "border-box",
                  }}
                >
                  <Knob
                    label="PAN"
                    value={channelPans[channel.id] ?? 0}
                    min={-50}
                    max={50}
                    color="cyan"
                    onChange={(val) => {
                      setChannelPans(prev => ({ ...prev, [channel.id]: val }));
                      engine.updateChannelPan(channel.id, val);
                    }}
                    title="Pan"
                    defaultValue={0}
                  />
                  <Knob
                    label="VOL"
                    value={channelVols[channel.id] ?? 80}
                    min={0}
                    max={100}
                    color="amber"
                    onChange={(val) => {
                      setChannelVols(prev => ({ ...prev, [channel.id]: val }));
                      engine.updateChannelVolume(channel.id, val);
                    }}
                    title="Volume"
                    defaultValue={80}
                  />
                </div>

                {/* D. INSTRUMENT BUTTON WITH RIGHT-CLICK POPUPS */}
                <button
                  type="button"
                  onContextMenu={(e) => handleRightClick(e, channel.id)}
                  onClick={() => {
                    setActiveInstrumentId(channel.id);
                    if (channel.instrumentType === "wam") {
                      if (onOpenWAM) onOpenWAM(channel.id);
                    } else {
                      if (onOpenSampler) onOpenSampler(channel.id);
                    }
                  }}
                style={{
                    width: `${SIZE.channelNameWidth}px`,
                    flexShrink: 0,
                    textAlign: "left",
                    paddingLeft: `${SPACE.sm}px`,
                    paddingRight: `${SPACE.sm}px`,
                    height: "22px",
                    userSelect: "none",
                    fontFamily: DARK.font,
                    fontSize: "9px",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    cursor: "pointer",
                    border: "none",
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    minWidth: 0,
                    ...(isSelected
                      ? { ...sunken(DARK), backgroundColor: DARK.bg5, color: DARK.textHi }
                      : { ...raised(DARK), backgroundColor: DARK.bg3, color: DARK.textMid }
                    ),
                  }}
                  title={`${channel.name} Settings (Right-click for options)`}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {channel.name}
                  </span>
                </button>

              </div>



              {/* RIGHT SIDE 16-STEP GRID OR MINI PIANO ROLL PREVIEW */}
              <div style={{ flex: 1, paddingLeft: "6px", paddingRight: "6px", height: "100%", display: "flex", alignItems: "center", minWidth: 0, boxSizing: "border-box" }}>
                {hasPianoRollEvents ? (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenPianoRoll) {
                        onOpenPianoRoll(channel.id);
                      }
                    }}
                    style={{
                      flex: 1,
                      height: "20px",
                      backgroundColor: DARK.bg0,
                      position: "relative",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingLeft: `${SPACE.sm}px`,
                      paddingRight: `${SPACE.sm}px`,
                      cursor: "pointer",
                      boxSizing: "border-box",
                      ...sunken(DARK),
                    }}
                    title="Piano Roll active (Click to open Piano Roll)"
                  >
                    {/* Grid lines */}
                    <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "space-between", pointerEvents: "none", opacity: 0.05 }}>
                      <div style={{ width: "1px", height: "100%", backgroundColor: DARK.bevelLight, marginLeft: "25%" }} />
                      <div style={{ width: "1px", height: "100%", backgroundColor: DARK.bevelLight, marginLeft: "50%" }} />
                      <div style={{ width: "1px", height: "100%", backgroundColor: DARK.bevelLight, marginLeft: "75%" }} />
                    </div>

                    {/* SVG/Micro MIDI notes */}
                    <div style={{ position: "absolute", inset: 0, paddingTop: "2px", paddingBottom: "2px", paddingLeft: "10px", paddingRight: "10px", pointerEvents: "none" }}>
                      {(() => {
                        const pitches = channelEvents.map(e => e.pitch).filter((p): p is number => p !== undefined);
                        const minPitch = pitches.length > 0 ? Math.min(...pitches) - 1 : 55;
                        const maxPitch = pitches.length > 0 ? Math.max(...pitches) + 1 : 65;
                        const pitchRange = Math.max(8, maxPitch - minPitch);

                        return channelEvents.map((e, idx) => {
                          if (e.pitch === undefined) return null;
                          const leftPercent = Math.min(100, (e.time / 4) * 100);
                          const widthPercent = Math.min(100 - leftPercent, ((e.duration ?? 0.25) / 4) * 100);
                          const topPercent = 100 - ((e.pitch - minPitch) / pitchRange) * 100;

                          return (
                            <div
                              key={e.id || idx}
                              style={{
                                position: "absolute",
                                height: "2px",
                                backgroundColor: DARK.accentBlue,
                                border: `1px solid ${DARK.bevelLight}`,
                                boxSizing: "border-box",
                                left: `${leftPercent}%`,
                                width: `${Math.max(2.5, widthPercent)}%`,
                                top: `${Math.min(85, Math.max(15, topPercent))}%`,
                              }}
                            />
                          );
                        });
                      })()}
                    </div>

                    <span 
                      style={{
                        fontSize: "8px",
                        color: DARK.textMid,
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        letterSpacing: "0.15em",
                        fontFamily: DARK.font,
                        zIndex: 10,
                        pointerEvents: "none",
                      }}
                    >
                      Piano Roll Active
                    </span>
                  </div>
                ) : (
                  <div 
                    style={{
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: "repeat(16, minmax(0, 1fr))",
                      gap: `${SPACE.xs}px`,
                      height: "100%",
                      alignItems: "center",
                      paddingLeft: "6px",
                      paddingRight: "6px",
                      boxSizing: "border-box",
                    }}
                  >
                    {stepColumns.map((beatValue, index) => {
                      const isActive = isStepActive(channel, index);
                      const isPassing = playbackState === "playing" && activePlayheadIndexRef.current === index;
                      const isBeatGroupA = Math.floor(index / 4) % 2 === 0;

                      // Base background color and border constructor based on state
                      let bg = DARK.bg3;
                      let borderStyle = raised(DARK);

                      if (isActive) {
                        borderStyle = sunken(DARK);
                        if (channel.type === "sample") {
                          bg = isPassing ? "#a8f5b4" : DARK.stateGreen;
                        } else {
                          bg = isPassing ? "#a0e8ff" : DARK.accentBlue;
                        }
                      } else {
                        if (isPassing) {
                          bg = DARK.bg5;
                        } else {
                          bg = isBeatGroupA ? DARK.bg3 : DARK.bg2;
                        }
                      }

                      return (
                        <button
                          key={index}
                          onClick={() => handleStepToggle(channel, index)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            if (isActive) {
                              handleStepToggle(channel, index);
                            }
                          }}
                          style={{
                            height: "18px",
                            width: "100%",
                            cursor: "pointer",
                            boxSizing: "border-box",
                            padding: 0,
                            backgroundColor: bg,
                            ...borderStyle,
                          }}
                          title={`${channel.name} at Step ${index + 1}`}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          );
        })}

        {/* Dynamic ADD CHANNEL button row with Overlay Dropdown */}
        <div style={{ paddingTop: `${SPACE.lg}px`, paddingLeft: `${SPACE.sm}px`, userSelect: "none", display: "flex", position: "relative" }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAddDropdownOpen(!addDropdownOpen);
            }}
            style={{
              padding: `${SPACE.sm}px ${SPACE.lg}px`,
              backgroundColor: DARK.bg3,
              color: DARK.accentBlue,
              fontFamily: DARK.font,
              fontSize: "9px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              cursor: "pointer",
              border: "none",
              boxSizing: "border-box",
              ...raised(DARK),
            }}
            id="add-channel-btn"
          >
            + Add Channel
          </button>

          {addDropdownOpen && (
            <div
              style={{
                position: "absolute",
                bottom: "100%",
                left: "4px",
                marginBottom: "4px",
                backgroundColor: DARK.bg2,
                ...flat(DARK),
                padding: "2px",
                width: "120px",
                zIndex: 50,
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                display: "flex",
                flexDirection: "column",
                boxSizing: "border-box",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div 
                style={{
                  padding: `${SPACE.xs}px ${SPACE.sm}px`,
                  fontSize: "8px",
                  color: DARK.textLo,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  borderBottom: `1px solid ${DARK.bevelDark}`,
                  marginBottom: "2px",
                  fontFamily: DARK.font,
                  fontWeight: "bold",
                }}
              >
                Select Instrument
              </div>
              {LOCAL_INSTRUMENTS.map((instrument) => {
                const color = instrument.type === "sampler" ? DARK.textMid : DARK.accentOrange;
                return (
                  <button
                    key={instrument.id}
                    type="button"
                    onClick={() => {
                      addChannelWithInstrument(instrument);
                      setAddDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: `${SPACE.sm}px ${SPACE.md}px`,
                      backgroundColor: "transparent",
                      color: color,
                      border: "none",
                      cursor: "pointer",
                      fontFamily: DARK.font,
                      fontSize: "9px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      boxSizing: "border-box",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = DARK.bg3;
                      e.currentTarget.style.color = DARK.textHi;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = color;
                    }}
                  >
                    {instrument.name}
                  </button>
                );
              })}
              <div style={{ height: "1px", backgroundColor: DARK.bevelDark, margin: "2px 0" }} />
              <div
                onMouseEnter={(e) => {
                  setMoreOpen(true);
                  fetchRemoteInstruments();
                  e.currentTarget.style.backgroundColor = DARK.bg3;
                  e.currentTarget.style.color = DARK.textHi;
                }}
                onMouseLeave={(e) => {
                  setMoreOpen(false);
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = DARK.textLo;
                }}
                style={{
                  position: "relative",
                  width: "100%",
                  textAlign: "left",
                  padding: `${SPACE.sm}px ${SPACE.md}px`,
                  backgroundColor: "transparent",
                  color: DARK.textLo,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: DARK.font,
                  fontSize: "9px",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  boxSizing: "border-box",
                }}
              >
                More ▶
                {moreOpen && (
                  <div
                    style={{
                      position: "absolute",
                      left: "100%",
                      top: 0,
                      width: "160px",
                      backgroundColor: DARK.bg2,
                      ...flat(DARK),
                      padding: "2px",
                      zIndex: 60,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                      display: "flex",
                      flexDirection: "column",
                      boxSizing: "border-box",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {remoteInstruments.length === 0 ? (
                      <div
                        style={{
                          padding: `${SPACE.sm}px ${SPACE.md}px`,
                          color: DARK.textLo,
                          fontFamily: DARK.font,
                          fontSize: "9px",
                          fontWeight: "bold",
                          textTransform: "uppercase",
                          boxSizing: "border-box",
                        }}
                      >
                        Loading...
                      </div>
                    ) : (
                      remoteInstruments.map((instrument) => {
                        const color = DARK.accentOrange;
                        return (
                          <button
                            key={instrument.id}
                            type="button"
                            onClick={() => {
                              addChannelWithInstrument(instrument);
                              setAddDropdownOpen(false);
                              setMoreOpen(false);
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: `${SPACE.sm}px ${SPACE.md}px`,
                              backgroundColor: "transparent",
                              color: color,
                              border: "none",
                              cursor: "pointer",
                              fontFamily: DARK.font,
                              fontSize: "9px",
                              fontWeight: "bold",
                              textTransform: "uppercase",
                              boxSizing: "border-box",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = DARK.bg3;
                              e.currentTarget.style.color = DARK.textHi;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                              e.currentTarget.style.color = color;
                            }}
                          >
                            {instrument.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </main>

      {/* ABSOLUTE FLOATING CUSTOM RIGHT-CLICK CONTEXT MENU POPUP */}
      {contextMenu && contextMenu.visible && (
        <div
          style={{
            position: "absolute",
            backgroundColor: DARK.bg2,
            ...flat(DARK),
            padding: "2px",
            width: "150px",
            zIndex: 100,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
            top: Math.max(0, Math.min(contextMenu.y, (containerRef.current?.clientHeight ?? 400) - 115)),
            left: Math.max(0, Math.min(contextMenu.x, (containerRef.current?.clientWidth ?? 800) - 180)),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              if (onOpenPianoRoll) {
                onOpenPianoRoll(contextMenu.channelId);
              }
              setContextMenu(null);
            }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: `${SPACE.sm}px ${SPACE.md}px`,
              backgroundColor: "transparent",
              color: DARK.textMid,
              border: "none",
              cursor: "pointer",
              fontFamily: DARK.font,
              fontSize: "9px",
              fontWeight: "bold",
              textTransform: "uppercase",
              boxSizing: "border-box",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = DARK.bg3;
              e.currentTarget.style.color = DARK.textHi;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = DARK.textMid;
            }}
          >
            Send to Piano Roll
          </button>

          <button
            type="button"
            onClick={() => {
              const target = channels.find(c => c.id === contextMenu.channelId);
              if (target) {
                clearChannelNotes(target);
              }
              setContextMenu(null);
            }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: `${SPACE.sm}px ${SPACE.md}px`,
              backgroundColor: "transparent",
              color: DARK.textMid,
              border: "none",
              cursor: "pointer",
              fontFamily: DARK.font,
              fontSize: "9px",
              fontWeight: "bold",
              textTransform: "uppercase",
              boxSizing: "border-box",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = DARK.bg3;
              e.currentTarget.style.color = DARK.textHi;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = DARK.textMid;
            }}
          >
            Clear Steps
          </button>

          <div style={{ height: "1px", backgroundColor: DARK.bevelDark, margin: "2px 0" }} />

          <button
            type="button"
            onClick={() => {
              deleteChannelRow(contextMenu.channelId);
              setContextMenu(null);
            }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: `${SPACE.sm}px ${SPACE.md}px`,
              backgroundColor: "transparent",
              color: DARK.stateRed,
              border: "none",
              cursor: "pointer",
              fontFamily: DARK.font,
              fontSize: "9px",
              fontWeight: "bold",
              textTransform: "uppercase",
              boxSizing: "border-box",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = DARK.bg3;
              e.currentTarget.style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = DARK.stateRed;
            }}
          >
            Delete Channel
          </button>
        </div>
      )}

    </div>
  );

  // Checks if a step index is currently toggled on
  function isStepActive(channel: ChannelRow, index: number): boolean {
    const beatValue = index * 0.25;
    if (channel.type === "sample") {
      return hasSampleInGrid(channel.sampleId!, beatValue);
    } else {
      return hasNoteInGrid(channel.pitch!, beatValue);
    }
  }
}
