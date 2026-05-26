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



const DEFAULT_CHANNELS: ChannelRow[] = [
  { id: "sampler_default", name: "Sampler", type: "sample", sampleId: "sampler_default_sample", mixerTarget: 1, instrumentType: "sampler" }
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
  const rotation = -135 + percent * 270;

  const colorClass = color === "cyan" ? "bg-cyan-400" : "bg-amber-500";
  const glowClass = color === "cyan"
    ? "shadow-[0_0_4px_rgba(34,211,238,0.5)]"
    : "shadow-[0_0_4px_rgba(245,158,11,0.5)]";

  return (
    <div className="flex flex-col items-center w-6 shrink-0 select-none">
      <span className="text-[5.5px] text-zinc-500 font-bold leading-none uppercase mb-1 font-mono tracking-tighter">
        {label}
      </span>
      <div
        ref={knobRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        className="w-5 h-5 rounded-full border border-neutral-800 bg-neutral-900/90 flex items-center justify-center relative touch-none cursor-ns-resize shadow-inner active:border-zinc-500 hover:border-zinc-800 select-none"
        title={`${title}: ${value} (Double-click to reset)`}
      >
        <div className="absolute inset-[1px] rounded-full bg-gradient-to-b from-[#18191d] to-[#0c0d10] flex items-center justify-center">
          {/* Rotating pointer pin */}
          <div
            className="w-full h-full relative"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <div className={`w-[1.5px] h-[5px] ${colorClass} ${glowClass} absolute top-[0.5px] left-1/2 -translate-x-1/2 rounded-full`} />
          </div>
        </div>
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
  onOpenObsidian?: (channelId: string) => void;
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
  onOpenObsidian,
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
      if (channel && channel.instrumentType === "obsidian") {
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

  // Add a dynamic channel builder for the selected instrument type
  const addChannelWithInstrument = (instrumentType: "sampler" | "obsidian") => {
    const nextIndex = channels.length + 1;
    const newChanId = `${instrumentType}_${Date.now()}`;
    const newChannel: ChannelRow = {
      id: newChanId,
      name: instrumentType === "sampler" ? `Sampler ${nextIndex}` : `Obsidian ${nextIndex}`,
      type: instrumentType === "sampler" ? "sample" : "pitch",
      sampleId: instrumentType === "sampler" ? `sample_${newChanId}` : undefined,
      pitch: instrumentType === "obsidian" ? 60 : undefined,
      mixerTarget: Math.min(99, nextIndex),
      instrumentType: instrumentType
    };

    setChannels([...channels, newChannel]);
    setActiveInstrumentId(newChanId);

    // Initializer maps matching this new unique key
    setChannelVols(prev => ({ ...prev, [newChanId]: 80 }));
    setChannelMixers(prev => ({ ...prev, [newChanId]: Math.min(99, nextIndex) }));

    // Update the audio engine registry on new channel creation
    if (engine) {
      engine.updateChannelVolume(newChanId, 80);
      engine.updateChannelPan(newChanId, 0);
      engine.updateChannelMixerTarget(newChanId, Math.min(99, nextIndex));
      if (engine.updateChannelInstrumentType) {
        engine.updateChannelInstrumentType(newChanId, instrumentType);
      }
    }

    // Toggle window visibility for the newly created instrument plugin
    if (instrumentType === "obsidian") {
      if (onOpenObsidian) {
        onOpenObsidian(newChanId);
      }
    } else {
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
      pushToHistory();
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
    <div ref={containerRef} className="flex flex-col h-full bg-[#08090a] text-zinc-300 font-mono text-[11px] select-none h-full relative">

      {/* 2. PATTERN SELECTOR HEADER */}
      <header className="flex items-center justify-between bg-[#101114] border-b border-neutral-900 p-1 px-2.5 h-10 shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="text-zinc-550 font-black text-[9px] tracking-widest uppercase">Channel Rack</span>

          <div className="flex items-center bg-black/50 border border-neutral-800 rounded-none h-6 px-1 gap-1">
            <button
              onClick={prevPattern}
              className="p-1 hover:text-white hover:bg-neutral-800/60 text-zinc-550 transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {isRenaming ? (
              <input
                type="text"
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') setIsRenaming(false);
                }}
                className="bg-neutral-900 text-[10px] text-cyan-400 font-bold border border-cyan-500 rounded-none w-20 px-1 focus:outline-none text-center"
              />
            ) : (
              <span
                onDoubleClick={startRename}
                className="text-[10px] font-bold px-2 text-cyan-400 text-center select-none w-20 truncate cursor-pointer hover:bg-neutral-800/40"
                title="Double click to rename"
              >
                {patterns.find(p => p.id === activePatternId)?.name || activePatternId}
              </span>
            )}
            <button
              onClick={nextPattern}
              className="p-1 hover:text-white hover:bg-neutral-800/60 text-zinc-550 transition-colors cursor-pointer"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <select
            value={activePatternId}
            onChange={(e) => setActivePatternId(e.target.value)}
            className="bg-black/50 border border-neutral-800 text-[10px] text-zinc-400 h-6 px-1 focus:outline-none focus:border-cyan-500 rounded-none font-medium cursor-pointer max-w-[120px]"
          >
            {patterns.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Plus Add Pattern Button */}
          <button
            onClick={handleAddNewPattern}
            className="flex items-center justify-center border border-neutral-800 bg-black/50 text-cyan-400 hover:text-white hover:bg-neutral-800/60 transition-colors h-6 w-6 cursor-pointer"
            title="Add Pattern"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          {/* Clone Pattern Button */}
          <button
            onClick={handleCloneActivePattern}
            className="flex items-center justify-center border border-neutral-800 bg-black/50 text-amber-400 hover:text-white hover:bg-neutral-800/60 transition-colors h-6 w-6 cursor-pointer"
            title="Clone/Duplicate Active Pattern"
          >
            <Copy className="h-3 w-3" />
          </button>

          {/* Delete Pattern Button */}
          <button
            onClick={() => deletePattern(activePatternId)}
            className="flex items-center justify-center border border-neutral-800 bg-black/50 text-red-400 hover:text-white hover:bg-neutral-800/60 transition-colors h-6 w-6 cursor-pointer"
            title="Delete Pattern"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Global Toolbar actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              clearEvents();
            }}
            className="px-2 py-1 bg-red-500/10 border border-red-500/20 hover:border-red-500/40 text-red-405 hover:bg-red-500/20 text-[9px] font-bold uppercase transition-colors rounded-none cursor-pointer flex items-center gap-1"
          >
            <Trash2 className="h-3 w-3" />
            <span>Clear Patterns</span>
          </button>
        </div>
      </header>

      {/* THE MAIN CHANNELS CONTAINER GRID */}
      <main className="flex-1 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin scrollbar-thumb-neutral-850">

        {/* Playhead LED Bulbs Track Row */}
        <div className="flex items-center pl-[185px] h-3 select-none pointer-events-none">
          <div className="flex-1 grid grid-cols-16 gap-[3px] pr-2.5">
            {stepColumns.map((_, i) => {
              const isCurrent = playbackState === "playing" && activePlayheadIndexRef.current === i;
              return (
                <div key={i} className="flex justify-center items-center h-[4px]">
                  <div
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-75 ${isCurrent
                        ? "bg-cyan-400 shadow-[0_0_5px_#22d3ee]"
                        : "bg-neutral-850"
                      }`}
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
          const hasPianoRollEvents = channel.instrumentType === "obsidian" || channelEvents.some(e => {
            if (e.pitch !== undefined && e.pitch !== channel.pitch) return true;
            if (e.time % 0.25 !== 0) return true;
            if (channel.type === "sample" && e.duration !== 0.4) return true;
            if (channel.type === "pitch" && e.duration !== 0.25) return true;
            return false;
          });

          return (
            <div
              key={channel.id}
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
              className={`flex items-center h-8 select-none transition-all duration-150 cursor-pointer ${isFocused
                  ? "bg-[#14151a] border border-neutral-800"
                  : "bg-[#0c0d10] border border-neutral-900/60"
                } p-0.5 ${isEffectivelyMuted ? "opacity-45" : "opacity-100"
                }`}
            >

              {/* Grab Handle */}
              <div
                draggable
                onDragStart={(e) => {
                  setDraggedChannelId(channel.id);
                  e.dataTransfer.setData("text/plain", channel.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDraggedChannelId(null);
                }}
                className="drag-handle w-3.5 h-full flex items-center justify-center cursor-grab active:cursor-grabbing text-zinc-650 hover:text-cyan-400 transition-colors shrink-0"
                title="Drag to rearrange channel"
              >
                <GripVertical className="w-3.5 h-3.5" />
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
                        pushToHistory();
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
                className={`flex items-center gap-1.5 w-[205px] shrink-0 p-0.5 transition-all duration-150 rounded-sm ${draggingOverChannelId === channel.id
                    ? "bg-cyan-950/50 border border-dashed border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.4)]"
                    : ""
                  }`}
              >

                {/* 0. MIDI Focus Target Indicator LED */}
                <button
                  id={`midi-focus-indicator-${channel.id}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFocusedChannelId(channel.id);
                  }}
                  className={`w-4 h-5 flex items-center justify-center rounded-xs transition-all duration-150 border cursor-pointer select-none relative ${isFocused
                      ? "bg-amber-500/20 border-amber-500/80 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                      : "bg-neutral-900 border-neutral-850 text-neutral-500 hover:text-neutral-300"
                    }`}
                  title={isFocused ? "MIDI Data actively routed here" : "Click to route PC MIDI to this channel"}
                >
                  <div className={`w-1.5 h-1.5 rounded-full transition-all duration-150 ${isFocused
                      ? "bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.95)] animate-pulse"
                      : "bg-zinc-800"
                    }`} />
                </button>

                {/* A. MIXER TARGET ROUTER (Functionless numerical box, custom wheel/increment behavior) */}
                <div
                  onWheel={(e) => {
                    e.preventDefault();
                    const dir = e.deltaY > 0 ? -1 : 1;
                    setChannelMixers(prev => ({
                      ...prev,
                      [channel.id]: Math.max(1, Math.min(99, (prev[channel.id] ?? channel.mixerTarget) + dir))
                    }));
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setChannelMixers(prev => ({
                      ...prev,
                      [channel.id]: Math.max(1, Math.min(99, (prev[channel.id] ?? channel.mixerTarget) + 1))
                    }));
                  }}
                  className="w-5 h-5 flex items-center justify-center bg-black border border-neutral-850 text-[9px] font-mono font-bold text-emerald-400 select-none cursor-ns-resize hover:border-emerald-500/40"
                  title="Mixer channel router (Click to increase, hover and scroll to change)"
                >
                  {channelMixers[channel.id] ?? channel.mixerTarget}
                </div>

                {/* B. MUTE / SOLO TOGGLE LEDS */}
                <div className="flex items-center gap-1">
                  {/* Mute button (Green LED indicates active channel, clicking turns off LED and mutes) */}
                  <button
                    onClick={() => {
                      setMutedChannels(prev => ({ ...prev, [channel.id]: !prev[channel.id] }));
                    }}
                    className="w-4 h-4 flex items-center justify-center bg-black border border-neutral-850 hover:border-zinc-550 transition-colors cursor-pointer"
                    title="Mute Channel"
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-75 ${isMuted
                          ? "bg-zinc-800"
                          : "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.85)]"
                        }`}
                    />
                  </button>

                  {/* Solo button (S) */}
                  <button
                    onClick={() => {
                      setSoloedChannels(prev => {
                        const nextVal = !prev[channel.id];
                        // If turning on solo, we toggle on. If shutting down solo, we toggle off.
                        return { ...prev, [channel.id]: nextVal };
                      });
                    }}
                    className={`w-4 h-4 flex items-center justify-center text-[8px] font-extrabold border rounded-none transition-colors cursor-pointer ${isSoloed
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/45 shadow-[0_0_4px_rgba(245,158,11,0.25)]"
                        : "bg-black text-zinc-650 border-neutral-850 hover:text-zinc-400 hover:border-zinc-700"
                      }`}
                    title="Solo Channel (S)"
                  >
                    S
                  </button>
                </div>

                {/* C. PAN / VOL LEVELERS */}
                <div className="flex items-center gap-1.5 w-14 shrink-0">
                  <Knob
                    label="PAN"
                    value={channelPans[channel.id] ?? 0}
                    min={-50}
                    max={50}
                    color="cyan"
                    onChange={(val) => setChannelPans(prev => ({ ...prev, [channel.id]: val }))}
                    title="Pan"
                    defaultValue={0}
                  />
                  <Knob
                    label="VOL"
                    value={channelVols[channel.id] ?? 80}
                    min={0}
                    max={100}
                    color="amber"
                    onChange={(val) => setChannelVols(prev => ({ ...prev, [channel.id]: val }))}
                    title="Volume"
                    defaultValue={80}
                  />
                </div>

                {/* D. INSTRUMENT BUTTON WITH RIGHT-CLICK POPUPS */}
                <button
                  onContextMenu={(e) => handleRightClick(e, channel.id)}
                  onClick={() => {
                    setActiveInstrumentId(channel.id);
                    if (channel.instrumentType === "obsidian") {
                      if (onOpenObsidian) {
                        onOpenObsidian(channel.id);
                      }
                    } else {
                      if (onOpenSampler) {
                        onOpenSampler(channel.id);
                      }
                    }
                  }}
                  className={`flex-1 text-left px-2 py-1 select-none border text-[9px] font-black uppercase tracking-wider truncate cursor-pointer transition-colors rounded-none flex items-center justify-between ${isSelected
                      ? "bg-[#181d26] text-cyan-400 border-cyan-500/35"
                      : "bg-[#121316] text-zinc-350 border-neutral-850 hover:bg-[#1a1c22] hover:text-white"
                    }`}
                  title={`${channel.name} Settings (Right-click for options)`}
                >
                  <span className="truncate mr-1">{channel.name}</span>
                  {isFocused && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.95)] shrink-0 animate-pulse"
                      title="MIDI Target Focused"
                    />
                  )}
                </button>

              </div>

              {/* RIGHT SIDE 16-STEP GRID OR MINI PIANO ROLL PREVIEW */}
              <div className="flex-1 px-1.5 h-full flex items-center min-w-0">
                {hasPianoRollEvents ? (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenPianoRoll) {
                        onOpenPianoRoll(channel.id);
                      }
                    }}
                    className="flex-1 h-5 bg-[#040507] border border-neutral-900 hover:border-cyan-500/40 rounded-sm relative overflow-hidden group transition-all flex items-center justify-between px-2 cursor-pointer"
                    title="Piano Roll active (Click to open Piano Roll)"
                  >
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex justify-between pointer-events-none opacity-[0.03]">
                      <div className="w-[1px] h-full bg-white" style={{ left: "25%" }} />
                      <div className="w-[1px] h-full bg-white" style={{ left: "50%" }} />
                      <div className="w-[1px] h-full bg-white" style={{ left: "75%" }} />
                    </div>

                    {/* SVG/Micro MIDI notes */}
                    <div className="absolute inset-0 py-0.5 px-2.5 pointer-events-none">
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
                              className="absolute h-[2px] bg-cyan-400/80 shadow-[0_0_2px_#22d3ee] rounded-xs"
                              style={{
                                left: `${leftPercent}%`,
                                width: `${Math.max(2.5, widthPercent)}%`,
                                top: `${Math.min(85, Math.max(15, topPercent))}%`,
                              }}
                            />
                          );
                        });
                      })()}
                    </div>

                    <span className="text-[7.5px] text-zinc-600 font-extrabold uppercase tracking-widest pl-1 group-hover:text-cyan-400/80 transition-colors pointer-events-none z-10">
                      PIANO ROLL ACTIVE
                    </span>
                  </div>
                ) : (
                  <div className="w-full grid grid-cols-16 gap-[3px] h-full items-center">
                    {stepColumns.map((beatValue, index) => {
                      const isActive = isStepActive(channel, index);
                      const isPassing = playbackState === "playing" && activePlayheadIndexRef.current === index;
                      const isBeatGroupA = Math.floor(index / 4) % 2 === 0;

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
                          className={`h-4.5 w-full rounded-none border transition-all cursor-pointer relative ${isActive
                              ? channel.type === "sample"
                                ? isPassing
                                  ? "bg-emerald-300 border-emerald-450 scale-[0.93] shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                                  : "bg-emerald-500 border-emerald-600 hover:bg-emerald-450"
                                : isPassing
                                  ? "bg-cyan-300 border-cyan-455 scale-[0.93] shadow-[0_0_8px_rgba(34,211,238,0.9)]"
                                  : "bg-cyan-500 border-cyan-550 hover:bg-cyan-450"
                              : isPassing
                                ? "bg-zinc-650 border-zinc-550 scale-[0.95]"
                                : isBeatGroupA
                                  ? "bg-[#25272c] border-neutral-750/70 hover:bg-[#32353c] hover:border-zinc-700"
                                  : "bg-[#141518] border-neutral-900 hover:bg-[#202227] hover:border-zinc-800"
                            }`}
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
        <div className="pt-2 pl-1 select-none flex relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAddDropdownOpen(!addDropdownOpen);
            }}
            className="px-3.5 py-1.5 bg-[#121316] hover:bg-[#1a1c22] border border-neutral-850 hover:border-zinc-700 text-cyan-400 hover:text-cyan-300 font-bold uppercase transition-colors rounded-none cursor-pointer flex items-center justify-center text-[9px] tracking-wider"
            id="add-channel-btn"
          >
            + Add Channel
          </button>

          {addDropdownOpen && (
            <div
              style={{ bottom: "100%", left: "4px" }}
              className="absolute mb-1 bg-[#111215] border border-neutral-850 p-1 w-36 z-50 shadow-2xl flex flex-col font-sans text-[10px] text-neutral-300 font-semibold rounded-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-2 py-1 text-[8px] text-zinc-500 uppercase tracking-widest font-black border-b border-neutral-900/60 mb-1">
                Select Instrument
              </div>
              <button
                type="button"
                onClick={() => {
                  addChannelWithInstrument("sampler");
                  setAddDropdownOpen(false);
                }}
                className="w-full text-left px-2 py-1.5 hover:bg-[#181d26] hover:text-cyan-400 transition-colors uppercase tracking-wide cursor-pointer font-sans"
              >
                Sampler
              </button>
              <button
                type="button"
                onClick={() => {
                  addChannelWithInstrument("obsidian");
                  setAddDropdownOpen(false);
                }}
                className="w-full text-left px-2 py-1.5 hover:bg-[#181d26] hover:text-rose-400 transition-colors uppercase tracking-wide cursor-pointer font-sans text-rose-500"
              >
                Obsidian
              </button>
            </div>
          )}
        </div>

      </main>

      {/* ABSOLUTE FLOATING CUSTOM RIGHT-CLICK CONTEXT MENU POPUP */}
      {contextMenu && contextMenu.visible && (
        <div
          className="absolute bg-[#111215] border border-neutral-850 p-1 w-44 z-50 shadow-2xl flex flex-col font-sans select-none text-[10px] text-neutral-300 font-semibold"
          style={{
            top: Math.max(0, Math.min(contextMenu.y, (containerRef.current?.clientHeight ?? 400) - 115)),
            left: Math.max(0, Math.min(contextMenu.x, (containerRef.current?.clientWidth ?? 800) - 180))
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
            className="w-full text-left px-2 py-1.5 hover:bg-[#181b21] hover:text-white rounded-none cursor-pointer flex items-center gap-1.5"
          >
            <span>Send to Piano Roll</span>
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
            className="w-full text-left px-2 py-1.5 hover:bg-[#181b21] hover:text-white rounded-none cursor-pointer flex items-center gap-1.5"
          >
            <span>Clear steps</span>
          </button>

          <hr className="border-neutral-800 my-0.5" />

          <button
            type="button"
            onClick={() => {
              deleteChannelRow(contextMenu.channelId);
              setContextMenu(null);
            }}
            className="w-full text-left px-2 py-1.5 hover:bg-red-950/40 text-red-400 hover:text-red-300 rounded-none cursor-pointer flex items-center gap-1.5"
          >
            <span>Delete Channel</span>
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
