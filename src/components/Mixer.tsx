import React, { useRef, useState, useEffect } from "react";
import { useAudioEngine } from "../audio/useAudioEngine";
import { Knob } from "./ChannelRack";
import { Volume2, VolumeX, Shield, Circle, Activity, Radio, Sparkles } from "lucide-react";
import { ChannelRow } from "../types";
import { MixerInsert } from "../audio/MixerManager";

interface MixerProps {
  channels?: ChannelRow[];
  channelMixers?: Record<string, number>;
  onOpenEQPanel?: (insertIndex: number, slotIndex: number) => void;
  onOpenReverbPanel?: (insertIndex: number, slotIndex: number) => void;
}

// The LevelMeter component uses requestAnimationFrame and direct DOM updates for high performance
function LevelMeter({ insertIndex, isMuted }: { insertIndex: number; isMuted: boolean }) {
  const { engine } = useAudioEngine();
  const rawMeterRef = useRef<HTMLDivElement>(null);
  const peakLineRef = useRef<HTMLDivElement>(null);
  const clipLedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrameId: number;
    let peakHoldValue = 0;
    let lastClipTime = 0;

    const updateMeter = () => {
      if (!engine) return;

      const levels = engine.getInsertLevels(insertIndex);
      const rms = isMuted ? 0 : levels.rms;
      const peak = isMuted ? 0 : levels.peak;

      // Map RMS to percentage
      // Level representation is linear for simplicity, boost mathematically to make safe range more dynamic
      const rmsHeight = Math.min(100, Math.pow(rms, 0.6) * 100);
      
      // Decay peak hold line
      if (peak > peakHoldValue) {
        peakHoldValue = peak;
      } else {
        peakHoldValue = Math.max(0, peakHoldValue - 0.015); // slow decay
      }
      const peakHeight = Math.min(100, Math.pow(peakHoldValue, 0.6) * 100);

      // Render RMS solid bar
      if (rawMeterRef.current) {
        rawMeterRef.current.style.height = `${rmsHeight}%`;
      }

      // Render Peak Hold thin line
      if (peakLineRef.current) {
        peakLineRef.current.style.bottom = `${peakHeight}%`;
        peakLineRef.current.style.display = peakHeight > 1 ? "block" : "none";
      }

      // Clipping LED check (0dBFS threshold is 1.0 amplitude)
      const now = Date.now();
      if (peak >= 0.99) {
        lastClipTime = now;
      }

      // Light up clipping LED if clipping occurred in the last 1000ms
      if (clipLedRef.current) {
        const isClipping = (now - lastClipTime) < 1000;
        if (isClipping) {
          clipLedRef.current.classList.add("bg-red-500", "shadow-[0_0_8px_#ef4444]");
          clipLedRef.current.classList.remove("bg-red-950/40");
        } else {
          clipLedRef.current.classList.remove("bg-red-500", "shadow-[0_0_8px_#ef4444]");
          clipLedRef.current.classList.add("bg-red-950/40");
        }
      }

      animationFrameId = requestAnimationFrame(updateMeter);
    };

    updateMeter();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [engine, insertIndex, isMuted]);

  return (
    <div className="flex flex-col items-center justify-between w-4.5 bg-black border border-neutral-900 rounded-none h-44 py-1.5 relative select-none">
      
      {/* 1S Hold clipping LED */}
      <div 
        ref={clipLedRef} 
        className="w-2.5 h-1 bg-red-950/40 rounded-none transition-all duration-100 mb-1 pointer-events-none" 
        title="0dBFS Clip Indicator (Holds for 1s)"
      />

      {/* Meter Cage with background tick lines */}
      <div className="flex-1 w-2 relative bg-zinc-950 overflow-hidden flex items-end">
        {/* dB markers drawn as absolute micro blocks */}
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between opacity-20">
          <div className="h-[1px] w-full bg-white text-[5px]" />
          <div className="h-[1px] w-full bg-white" />
          <div className="h-[1px] w-full bg-white" />
          <div className="h-[1px] w-full bg-white" />
          <div className="h-[1px] w-full bg-white" />
        </div>

        {/* Dynamic Amplitude RMS Gradient Solid Bar */}
        <div 
          ref={rawMeterRef}
          className="w-full bg-gradient-to-t from-emerald-500 via-yellow-400 to-red-500 rounded-none transition-all duration-75 origin-bottom"
          style={{ height: "0%" }}
        />

        {/* Single Peak Hold Line Indicator */}
        <div 
          ref={peakLineRef}
          className="absolute left-0 right-0 h-0.5 bg-cyan-400/90 shadow-[0_0_2px_#22d3ee] pointer-events-none z-10"
          style={{ bottom: "0%", display: "none" }}
        />
      </div>

    </div>
  );
}

