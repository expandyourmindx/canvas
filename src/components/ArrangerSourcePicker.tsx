/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from "react";
import { Music, ChevronRight, ChevronLeft, Upload, Volume2 } from "lucide-react";
import { PatternData, ChannelRow } from "../types";
import { AudioEngine } from "../audio/AudioEngine";

interface ArrangerSourcePickerProps {
  patterns: PatternData[];
  engine: AudioEngine;
  channels: ChannelRow[];
  onOpenPianoRoll?: (channelId: string) => void;
  onOpenSampler?: (channelId: string) => void;
  onOpenWindow?: (windowId: "pianoroll" | "sequencer" | "sampler" | "obsidian" | "canvas") => void;
  selectedClipType: "pattern" | "sample" | null;
  setSelectedClipType: (type: "pattern" | "sample" | null) => void;
  selectedReferenceId: string;
  setSelectedReferenceId: (id: string) => void;
  setClipDurationBeats: (beats: number) => void;
  getActiveSelectionDetails: () => string;
  getSampleName: (id: string) => string;
  handleAudioFileImport: (file: File) => Promise<void>;
  /** Reactive trigger — changes when new samples are loaded into the engine registry */
  sampleCount?: number;
}

// Reusable mini-waveform preview component that maps audio buffer peaks to canvas
function SampleWaveform({
  sampleId,
  engine,
}: {
  sampleId: string;
  engine: AudioEngine;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const buffer = engine.getSampleBuffer(sampleId);
    const dpr = window.devicePixelRatio || 1;

    // Fixed internal resolution suitable for a mini card
    const widthPx = 130;
    const heightPx = 32;

    canvas.width = widthPx * dpr;
    canvas.height = heightPx * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, widthPx, heightPx);

    if (!buffer) {
      // If buffer is loading/offline, draw a subtle loader dash
      ctx.strokeStyle = "rgba(115, 115, 115, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(10, heightPx / 2);
      ctx.lineTo(widthPx - 10, heightPx / 2);
      ctx.stroke();
      return;
    }

    const channelData = buffer.getChannelData(0);
    const midY = heightPx / 2;
    const ampScale = 0.85;

    ctx.strokeStyle = "rgba(34, 211, 238, 0.85)"; // High-contrast cyan to match Canvas DAW theme
    ctx.lineWidth = 1.0;

    for (let i = 0; i < widthPx; i++) {
      const startIdx = Math.floor((i / widthPx) * channelData.length);
      const endIdx = Math.min(startIdx + Math.ceil(channelData.length / widthPx), channelData.length);

      let min = 0;
      let max = 0;
      let hasData = false;

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

      const yMin = midY + min * (heightPx / 2) * ampScale;
      const yMax = midY + max * (heightPx / 2) * ampScale;

      ctx.beginPath();
      ctx.moveTo(i, yMin);
      ctx.lineTo(i, yMax);
      ctx.stroke();
    }
  }, [sampleId, engine]);

  return <canvas ref={canvasRef} className="w-full h-full pointer-events-none" style={{ height: "32px" }} />;
}

