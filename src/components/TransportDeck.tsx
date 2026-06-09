/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { useAudioEngine } from "../audio/useAudioEngine";
import { Play, Pause, Square, Volume2, VolumeX, Clock, Activity, Music, RotateCcw } from "lucide-react";

export function TransportDeck() {
  const {
    playbackState,
    position,
    bpm,
    metronomeEnabled,
    loopSettings,
    play,
    pause,
    stop,
    setBpm,
    toggleMetronome,
    setLoop,
    isRecording,
    startRecording,
    stopRecording,
  } = useAudioEngine();

  // Keep a local state for the BPM input value for responsive typing
  const [bpmInput, setBpmInput] = useState<string>(bpm.toString());

  // Synchronize local input state if BPM shifts externally
  useEffect(() => {
    setBpmInput(bpm.toString());
  }, [bpm]);

  // Handle BPM submission
  const handleBpmChange = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(bpmInput);
    if (!isNaN(parsed) && parsed >= 20 && parsed <= 300) {
      setBpm(parsed);
    } else {
      // Revert to valid engine BPM if out of bounds
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

  // 4. Formatted Display Calculations:
  // Convert continuous float beats into traditional DAW Bars:Beats:Ticks metric
  // Assuming standard 4/4 time signature structure
  const beatsValue = position.beats;
  const bars = Math.floor(beatsValue / 4) + 1;
  const targetBeats = Math.floor(beatsValue % 4) + 1;
  const sixteenths = Math.floor((beatsValue % 1) * 4) + 1;
  const ticks = Math.floor(((beatsValue % 0.25) / 0.25) * 240); // 240 standard PPQN ticks per 16th

  // Format Helper: Zeropad integers
  const zeroPad = (num: number, targetLength: number) => {
    return String(num).padStart(targetLength, "0");
  };

  // Convert raw seconds into human-readable chronometer minutes:seconds:milliseconds
  const totalSeconds = position.seconds;
  const displayMin = Math.floor(totalSeconds / 60);
  const displaySec = Math.floor(totalSeconds % 60);
  const displayMs = Math.floor((totalSeconds % 1) * 1000);

  return (
    <div
      id="daw-transport-deck"
      className="w-full bg-[#1e2022] border-t border-b border-[#2e3135] bg-radial from-[#1e2022] to-[#121315] shadow-2xl px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-6 select-none"
    >
      {/* SECTION 1: Status & Brand Emblem */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <Activity className="h-5 w-5 animate-pulse" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-neutral-100 font-sans uppercase">
            Headless DAW Engine
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-wider text-neutral-400 uppercase">
              STATUS:
            </span>
            <span
              className={`text-[10px] font-mono font-semibold tracking-wider uppercase flex items-center gap-1 ${
                playbackState === "playing"
                  ? "text-emerald-400"
                  : playbackState === "paused"
                  ? "text-amber-400"
                  : "text-neutral-500"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  playbackState === "playing"
                    ? "bg-emerald-400 animate-ping"
                    : playbackState === "paused"
                    ? "bg-amber-400"
                    : "bg-neutral-600"
                }`}
              />
              {playbackState}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: Transport Action Controls */}
      <div className="flex items-center gap-2 bg-[#121315]/50 p-1.5 rounded-xl border border-[#2e3135]/50 shadow-inner">
        {/* Play Button */}
        <button
          id="btn-play"
          onClick={play}
          className={`flex h-11 px-5 items-center justify-center gap-2 rounded-lg font-sans font-medium text-xs tracking-wider uppercase transition-all duration-150 cursor-pointer ${
            playbackState === "playing"
              ? "bg-emerald-500 text-neutral-950 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
              : "text-neutral-300 hover:bg-[#1e2022] hover:text-white"
          }`}
          title="Play Transport"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>Play</span>
        </button>

        {/* Pause Button */}
        <button
          id="btn-pause"
          onClick={pause}
          className={`flex h-11 px-5 items-center justify-center gap-2 rounded-lg font-sans font-medium text-xs tracking-wider uppercase transition-all duration-150 cursor-pointer ${
            playbackState === "paused"
              ? "bg-amber-500 text-neutral-950 shadow-[0_0_15px_rgba(245,158,11,0.4)]"
              : "text-neutral-300 hover:bg-[#1e2022] hover:text-white"
          }`}
          title="Pause Playhead"
        >
          <Pause className="h-4 w-4 fill-current" />
          <span>Pause</span>
        </button>

        {/* Stop Button */}
        <button
          id="btn-stop"
          onClick={stop}
          className={`flex h-11 w-11 items-center justify-center rounded-lg text-neutral-300 hover:bg-[#1e2022] hover:text-red-400 transition-all duration-150 cursor-pointer ${
            playbackState === "stopped" ? "bg-red-500/10 border border-red-500/30 text-red-500" : ""
          }`}
          title="Stop & Reset Timeline"
        >
          <Square className="h-4 w-4 fill-current" />
        </button>

        {/* Record Button */}
        <button
          id="btn-record"
          onClick={() => isRecording ? stopRecording() : startRecording()}
          className={`flex h-11 px-5 items-center justify-center gap-2 rounded-lg font-sans font-medium text-xs tracking-wider uppercase transition-all duration-150 cursor-pointer ${
            isRecording
              ? "bg-red-500/10 border border-red-500/30 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
              : "text-neutral-300 hover:bg-[#1e2022] hover:text-red-400"
          }`}
          title={isRecording ? "Stop Recording" : "Record"}
        >
          <svg
            viewBox="0 0 12 12"
            width="12"
            height="12"
            className={isRecording ? "animate-pulse" : ""}
          >
            <circle cx="6" cy="6" r="5" fill="currentColor" />
          </svg>
          <span>Rec</span>
        </button>
      </div>

      {/* SECTION 3: Live Hardware LCD-Style Readout Panel */}
      <div
        id="daw-lcd-display"
        className="flex flex-col sm:flex-row items-stretch gap-px bg-[#0a0a0c] border-2 border-[#16171a] rounded-xl shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)] overflow-hidden"
      >
        {/* Musical Beats Segment */}
        <div className="px-5 py-2.5 flex flex-col justify-center min-w-[150px] border-b sm:border-b-0 sm:border-r border-[#222]">
          <div className="flex items-center gap-1.5 text-[9px] font-mono tracking-widest text-[#777] uppercase font-bold">
            <Music className="h-3 w-3 text-emerald-500/80" /> Beats Coordinates
          </div>
          <div className="flex items-baseline gap-2 font-mono mt-1 select-all cursor-all">
            <span className="text-[#050608] select-none text-2xl font-bold font-mono tracking-widest absolute opacity-5">
              888:8:8:888
            </span>
            <span className="text-emerald-400 text-2xl font-bold font-mono tracking-wider drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
              {zeroPad(bars, 3)}
            </span>
            <span className="text-[#333] font-bold text-lg select-none">:</span>
            <span className="text-emerald-400 text-2xl font-bold font-mono tracking-wider drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
              {targetBeats}
            </span>
            <span className="text-[#333] font-bold text-lg select-none">:</span>
            <span className="text-emerald-400 text-2xl font-bold font-mono tracking-wider drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
              {sixteenths}
            </span>
            <span className="text-[#333] font-bold text-lg select-none">:</span>
            <span className="text-emerald-400 text-base font-bold font-mono tracking-wide drop-shadow-[0_0_6px_rgba(52,211,153,0.4)]">
              {zeroPad(ticks, 3)}
            </span>
          </div>
          <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">
            Bar : Beat : 16th : Tick
          </span>
        </div>

        {/* Accurate Synchronous Hard-Time Chronometer */}
        <div className="px-5 py-2.5 flex flex-col justify-center min-w-[150px]">
          <div className="flex items-center gap-1.5 text-[9px] font-mono tracking-widest text-[#777] uppercase font-bold">
            <Clock className="h-3 w-3 text-cyan-500/80" /> Hardware Time
          </div>
          <div className="flex items-baseline gap-2 font-mono mt-1">
            <span className="text-[#050608] select-none text-2xl font-bold font-mono tracking-widest absolute opacity-5">
              88:88.888
            </span>
            <span className="text-cyan-400 text-2xl font-bold font-mono tracking-wider drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
              {zeroPad(displayMin, 2)}
            </span>
            <span className="text-[#333] font-bold text-lg select-none">:</span>
            <span className="text-cyan-400 text-2xl font-bold font-mono tracking-wider drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
              {zeroPad(displaySec, 2)}
            </span>
            <span className="text-[#333] font-bold text-lg select-none">.</span>
            <span className="text-cyan-400 text-base font-bold font-mono tracking-wide drop-shadow-[0_0_6px_rgba(34,211,238,0.4)]">
              {zeroPad(displayMs, 3)}
            </span>
          </div>
          <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">
            Min : Sec . Ms
          </span>
        </div>
      </div>

      {/* SECTION 4: Tempo & Metronome Utilities */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-4">
        {/* BPM Tempo Input Field */}
        <div className="flex flex-col">
          <label className="text-[10px] font-mono tracking-widest text-neutral-400 uppercase font-semibold mb-1">
            Tempo Settings
          </label>
          <form onSubmit={handleBpmChange} className="relative flex items-center">
            <input
              id="input-bpm"
              type="number"
              min="20"
              max="300"
              step="0.1"
              value={bpmInput}
              onChange={(e) => setBpmInput(e.target.value)}
              onBlur={handleBpmBlur}
              className="w-24 h-11 bg-[#121315] border border-[#2e3135] rounded-lg text-center font-mono text-sm font-semibold text-neutral-100 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 shadow-inner px-2 transition-all duration-150"
            />
            <span className="absolute right-3 font-mono text-[10px] text-zinc-500 font-bold select-none uppercase">
              BPM
            </span>
          </form>
        </div>

        {/* Metronome Toggle Switch */}
        <div className="flex flex-col">
          <label className="text-[10px] font-mono tracking-widest text-neutral-400 uppercase font-semibold mb-1">
            Metronome
          </label>
          <button
            id="btn-metronome"
            onClick={() => toggleMetronome()}
            className={`flex h-11 px-4 items-center gap-2 rounded-lg font-sans font-medium text-xs tracking-wider uppercase border transition-all duration-150 cursor-pointer ${
              metronomeEnabled
                ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                : "border-[#2e3135] bg-[#121315]/50 text-neutral-400 hover:text-neutral-200"
            }`}
            title="Toggle Metronome Sound"
          >
            {metronomeEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
            <span>Click</span>
          </button>
        </div>
      </div>
    </div>
  );
}
