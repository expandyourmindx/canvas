/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { useAudioEngine } from "../../../audio/useAudioEngine";
import { ChannelRow, DAWEvent } from "../../../types";
import { getLibraryManager } from "../../SampleBrowser";

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
    id: "synth101", 
    name: "Synth 101", 
    type: "wam" as const, 
    url: "https://plugins.canvasdaw.com/burns-audio/synth101/index.js", 
    description: "Roland SH-101 synthesizer emulation" 
  },
  { 
    id: "modal", 
    name: "Modal", 
    type: "wam" as const, 
    url: "https://plugins.canvasdaw.com/burns-audio/modal/index.js", 
    description: "Physical modelling synthesizer" 
  }
];

export interface UseChannelRackStateProps {
  channels: ChannelRow[];
  setChannels: React.Dispatch<React.SetStateAction<ChannelRow[]>>;
  channelMixers: Record<string, number>;
  setChannelMixers: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  channelPans: Record<string, number>;
  setChannelPans: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  channelVols: Record<string, number>;
  setChannelVols: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  mutedChannels: Record<string, boolean>;
  setMutedChannels: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  soloedChannels: Record<string, boolean>;
  setSoloedChannels: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  activeInstrumentId: string;
  setActiveInstrumentId: (id: string) => void;
  onOpenSampler?: (channelId: string) => void;
  onOpenPianoRoll?: (channelId: string) => void;
  onOpenWAM?: (channelId: string) => void;
}