export function Mixer({
  channels = [],
  channelMixers = {},
  onOpenEQPanel,
  onOpenReverbPanel,
}: MixerProps) {
  const { engine, setInsertFXSlot, setInsertFXBypass } = useAudioEngine();
  const [selectedInsertIndex, setSelectedInsertIndex] = useState(0);
  
  // Mixer strips state - locally tracked for rapid visual response, synced to engine on mutations
  const [insertsState, setInsertsState] = useState<MixerInsert[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [activePickerSlotIdx, setActivePickerSlotIdx] = useState<number | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [slotContextMenu, setSlotContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    slotIdx: number;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setActivePickerSlotIdx(null);
      }
    };
    if (activePickerSlotIdx !== null) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [activePickerSlotIdx]);

  // Close slot context menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setSlotContextMenu(null);
      }
    };
    if (slotContextMenu !== null) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [slotContextMenu]);

  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const startRename = (index: number, currentName: string) => {
    setRenamingIndex(index);
    setRenameValue(currentName);
  };

  const submitRename = (index: number) => {
    if (renameValue.trim()) {
      if (engine && (engine as any).renameInsert) {
        (engine as any).renameInsert(index, renameValue.trim());
      }
      setInsertsState((prev) =>
        prev.map((ins) => (ins.index === index ? { ...ins, name: renameValue.trim() } : ins))
      );
    }
    setRenamingIndex(null);
  };

  // Wheel horizontal scrolling effect
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Periodic visual refresh of inserts (in case they expand dynamically due to rack additions)
  useEffect(() => {
    if (!engine) return;

    const pullInserts = () => {
      const inserts = engine.getInserts();
      setInsertsState(
        inserts.map((ins) => ({
          ...ins
        }))
      );
    };

    pullInserts();
    
    // Poll slowly for structural updates (dynamic insert expansions)
    const interval = setInterval(pullInserts, 1500);
    return () => clearInterval(interval);
  }, [engine]);

  // Apply volume updates
  const handleVolumeChange = (index: number, nextVol: number) => {
    if (!engine) return;
    engine.updateInsertVolume(index, nextVol);
    setInsertsState((prev) =>
      prev.map((ins) => (ins.index === index ? { ...ins, volume: nextVol } : ins))
    );
  };

  // Apply panning updates
  const handlePanChange = (index: number, nextPan: number) => {
    if (!engine) return;
    engine.updateInsertPan(index, nextPan);
    setInsertsState((prev) =>
      prev.map((ins) => (ins.index === index ? { ...ins, pan: nextPan } : ins))
    );
  };

  // Toggle Mute
  const handleToggleMute = (index: number, currentMuted: boolean) => {
    if (!engine) return;
    engine.updateInsertMute(index, !currentMuted);
    setInsertsState((prev) =>
      prev.map((ins) => (ins.index === index ? { ...ins, isMuted: !currentMuted } : ins))
    );
  };

  // Toggle Solo
  const handleToggleSolo = (index: number, currentSoloed: boolean) => {
    if (!engine) return;
    engine.updateInsertSolo(index, !currentSoloed);
    // Solos trigger multi-strip changes, re-fetch state from solver
    const inserts = engine.getInserts();
    setInsertsState(
      inserts.map((ins) => ({
        ...ins
      }))
    );
  };

  // Selected strip info
  const selectedInsert = insertsState[selectedInsertIndex] || insertsState[0];

  return (
    <div 
      id="mixer-parent-container" 
      className="w-full h-full bg-[#0a0b0d] flex text-zinc-300 font-mono text-[11px] select-none rounded-none border border-neutral-900 overflow-hidden relative"
    >
      {/* 1. SCROLLABLE INSERTS BANK */}
      <div className="flex-1 h-full flex bg-[#08090a] overflow-hidden min-w-0">
        
        {/* A. MASTER BUS PINNED LEFT */}
        {insertsState.length > 0 && (
          <div 
            onClick={() => setSelectedInsertIndex(0)}
            className={`w-[68px] shrink-0 h-full border-r-2 border-neutral-950 flex flex-col justify-between py-2 text-center transition-all bg-gradient-to-b ${
              selectedInsertIndex === 0 
                ? "bg-[#141b25]/85 border-l-2 border-cyan-500/20" 
                : "bg-neutral-900/40 hover:bg-neutral-900/75"
            }`}
          >
            {/* Top Pinned Label */}
            <div className="px-1 truncate">
              <span className="text-[10px] filter saturate-150 font-black text-rose-500 tracking-wider">MASTER</span>
              <div className="text-[7.5px] text-zinc-500 font-bold tracking-widest mt-0.5">OUT 0</div>
            </div>

            {/* Panning knob */}
            <div className="flex justify-center my-1.5 select-none scale-90">
              <Knob
                label="PAN"
                value={insertsState[0]?.pan ?? 0}
                min={-50}
                max={50}
                color="cyan"
                onChange={(v) => handlePanChange(0, v)}
                title="Master Panning balance"
                defaultValue={0}
              />
            </div>

            {/* Fader section */}
            <div className="flex-1 flex justify-center gap-2 items-center px-1 max-h-[220px]">
              {/* RMS Peak Hold LED meter */}
              <LevelMeter insertIndex={0} isMuted={insertsState[0]?.isMuted} />

              {/* Vertical volume fader */}
              <div className="relative flex flex-col items-center h-44 group select-none">
                <input 
                  type="range"
                  min="0"
                  max="100"
                  value={insertsState[0]?.volume ?? 80}
                  onChange={(e) => handleVolumeChange(0, Number(e.target.value))}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleVolumeChange(0, 80);
                  }}
                  onPointerDown={(e) => {
                    if (e.altKey && e.button === 0) {
                      e.preventDefault();
                      e.stopPropagation();
                      handleVolumeChange(0, 80);
                    }
                  }}
                  {...{ orient: "vertical" }}
                  className="accent-cyan-400 w-3.5 h-40 bg-zinc-950 hover:bg-zinc-900 border border-neutral-900 cursor-row-resize rounded-none select-none"
                  style={{ WebkitAppearance: "slider-vertical" } as any}
                  title="Master Volume Fader (Double-click or Alt-click to reset to 80%)"
                />
                <span className="text-[7.5px] text-cyan-400 font-bold mt-1.5">{insertsState[0]?.volume}%</span>
              </div>
            </div>

            {/* Mute and Solo triggers */}
            <div className="px-1.5 flex gap-1 mt-2.5">
              <button
                onClick={(e) => { e.stopPropagation(); handleToggleMute(0, insertsState[0]?.isMuted); }}
                className={`flex-1 text-[8px] py-1 cursor-pointer select-none font-bold uppercase tracking-wider rounded-sm border ${
                  insertsState[0]?.isMuted 
                    ? "bg-red-500/10 text-red-400 border-red-500/40 shadow-[0_0_4px_rgba(239,68,68,0.15)]" 
                    : "bg-zinc-950 border-[#181a1f] text-zinc-550 hover:text-zinc-400"
                }`}
                title="Mute Master Output"
              >
                M
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleToggleSolo(0, insertsState[0]?.isSoloed); }}
                className={`flex-1 text-[8px] py-1 cursor-pointer select-none font-bold uppercase tracking-wider rounded-sm border ${
                  insertsState[0]?.isSoloed 
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/40 shadow-[0_0_4px_rgba(245,158,11,0.15)]" 
                    : "bg-zinc-950 border-[#181a1f] text-zinc-550 hover:text-zinc-400"
                }`}
                title="Solo Master Bus"
              >
                S
              </button>
            </div>
          </div>
        )}

        {/* B. SCROLLING INSERTS BANK */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto h-full flex flex-row scrollbar-thin scrollbar-thumb-zinc-900 select-none bg-[#070809]"
        >
          {insertsState.slice(1).map((ins) => {
            const isSelected = selectedInsertIndex === ins.index;
            const linkedChannels = channels.filter(c => (channelMixers?.[c.id] ?? c.mixerTarget) === ins.index);
            const inheritedName = linkedChannels.length > 0 ? linkedChannels[0].name : `Insert ${ins.index}`;
            const displayName = ins.name && ins.name !== `Insert ${ins.index}` ? ins.name : inheritedName;

            return (
              <div 
                key={ins.index}
                onClick={() => setSelectedInsertIndex(ins.index)}
                className={`w-[60px] shrink-0 h-full border-r border-neutral-950 flex flex-col justify-between py-2 text-center transition-all cursor-pointer ${
                  isSelected 
                    ? "bg-[#181d26]/90 border-t-2 border-t-cyan-400 p-px" 
                    : "bg-neutral-900/10 hover:bg-[#0f1012]"
                }`}
              >
                {/* Channel Label */}
                <div 
                  className="px-0.5 truncate h-8.5 flex flex-col justify-center select-none"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startRename(ins.index, displayName);
                  }}
                >
                  {renamingIndex === ins.index ? (
                    <input
                      type="text"
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => submitRename(ins.index)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitRename(ins.index);
                        if (e.key === "Escape") setRenamingIndex(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-neutral-950 text-[8.5px] text-cyan-400 font-bold border border-cyan-500 rounded-none w-full text-center focus:outline-none animate-pulse"
                    />
                  ) : (
                    <span className={`text-[8.5px] font-bold tracking-tight uppercase leading-none truncate block ${
                      isSelected ? "text-cyan-400 font-extrabold" : "text-zinc-450"
                    }`}>
                      {displayName}
                    </span>
                  )}
                  <div className="text-[7.5px] text-zinc-650 font-bold mt-0.5 uppercase">CH {ins.index}</div>
                </div>

                {/* Left-Right Panning rotary knob */}
                <div className="flex justify-center my-1.5 select-none scale-85">
                  <Knob
                    label="PAN"
                    value={ins.pan}
                    min={-50}
                    max={50}
                    color="cyan"
                    onChange={(v) => handlePanChange(ins.index, v)}
                    title={`Panner for Insert ${ins.index}`}
                    defaultValue={0}
                  />
                </div>

                {/* Linear Fader elements */}
                <div className="flex-1 flex justify-center gap-1.5 items-center px-0.5 max-h-[220px]">
                  <LevelMeter insertIndex={ins.index} isMuted={ins.isMuted} />

                  <div className="relative flex flex-col items-center h-44 group select-none">
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      value={ins.volume}
                      onChange={(e) => handleVolumeChange(ins.index, Number(e.target.value))}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleVolumeChange(ins.index, 80);
                      }}
                      onPointerDown={(e) => {
                        if (e.altKey && e.button === 0) {
                          e.preventDefault();
                          e.stopPropagation();
                          handleVolumeChange(ins.index, 80);
                        }
                      }}
                      {...{ orient: "vertical" }}
                      className="accent-zinc-400 w-3 h-40 bg-zinc-950 border border-neutral-900 hover:bg-zinc-900 cursor-row-resize rounded-none select-none"
                      style={{ WebkitAppearance: "slider-vertical" } as any}
                      title={`Fader for Insert ${ins.index} (Double-click or Alt-click to reset)`}
                    />
                    <span className={`text-[7.5px] font-bold mt-1.5 ${isSelected ? "text-cyan-400" : "text-zinc-550"}`}>{ins.volume}%</span>
                  </div>
                </div>

                {/* Solo/Mute switches */}
                <div className="px-1 flex gap-1 mt-2.5 select-none">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleMute(ins.index, ins.isMuted); }}
                    className={`flex-1 text-[7.5px] py-1 cursor-pointer select-none font-bold uppercase tracking-wider rounded-sm border ${
                      ins.isMuted 
                        ? "bg-red-500/10 text-red-500 border-red-500/35 shadow-[0_0_4px_rgba(239,68,68,0.1)]" 
                        : "bg-zinc-950 border-[#14151a]/60 text-zinc-600 hover:text-zinc-500"
                    }`}
                    title={`Mute Insert ${ins.index}`}
                  >
                    M
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleSolo(ins.index, ins.isSoloed); }}
                    className={`flex-1 text-[7.5px] py-1 cursor-pointer select-none font-bold uppercase tracking-wider rounded-sm border ${
                      ins.isSoloed 
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/35 shadow-[0_0_4px_rgba(245,158,11,0.1)]" 
                        : "bg-zinc-950 border-[#14151a]/60 text-zinc-600 hover:text-zinc-500"
                    }`}
                    title={`Solo Insert ${ins.index}`}
                  >
                    S
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* 2. DEDICATED FX PANEL MOUNTED RIGHT */}
      {selectedInsert && (
        <div 
          id="mixer-fx-panel" 
          className="w-56 shrink-0 h-full border-l border-neutral-950 bg-[#0e0f12] flex flex-col p-2.5 text-zinc-400 select-none"
        >
          {/* Header */}
          <div className="border-b border-neutral-850 pb-2 mb-3">
            <h4 className="text-[9.5px] text-cyan-400 font-extrabold uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              FX ROUTING PANEL
            </h4>
            <div className="text-[7.5px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5 flex justify-between">
              <span>
                TARGET:{" "}
                {selectedInsert.name && selectedInsert.name !== `Insert ${selectedInsert.index}`
                  ? selectedInsert.name
                  : (channels.filter(
                      (c) => (channelMixers?.[c.id] ?? c.mixerTarget) === selectedInsert.index
                    ).length > 0
                      ? channels.filter(
                          (c) => (channelMixers?.[c.id] ?? c.mixerTarget) === selectedInsert.index
                        )[0].name
                      : `Insert ${selectedInsert.index}`)}
              </span>
              <span>INDEX: {selectedInsert.index}</span>
            </div>
          </div>

          {/* 8 Empty Visual FX Slots with high-contrast hardware look */}
          <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-0.5 scrollbar-thin">
            {selectedInsert.fxSlots.map((slotName: string, slotIdx: number) => {
              const isBypassed = selectedInsert.fxBypass?.[slotIdx] ?? false;

              return (
                <div 
                  key={slotIdx}
                  onClick={() => {
                    if (!slotName) {
                      setActivePickerSlotIdx(slotIdx);
                    } else if (slotName === "EQ") {
                      onOpenEQPanel?.(selectedInsert.index, slotIdx);
                    } else if (slotName === "Reverb") {
                      onOpenReverbPanel?.(selectedInsert.index, slotIdx);
                    }
                  }}
                  onContextMenu={(e) => {
                    if (slotName) {
                      e.preventDefault();
                      e.stopPropagation();
                      const parent = document.getElementById("mixer-parent-container");
                      const parentRect = parent ? parent.getBoundingClientRect() : { left: 0, top: 0 };
                      setSlotContextMenu({
                        visible: true,
                        x: e.clientX - parentRect.left,
                        y: e.clientY - parentRect.top,
                        slotIdx
                      });
                    }
                  }}
                  className="group h-8.5 bg-black/55 hover:bg-black/85 border border-dashed border-neutral-800 hover:border-cyan-500/30 flex items-center justify-between px-2.5 transition-all relative rounded-none hover:shadow-[0_0_6px_rgba(34,211,238,0.03)] cursor-pointer"
                >
                  {/* Left slot indicator badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-zinc-[600] font-black group-hover:text-cyan-500/70">{slotIdx + 1}</span>
                    <span className={`text-[8.5px] font-black uppercase tracking-wider ${
                      slotName 
                        ? isBypassed ? "text-zinc-600 line-through" : "text-cyan-400" 
                        : "text-zinc-550 group-hover:text-zinc-400"
                    }`}>
                      {slotName || "EMPTY SLOT"}
                    </span>
                  </div>

                  {/* Slot Activation Status / Bypass Toggle */}
                  {slotName && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setInsertFXBypass(selectedInsert.index, slotIdx, !isBypassed);
                      }}
                      className="flex items-center gap-1.5 cursor-pointer group/bypass"
                      title={isBypassed ? "Activate Effect" : "Bypass Effect"}
                    >
                      <span className="text-[6.5px] text-zinc-650 group-hover/bypass:text-zinc-450 uppercase tracking-tighter">BYPASS</span>
                      <div className="w-2.5 h-2.5 rounded-full bg-zinc-950 border border-neutral-850 flex items-center justify-center">
                        <div className={`w-1.5 h-1.5 rounded-full transition-all duration-150 ${
                          isBypassed 
                            ? "bg-neutral-800" 
                            : "bg-emerald-400 shadow-[0_0_6px_#34d399]"
                        }`} />
                      </div>
                    </button>
                  )}

                  {/* Popover Effect Picker Dropdown */}
                  {activePickerSlotIdx === slotIdx && (
                    <div 
                      ref={pickerRef}
                      className="absolute left-0 right-0 top-full mt-1 bg-[#141519]/95 backdrop-blur-md border border-neutral-800 rounded-xs shadow-2xl py-1.5 z-[100] font-mono text-[9px] uppercase"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-2.5 py-0.5 text-[7.5px] text-zinc-550 border-b border-neutral-900 mb-1.5 font-black tracking-wider">Select Effect</div>
                      <button
                        onClick={() => {
                          setInsertFXSlot(selectedInsert.index, slotIdx, "EQ");
                          setActivePickerSlotIdx(null);
                        }}
                        className="w-full text-left px-2.5 py-1 text-zinc-300 hover:text-white hover:bg-indigo-600/10 cursor-pointer font-bold transition-colors"
                      >
                        EQ (Parametric)
                      </button>
                      <button
                        onClick={() => {
                          setInsertFXSlot(selectedInsert.index, slotIdx, "Reverb");
                          setActivePickerSlotIdx(null);
                        }}
                        className="w-full text-left px-2.5 py-1 text-zinc-300 hover:text-white hover:bg-indigo-600/10 cursor-pointer font-bold transition-colors"
                      >
                        Reverb (Stub)
                      </button>
                      <div className="border-t border-neutral-900 mt-1.5 pt-1.5">
                        <button
                          onClick={() => {
                            setInsertFXSlot(selectedInsert.index, slotIdx, "");
                            setActivePickerSlotIdx(null);
                          }}
                          className="w-full text-left px-2.5 py-1 text-red-400 hover:text-red-300 hover:bg-red-950/20 cursor-pointer font-bold transition-colors"
                        >
                          Clear Slot
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Diagnostics / Signal Flow Card */}
          <div className="mt-3.5 bg-black/45 border border-neutral-900 px-2 py-1.5 flex flex-col gap-1 rounded-none text-[8px] text-zinc-550 font-bold leading-relaxed uppercase">
            <div className="text-zinc-[600] border-b border-neutral-850/40 pb-0.5 flex justify-between items-center text-[7.5px]">
              <span>OUT MODULES</span>
              <Shield className="w-3.5 h-3.5 text-zinc-700 shrink-0" />
            </div>
            <div className="flex justify-between mt-0.5">
              <span>SIGNAL PATH:</span>
              <span className="text-emerald-400 font-black">ANALOG CHAIN</span>
            </div>
            <div className="flex justify-between">
              <span>LATENCY:</span>
              <span className="text-cyan-400 font-extrabold">0.00 MS (NATIVE)</span>
            </div>
          </div>
        </div>
      )}

      {slotContextMenu && (
        <div
          ref={contextMenuRef}
          className="absolute bg-[#121316] border border-neutral-800 shadow-2xl py-1 z-[200] font-mono text-[9px] uppercase min-w-[70px] rounded-none select-none"
          style={{
            left: `${slotContextMenu.x}px`,
            top: `${slotContextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const slotName = selectedInsert.fxSlots[slotContextMenu.slotIdx];
              if (slotName === "EQ") {
                onOpenEQPanel?.(selectedInsert.index, slotContextMenu.slotIdx);
              } else if (slotName === "Reverb") {
                onOpenReverbPanel?.(selectedInsert.index, slotContextMenu.slotIdx);
              }
              setSlotContextMenu(null);
            }}
            className="w-full text-left px-2 py-1.5 text-zinc-300 hover:text-white hover:bg-indigo-600/10 cursor-pointer font-bold transition-colors"
          >
            Open
          </button>
          <button
            onClick={() => {
              setInsertFXSlot(selectedInsert.index, slotContextMenu.slotIdx, "");
              setSlotContextMenu(null);
            }}
            className="w-full text-left px-2 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/20 cursor-pointer font-bold transition-colors border-t border-neutral-850/50"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