export function ArrangerSourcePicker({
  patterns,
  engine,
  channels,
  onOpenPianoRoll,
  onOpenSampler,
  onOpenWindow,
  selectedClipType,
  setSelectedClipType,
  selectedReferenceId,
  setSelectedReferenceId,
  setClipDurationBeats,
  handleAudioFileImport,
}: ArrangerSourcePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false); // Collapsed by default
  const [activeTab, setActiveTab] = useState<"patterns" | "samples" | "automation">("patterns");

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await handleAudioFileImport(file);
    }
  };

  // Filter for all sample channels currently registered in the channel rack
  const sampleChannels = channels.filter(c => c.type === "sample" || c.instrumentType === "sampler");

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col border border-neutral-850 bg-black/15 transition-all duration-300 ease-in-out select-none overflow-hidden h-full shrink-0 ${
        isCollapsed ? "w-10" : "w-[150px]"
      } ${
        isDraggingFile
          ? "border-cyan-500 bg-[#16222c]/50 shadow-[inset_0_0_15px_rgba(6,182,212,0.25)]"
          : ""
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="audio/*,.wav,.mp3"
        onChange={async (e) => {
          if (e.target.files && e.target.files.length > 0) {
            await handleAudioFileImport(e.target.files[0]);
          }
        }}
      />

      {/* Header Strip */}
      <div className="flex items-center justify-between p-1.5 border-b border-neutral-850 shrink-0 bg-[#0c0d10]">
        {!isCollapsed && (
          <span className="text-[8px] font-black tracking-widest text-zinc-555 uppercase select-none font-mono">
            PICKER
          </span>
        )}
        <div className={`flex items-center gap-1 ${isCollapsed ? "flex-col w-full" : ""}`}>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1 hover:bg-[#1b1c20] text-zinc-400 hover:text-cyan-400 transition-colors rounded-none border border-transparent hover:border-neutral-850 cursor-pointer flex items-center justify-center"
            title="Load Custom Sample File"
          >
            <Upload className="h-3.5 w-3.5" />
          </button>
          
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-[#1b1c20] text-zinc-400 hover:text-cyan-400 transition-colors rounded-none border border-transparent hover:border-neutral-850 cursor-pointer flex items-center justify-center"
            title={isCollapsed ? "Expand Picker Panel" : "Collapse Picker Panel"}
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Three tabs at the top */}
          <div className="flex border-b border-neutral-850 bg-[#0a0b0d] p-0.5 select-none shrink-0 font-mono text-[7.5px] font-bold">
            <button
              onClick={() => setActiveTab("patterns")}
              className={`flex-1 py-1 text-center border-none transition-colors cursor-pointer rounded-none uppercase ${
                activeTab === "patterns"
                  ? "bg-cyan-500/10 text-cyan-400 font-black border-b border-cyan-500"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Patterns
            </button>
            <button
              onClick={() => setActiveTab("samples")}
              className={`flex-1 py-1 text-center border-none transition-colors cursor-pointer rounded-none uppercase ${
                activeTab === "samples"
                  ? "bg-cyan-500/10 text-cyan-400 font-black border-b border-cyan-500"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Samples
            </button>
            <button
              disabled
              className="flex-1 py-1 text-center border-none text-zinc-650 cursor-not-allowed uppercase flex flex-col justify-center items-center opacity-50 relative group"
              title="Coming Soon"
            >
              <span>Auto</span>
              <span className="text-[5px] text-zinc-600 scale-[0.8] leading-none mt-px">SOON</span>
            </button>
          </div>

          {/* Tab contents */}
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
            {activeTab === "patterns" && (
              <div className="space-y-2">
                {patterns.map((pat) => {
                  const isSelected = selectedClipType === "pattern" && selectedReferenceId === pat.id;
                  
                  // Compute note range for mini-preview
                  const pitches = pat.notes.map((n) => n.pitch).filter((p): p is number => p !== undefined);
                  const minPitch = pitches.length > 0 ? Math.min(...pitches) - 1 : 48;
                  const maxPitch = pitches.length > 0 ? Math.max(...pitches) + 1 : 72;
                  const pitchRange = Math.max(12, maxPitch - minPitch);

                  return (
                    <div
                      key={pat.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          "application/json",
                          JSON.stringify({
                            type: "pattern",
                            id: pat.id,
                            name: pat.name,
                          })
                        );
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => {
                        setSelectedClipType("pattern");
                        setSelectedReferenceId(pat.id);
                        setClipDurationBeats(4);
                      }}
                      onDoubleClick={() => {
                        if (onOpenPianoRoll) {
                          const obsChan =
                            channels.find((c) => c.instrumentType === "obsidian" || c.id.startsWith("obsidian")) ||
                            channels[0];
                          if (obsChan) onOpenPianoRoll(obsChan.id);
                        }
                      }}
                      className={`group p-1.5 border transition-all duration-150 rounded-none cursor-pointer flex flex-col gap-1.5 ${
                        isSelected
                          ? "border-cyan-500 bg-[#16222c]/40 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.15)] animate-pulse"
                          : "border-neutral-850 bg-[#121316]/50 text-neutral-400 hover:bg-[#15171d] hover:border-neutral-800"
                      }`}
                      title={`${pat.name} - ${pat.notes.length} notes (Drag to timeline / Click to select tool)`}
                    >
                      {/* Mini Note Preview */}
                      <div className="w-full h-8 relative bg-neutral-950/70 border border-neutral-900/50 overflow-hidden rounded-xs pointer-events-none">
                        {pat.notes.map((note, idx) => {
                          const noteLeftPct = (note.time / 4) * 100;
                          const noteWidthPct = ((note.duration || 0.25) / 4) * 100;
                          const notePitch = note.pitch ?? 60;
                          const topPct = 100 - ((notePitch - minPitch) / pitchRange) * 100;

                          return (
                            <div
                              key={idx}
                              className={`absolute h-[2px] rounded-xs ${
                                isSelected ? "bg-cyan-400 shadow-[0_0_2px_rgba(6,182,212,0.5)]" : "bg-neutral-500/80"
                              }`}
                              style={{
                                left: `${Math.max(0, Math.min(95, noteLeftPct))}%`,
                                width: `${Math.max(4, Math.min(100 - noteLeftPct, noteWidthPct))}%`,
                                top: `${Math.min(85, Math.max(15, topPct))}%`,
                              }}
                            />
                          );
                        })}
                      </div>

                      {/* Pattern Name */}
                      <div className="flex justify-between items-center px-0.5 pointer-events-none">
                        <span className={`text-[8.5px] font-black tracking-wide uppercase truncate leading-none mt-0.5 ${
                          isSelected ? "text-cyan-400 font-black" : "text-neutral-300"
                        }`}>
                          {pat.name}
                        </span>
                        <span className="text-[6.5px] font-mono bg-black/40 px-1 py-0.5 text-zinc-555 shrink-0">
                          {pat.notes.length}N
                        </span>
                      </div>
                    </div>
                  );
                })}
                {patterns.length === 0 && (
                  <div className="text-zinc-650 text-[8.5px] font-mono p-3 border border-neutral-850 bg-[#121316]/30 text-center uppercase">
                    No Patterns
                  </div>
                )}
              </div>
            )}
            
            {activeTab === "samples" && (
              <div className="space-y-2">
                {sampleChannels.map((chan) => {
                  const isSelected = selectedClipType === "sample" && selectedReferenceId === chan.id;
                  const sampleId = chan.sampleId || chan.id;

                  return (
                    <div
                      key={chan.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          "application/json",
                          JSON.stringify({
                            type: "sample",
                            id: chan.id,
                            name: chan.name,
                            path: "",
                          })
                        );
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => {
                        setSelectedClipType("sample");
                        setSelectedReferenceId(chan.id);
                        
                        let duration = 1;
                        const buffer = engine.getSampleBuffer(sampleId);
                        if (buffer) {
                          duration = engine.secondsToBeats(buffer.duration);
                        }
                        setClipDurationBeats(duration);
                      }}
                      onDoubleClick={() => {
                        if (onOpenSampler) {
                          onOpenSampler(chan.id);
                        } else {
                          onOpenWindow?.("sampler");
                        }
                      }}
                      className={`group p-1.5 border transition-all duration-150 rounded-none cursor-pointer flex flex-col gap-1.5 ${
                        isSelected
                          ? "border-cyan-500 bg-[#16222c]/40 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.15)] animate-pulse"
                          : "border-neutral-850 bg-[#121316]/50 text-neutral-400 hover:bg-[#15171d] hover:border-neutral-800"
                      }`}
                      title={`${chan.name} (Drag to timeline / Click to select tool)`}
                    >
                      {/* Waveform Canvas Preview */}
                      <div className="w-full h-8 relative bg-neutral-950/70 border border-neutral-900/50 overflow-hidden rounded-xs pointer-events-none flex items-center justify-center">
                        <SampleWaveform sampleId={sampleId} engine={engine} />
                      </div>

                      {/* Sample Name */}
                      <div className="flex justify-between items-center px-0.5 pointer-events-none">
                        <span className={`text-[8.5px] font-black tracking-wide uppercase truncate leading-none mt-0.5 ${
                          isSelected ? "text-cyan-400 font-black" : "text-neutral-300"
                        }`}>
                          {chan.name}
                        </span>
                        <Volume2 className={`h-3 w-3 shrink-0 ${isSelected ? "text-cyan-400" : "text-zinc-650"}`} />
                      </div>
                    </div>
                  );
                })}
                {sampleChannels.length === 0 && (
                  <div className="text-zinc-650 text-[8.5px] font-mono p-3 border border-neutral-850 bg-[#121316]/30 text-center uppercase">
                    No Samples
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
