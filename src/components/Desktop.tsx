/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { TopToolbar } from "./TopToolbar";
import { DraggableWindow } from "./DraggableWindow";
import { Canvas } from "./Canvas";
declare module "./Canvas" {
  export interface CanvasProps {
    onOpenWAM?: (channelId: string) => void;
  }
}
import { ChannelRack } from "./ChannelRack";
import { Sampler } from "../plugins/Sampler";
import { PianoRoll } from "./PianoRoll";
import { Mixer } from "./Mixer";
import { useAudioEngine } from "../audio/useAudioEngine";
import { ExportWindow } from "./ExportWindow";
import { SampleBrowser } from "./SampleBrowser";
import { ParametricEQPanel } from "./effects/ParametricEQPanel";
import { ReverbPanel } from "./effects/ReverbPanel";
import { ChannelRow, SamplerSettings } from "../types";
import {
  FileAudio,
  HelpCircle,
  Layers,
  Settings,
  Terminal,
  Compass,
  Radio,
  Pin,
  PinOff,
} from "lucide-react";

import { useTheme } from "../theme/ThemeContext";

export function Desktop() {
  const { theme: DARK } = useTheme();
  const {
    engine,
    getSampleBuffer,
    previewChannel,
    notifySampleLoaded,
    registerSetChannels,
    registerDesktopSync,
    missingSamples,
    dismissMissingSamples
  } = useAudioEngine();

  // 1. Maintain visibility states for floating windows
  const [activeWindows, setActiveWindows] = useState({
    canvas: true,
    sequencer: true,
    sampler: false, // Sampler window initially closed
    pianoroll: false, // Piano Roll window initially closed
    mixer: false, // Mixer window initially closed by default
    export: false, // Export window initially closed
    eqpanel: false, // EQ Panel window initially closed
    reverbpanel: false, // Reverb Panel window initially closed
    wam: false, // WAM window initially closed
    wameffect: false,
  });

  // 2. Maintain a layer order array (focused items are added to/moved to the end of the array)
  type WindowId = "canvas" | "sequencer" | "sampler" | "pianoroll" | "mixer" | "export" | "eqpanel" | "reverbpanel" | "wam" | "wameffect";
  const [winOrder, setWinOrder] = useState<WindowId[]>(["canvas", "sequencer", "sampler", "pianoroll", "mixer", "export", "eqpanel", "reverbpanel", "wam", "wameffect"]);

  const [eqPanelIndex, setEqPanelIndex] = useState<{ insertIndex: number; slotIndex: number }>({
    insertIndex: 0,
    slotIndex: 0
  });

  const mixerPositionCallbackRef = useRef<((pos: { x: number; y: number }) => void) | null>(null);

  const [reverbPanelIndex, setReverbPanelIndex] = useState<{ insertIndex: number; slotIndex: number }>({
    insertIndex: 0,
    slotIndex: 0
  });

  const handleOpenEQPanel = (insertIndex: number, slotIndex: number) => {
    setEqPanelIndex({ insertIndex, slotIndex });
    setActiveWindows((prev) => ({ ...prev, eqpanel: true }));
    handleSetFocus("eqpanel");
  };

  const handleOpenReverbPanel = (insertIndex: number, slotIndex: number) => {
    setReverbPanelIndex({ insertIndex, slotIndex });
    setActiveWindows((prev) => ({ ...prev, reverbpanel: true }));
    handleSetFocus("reverbpanel");
  };

  // 3. Lifted sequencer and sampler states for true visual sync and responsive knobs
  const [channels, setChannels] = useState<ChannelRow[]>([
    { id: "sampler_kick", name: "Trap Kick", type: "sample", sampleId: "sampler_kick_sample", mixerTarget: 1, instrumentType: "sampler" },
    { id: "sampler_snare", name: "Trap Snare", type: "sample", sampleId: "sampler_snare_sample", mixerTarget: 2, instrumentType: "sampler" },
    { id: "sampler_hihat", name: "Trap Hihat", type: "sample", sampleId: "sampler_hihat_sample", mixerTarget: 3, instrumentType: "sampler" },
    { id: "obsidian_default", name: "Obsidian", type: "pitch", pitch: 60, mixerTarget: 4, instrumentType: "wam", wamUrl: "https://expandyourmindx.github.io/obsidian-wam/index.js" }
  ]);

  useEffect(() => {
    registerSetChannels(setChannels, channels);
  }, [registerSetChannels, setChannels]);

  const [stripColors, setStripColors] = useState<Record<number, string>>({});

  // Lifted state synchronization reference to avoid stale state capture
  const stateRef = useRef({
    channels,
    channelVols: {} as Record<string, number>,
    channelPans: {} as Record<string, number>,
    channelMixers: {} as Record<string, number>,
    samplerSettings: {} as Record<string, SamplerSettings>,
    stripColors: {} as Record<number, string>
  });

  const [channelMixers, setChannelMixers] = useState<Record<string, number>>({
    sampler_kick: 1,
    sampler_snare: 2,
    sampler_hihat: 3,
    obsidian_default: 4
  });
  const [channelPans, setChannelPans] = useState<Record<string, number>>({});
  const [channelVols, setChannelVols] = useState<Record<string, number>>({
    sampler_kick: 80,
    sampler_snare: 75,
    sampler_hihat: 65,
    obsidian_default: 80
  });
  const [mutedChannels, setMutedChannels] = useState<Record<string, boolean>>({});
  const [soloedChannels, setSoloedChannels] = useState<Record<string, boolean>>({});
  const [activeInstrumentId, setActiveInstrumentId] = useState<string>("obsidian_default");

  // New sampler plugin settings
  const [samplerSettings, setSamplerSettings] = useState<Record<string, SamplerSettings>>({});

  stateRef.current = { channels, channelVols, channelPans, channelMixers, samplerSettings, stripColors };

  useEffect(() => {
    if (registerDesktopSync) {
      registerDesktopSync({
        getChannels: () => stateRef.current.channels,
        getChannelVols: () => stateRef.current.channelVols,
        getChannelPans: () => stateRef.current.channelPans,
        getChannelMixers: () => stateRef.current.channelMixers,
        getStripColors: () => stateRef.current.stripColors,
        setChannels: (c: ChannelRow[]) => setChannels(c),
        setChannelVols: (v: Record<string, number>) => setChannelVols(v),
        setChannelPans: (p: Record<string, number>) => setChannelPans(p),
        setChannelMixers: (m: Record<string, number>) => setChannelMixers(m),
        setSamplerSettings: (s: Record<string, SamplerSettings>) => setSamplerSettings(s),
        setStripColors: (colors: Record<number, string>) => setStripColors(colors)
      });
    }
  }, [registerDesktopSync]);
  const [activeSamplerChannelId, setActiveSamplerChannelId] = useState<string | null>(null);



  // New Piano Roll state
  const [activePianoRollChannelId, setActivePianoRollChannelId] = useState<string>("obsidian_default");

  // New WAM state
  const [activeWAMChannelId, setActiveWAMChannelId] = useState<string | null>(null);
  const [activeWAMEffectSlot, setActiveWAMEffectSlot] = useState<{
    insertIndex: number;
    slotIndex: number;
  } | null>(null);


  // ── Sample Browser State ──
  const [browserOpen, setBrowserOpen] = useState(true);
  const [browserPinned, setBrowserPinned] = useState(true);
  const [browserWidth, setBrowserWidth] = useState(240);
  const isResizingBrowser = useRef(false);

  // Sync the pinned sample browser width to a global CSS custom variable
  useEffect(() => {
    const widthVal = browserPinned && browserOpen ? `${browserWidth}px` : "0px";
    document.documentElement.style.setProperty("--sample-browser-width", widthVal);
    return () => {
      document.documentElement.style.removeProperty("--sample-browser-width");
    };
  }, [browserPinned, browserOpen, browserWidth]);

  // Cached sync state ref to prevent O(N) redundant engine updates on fader sweeps
  const prevSyncStateRef = useRef<Record<string, { vol: number; pan: number; mixerTarget: number; sampleId?: string; instrumentType?: string }>>({});

  // Sync Channel Rack stats directly into the Audio Engine
  useEffect(() => {
    if (!engine) return;

    const prev = prevSyncStateRef.current;
    const current: typeof prev = {};

    channels.forEach((chan) => {
      const vol = channelVols[chan.id] ?? 80;
      const pan = channelPans[chan.id] ?? 0;
      const target = channelMixers[chan.id] ?? chan.mixerTarget ?? 1;
      const sampleId = chan.sampleId;
      const instrumentType = chan.instrumentType;

      current[chan.id] = { vol, pan, mixerTarget: target, sampleId, instrumentType };

      const cached = prev[chan.id];
      if (!cached) {
        // Initial sync or newly created channel: update all fields in engine
        engine.updateChannelVolume(chan.id, vol);
        engine.updateChannelPan(chan.id, pan);
        engine.updateChannelMixerTarget(chan.id, target);
        if (sampleId) {
          engine.updateChannelSampleId(chan.id, sampleId);
        }
        if (instrumentType && engine.updateChannelInstrumentType) {
          engine.updateChannelInstrumentType(chan.id, instrumentType);
        }
      } else {
        // High-precision O(1) diffing: only fire changed faders/knobs
        if (cached.vol !== vol) {
          engine.updateChannelVolume(chan.id, vol);
        }
        if (cached.pan !== pan) {
          engine.updateChannelPan(chan.id, pan);
        }
        if (cached.mixerTarget !== target) {
          engine.updateChannelMixerTarget(chan.id, target);
        }
        if (sampleId && cached.sampleId !== sampleId) {
          engine.updateChannelSampleId(chan.id, sampleId);
        }
        if (instrumentType && cached.instrumentType !== instrumentType && engine.updateChannelInstrumentType) {
          engine.updateChannelInstrumentType(chan.id, instrumentType);
        }
      }
    });

    prevSyncStateRef.current = current;
  }, [channels, channelVols, channelPans, channelMixers, engine]);

  const toggleWindow = (winId: WindowId) => {
    const isOpening = !activeWindows[winId];
    if (winId === "pianoroll" && isOpening) {
      setActiveInstrumentId(activePianoRollChannelId);
    }
    setActiveWindows((prev) => {
      const nextVal = !prev[winId];
      return {
        ...prev,
        [winId]: nextVal,
      };
    });
  };

  const handleSetFocus = (winId: WindowId) => {
    setWinOrder((prev) => {
      const filtered = prev.filter((id) => id !== winId);
      return [...filtered, winId];
    });
  };

  const handleOpenSampler = (channelId: string) => {
    setActiveSamplerChannelId(channelId);
    setActiveWindows((prev) => ({ ...prev, sampler: true }));
    handleSetFocus("sampler");
  };


  const handleOpenPianoRoll = (channelId: string) => {
    setActivePianoRollChannelId(channelId);
    setActiveWindows((prev) => ({ ...prev, pianoroll: true }));
    handleSetFocus("pianoroll");
    setActiveInstrumentId(channelId);
  };

  const handleOpenWAM = (channelId: string) => {
    setActiveWAMChannelId(channelId);
    setActiveWindows((prev) => ({ ...prev, wam: true }));
    handleSetFocus("wam");
  };

  const handleOpenWAMEffect = (insertIndex: number, slotIndex: number) => {
    setActiveWAMEffectSlot({ insertIndex, slotIndex });
    setActiveWindows((prev) => ({ ...prev, wameffect: true }));
    handleSetFocus("wameffect");
  };


  // Base z-index calculations from order position
  const getZIndex = (winId: WindowId) => {
    return 10 + winOrder.indexOf(winId);
  };

  // ── Browser resize handlers ──
  const handleBrowserResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    isResizingBrowser.current = true;
    const startX = e.clientX;
    const startWidth = browserWidth;

    const onMove = (ev: PointerEvent) => {
      if (!isResizingBrowser.current) return;
      const delta = ev.clientX - startX;
      setBrowserWidth(Math.max(180, Math.min(400, startWidth + delta)));
    };

    const onUp = () => {
      isResizingBrowser.current = false;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };



  return (
    <div
      className="absolute inset-0 h-screen w-screen overflow-hidden flex flex-col font-sans select-none text-neutral-200"
      style={{ backgroundColor: DARK.bg0 }}
    >

      {/* 2. Extensible top toolbar */}
      <TopToolbar
        activeWindows={activeWindows}
        winOrder={winOrder}
        toggleWindow={toggleWindow}
        onSetFocus={handleSetFocus}
        browserOpen={browserOpen}
        onToggleBrowser={() => setBrowserOpen((prev) => !prev)}
      />

      {/* ── OFFLINE SAMPLES WARNING BANNER ── */}
      {missingSamples && missingSamples.length > 0 && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[99] w-full max-w-lg px-4">
          <div className="bg-[#0b0c0f]/90 backdrop-blur-md border border-amber-500/30 rounded-md p-4 shadow-[0_8px_32px_rgba(245,158,11,0.20)] flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-305">
            <div className="flex items-center gap-2.5 text-amber-400">
              <Radio className="h-4 w-4 animate-pulse" />
              <h3 className="text-xs font-black tracking-wider uppercase">
                Offline Samples Flagged
              </h3>
            </div>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              The following files could not be automatically resolved and are currently offline. Please locate them or drag them back into the browser to re-authorize permission:
            </p>
            <div className="max-h-24 overflow-y-auto bg-black/40 rounded p-2 border border-neutral-900 font-mono text-[9px] text-amber-200/90 flex flex-col gap-1">
              {missingSamples.map((sampleId) => (
                <div key={sampleId} className="truncate">
                  ⚠️ {sampleId}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[8px] text-zinc-550 uppercase tracking-widest">
                Built-in presets seeded automatically
              </span>
              <button
                onClick={dismissMissingSamples}
                className="px-3 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-zinc-400 hover:text-white text-[10px] uppercase font-bold tracking-widest rounded-sm active:scale-98 transition-all cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pinned Sample Browser Panel ── */}
      {browserPinned && browserOpen && (
        <div
          className="fixed left-0 top-11 bottom-0 flex flex-col select-none"
          style={{
            width: "var(--sample-browser-width)",
            zIndex: 45,
            backgroundColor: DARK.bg0,
            borderRight: `1px solid ${DARK.bevelDark}`,
          }}
        >
          {/* Panel Header */}
          <div
            className="flex items-center justify-between px-2 py-1.5 shrink-0"
            style={{
              backgroundColor: DARK.bg1,
              borderBottom: `1px solid ${DARK.bevelDark}`,
            }}
          >
            <span
              className="text-[9px] font-black tracking-widest uppercase"
              style={{ color: DARK.textMid }}
            >
              Sample Browser
            </span>
            <button
              onClick={() => setBrowserPinned(false)}
              className="p-0.5 hover:bg-neutral-800 text-zinc-500 hover:text-amber-400 transition-colors rounded-xs cursor-pointer"
              title="Unpin – switch to floating window"
            >
              <Pin className="h-3 w-3" />
            </button>
          </div>
          {/* Browser Contents */}
          <div className="flex-1 overflow-hidden [&>div]:!w-full">
            <SampleBrowser
              engine={engine}
              channels={channels}
              getSampleBuffer={getSampleBuffer}
              previewChannel={previewChannel}
              onSampleLoaded={notifySampleLoaded}
            />
          </div>
          {/* Resize Handle */}
          <div
            onPointerDown={handleBrowserResizeStart}
            className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize hover:bg-cyan-500/20 active:bg-cyan-500/30 transition-colors z-10"
          />
        </div>
      )}

      {/* 1. Full-screen overflow-hidden dark desktop environment space */}
      <main
        className="flex-1 relative mt-14 overflow-hidden h-[calc(100vh-3.5rem)] select-none transition-[margin-left,width] duration-100"
        style={{
          marginLeft: "var(--sample-browser-width)",
          width: "calc(100% - var(--sample-browser-width))"
        }}
      >

        {/* Decorative Grid Wallpaper / Workspace Background */}
        <div className="absolute inset-x-0 top-0 bottom-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:16px_16px] z-0" />

        {/* Futuristic Subtle Circular Ambient Glow */}
        <div className="absolute top-[20%] left-[30%] w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none z-0" />
        <div className="absolute bottom-[20%] right-[25%] w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none z-0" />

        {/* 3. Floating window wrapper: Arrangement Canvas window */}
        <DraggableWindow
          id="canvas"
          title="Arrangement Canvas"
          isVisible={activeWindows.canvas}
          onClose={() => toggleWindow("canvas")}
          onFocus={() => handleSetFocus("canvas")}
          zIndex={getZIndex("canvas")}
          defaultX={30}
          defaultY={30}
          defaultWidth={880}
          defaultHeight={460}
          minWidth={550}
          minHeight={300}
          defaultMaximized={true}
        >
          <Canvas
            channels={channels}
            setChannels={setChannels}
            setChannelVols={setChannelVols}
            setChannelMixers={setChannelMixers}
            activeInstrumentId={activeInstrumentId}
            setActiveInstrumentId={setActiveInstrumentId}
            onOpenWindow={(winId) => {
              setActiveWindows((prev) => ({ ...prev, [winId]: true }));
              handleSetFocus(winId);
            }}
            onOpenPianoRoll={handleOpenPianoRoll}
            onOpenSampler={handleOpenSampler}
            onOpenWAM={handleOpenWAM}
            onOpenChannelRack={() => {
              setActiveWindows((prev) => ({ ...prev, sequencer: true }));
              handleSetFocus("sequencer");
            }}
          />
        </DraggableWindow>

        {/* 3. Floating window wrapper: Step pattern Channel Rack Sequencer */}
        <DraggableWindow
          id="sequencer"
          title="Channel Rack"
          isVisible={activeWindows.sequencer}
          onClose={() => toggleWindow("sequencer")}
          onFocus={() => handleSetFocus("sequencer")}
          zIndex={getZIndex("sequencer")}
          defaultX={200}
          defaultY={130}
          defaultWidth={850}
          defaultHeight={420}
          minWidth={600}
          minHeight={250}
        >
          <ChannelRack
            channels={channels}
            setChannels={setChannels}
            channelMixers={channelMixers}
            setChannelMixers={setChannelMixers}
            channelPans={channelPans}
            setChannelPans={setChannelPans}
            channelVols={channelVols}
            setChannelVols={setChannelVols}
            mutedChannels={mutedChannels}
            setMutedChannels={setMutedChannels}
            soloedChannels={soloedChannels}
            setSoloedChannels={setSoloedChannels}
            activeInstrumentId={activeInstrumentId}
            setActiveInstrumentId={setActiveInstrumentId}
            onOpenSampler={handleOpenSampler}
            onOpenPianoRoll={handleOpenPianoRoll}
            onOpenWAM={handleOpenWAM}
          />
        </DraggableWindow>

        {/* 3. Floating window wrapper: Sampler plugin window */}
        {activeWindows.sampler && activeSamplerChannelId && (
          <DraggableWindow
            id="sampler"
            title={`Sampler - ${channels.find(c => c.id === activeSamplerChannelId)?.name || "Default"}`}
            isVisible={activeWindows.sampler}
            onClose={() => toggleWindow("sampler")}
            onFocus={() => handleSetFocus("sampler")}
            zIndex={getZIndex("sampler")}
            defaultX={280}
            defaultY={190}
            defaultWidth={480}
            defaultHeight={295}
            minWidth={360}
            minHeight={220}
          >
            <Sampler
              channelId={activeSamplerChannelId}
              channels={channels}
              setChannels={setChannels}
              channelVols={channelVols}
              channelPans={channelPans}
              setChannelVols={setChannelVols}
              setChannelPans={setChannelPans}
              samplerSettings={samplerSettings}
              setSamplerSettings={setSamplerSettings}
            />
          </DraggableWindow>
        )}

        {/* 3. Floating window wrapper: Piano Roll window */}
        {activeWindows.pianoroll && (
          <DraggableWindow
            id="pianoroll"
            title={`Piano Roll - ${channels.find(c => c.id === activePianoRollChannelId)?.name || "Default"}`}
            isVisible={activeWindows.pianoroll}
            onClose={() => toggleWindow("pianoroll")}
            onFocus={() => handleSetFocus("pianoroll")}
            zIndex={getZIndex("pianoroll")}
            defaultX={120}
            defaultY={110}
            defaultWidth={800}
            defaultHeight={440}
            minWidth={480}
            minHeight={250}
          >
            <PianoRoll
              channels={channels}
              activeChannelId={activePianoRollChannelId}
              setActiveChannelId={setActivePianoRollChannelId}
              channelVols={channelVols}
              channelPans={channelPans}
            />
          </DraggableWindow>
        )}

        {/* 3. Floating window wrapper: Master Mixer Console window */}
        <DraggableWindow
          id="mixer"
          title="Master Mixer"
          isVisible={activeWindows.mixer}
          onClose={() => toggleWindow("mixer")}
          onFocus={() => handleSetFocus("mixer")}
          zIndex={getZIndex("mixer")}
          defaultX={50}
          defaultY={250}
          defaultWidth={880}
          defaultHeight={330}
          minWidth={550}
          minHeight={280}
          onPositionChange={(pos) => {
            mixerPositionCallbackRef.current?.(pos);
          }}
        >
          <Mixer
            channels={channels}
            channelMixers={channelMixers}
            setChannelMixers={setChannelMixers}
            onOpenEQPanel={handleOpenEQPanel}
            onOpenReverbPanel={handleOpenReverbPanel}
            onOpenWAMEffect={handleOpenWAMEffect}
            stripColors={stripColors}
            setStripColors={setStripColors}
            isVisible={activeWindows.mixer}
            onPositionChangeRef={mixerPositionCallbackRef}
          />
        </DraggableWindow>


        {activeWindows.wam && activeWAMChannelId && (
          <DraggableWindow
            id="wam"
            title={channels.find(c => c.id === activeWAMChannelId)?.name || "Instrument"}
            isVisible={activeWindows.wam}
            onClose={() => toggleWindow("wam")}
            onFocus={() => handleSetFocus("wam")}
            zIndex={getZIndex("wam")}
            defaultX={180}
            defaultY={100}
            defaultWidth={700}
            defaultHeight={680}
            minWidth={400}
            minHeight={400}
          >
            <WAMGuiMount channelId={activeWAMChannelId} />
          </DraggableWindow>
        )}

        {activeWindows.wameffect && activeWAMEffectSlot && (
          <DraggableWindow
            id="wameffect"
            title={`FX — Insert ${activeWAMEffectSlot.insertIndex} Slot ${activeWAMEffectSlot.slotIndex + 1}`}
            isVisible={activeWindows.wameffect}
            onClose={() => setActiveWindows((prev) => ({ ...prev, wameffect: false }))}
            onFocus={() => handleSetFocus("wameffect")}
            zIndex={getZIndex("wameffect")}
            defaultX={520}
            defaultY={140}
            defaultWidth={500}
            defaultHeight={400}
            minWidth={300}
            minHeight={250}
          >
            <WAMEffectGuiMount
              insertIndex={activeWAMEffectSlot.insertIndex}
              slotIndex={activeWAMEffectSlot.slotIndex}
            />
          </DraggableWindow>
        )}

        {/* 3. Floating window wrapper: Export Window */}
        {activeWindows.export && (
          <DraggableWindow
            id="export"
            title="MASTER EXPORT"
            isVisible={activeWindows.export}
            onClose={() => toggleWindow("export")}
            onFocus={() => handleSetFocus("export")}
            zIndex={getZIndex("export")}
            defaultX={200}
            defaultY={120}
            defaultWidth={500}
            defaultHeight={420}
            minWidth={440}
            minHeight={350}
          >
            <ExportWindow
              onClose={() => toggleWindow("export")}
              focused={winOrder[winOrder.length - 1] === "export"}
            />
          </DraggableWindow>
        )}

        {/* 3. Floating window wrapper: Parametric EQ Panel */}
        {activeWindows.eqpanel && (
          <DraggableWindow
            id="eqpanel"
            title={`Parametric EQ — Insert ${eqPanelIndex.insertIndex === 0 ? "Master" : eqPanelIndex.insertIndex} (Slot ${eqPanelIndex.slotIndex + 1})`}
            isVisible={activeWindows.eqpanel}
            onClose={() => toggleWindow("eqpanel")}
            onFocus={() => handleSetFocus("eqpanel")}
            zIndex={getZIndex("eqpanel")}
            defaultX={220}
            defaultY={100}
            defaultWidth={620}
            defaultHeight={336}
            minWidth={550}
            minHeight={330}
          >
            <ParametricEQPanel
              insertIndex={eqPanelIndex.insertIndex}
              slotIndex={eqPanelIndex.slotIndex}
              onClose={() => toggleWindow("eqpanel")}
            />
          </DraggableWindow>
        )}

        {/* 3. Floating window wrapper: Reverb Panel */}
        {activeWindows.reverbpanel && (
          <DraggableWindow
            id="reverbpanel"
            title={`Convolution Reverb — Insert ${reverbPanelIndex.insertIndex === 0 ? "Master" : reverbPanelIndex.insertIndex} (Slot ${reverbPanelIndex.slotIndex + 1})`}
            isVisible={activeWindows.reverbpanel}
            onClose={() => toggleWindow("reverbpanel")}
            onFocus={() => handleSetFocus("reverbpanel")}
            zIndex={getZIndex("reverbpanel")}
            defaultX={240}
            defaultY={120}
            defaultWidth={400}
            defaultHeight={170}
            minWidth={300}
            minHeight={150}
          >
            <ReverbPanel
              insertIndex={reverbPanelIndex.insertIndex}
              slotIndex={reverbPanelIndex.slotIndex}
              onClose={() => toggleWindow("reverbpanel")}
            />
          </DraggableWindow>
        )}

      </main>

      {/* ── Floating Sample Browser (unpinned mode) ── */}
      {!browserPinned && browserOpen && (
        <DraggableWindow
          id="samplebrowser"
          title="Sample Browser"
          isVisible={true}
          onClose={() => setBrowserOpen(false)}
          onFocus={() => {}}
          zIndex={48}
          defaultX={10}
          defaultY={60}
          defaultWidth={260}
          defaultHeight={500}
          minWidth={200}
          minHeight={300}
        >
          <div className="h-full flex flex-col">
            {/* Pin button in floating header */}
            <div
              className="flex items-center justify-between px-1 py-0.5 border-b shrink-0"
              style={{ backgroundColor: DARK.bg1, borderBottomColor: DARK.bevelDark }}
            >
              <button
                onClick={() => setBrowserPinned(true)}
                className="p-0.5 hover:bg-neutral-800 text-zinc-500 hover:text-amber-400 transition-colors rounded-xs cursor-pointer"
                title="Pin – dock to left edge"
              >
                <PinOff className="h-3 w-3" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden [&>div]:!w-full">
              <SampleBrowser
                engine={engine}
                channels={channels}
                getSampleBuffer={getSampleBuffer}
                previewChannel={previewChannel}
                onSampleLoaded={notifySampleLoaded}
              />
            </div>
          </div>
        </DraggableWindow>
      )}

    </div>
  );
}

function WAMGuiMount({ channelId }: { channelId: string }) {
  const { engine } = useAudioEngine();
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!channelId || !containerRef.current) return;
    if (mountedRef.current === channelId) return;

    containerRef.current.innerHTML = '';
    mountedRef.current = null;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30;

    const tryMount = async () => {
      if (cancelled || !containerRef.current) return;

      const instance = engine.getWAMInstance(channelId);
      if (!instance) {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(tryMount, 150);
        }
        return;
      }

      try {
        const createGuiFn = instance.createGui ?? instance.createGUI;
        if (!createGuiFn) {
          console.error('[WAM] No createGui or createGUI method found on instance');
          return;
        }
        const gui = await createGuiFn.call(instance);
        if (cancelled || !containerRef.current) return;
        containerRef.current.appendChild(gui);
        mountedRef.current = channelId;
      } catch (err) {
        console.error("WAM createGUI failed:", err);
      }
    };

    tryMount();

    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = '';
      mountedRef.current = null;
    };
  }, [channelId, engine]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'auto', background: '#060a0f' }} /* TODO: wire to theme when WAM mount is refactored */
    />
  );
}

