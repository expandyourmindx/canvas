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
  FolderOpen,
  Save,
  Upload
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
  winOrder: any[];
  toggleWindow: (winId: any) => void;
  onSetFocus: (winId: any) => void;
  browserOpen?: boolean;
  onToggleBrowser?: () => void;
}

export function TopToolbar({ activeWindows, winOrder, toggleWindow, onSetFocus, browserOpen, onToggleBrowser }: TopToolbarProps) {
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
    saveProject,
    loadProject,
    autosaveProject,
    restoreAutosave,
    isDirty,
  } = useAudioEngine();

  const [visMode, setVisMode] = useState<"spectrum" | "waveform">("spectrum");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visModeRef = useRef<"spectrum" | "waveform">("spectrum");

  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(event.target as Node)) {
        setIsFileMenuOpen(false);
      }
    };
    if (isFileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isFileMenuOpen]);

  useEffect(() => {
    visModeRef.current = visMode;
  }, [visMode]);

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

      if (visModeRef.current === "waveform") {
        analyser.getByteTimeDomainData(dataArray);

        // Solid dark background clear
        ctx.fillStyle = "rgba(10, 10, 12, 0.25)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Zero-crossing trigger search to stabilize the oscilloscope line
        let triggerIndex = 0;
        for (let i = 0; i < bufferLength / 2; i++) {
          if (dataArray[i] < 128 && dataArray[i + 1] >= 128) {
            triggerIndex = i;
            break;
          }
        }

        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#34d399"; // Glowing Emerald
        ctx.shadowColor = "#34d399";
        ctx.shadowBlur = 4;
        ctx.beginPath();

        const displayLength = Math.min(bufferLength - triggerIndex, 256); // show a clean window of 256 samples
        const sliceWidth = canvas.width / displayLength;
        
        for (let i = 0; i < displayLength; i++) {
          const v = dataArray[triggerIndex + i] / 128.0;
          const y = (v * canvas.height) / 2;
          const x = i * sliceWidth;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      } else {
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

  const [isTapped, setIsTapped] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const tapTimesRef = useRef<number[]>([]);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    };
  }, []);

  const handleTap = () => {
    const now = Date.now();

    // Clear active inactivity reset timeout since a new tap occurred
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }

    const lastTap = tapTimesRef.current[tapTimesRef.current.length - 1];

    // Reset tap history if more than 2 seconds pass between taps
    if (lastTap && now - lastTap > 2000) {
      tapTimesRef.current = [];
      setIsLocked(false);
    }

    tapTimesRef.current.push(now);

    // Keep history buffer size at up to 8 taps
    if (tapTimesRef.current.length > 8) {
      tapTimesRef.current.shift();
    }

    const N = tapTimesRef.current.length;
    let stableDetected = false;
    let targetBpm = bpm;

    // Check stability over the last 3 intervals (requires at least 4 taps)
    if (N >= 4) {
      const t_a = tapTimesRef.current[N - 4];
      const t_b = tapTimesRef.current[N - 3];
      const t_c = tapTimesRef.current[N - 2];
      const t_d = tapTimesRef.current[N - 1];

      const I1 = t_b - t_a;
      const I2 = t_c - t_b;
      const I3 = t_d - t_c;

      const B1 = 60000 / I1;
      const B2 = 60000 / I2;
      const B3 = 60000 / I3;

      const maxBpm = Math.max(B1, B2, B3);
      const minBpm = Math.min(B1, B2, B3);

      // Lock in if the last 3 consecutive intervals produce a value within 5 BPM of each other
      if (maxBpm - minBpm <= 5) {
        stableDetected = true;
        const avgInterval = (I1 + I2 + I3) / 3;
        targetBpm = Math.round(60000 / avgInterval);
      }
    }

    if (stableDetected) {
      // Commit stable BPM rounded to the nearest whole number
      if (targetBpm >= 20 && targetBpm <= 300) {
        setBpm(targetBpm);
        setBpmInput(targetBpm.toString());
      }

      // Stability Lock visual feedback (emerald)
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      setIsTapped(false);
      setIsLocked(true);
      lockTimeoutRef.current = setTimeout(() => {
        setIsLocked(false);
      }, 800);
    } else {
      // Not stable yet - show live calculated decimal preview in the input field
      if (N >= 2) {
        let totalInterval = 0;
        const count = N - 1;
        for (let i = 0; i < count; i++) {
          totalInterval += tapTimesRef.current[i + 1] - tapTimesRef.current[i];
        }
        const avgIntervalMs = totalInterval / count;
        const calculatedBpm = 60000 / avgIntervalMs;

        if (calculatedBpm >= 20 && calculatedBpm <= 300) {
          setBpmInput(calculatedBpm.toFixed(1));
        }
      }

      // Regular tap flash visual feedback (indigo)
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      setIsLocked(false);
      setIsTapped(true);
      tapTimeoutRef.current = setTimeout(() => {
        setIsTapped(false);
      }, 120);
    }

    // Reset everything if more than 2 seconds pass between taps
    resetTimeoutRef.current = setTimeout(() => {
      tapTimesRef.current = [];
      setIsLocked(false);
      setIsTapped(false);
      setBpmInput(bpm.toString());
    }, 2000);
  };

  const handleWindowClick = (winId: any) => {
    const isOpen = activeWindows[winId as keyof typeof activeWindows];
    if (isOpen) {
      // Find the open window with the highest index in winOrder
      let highestOpenWin: any = null;
      let highestIndex = -1;
      for (const id of winOrder) {
        if (activeWindows[id as keyof typeof activeWindows]) {
          const index = winOrder.indexOf(id);
          if (index > highestIndex) {
            highestIndex = index;
            highestOpenWin = id;
          }
        }
      }
      const isFocused = highestOpenWin === winId;
      if (isFocused) {
        // If already open and focused, toggle it closed/minimized
        toggleWindow(winId);
      } else {
        // If open but not focused (behind other windows), focus it (bring to front)
        onSetFocus(winId);
      }
    } else {
      // If closed, open it and focus it
      toggleWindow(winId);
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
      {/* LEFT BRAND SECTION & SAVE/LOAD BUTTONS */}
      <div className="flex items-center gap-4 pl-1 select-none">
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-black tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400 uppercase font-sans leading-none">
            CANVAS
          </h1>
          <span className="text-[8px] font-mono tracking-wide text-indigo-400 font-bold opacity-80 mt-0.5">
            v{CANVAS_VERSION}
          </span>
        </div>

        {/* File Menu Dropdown */}
        <div className="relative ml-2" ref={fileMenuRef}>
          <button
            onClick={() => setIsFileMenuOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm hover:bg-neutral-850 text-[10px] uppercase font-mono tracking-wider font-extrabold text-neutral-450 hover:text-indigo-400 border border-neutral-800/80 hover:border-indigo-500/20 bg-[#0d0e10]/40 cursor-pointer active:scale-95 transition-all h-[24px]"
            title="File operations and autosave recovery"
          >
            <FolderOpen className="h-3 w-3" />
            <span>File</span>
            {isDirty && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse ml-0.5" title="Unsaved changes" />
            )}
            <ChevronDown className="h-2.5 w-2.5 opacity-60 ml-0.5" />
          </button>

          {isFileMenuOpen && (
            <div className="absolute left-0 mt-1 w-64 bg-[#141517]/95 backdrop-blur-md border border-neutral-800 rounded-md shadow-2xl py-1 z-[100] animate-in fade-in slide-in-from-top-2 duration-150">
              <button
                onClick={() => {
                  setIsFileMenuOpen(false);
                  saveProject();
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-[9px] text-zinc-300 hover:text-white hover:bg-indigo-600/10 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2 font-mono uppercase tracking-wider font-bold">
                  <Save className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Save Project</span>
                </div>
                <span className="text-[8px] font-mono text-zinc-500">Ctrl+S</span>
              </button>

              <button
                onClick={() => {
                  setIsFileMenuOpen(false);
                  loadProject();
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-[9px] text-zinc-300 hover:text-white hover:bg-indigo-600/10 cursor-pointer transition-colors border-b border-neutral-800/40"
              >
                <div className="flex items-center gap-2 font-mono uppercase tracking-wider font-bold">
                  <Upload className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Load Project</span>
                </div>
                <span className="text-[8px] font-mono text-zinc-500">Ctrl+O</span>
              </button>

              {autosaveProject && (
                <button
                  onClick={() => {
                    setIsFileMenuOpen(false);
                    restoreAutosave();
                  }}
                  className="w-full flex flex-col px-3 py-2.5 text-left hover:bg-emerald-600/10 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-2 font-mono uppercase tracking-wider font-extrabold text-emerald-400 group-hover:text-emerald-300">
                    <Activity className="h-3.5 w-3.5 animate-pulse text-emerald-500" />
                    <span>Recover Autosave</span>
                  </div>
                  <div className="mt-1 flex flex-col gap-0.5 text-[8px] text-zinc-400 leading-tight">
                    <div className="truncate">
                      Project: <span className="text-zinc-300 font-semibold font-mono">{autosaveProject.projectName || "Untitled"}</span>
                    </div>
                    <div className="text-[7.5px] text-zinc-500">
                      Saved: {new Date(autosaveProject.savedAt).toLocaleString()}
                    </div>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
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

        {/* Real-time Spectrogram/Waveform Visualizer */}
        <div 
          onClick={() => setVisMode(prev => prev === "spectrum" ? "waveform" : "spectrum")}
          className="flex items-center justify-center bg-[#0a0a0c] border border-neutral-850 h-7.5 w-36 rounded-sm shadow-inner relative overflow-hidden select-none cursor-pointer hover:border-neutral-700 hover:bg-[#121316] transition-all"
          title={`Click to toggle visualization mode (Current: ${visMode === "spectrum" ? "Spectrum" : "Waveform"})`}
        >
          <canvas ref={canvasRef} width="144" height="30" className="w-full h-full pointer-events-none" />
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

        {/* Tap Tempo Button */}
        <button
          type="button"
          onClick={handleTap}
          className={`h-7 px-2.5 rounded-sm items-center justify-center font-mono text-[9px] font-extrabold uppercase tracking-wider cursor-pointer border transition-all active:scale-95 duration-100 hidden sm:flex ${
            isLocked
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.35)]"
              : isTapped
                ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.2)]"
                : "border-neutral-800 bg-[#0d0e10]/40 text-neutral-400 hover:text-neutral-200 hover:bg-[#121316]/60"
          }`}
          title="Tap Tempo (Stable tempo locks in automatically)"
        >
          Tap
        </button>

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
            title="Sample Browser"
          >
            <FolderOpen className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => handleWindowClick("canvas")}
          className="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-neutral-800/60 text-zinc-400 hover:text-indigo-400 active:scale-90 transition-all duration-100 cursor-pointer"
          title="Arranger Window"
        >
          <Layers className="h-4 w-4" />
        </button>

        <button
          onClick={() => handleWindowClick("sequencer")}
          className="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-neutral-800/60 text-zinc-400 hover:text-indigo-400 active:scale-90 transition-all duration-100 cursor-pointer"
          title="Channel Rack Window"
        >
          <Music className="h-4 w-4" />
        </button>

        <button
          onClick={() => handleWindowClick("pianoroll")}
          className="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-neutral-800/60 text-zinc-400 hover:text-indigo-400 active:scale-90 transition-all duration-100 cursor-pointer"
          title="Piano Roll Window"
        >
          <Keyboard className="h-4 w-4" />
        </button>

        <button
          onClick={() => handleWindowClick("obsidian")}
          className="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-neutral-800/60 text-zinc-400 hover:text-indigo-400 active:scale-90 transition-all duration-100 cursor-pointer"
          title="Synth Window"
        >
          <Zap className="h-4 w-4" />
        </button>

        <button
          onClick={() => handleWindowClick("mixer")}
          className="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-neutral-800/60 text-zinc-400 hover:text-indigo-400 active:scale-90 transition-all duration-100 cursor-pointer"
          title="Mixer Window"
        >
          <Activity className="h-4 w-4" />
        </button>

        <button
          id="toolbar-export-btn"
          onClick={() => handleWindowClick("export")}
          className="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-neutral-800/60 text-zinc-400 hover:text-indigo-400 active:scale-90 transition-all duration-100 cursor-pointer"
          title="Export Window"
        >
          <Disc className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
