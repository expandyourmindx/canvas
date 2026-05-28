/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import { Music, ChevronRight, ChevronLeft, Upload } from "lucide-react";
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

export function ArrangerSourcePicker({
  patterns,
  channels,
  onOpenPianoRoll,
  selectedClipType,
  setSelectedClipType,
  selectedReferenceId,
  setSelectedReferenceId,
  setClipDurationBeats,
  handleAudioFileImport,
}: ArrangerSourcePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true); // Collapsed by default
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
          <span className="text-[8px] font-black tracking-widest text-zinc-500 uppercase select-none font-mono">
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
                        <span className="text-[6.5px] font-mono bg-black/40 px-1 py-0.5 text-zinc-550 shrink-0">
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
              <div className="text-zinc-600 text-[8.5px] font-mono py-8 px-2 border border-dashed border-neutral-850 bg-[#121316]/10 text-center uppercase tracking-wide">
                No Samples
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