export function useChannelRackState({
  channels,
  setChannels,
  channelMixers,
  setChannelMixers,
  channelPans,
  setChannelPans,
  channelVols,
  setChannelVols,
  mutedChannels,
  setMutedChannels,
  soloedChannels,
  setSoloedChannels,
  activeInstrumentId,
  setActiveInstrumentId,
  onOpenSampler,
  onOpenPianoRoll,
  onOpenWAM,
}: UseChannelRackStateProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const addChannelBtnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Pattern renaming state helpers
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    channelId: string;
  } | null>(null);

  // Instrument dropdown visibility state
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [remoteInstruments, setRemoteInstruments] = useState<InstrumentDefinition[]>([]);
  const [wamUrlInput, setWamUrlInput] = useState("");

  // Drag and drop states
  const [draggingOverChannelId, setDraggingOverChannelId] = useState<string | null>(null);
  const [draggedChannelId, setDraggedChannelId] = useState<string | null>(null);

  // Dropdown positioning
  useEffect(() => {
    if (!addDropdownOpen) return;

    const updatePosition = () => {
      const button = addChannelBtnRef.current;
      const menu = dropdownRef.current;
      if (!button || !menu) return;

      const rect = button.getBoundingClientRect();
      const menuWidth = menu.offsetWidth;
      const menuHeight = menu.offsetHeight;

      let top = rect.bottom;
      let left = rect.left;

      if (top + menuHeight > window.innerHeight) {
        top = rect.top - menuHeight;
      }
      if (top < 0) {
        top = rect.bottom;
      }

      if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth;
      }
      if (left < 0) {
        left = 0;
      }

      menu.style.top = `${top}px`;
      menu.style.left = `${left}px`;
      menu.style.visibility = "visible";
    };

    updatePosition();

    window.addEventListener("resize", updatePosition, { passive: true });
    window.addEventListener("scroll", updatePosition, { capture: true, passive: true });

    let rafId = requestAnimationFrame(function tick() {
      updatePosition();
      rafId = requestAnimationFrame(tick);
    });

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, { capture: true });
      cancelAnimationFrame(rafId);
    };
  }, [addDropdownOpen]);

  // Global click listener for closing menus
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

  const playSamplePreview = (sampleId: string, channelId: string) => {
    try {
      const buffer = engine.getSampleBuffer(sampleId);
      const volVal = channelVols[channelId] !== undefined ? channelVols[channelId] : 80;
      const panVal = channelPans[channelId] !== undefined ? channelPans[channelId] : 0;

      if (!buffer) {
        engine.triggerTonePreview(channelId, 125, 0.15, "sine");
        return;
      }

      engine.previewChannel(channelId, sampleId, volVal, panVal);
    } catch (e) {
      console.warn("Direct sample preview failed:", e);
    }
  };

  const playPitchPreview = (pitch: number, channelId: string) => {
    try {
      const channel = channels.find((c) => c.id === channelId);
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
      const res = await fetch("https://plugins.canvasdaw.com/plugins.json");
      if (res.ok) {
        const data: any[] = await res.json();
        setRemoteInstruments(
          data
            .filter((p: any) => p.type === "instrument")
            .map((p: any) => ({
              id: p.id,
              name: p.name,
              type: "wam" as const,
              url: p.url,
              description: p.description,
            }))
        );
      }
    } catch {
      // fail silently
    }
  };

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
      wamUrl: instrument.type === "wam" ? instrument.url : undefined,
    };

    const updated = [...channels, newChannel];
    setChannels(updated);
    setActiveInstrumentId(newChanId);
    setFocusedChannelId(newChanId);

    setChannelVols((prev) => ({ ...prev, [newChanId]: 80 }));
    setChannelMixers((prev) => ({ ...prev, [newChanId]: 0 }));

    if (engine) {
      engine.updateChannelVolume(newChanId, 80);
      engine.updateChannelPan(newChanId, 0);
      engine.updateChannelMixerTarget(newChanId, 0);
      if (engine.updateChannelInstrumentType) {
        engine.updateChannelInstrumentType(newChanId, instrument.type);
      }
    }

    if (instrument.type === "wam" && instrument.url) {
      if (engine) {
        try {
          await engine.loadWAM(newChanId, instrument.url);
          if (onOpenWAM) {
            onOpenWAM(newChanId);
          }
        } catch (err) {
          console.error("Failed to load WAM instrument on channel creation", err);
        }
      }
    } else if (instrument.type === "sampler") {
      if (onOpenSampler) {
        onOpenSampler(newChanId);
      }
    }
  };

  const hasNoteInGrid = (pitch: number, beat: number): boolean => {
    return events.some((e) => Math.abs(e.time - beat) < 0.05 && e.pitch === pitch);
  };

  const hasSampleInGrid = (sampleId: string, beat: number): boolean => {
    return events.some((e) => Math.abs(e.time - beat) < 0.05 && e.sampleId === sampleId);
  };

  const isStepActive = (channel: ChannelRow, index: number): boolean => {
    const beatValue = index * 0.25;
    if (channel.type === "sample") {
      return hasSampleInGrid(channel.sampleId!, beatValue);
    } else {
      return hasNoteInGrid(channel.pitch!, beatValue);
    }
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
          channelId: channel.id,
        };
        addEvent(newEvent);
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
          channelId: channel.id,
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

  const clearChannelNotes = (channel: ChannelRow) => {
    if (channel.type === "sample") {
      setEvents(events.filter((e) => e.sampleId !== channel.sampleId));
    } else {
      setEvents(events.filter((e) => e.channelId !== channel.id));
    }
  };

  const deleteChannelRow = (channelId: string) => {
    const target = channels.find((c) => c.id === channelId);
    if (!target) return;
    clearChannelNotes(target);
    setChannels((prev) => prev.filter((c) => c.id !== channelId));
  };

  const prevPattern = () => {
    const currentIndex = patterns.findIndex((p) => p.id === activePatternId);
    if (currentIndex > 0) {
      setActivePatternId(patterns[currentIndex - 1].id);
    }
  };

  const nextPattern = () => {
    const currentIndex = patterns.findIndex((p) => p.id === activePatternId);
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
    const currentPat = patterns.find((p) => p.id === activePatternId);
    if (!currentPat) return;

    const nextNum = patterns.length + 1;
    const newPatId = `pattern_${Date.now()}`;
    const newPatName = `${currentPat.name} (Copy)`;

    createPattern(newPatId, newPatName);

    if (engine) {
      const currentEvents = engine.getPatterns()[activePatternId] || [];
      const clonedEvents = currentEvents.map((e) => ({
        ...e,
        id: `event-clone-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        channelId: e.channelId,
      }));

      setActivePatternId(newPatId);
      setEvents(clonedEvents);
      pushToHistory();
    }
  };

  const startRename = () => {
    const currentPat = patterns.find((p) => p.id === activePatternId);
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

  return {
    containerRef,
    addChannelBtnRef,
    dropdownRef,
    engine,
    playbackState,
    events,
    setEvents,
    addEvent,
    clearEvents,
    activePatternId,
    setActivePatternId,
    patterns,
    focusedChannelId,
    setFocusedChannelId,
    pushToHistory,
    notifySampleLoaded,
    isRenaming,
    setIsRenaming,
    renameValue,
    setRenameValue,
    contextMenu,
    setContextMenu,
    addDropdownOpen,
    setAddDropdownOpen,
    moreOpen,
    setMoreOpen,
    remoteInstruments,
    wamUrlInput,
    setWamUrlInput,
    draggingOverChannelId,
    setDraggingOverChannelId,
    draggedChannelId,
    setDraggedChannelId,
    handleFileDrop,
    playSamplePreview,
    playPitchPreview,
    fetchRemoteInstruments,
    addChannelWithInstrument,
    isStepActive,
    handleStepToggle,
    handleRightClick,
    clearChannelNotes,
    deleteChannelRow,
    deletePattern,
    prevPattern,
    nextPattern,
    handleAddNewPattern,
    handleCloneActivePattern,
    startRename,
    handleRenameSubmit,
  };
}
