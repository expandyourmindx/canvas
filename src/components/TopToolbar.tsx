/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from "react";
import { useAudioEngine } from "../audio/useAudioEngine";
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Activity,
  Layers,
  Music,
  Maximize2,
  Keyboard,
  ChevronDown,
  Disc,
  Zap,
  FolderOpen
} from "lucide-react";
import { CANVAS_VERSION } from "../config";

interface TopToolbarProps {
  activeWindows: {
    canvas: boolean;
    sequencer: boolean;
    pianoroll: boolean;
    mixer: boolean;
    export?: boolean;
    sampler?: boolean;
    obsidian?: boolean;
  };
  toggleWindow: (winId: any) => void;
  onSetFocus: (winId: any) => void;
  browserOpen?: boolean;
  onToggleBrowser?: () => void;
}

export function TopToolbar({ activeWindows, toggleWindow, onSetFocus, browserOpen, onToggleBrowser }: TopToolbarProps) {
  const {
    engine,
    playbackState,
    playbackMode,
    position,
    bpm,
    metronomeEnabled,
    play,
    pause,
    stop,
    setBpm,
    setPlaybackMode,
    toggleMetronome,
    pcKeyboardMidiActive,
    setPcKeyboardMidiActive,
    baseOctave,
    setBaseOctave,
  } = useAudioEngine();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !engine) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyser = engine.getOrCreateMixerInsert(0).analyserNode;
    analyser.fftSize = 1024;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const sampleRate = analyser.context.sampleRate || 44100;
    const numBars = 36; // High resolution bands
    const barWidth = canvas.width / numBars;

    // Scientific logarithmic bin mapping: accurately distributes bands across human hearing range (20Hz - 20kHz)
    const minHz = 35;
    const maxHz = 18000;
    const binIndices = new Int32Array(numBars);
    for (let i = 0; i < numBars; i++) {
      const targetHz = minHz * Math.pow(maxHz / minHz, i / (numBars - 1));
      const binIndex = Math.min(
        bufferLength - 1,
        Math.max(0, Math.round((targetHz * 1024) / sampleRate))
      );
      binIndices[i] = binIndex;
    }

    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      // Trailing motion blur fade
      ctx.fillStyle = "rgba(10, 10, 12, 0.25)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < numBars; i++) {
        const binIndex = binIndices[i];
        const val = dataArray[binIndex] || 0;
        
        // Scale frequency amplitude using decibel-like weighting
        const amplitude = val / 255;
        // Subtle gain compensation for high-end bands to balance visual energy
        const boost = 1 + (i / numBars) * 0.45;
        const barHeight = Math.min(canvas.height, amplitude * canvas.height * 0.95 * boost);

        // Professional cyan-to-emerald gradient spectrum coloring
        const grad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        grad.addColorStop(0, "#06b6d4"); // cyan bottom
        grad.addColorStop(1, "#34d399"); // emerald top

        ctx.fillStyle = grad;
        const yPos = canvas.height - barHeight;
        
        // Draw high-precision thin bar
        ctx.fillRect(i * barWidth, yPos, barWidth - 1, barHeight);
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [engine]);

  // Local state for Tempo BPM to handle smooth inline keyboard entry
  const [bpmInput, setBpmInput] = useState<string>(bpm.toString());
  const [showOctaveMenu, setShowOctaveMenu] = useState<boolean>(false);
  const [displayMode, setDisplayMode] = useState<"time" | "beats">("time");

  const handleWindowClick = (winId: any) => {
    toggleWindow(winId);
    if (!activeWindows[winId]) {
      onSetFocus(winId);
    }
  };

  useEffect(() => {
    setBpmInput(bpm.toString());
  }, [bpm]);

  const handleBpmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(bpmInput);
    if (!isNaN(parsed) && parsed >= 20 && parsed <= 300) {
      setBpm(parsed);
    } else {
      setBpmInput(bpm.toString());
    }
  };

  const handleBpmBlur = () => {
    const parsed = parseFloat(bpmInput);
    if (!isNaN(parsed) && parsed >= 20 && parsed <= 300) {
      setBpm(parsed);
    } else {
      setBpmInput(bpm.toString());
    }
  };

  // Convert raw beats into Bar : Beat : 16th : Tick
  const beatsValue = position.beats;
  const bars = Math.floor(beatsValue / 4) + 1;
  const targetBeats = Math.floor(beatsValue % 4) + 1;
  const sixteenths = Math.floor((beatsValue % 1) * 4) + 1;
  const ticks = Math.floor(((beatsValue % 0.25) / 0.25) * 240);

  // Convert seconds into Min : Sec . Ms
  const totalSeconds = position.seconds;
  const displayMin = Math.floor(totalSeconds / 60);
  const displaySec = Math.floor(totalSeconds % 60);
  const displayMs = Math.floor((totalSeconds % 1) * 1000);

  const zeroPad = (num: number, targetLength: number) => {
    return String(num).padStart(targetLength, "0");
  };

  return (
    <header
      id="daw-top-toolbar"
      className="fixed top-0 left-0 right-0 h-11 bg-[#16171a] border-b border-neutral-800 z-50 px-3 flex items-center justify-between select-none shadow-md"
    >
      {/* LEFT BRAND SECTION */}
      <div className="flex items-baseline gap-2 pl-1 select-none">
        <h1 className="text-sm font-black tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400 uppercase font-sans leading-none">
          CANVAS
        </h1>
        <span className="text-[8px] font-mono tracking-wide text-indigo-400 font-bold opacity-80 mt-0.5">
          v{CANVAS_VERSION}
        </span>
      </div>

      {/* CENTER COMPACT TRANSPORT CONSOLE */}
      <div className="flex items-center gap-3">
        {/* Playback Buttons */}
        <div className="flex items-center bg-[#0d0e10] p-0.5 rounded-sm border border-neutral-80/80">
          {/* Play/Pause Toggle */}
          <button
            onClick={playbackState === "playing" ? pause : play}
            className={`p-1 rounded-sm cursor-pointer transition-colors ${playbackState === "playing"
              ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
              : playbackState === "paused"
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : "text-zinc-400 hover:text-white"
              }`}
            title={playbackState === "playing" ? "Pause Playback" : "Start Playback"}
          >
            {playbackState === "playing" ? (
              <Pause className="h-3 w-3 fill-current" />
            ) : (
              <Play className="h-3 w-3 fill-current" />
            )}
          </button>

          {/* Stop */}
          <button
            onClick={stop}
            className={`p-1 rounded-sm cursor-pointer text-zinc-400 hover:text-red-400 transition-colors ${playbackState === "stopped" ? "bg-zinc-800 text-zinc-300" : ""
              }`}
            title="Stop & Return to Zero"
          >
            <Square className="h-3 w-3 fill-current" />
          </button>
        </div>

        {/* Dense Hardware-Style Playback Mode Toggle */}
        <div className="flex items-center bg-[#0d0e10] p-0.5 rounded-sm border border-neutral-80/80 h-[26px] gap-[1px]">
          <button
            type="button"
            onClick={() => setPlaybackMode("pattern")}
            className={`px-2 py-0.5 text-[8.5px] font-black tracking-wider uppercase transition-all duration-150 cursor-pointer rounded-xs select-none ${playbackMode === "pattern"
              ? "bg-orange-500/25 text-orange-400 border border-orange-500/35 shadow-[0_0_6px_rgba(249,115,22,0.25)]"
              : "text-neutral-500 hover:text-neutral-300 border border-transparent font-semibold"
              }`}
            title="Pattern Mode (Sequencer sequence looper)"
          >
            PAT
          </button>
          <button
            type="button"
            onClick={() => setPlaybackMode("song")}
            className={`px-2 py-0.5 text-[8.5px] font-black tracking-wider uppercase transition-all duration-150 cursor-pointer rounded-xs select-none ${playbackMode === "song"
              ? "bg-orange-500/25 text-orange-400 border border-orange-500/35 shadow-[0_0_6px_rgba(249,115,22,0.25)]"
              : "text-neutral-550 hover:text-neutral-300 border border-transparent font-semibold"
              }`}
            title="Song Mode (Arrangement Timeline player)"
          >
            SONG
          </button>
        </div>

        {/* Real-time Combined Hardware LCD Display */}
        <button
          onClick={() => setDisplayMode(displayMode === "time" ? "beats" : "time")}
          className="flex items-center justify-center bg-[#0a0a0c] border border-neutral-850 h-7.5 px-3 rounded-sm shadow-inner font-mono cursor-pointer select-none transition-all hover:border-neutral-700 hover:bg-[#121316] text-[10px]"
          title="Click to toggle display readout (Time / Beats)"
        >
          {displayMode === "time" ? (
            <div className="flex items-baseline gap-1.5 text-cyan-400 tracking-wider">
              <span className="text-cyan-500/40 text-[8px] font-bold">TIME:</span>
              <span className="font-extrabold">{zeroPad(displayMin, 2)}</span>
              <span className="text-cyan-900/60 font-extrabold">:</span>
              <span className="font-extrabold">{zeroPad(displaySec, 2)}</span>
              <span className="text-cyan-900/60 font-extrabold">.</span>
              <span className="text-cyan-500/80 font-normal text-[8.5px]">{zeroPad(displayMs, 3)}</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1.5 text-emerald-400 tracking-wider">
              <span className="text-emerald-500/40 text-[8px] font-bold">BEATS:</span>
              <span className="font-extrabold">{zeroPad(bars, 2)}</span>
              <span className="text-emerald-900/60 font-extrabold">:</span>
              <span className="font-extrabold">{targetBeats}</span>
              <span className="text-emerald-900/60 font-extrabold">:</span>
              <span className="font-extrabold">{sixteenths}</span>
              <span className="text-emerald-900/60 font-extrabold">:</span>
              <span className="text-emerald-500/80 font-normal text-[8.5px]">{zeroPad(ticks, 3)}</span>
            </div>
          )}
        </button>

        {/* Real-time Spectrogram Visualizer */}
        <div 
          className="flex items-center justify-center bg-[#0a0a0c] border border-neutral-850 h-7.5 w-36 rounded-sm shadow-inner relative overflow-hidden select-none"
          title="Master Output Spectrogram Visualizer"
        >
          <canvas ref={canvasRef} width="144" height="30" className="w-full h-full" />
        </div>

        {/* BPM Input Setting */}
        <form onSubmit={handleBpmSubmit} className="relative items-center hidden sm:flex">
          <input
            type="number"
            min="20"
            max="300"
            step="0.1"
            value={bpmInput}
            onChange={(e) => setBpmInput(e.target.value)}
            onBlur={handleBpmBlur}
            className="w-14 h-7 bg-[#0d0e10] border border-neutral-800 rounded-sm text-center font-mono text-[10px] font-bold text-neutral-200 focus:outline-none focus:border-indigo-500/50 px-1"
          />
          <span className="absolute right-1 text-[7px] font-mono text-zinc-500 pointer-events-none select-none uppercase">
            BPM
          </span>
        </form>

        {/* Metronome sounds trigger */}
        <button
          onClick={() => toggleMetronome()}
          className={`h-7 px-2 rounded-sm flex items-center gap-1 cursor-pointer transition-colors border ${metronomeEnabled
            ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-bold"
            : "border-neutral-800 bg-[#0d0e10]/40 text-neutral-500 hover:text-neutral-300"
            }`}
          title="Toggle Metronome Sound Click"
        >
          {metronomeEnabled ? (
            <Volume2 className="h-3 w-3" />
          ) : (
            <VolumeX className="h-3 w-3" />
          )}
          <span className="text-[9px] uppercase font-mono tracking-wider hidden lg:block">Click</span>
        </button>

        {/* PC Keyboard MIDI Toggle with Dropdown */}
        <div id="pc-midi-button-group" className="relative flex items-center bg-[#0d0e10] p-0.5 rounded-sm border border-neutral-80/80 h-7">
          <button
            id="pc-keyboard-midi-toggle"
            type="button"
            onClick={() => setPcKeyboardMidiActive(!pcKeyboardMidiActive)}
            onContextMenu={(e) => {
              e.preventDefault();
              setShowOctaveMenu(!showOctaveMenu);
            }}
            className={`h-full px-2 rounded-xs flex items-center gap-1.5 cursor-pointer transition-all ${pcKeyboardMidiActive
              ? "bg-amber-500/20 text-white border border-amber-500/30 text-amber-400 font-bold"
              : "text-zinc-500 hover:text-neutral-300 font-semibold"
              }`}
            title="Toggle PC Keyboard MIDI Input (Right-click or click arrow to set Base Octave)"
          >
            {/* LED style indicator */}
            <span id="pc-midi-led" className={`w-1.5 h-1.5 rounded-full transition-shadow duration-150 ${pcKeyboardMidiActive
              ? "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.85)] animate-pulse"
              : "bg-neutral-800"
              }`} />
            <span className="text-[8.5px] uppercase font-mono tracking-wider">KBD MIDI</span>
            <span className="text-[7.5px] px-1 bg-black/40 text-zinc-500 rounded-xs font-mono font-bold">
              OCT {baseOctave}
            </span>
          </button>

          <button
            id="pc-keyboard-midi-dropdown-arrow"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowOctaveMenu(!showOctaveMenu);
            }}
            className="h-full px-1 hover:bg-neutral-800 text-zinc-500 hover:text-neutral-300 transition-colors border-l border-neutral-850/80"
            title="Choose Base Octave"
          >
            <ChevronDown className="h-3 w-3 shrink-0" />
          </button>

          {/* Retro Hardware Dropdown Context Menu for Base Octaves */}
          {showOctaveMenu && (
            <>
              {/* Backing dismiss overlay */}
              <div id="octave-menu-backdrop" className="fixed inset-0 z-45 bg-transparent" onClick={() => setShowOctaveMenu(false)} />
              <div
                id="octave-dropdown-menu"
                className="absolute right-0 top-full mt-1.5 bg-[#0e1013] border border-neutral-800 rounded-sm shadow-2xl p-1 z-50 min-w-[130px] font-mono text-[9px] text-[#eceff4]"
              >
                <div className="px-2 py-1 text-[7px] text-zinc-550 border-b border-zinc-900 mb-1 font-black tracking-widest uppercase text-center">
                  BASE OCTAVE SELECTOR
                </div>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((oct) => (
                  <button
                    key={oct}
                    id={`octave-select-${oct}`}
                    onClick={() => {
                      setBaseOctave(oct);
                      setShowOctaveMenu(false);
                    }}
                    className={`w-full text-left px-2 py-1 flex items-center justify-between rounded-xs transition-colors hover:bg-amber-500/10 hover:text-amber-400 ${baseOctave === oct
                      ? "text-amber-400 font-extrabold bg-amber-500/5 border-l-2 border-amber-500"
                      : "text-zinc-400 border-l-2 border-transparent"
                      }`}
                  >
                    <span>Octave {oct}</span>
                    {oct === 4 && <span className="text-[7px] text-zinc-650 font-normal">(Default)</span>}
                    {baseOctave === oct && (
                      <div className="w-1.5 h-1.5 bg-amber-400 rounded-full shadow-[0_0_6px_rgba(245,158,11,0.85)]" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* RIGHT SIDE COMPONENT WINDOWS DOCK */}
      <div className="flex items-center gap-1 bg-[#0d0e10] p-0.5 rounded-sm border border-neutral-80/80">
        {/* Sample Browser Toggle */}
        {onToggleBrowser && (
          <button
            onClick={onToggleBrowser}
            className={`w-8 h-8 flex items-center justify-center rounded-sm hover:bg-neutral-800/60 active:scale-90 transition-all duration-100 cursor-pointer ${
              browserOpen
                ? "text-cyan-400 bg-cyan-500/10"
                : "text-zinc-400 hover:text-indigo-400"
            }`}
            title="Toggle Sample Browser"
          >
            <FolderOpen className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => handleWindowClick("canvas")}
          className="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-neutral-800/60 text-zinc-400 hover:text-indigo-400 active:scale-90 transition-all duration-100 cursor-pointer"
          title="Toggle Arranger Window"
        >
          <Layers className="h-4 w-4" />
        </button>

        <button
          onClick={() => handleWindowClick("sequencer")}
          className="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-neutral-800/60 text-zinc-400 hover:text-indigo-400 active:scale-90 transition-all duration-100 cursor-pointer"
          title="Toggle Channel Rack Window"
        >
          <Music className="h-4 w-4" />
        </button>

        <button
          onClick={() => handleWindowClick("pianoroll")}
          className="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-neutral-800/60 text-zinc-400 hover:text-indigo-400 active:scale-90 transition-all duration-100 cursor-pointer"
          title="Toggle Piano Roll Window"
        >
          <Keyboard className="h-4 w-4" />
        </button>

        <button
          onClick={() => handleWindowClick("obsidian")}
          className="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-neutral-800/60 text-zinc-400 hover:text-indigo-400 active:scale-90 transition-all duration-100 cursor-pointer"
          title="Toggle Synth Window"
        >
          <Zap className="h-4 w-4" />
        </button>

        <button
          onClick={() => handleWindowClick("mixer")}
          className="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-neutral-800/60 text-zinc-400 hover:text-indigo-400 active:scale-90 transition-all duration-100 cursor-pointer"
          title="Toggle Mixer Window"
        >
          <Activity className="h-4 w-4" />
        </button>

        <button
          id="toolbar-export-btn"
          onClick={() => handleWindowClick("export")}
          className="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-neutral-800/60 text-zinc-400 hover:text-indigo-400 active:scale-90 transition-all duration-100 cursor-pointer"
          title="Toggle Export Window"
        >
          <Disc className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
