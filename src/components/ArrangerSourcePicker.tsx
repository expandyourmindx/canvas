/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from "react";
import { ChevronRight, ChevronLeft, Upload, Volume2 } from "lucide-react";
import { PatternData, ChannelRow } from "../types";
import { AudioEngine } from "../audio/AudioEngine";
import {
  DARK,
  raised,
  sunken,
  flat,
  flush,
  SPACE
} from "../../public/Themes/Vintage Console/tokens";

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
      ctx.strokeStyle = DARK.textDim;
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

    ctx.strokeStyle = DARK.accentBlue; // Accent blue from tokens
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

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "32px",
        pointerEvents: "none",
      }}
    />
  );
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
      style={{
        display: "flex",
        flexDirection: "column",
        width: isCollapsed ? "40px" : "150px",
        height: "100%",
        backgroundColor: isDraggingFile ? DARK.bg5 : DARK.bg2,
        border: "none",
        borderRight: `1px solid ${DARK.bevelMid}`, // flat(DARK) right border
        boxSizing: "border-box",
        flexShrink: 0,
        overflow: "hidden",
        userSelect: "none",
        fontFamily: DARK.font,
      }}
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "space-between",
          padding: `${SPACE.sm}px ${SPACE.md}px`,
          borderBottom: `1px solid ${DARK.bevelDark}`,
          flexShrink: 0,
          backgroundColor: DARK.bg1,
          boxSizing: "border-box",
        }}
      >
        {!isCollapsed && (
          <span
            style={{
              fontSize: "8px",
              fontWeight: "black",
              letterSpacing: "0.15em",
              color: DARK.textDim,
              textTransform: "uppercase",
              userSelect: "none",
              fontFamily: DARK.font,
            }}
          >
            PICKER
          </span>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: `${SPACE.xs}px`,
            flexDirection: isCollapsed ? "column" : "row",
            width: isCollapsed ? "100%" : "auto",
            boxSizing: "border-box",
          }}
        >
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "4px",
              backgroundColor: DARK.bg3,
              color: DARK.textMid,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              boxSizing: "border-box",
              ...raised(DARK),
            }}
            title="Load Custom Sample File"
          >
            <Upload className="h-3.5 w-3.5" />
          </button>
          
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              padding: "4px",
              backgroundColor: DARK.bg3,
              color: DARK.textMid,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              boxSizing: "border-box",
              ...raised(DARK),
            }}
            title={isCollapsed ? "Expand Picker Panel" : "Collapse Picker Panel"}
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Three tabs at the top */}
          <div
            style={{
              display: "flex",
              backgroundColor: DARK.bg1,
              padding: `${SPACE.xs}px`,
              borderBottom: `1px solid ${DARK.bevelDark}`,
              userSelect: "none",
              flexShrink: 0,
              fontFamily: DARK.font,
              fontSize: "8px",
              fontWeight: "bold",
              boxSizing: "border-box",
            }}
          >
            <button
              onClick={() => setActiveTab("patterns")}
              style={{
                flex: 1,
                padding: `${SPACE.sm}px 0`,
                textAlign: "center",
                cursor: "pointer",
                textTransform: "uppercase",
                fontFamily: DARK.font,
                fontSize: "8px",
                fontWeight: activeTab === "patterns" ? "black" : "bold",
                backgroundColor: activeTab === "patterns" ? DARK.bg0 : DARK.bg3,
                color: activeTab === "patterns" ? DARK.textHi : DARK.textDim,
                boxSizing: "border-box",
                border: "none",
                ...(activeTab === "patterns" ? sunken(DARK) : raised(DARK)),
              }}
            >
              Patterns
            </button>
            <button
              onClick={() => setActiveTab("samples")}
              style={{
                flex: 1,
                padding: `${SPACE.sm}px 0`,
                textAlign: "center",
                cursor: "pointer",
                textTransform: "uppercase",
                fontFamily: DARK.font,
                fontSize: "8px",
                fontWeight: activeTab === "samples" ? "black" : "bold",
                backgroundColor: activeTab === "samples" ? DARK.bg0 : DARK.bg3,
                color: activeTab === "samples" ? DARK.textHi : DARK.textDim,
                boxSizing: "border-box",
                border: "none",
                ...(activeTab === "samples" ? sunken(DARK) : raised(DARK)),
              }}
            >
              Samples
            </button>
            <button
              disabled
              style={{
                flex: 1,
                padding: `${SPACE.sm}px 0`,
                textAlign: "center",
                cursor: "not-allowed",
                textTransform: "uppercase",
                fontFamily: DARK.font,
                fontSize: "8px",
                fontWeight: "bold",
                backgroundColor: DARK.bg3,
                color: DARK.textDim,
                opacity: 0.5,
                boxSizing: "border-box",
                border: "none",
                ...raised(DARK),
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
              title="Coming Soon"
            >
              <span>Auto</span>
              <span style={{ fontSize: "5px", color: DARK.textDim, marginTop: "1px" }}>SOON</span>
            </button>
          </div>

          {/* Tab contents */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: `${SPACE.md}px`,
              boxSizing: "border-box",
            }}
          >
            {activeTab === "patterns" && (
              <div style={{ display: "flex", flexDirection: "column", gap: `${SPACE.md}px` }}>
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
                      style={{
                        padding: `${SPACE.md}px`,
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: `${SPACE.sm}px`,
                        backgroundColor: isSelected ? DARK.bg5 : DARK.bg3,
                        boxSizing: "border-box",
                        ...(isSelected ? {
                          ...sunken(DARK),
                          borderLeft: `2px solid ${DARK.accentBlue}`, // left border accent DARK.accentBlue
                        } : raised(DARK)),
                      }}
                      title={`${pat.name} - ${pat.notes.length} notes (Drag to timeline / Click to select tool)`}
                    >
                      {/* Mini Note Preview */}
                      <div
                        style={{
                          width: "100%",
                          height: "32px",
                          position: "relative",
                          backgroundColor: DARK.bg0,
                          overflow: "hidden",
                          pointerEvents: "none",
                          boxSizing: "border-box",
                          ...sunken(DARK),
                        }}
                      >
                        {pat.notes.map((note, idx) => {
                          const noteLeftPct = (note.time / 4) * 100;
                          const noteWidthPct = ((note.duration || 0.25) / 4) * 100;
                          const notePitch = note.pitch ?? 60;
                          const topPct = 100 - ((notePitch - minPitch) / pitchRange) * 100;

                          return (
                            <div
                              key={idx}
                              style={{
                                position: "absolute",
                                height: "2px",
                                backgroundColor: isSelected ? DARK.accentBlue : DARK.textLo,
                                left: `${Math.max(0, Math.min(95, noteLeftPct))}%`,
                                width: `${Math.max(4, Math.min(100 - noteLeftPct, noteWidthPct))}%`,
                                top: `${Math.min(85, Math.max(15, topPct))}%`,
                              }}
                            />
                          );
                        })}
                      </div>

                      {/* Pattern Name */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: `0 ${SPACE.xs}px`,
                          pointerEvents: "none",
                          boxSizing: "border-box",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "8.5px",
                            fontFamily: DARK.font,
                            fontWeight: isSelected ? "black" : "bold",
                            color: isSelected ? DARK.textHi : DARK.textMid,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            lineHeight: "1.0",
                          }}
                        >
                          {pat.name}
                        </span>
                        <span
                          style={{
                            fontSize: "7px",
                            fontFamily: DARK.font,
                            color: DARK.textDim,
                            backgroundColor: DARK.bg0,
                            padding: `2px ${SPACE.sm}px`,
                            boxSizing: "border-box",
                            flexShrink: 0,
                          }}
                        >
                          {pat.notes.length}N
                        </span>
                      </div>
                    </div>
                  );
                })}
                {patterns.length === 0 && (
                  <div
                    style={{
                      color: DARK.textDim,
                      fontSize: "8px",
                      fontFamily: DARK.font,
                      padding: `${SPACE.lg}px`,
                      backgroundColor: DARK.bg1,
                      textAlign: "center",
                      textTransform: "uppercase",
                      boxSizing: "border-box",
                      ...flush(DARK),
                    }}
                  >
                    No Patterns
                  </div>
                )}
              </div>
            )}
            
            {activeTab === "samples" && (
              <div style={{ display: "flex", flexDirection: "column", gap: `${SPACE.md}px` }}>
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
                      style={{
                        padding: `${SPACE.md}px`,
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: `${SPACE.sm}px`,
                        backgroundColor: isSelected ? DARK.bg5 : DARK.bg3,
                        boxSizing: "border-box",
                        ...(isSelected ? {
                          ...sunken(DARK),
                          borderLeft: `2px solid ${DARK.accentBlue}`, // left border accent DARK.accentBlue
                        } : raised(DARK)),
                      }}
                      title={`${chan.name} (Drag to timeline / Click to select tool)`}
                    >
                      {/* Waveform Canvas Preview */}
                      <div
                        style={{
                          width: "100%",
                          height: "32px",
                          position: "relative",
                          backgroundColor: DARK.bg0,
                          overflow: "hidden",
                          pointerEvents: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxSizing: "border-box",
                          ...sunken(DARK),
                        }}
                      >
                        <SampleWaveform sampleId={sampleId} engine={engine} />
                      </div>

                      {/* Sample Name */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: `0 ${SPACE.xs}px`,
                          pointerEvents: "none",
                          boxSizing: "border-box",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "8.5px",
                            fontFamily: DARK.font,
                            fontWeight: isSelected ? "black" : "bold",
                            color: isSelected ? DARK.textHi : DARK.textMid,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            lineHeight: "1.0",
                          }}
                        >
                          {chan.name}
                        </span>
                        <Volume2
                          className="shrink-0"
                          style={{
                            height: "12px",
                            width: "12px",
                            color: isSelected ? DARK.accentBlue : DARK.textDim,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                {sampleChannels.length === 0 && (
                  <div
                    style={{
                      color: DARK.textDim,
                      fontSize: "8px",
                      fontFamily: DARK.font,
                      padding: `${SPACE.lg}px`,
                      backgroundColor: DARK.bg1,
                      textAlign: "center",
                      textTransform: "uppercase",
                      boxSizing: "border-box",
                      ...flush(DARK),
                    }}
                  >
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
