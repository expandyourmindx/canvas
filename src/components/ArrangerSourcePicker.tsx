/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from "react";
import { Music, Volume2 } from "lucide-react";
import { PatternData, ChannelRow } from "../types";

interface ArrangerSourcePickerProps {
  patterns: PatternData[];
  engine: any;
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
  getActiveSelectionDetails,
  getSampleName,
  handleAudioFileImport,
}: ArrangerSourcePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingFile, setIsDraggingFile] = React.useState(false);

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

  const loadedSampleIds = engine?.getLoadedSampleIds() || [];

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-1/6 min-w-[200px] flex flex-col gap-3 p-2 border transition-all duration-200 select-none overflow-y-auto h-full scrollbar-thin ${
        isDraggingFile
          ? "border-cyan-500 bg-[#16222c]/50 shadow-[inset_0_0_15px_rgba(6,182,212,0.25)] scale-[1.01]"
          : "border-[#1b1c20]/40 bg-black/15"
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

      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full py-2 bg-gradient-to-r from-cyan-600/90 to-cyan-500/90 hover:from-cyan-500 hover:to-cyan-400 text-black text-[9.5px] font-black uppercase tracking-wider transition-all duration-150 rounded-none cursor-pointer flex items-center justify-center gap-1.5 border border-cyan-400 select-none shadow-[0_0_8px_rgba(6,182,212,0.3)] hover:shadow-[0_0_12px_rgba(6,182,212,0.55)] active:scale-[0.98]"
        title="Import custom .wav or .mp3 sample file"
      >
        <span className="text-[12px] leading-none font-sans font-bold">+</span>
        <span>Load Sample File</span>
      </button>

      <div className="border border-neutral-850 bg-[#0c0d10] p-2.5 rounded-none text-left space-y-1 select-none">
        <div className="text-[7.5px] font-mono text-zinc-500 uppercase tracking-widest font-black">
          STAMP CURSOR BUFFER:
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-555 animate-pulse shrink-0 shadow-[0_0_6px_rgba(249,115,22,0.6)]" />
          <div className="text-[9.5px] font-black text-orange-400 uppercase tracking-wide truncate">
            {getActiveSelectionDetails()}
          </div>
        </div>
      </div>

      <div className="text-left space-y-1">
        <h4 className="text-[8.5px] font-mono font-black text-zinc-500 uppercase tracking-widest pl-1">
          Registered Patterns
        </h4>
        <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
          {patterns.map((pat) => {
            const isSelected = selectedClipType === "pattern" && selectedReferenceId === pat.id;
            let activeBorderColor = "border-neutral-850 bg-[#121316] text-neutral-400 hover:bg-[#15171d]";

            if (isSelected) {
              activeBorderColor = "bg-[#181d26] text-cyan-400 border-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.15)]";
            }

            return (
              <button
                key={pat.id}
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
                className={`w-full text-left px-2 py-1.5 border transition-all duration-150 rounded-none cursor-pointer flex justify-between items-center ${activeBorderColor}`}
              >
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <Music className="h-3 w-3 text-indigo-400 shrink-0" />
                  <span className="text-[9.5px] font-black tracking-wide uppercase truncate leading-none mt-0.5">
                    {pat.name}
                  </span>
                </div>
                <span className="text-[7.5px] font-mono bg-black/40 px-1 py-0.5 text-zinc-400">
                  {pat.notes.length} notes
                </span>
              </button>
            );
          })}
          {patterns.length === 0 && (
            <div className="text-zinc-650 text-[9px] font-mono p-2 border border-neutral-850 bg-[#121316] text-center uppercase">
              No Patterns loaded
            </div>
          )}
        </div>
      </div>

      <div className="text-left space-y-1">
        <h4 className="text-[8.5px] font-mono font-black text-zinc-500 uppercase tracking-widest pl-1">
          Audio Samples
        </h4>
        <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
          {loadedSampleIds.map((sampleId) => {
            const isSelected = selectedClipType === "sample" && selectedReferenceId === sampleId;
            let activeBorderColor = "border-neutral-850 bg-[#121316] text-neutral-400 hover:bg-[#15171d]";

            if (isSelected) {
              if (sampleId === "kick_sample") {
                activeBorderColor =
                  "bg-[#181d26] text-emerald-400 border-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.15)]";
              } else if (sampleId === "snare_sample") {
                activeBorderColor =
                  "bg-[#181d26] text-amber-500 border-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.15)]";
              } else {
                activeBorderColor =
                  "bg-[#181d26] text-cyan-400 border-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.15)]";
              }
            }

            return (
              <button
                key={sampleId}
                onClick={() => {
                  setSelectedClipType("sample");
                  setSelectedReferenceId(sampleId);
                  
                  let duration = 1;
                  const buffer = engine?.getSampleBuffer?.(sampleId);
                  if (buffer && engine?.secondsToBeats) {
                    duration = engine.secondsToBeats(buffer.duration);
                  }
                  setClipDurationBeats(duration);
                }}
                onDoubleClick={() => {
                  if (onOpenSampler) {
                    const chan = channels.find((c) => c.sampleId === sampleId || c.id === sampleId);
                    if (chan) {
                      onOpenSampler(chan.id);
                    } else {
                      onOpenWindow?.("sampler");
                    }
                  }
                }}
                className={`w-full text-left px-2 py-1.5 border transition-all duration-150 rounded-none cursor-pointer flex justify-between items-center ${activeBorderColor}`}
              >
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <Volume2 className="h-3 w-3 text-cyan-400 shrink-0" />
                  <span className="text-[9.5px] font-black tracking-wide uppercase truncate leading-none mt-0.5">
                    {getSampleName(sampleId)}
                  </span>
                </div>
                <span className="text-[7.5px] font-mono bg-black/40 px-1 py-0.5 text-zinc-400">
                  1 beat
                </span>
              </button>
            );
          })}
          {loadedSampleIds.length === 0 && (
            <div className="text-zinc-650 text-[9px] font-mono p-2 border border-neutral-850 bg-[#121316] text-center uppercase">
              No Samples loaded
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