function WAMEffectGuiMount({
  insertIndex,
  slotIndex,
}: {
  insertIndex: number;
  slotIndex: number;
}) {
  const { engine } = useAudioEngine();
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef<string | null>(null);
  const key = `${insertIndex}_${slotIndex}`;

  useEffect(() => {
    if (!containerRef.current) return;
    if (mountedRef.current === key) return;

    containerRef.current.innerHTML = "";
    mountedRef.current = null;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30;

    const tryMount = async () => {
      if (cancelled || !containerRef.current) return;
      const instance = engine.getWAMEffectInstance(insertIndex, slotIndex);
      if (!instance) {
        attempts++;
        if (attempts < maxAttempts) setTimeout(tryMount, 150);
        return;
      }
      try {
        const createGuiFn = instance.createGui ?? instance.createGUI;
        if (!createGuiFn) {
          console.error("[WAM Effect] No createGui method found");
          return;
        }
        const gui = await createGuiFn.call(instance);
        if (cancelled || !containerRef.current) return;
        containerRef.current.appendChild(gui);
        mountedRef.current = key;
      } catch (err) {
        console.error("[WAM Effect] createGUI failed:", err);
      }
    };

    tryMount();

    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
      mountedRef.current = null;
    };
  }, [key, engine]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", overflow: "auto", background: "#060a0f" }} /* TODO: wire to theme when WAM mount is refactored */
    />
  );
}

