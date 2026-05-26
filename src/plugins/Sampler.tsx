/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from "react";
import { ChannelRow, SamplerSettings } from "../types";
import { Knob } from "../components/ChannelRack";
import { useAudioEngine } from "../audio/useAudioEngine";
import { Volume2, Power, Waves, Upload } from "lucide-react";

interface SamplerProps {
  channelId: string;
  channels: ChannelRow[];
  setChannels: React.Dispatch<React.SetStateAction<ChannelRow[]>>;
  channelVols: Record<string, number>;
  channelPans: Record<string, number>;
  setChannelVols: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setChannelPans: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  samplerSettings: Record<string, SamplerSettings>;
  setSamplerSettings: React.Dispatch<React.SetStateAction<Record<string, SamplerSettings>>>;
}

const DEFAULT_SETTINGS: SamplerSettings = {
  pitch: 0,
  sampleStart: 0,
  envelopeOn: false,
  attack: 15,
  decay: 30,
  sustain: 70,
  release: 40,
};

export function Sampler({
  channelId,
  channels,
  setChannels,
  channelVols,
  channelPans,
  setChannelVols,
  setChannelPans,
  samplerSettings,
  setSamplerSettings,
}: SamplerProps) {
  const { engine, getSampleBuffer, previewChannel } = useAudioEngine();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loadedBuffer, setLoadedBuffer] = useState<AudioBuffer | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isPreviewActive, setIsPreviewActive] = useState(false);

  // Find current channel metadata
  const channel = channels.find((c) => c.id === channelId);
  const channelName = channel ? channel.name : "Unknown Sampler";
  
  // Get active settings or fallback to default
  const settings = samplerSettings[channelId] || DEFAULT_SETTINGS;
  const vol = channelVols[channelId] !== undefined ? channelVols[channelId] : 80;
  const pan = channelPans[channelId] !== undefined ? channelPans[channelId] : 0;

  // Retrieve buffer from engine on mount/change
  useEffect(() => {
    if (channel?.sampleId) {
      const buffer = getSampleBuffer(channel.sampleId);
      setLoadedBuffer(buffer || null);
      // Synchronize latest registered parameters into audio engine maps
      engine.updateChannelSampleId(channelId, channel.sampleId);
      engine.updateChannelVolume(channelId, vol);
      engine.updateChannelPan(channelId, pan);
      engine.updateChannelSamplerSettings(channelId, settings);
    } else {
      setLoadedBuffer(null);
    }
  }, [channelId, channel?.sampleId, getSampleBuffer, vol, pan, settings, engine]);

  const handleWaveformClick = () => {
    if (!channel?.sampleId) return;

    // Explicit sync before trigger
    engine.updateChannelSampleId(channelId, channel.sampleId);
    engine.updateChannelVolume(channelId, vol);
    engine.updateChannelPan(channelId, pan);
    engine.updateChannelSamplerSettings(channelId, settings);

    // Audition preview channel immediately
    previewChannel(channelId);

    // Highlight cue
    setIsPreviewActive(true);
    setTimeout(() => {
      setIsPreviewActive(false);
    }, 120);
  };

  // Redraw waveform canvas whenever buffer or start offset updates
  useEffect(() => {
    drawWaveform();
  }, [loadedBuffer, settings.sampleStart]);

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Solid deep background clear
    ctx.clearRect(0, 0, width, height);

    if (!loadedBuffer) {
      // FLATLINE EMPTY STATE: Render a single ultra-crisp, flat, 1-pixel horizontal line dead center
      ctx.strokeStyle = "rgba(6, 182, 212, 0.45)"; // Deep cyan/teal for empty state
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    // Capture mono amplitude channel
    const channelData = loadedBuffer.getChannelData(0);
    const step = Math.ceil(channelData.length / width);
    const ampScale = 0.95; // scaling factor to keep clean margins inside LCD boundary

    for (let i = 0; i < width; i++) {
      let min = 0;
      let max = 0;
      let hasData = false;
      const startIdx = i * step;
      const endIdx = Math.min(startIdx + step, channelData.length);

      for (let j = startIdx; j < endIdx; j++) {
        const val = channelData[j];
        if (!hasData) {
          min = val;
          max = val;
          hasData = true;
        } else {
          if (val < min) min = val;
          if (val > max) max = val;
        }
      }

      // Center around mid y level
      const midY = height / 2;
      const yMin = midY + min * midY * ampScale;
      const yMax = midY + max * midY * ampScale;

      // Color coding relative to the Offset percentage threshold
      const sampleOffsetPct = settings.sampleStart;
      const isPastOffset = (i / width) * 100 >= sampleOffsetPct;

      ctx.strokeStyle = isPastOffset 
        ? "rgba(34, 211, 238, 0.85)" // High-contrast cyan
        : "rgba(63, 63, 70, 0.55)";  // Dark visual mute for clipped pre-start portion

      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(i, yMin);
      ctx.lineTo(i, yMax);
      ctx.stroke();
    }

    if (settings.sampleStart > 0) {
      // DRAW THE VISUAL START MARKER LINE ACCORDING TO THE "OFFSET" KNOB VALUE
      const xMarker = (settings.sampleStart / 100) * width;
      ctx.strokeStyle = "#22d3ee"; // glowing cyan
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 3]); // hardware dashes
      ctx.beginPath();
      ctx.moveTo(xMarker, 0);
      ctx.lineTo(xMarker, height);
      ctx.stroke();
      ctx.setLineDash([]); // clear dash styling for other structures

      // Head tag on start offset
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.moveTo(xMarker - 4, 0);
      ctx.lineTo(xMarker + 4, 0);
      ctx.lineTo(xMarker, 5);
      ctx.closePath();
      ctx.fill();
    }
  };

  const updateSetting = <K extends keyof SamplerSettings>(key: K, val: SamplerSettings[K]) => {
    const nextSettings = {
      ...(samplerSettings[channelId] || DEFAULT_SETTINGS),
      [key]: val,
    };
    setSamplerSettings((prev) => ({
      ...prev,
      [channelId]: nextSettings,
    }));
    engine.updateChannelSamplerSettings(channelId, nextSettings);
  };

  const handleVolChange = (newVol: number) => {
    setChannelVols((prev) => ({ ...prev, [channelId]: newVol }));
    engine.updateChannelVolume(channelId, newVol);
  };

  const handlePanChange = (newPan: number) => {
    setChannelPans((prev) => ({ ...prev, [channelId]: newPan }));
    engine.updateChannelPan(channelId, newPan);
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("audio/") && !file.name.endsWith(".wav") && !file.name.endsWith(".mp3")) {
      console.warn("Unsupported sample file extension format.");
      return;
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const sampleId = `${channelId}_sample_${Date.now()}`;

      // Synchronously registers sample in state-authoritative global AudioEngine hook
      await engine.loadSample(sampleId, arrayBuffer);

      // Mutate lifted workspace channels configuration list
      setChannels((prev) =>
        prev.map((c) =>
          c.id === channelId 
            ? { ...c, name: file.name.replace(/\.[^/.]+$/, ""), sampleId: sampleId, type: "sample" as const }
            : c
        )
      );

      console.log(`Sampler successfully loaded: ${file.name}`);
    } catch (err) {
      console.error("Audio decoding execution exception failure:", err);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFile(file);
    }
  };

  return (
    <div 
      id={`sampler-plugin-${channelId}`} 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col h-full bg-[#0a0b0d] p-3 text-zinc-300 font-mono text-[11px] select-none rounded-none border transition-all duration-200 relative ${
        isDraggingOver 
          ? "border-cyan-400 bg-cyan-950/20 shadow-[0_0_12px_rgba(34,211,238,0.25)]" 
          : "border-neutral-900"
      }`}
    >
      {/* Visual File Hover Alert Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center border-2 border-dashed border-cyan-400 pointer-events-none">
          <Upload className="w-9 h-9 text-cyan-400 mb-2" />
          <span className="text-cyan-400 font-black text-[10px] uppercase tracking-widest leading-none mb-1">Drop Audio Sample Here</span>
          <span className="text-zinc-550 text-[8px]">SUPPORTED: WAV, MP3, AIFF</span>
        </div>
      )}

      {/* 1. PLASMA LCD WAVEFORM DISPLAY BOX */}
      <div className="w-full bg-[#050608] border border-neutral-950 p-2.5 rounded-none shadow-inner relative overflow-hidden mb-3.5 h-20 flex flex-col justify-between">
        {/* Futuristic Background Scanlines */}
        <div className="absolute inset-x-0 top-0 bottom-0 pointer-events-none opacity-[0.04] bg-[linear-gradient(rgba(18,18,18,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] z-10" />
        
        {/* Audio Sample metadata & status bar */}
        <div className="flex items-center justify-between text-[8px] text-zinc-500 font-semibold uppercase tracking-wider select-none z-25 relative">
          <div className="flex items-center gap-1.5 text-cyan-500/80">
            <Waves className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[140px] font-bold">{channelName}</span>
          </div>
          
          <div className="flex items-center gap-2.5">
            <div className="text-zinc-[500] flex items-center gap-1 font-mono text-[8px]">
              <span>START:</span> <span className="text-cyan-400 font-bold">{settings.sampleStart}%</span>
            </div>
            
            {/* Load Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-zinc-900 border border-neutral-800 text-cyan-400 text-[8px] px-1.5 py-0.5 rounded-sm hover:bg-neutral-850 hover:border-neutral-700 hover:text-white cursor-pointer select-none font-bold uppercase tracking-wider flex items-center gap-1 transition-colors font-mono"
              title="Click to browse audio sample file"
            >
              <Upload className="w-2.5 h-2.5 shrink-0" />
              <span>LOAD</span>
            </button>
            <input 
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* HTML5 wave canvas with interactive play audition */}
        <div 
          onClick={handleWaveformClick}
          className={`flex-1 w-full relative flex items-center justify-center mt-1.5 z-0 select-none overflow-hidden h-10 cursor-pointer transition-all duration-100 ${
            isPreviewActive 
              ? "brightness-150 scale-[0.99] shadow-[inset_0_0_12px_rgba(34,211,238,0.55)] bg-cyan-950/20" 
              : "hover:bg-cyan-950/5"
          }`}
          title="Click to audition sample"
        >
          <canvas
            ref={canvasRef}
            width={450}
            height={48}
            className="w-full h-full block pointer-events-none"
          />
        </div>

        {/* Bottom LCD Info Bar */}
        <span className="text-[7.5px] text-zinc-650 font-bold mt-1.5 flex justify-between z-10">
          <span>SAMPLER INTEGRATED ANALYSER</span>
          <span>BUFFER: {loadedBuffer ? "READY" : "OFFLINE"}</span>
        </span>
      </div>

      {/* 2. DENSE HARDWARE CONTROL CONTROLS PANEL */}
      <div className="grid grid-cols-2 gap-3.5 mb-1.5 select-none relative z-10">
        
        {/* A. SAMPLE CORE CONFIG MODULES */}
        <div className="bg-[#101114] border border-neutral-900/80 p-2.5 flex flex-col justify-between">
          <h5 className="text-[8px] text-zinc-500 font-black uppercase tracking-widest border-b border-neutral-850 pb-1 mb-2.5 flex items-center gap-1">
            <span className="w-1 h-1 bg-cyan-400 rounded-full" />
            CORE ANALOCS
          </h5>
          
          <div className="flex items-center justify-around gap-1 pt-1 select-none">
            <Knob
              label="PITCH"
              value={settings.pitch}
              min={-12}
              max={12}
              color="cyan"
              onChange={(v) => updateSetting("pitch", v)}
              title="Symmetric pitch transpose (semitones)"
            />
            <Knob
              label="VOL"
              value={vol}
              min={0}
              max={100}
              color="amber"
              onChange={handleVolChange}
              title="Dual linked master volume"
            />
            <Knob
              label="PAN"
              value={pan}
              min={-50}
              max={50}
              color="cyan"
              onChange={handlePanChange}
              title="Standard stereo pan balance"
            />
            <Knob
              label="OFFSET"
              value={settings.sampleStart}
              min={0}
              max={100}
              color="amber"
              onChange={(v) => updateSetting("sampleStart", v)}
              title="WAV file play start offset"
            />
          </div>

          {/* Digital status readout */}
          <div className="mt-3.5 bg-black/45 border border-zinc-950/20 px-1.5 py-1 text-[7.5px] text-zinc-500 font-bold flex justify-between leading-none uppercase tracking-tighter">
            <span>PTCH: {settings.pitch > 0 ? `+${settings.pitch}` : settings.pitch}</span>
            <span>STRT: {settings.sampleStart}%</span>
          </div>
        </div>

        {/* B. EXPERIMENTAL ADSR FILTER ENVELOPE MODULES (Bypassable) */}
        <div className="bg-[#101114] border border-neutral-900/80 p-2.5 flex flex-col justify-between">
          
          <div className="flex items-center justify-between border-b border-neutral-850 pb-1 mb-2.5 select-none text-[8px] text-zinc-500 font-black tracking-widest">
            <div className="flex items-center gap-1">
              <span className={`w-1 h-1 rounded-full ${settings.envelopeOn ? "bg-amber-400" : "bg-neutral-850"}`} />
              ENVELOPE ADSR
            </div>
            
            {/* POWER ON/OFF SLIDER SWITCH */}
            <button
              onClick={() => updateSetting("envelopeOn", !settings.envelopeOn)}
              className={`px-1.5 py-0.5 text-[7px] font-black uppercase rounded-sm border cursor-pointer transition-all flex items-center gap-1 ${
                settings.envelopeOn 
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/40" 
                  : "bg-black text-zinc-600 border-zinc-850 hover:text-zinc-500"
              }`}
              title="Toggle filter envelope on/off bypass"
            >
              <Power className="w-[8px] h-[8px]" />
              <span>{settings.envelopeOn ? "ON" : "BYP"}</span>
            </button>
          </div>

          {/* ADSR knobs row, dims automatically when bypassed */}
          <div className={`flex items-center justify-around gap-1 pt-1 transition-opacity duration-300 ${
            settings.envelopeOn ? "opacity-100" : "opacity-35 pointer-events-none"
          }`}>
            <Knob
              label="ATTACK"
              value={settings.attack}
              min={0}
              max={100}
              color="cyan"
              onChange={(v) => updateSetting("attack", v)}
              title="Attack time envelope (ms)"
            />
            <Knob
              label="DECAY"
              value={settings.decay}
              min={0}
              max={100}
              color="amber"
              onChange={(v) => updateSetting("decay", v)}
              title="Decay slope time (ms)"
            />
            <Knob
              label="SUST"
              value={settings.sustain}
              min={0}
              max={100}
              color="cyan"
              onChange={(v) => updateSetting("sustain", v)}
              title="Sustain volume percentage"
            />
            <Knob
              label="REL"
              value={settings.release}
              min={0}
              max={100}
              color="amber"
              onChange={(v) => updateSetting("release", v)}
              title="Release tail duration (ms)"
            />
          </div>

          {/* ADSR mini visual timeline graph indicator */}
          <div className="mt-3.5 h-3 flex items-center relative gap-[1.5px] select-none">
            <div className="flex-1 bg-black/45 border border-zinc-950/20 px-1.5 py-1 text-[7.5px] text-zinc-500 font-bold flex justify-between leading-none uppercase tracking-tighter">
              <span>{settings.envelopeOn ? `A:${settings.attack} D:${settings.decay} S:${settings.sustain} R:${settings.release}` : "ENVELOPE IS BYPASSED"}</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
