/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ExportEngine, ExportSettings } from "../audio/ExportEngine";
import { Play, Check, AlertTriangle, Disc, Volume2, HelpCircle } from "lucide-react";
import { useAudioEngine } from "../audio/useAudioEngine";

interface ExportWindowProps {
  onClose: () => void;
  focused?: boolean;
}

export function ExportWindow({ onClose }: ExportWindowProps) {
  const { engine } = useAudioEngine();

  // 1. Interactive Form states matching hardware toggle specifications
  const [format, setFormat] = useState<"wav">("wav");
  const [range, setRange] = useState<"full" | "loop">("full");
  const [normalize, setNormalize] = useState<boolean>(true);
  const [renderTail, setRenderTail] = useState<boolean>(false);
  const [filename, setFilename] = useState<string>(`Canvas_Mix_${engine ? engine.getBpm() : 120}BPM`);

  // 2. Render Pipeline State Machine
  const [renderStatus, setRenderStatus] = useState<"idle" | "rendering" | "success" | "error">("idle");
  const [progress, setProgress] = useState<number>(0);
  const [stats, setStats] = useState<{ duration: number; timeSecs: number } | null>(null);

  const startRender = async () => {
    if (renderStatus === "rendering") return;

    setRenderStatus("rendering");
    setProgress(0);

    const startTime = Date.now();

    try {
      const exportSettings: ExportSettings = {
        format,
        range,
        normalize,
        renderTail,
      };

      console.log("[ExportWindow] Calling renderAudio...");
      // Call genuine offline context renderer
      const renderedBuffer = await ExportEngine.renderAudio(engine, exportSettings);

      // Encode buffer into Wav
      const wavArrayBuffer = ExportEngine.bufferToWav(renderedBuffer);
      const blob = new Blob([wavArrayBuffer], { type: "audio/wav" });
      const downloadUrl = URL.createObjectURL(blob);

      // Premium visual progress bar simulation
      const intervalTime = 30; // ms
      const totalSteps = 45; // ~1.3s visual compile sweep
      let step = 0;

      const timer = setInterval(() => {
        step++;
        const percent = Math.min(100, Math.round((step / totalSteps) * 100));
        setProgress(percent);

        if (percent === 100) {
          clearInterval(timer);

          // Trigger WAV download in browser!
          const link = document.createElement("a");
          link.href = downloadUrl;
          const sanitizedFilename = filename.trim().replace(/[^a-zA-Z0-9_-]/g, "_") || "Canvas_Mix";
          link.download = `${sanitizedFilename}.${format}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Cleanup URL
          setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);

          const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
          setStats({
            duration: Math.round(renderedBuffer.duration),
            timeSecs: parseFloat(timeElapsed),
          });
          setRenderStatus("success");
        }
      }, intervalTime);

    } catch (err) {
      console.error("[ExportWindow] Render process crashed:", err);
      setRenderStatus("error");
    }
  };

  return (
    <div id="export-window-container" className="flex flex-col h-full bg-[#08090b] text-[#eceff4] font-sans p-3 select-none">
      
      {/* Visual Header / Subtitle Info block */}
      <div className="border border-neutral-900/60 bg-[#0d0e11] p-1.5 mb-3 rounded-none flex items-center justify-between border-l-2 border-l-amber-500">
        <div>
          <h4 className="text-[9px] font-black tracking-widest text-zinc-300 uppercase leading-none">
            Offline Audio Bounce Tool
          </h4>
          <span className="text-[7.5px] text-zinc-550 font-medium font-mono">
            ENGINE TYPE: WEB AUDIO OFFLINE EXPORT CORE v0.14.0
          </span>
        </div>
        <div className="flex gap-1.5 items-center">
          <span className={`w-2 h-2 rounded-full ${renderStatus === "rendering" ? "bg-amber-500 animate-ping" : "bg-zinc-800"}`} />
          <span className="font-mono text-[8px] text-zinc-500">BOUNCE TARGET: IDLE</span>
        </div>
      </div>

      <div className="flex-1 space-y-3.5 overflow-y-auto pr-0.5">
        
        {/* Filename Input Card */}
        <div className="bg-[#0f1013] border border-neutral-850 p-2.5 text-left">
          <span className="font-mono text-[8px] text-zinc-550 font-extrabold uppercase tracking-widest block mb-1.5">
            Export Target Filename
          </span>
          <div className="relative flex items-center">
            <input
              id="export-filename-input"
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              disabled={renderStatus === "rendering"}
              placeholder="e.g. My_Awesome_Trap_Beat"
              className="w-full h-9 bg-[#121316] border border-neutral-850 rounded-xs font-mono text-[10px] text-cyan-400 focus:outline-none focus:border-cyan-500/50 shadow-inner px-2.5 transition-all"
            />
            <span className="absolute right-3 font-mono text-[8px] text-zinc-650 font-black select-none uppercase">
              .{format}
            </span>
          </div>
        </div>
        
        {/* Row 1: Exporter format and timeline range selectors */}
        <div className="grid grid-cols-2 gap-3">
          {/* Format Selection Card */}
          <div className="bg-[#0f1013] border border-neutral-850 p-2 text-left">
            <span className="font-mono text-[8px] text-zinc-500 font-extrabold uppercase tracking-widest block mb-1.5">
              Target Container File Format
            </span>
            <div id="export-format-group" className="flex gap-1.5">
              <button
                id="format-button-wav"
                type="button"
                onClick={() => setFormat("wav")}
                disabled={renderStatus === "rendering"}
                className={`flex-1 py-1.5 font-mono text-[9px] font-black uppercase border cursor-pointer transition-all ${
                  format === "wav"
                    ? "bg-amber-500/10 border-amber-500/70 text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                    : "bg-[#111316] border-neutral-80/50 hover:border-zinc-700 text-zinc-500"
                }`}
              >
                .WAV (Uncompressed)
              </button>
              <button
                id="format-button-mp3"
                disabled
                title="MP3 encoding coming soon"
                className="px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider border border-neutral-700 bg-neutral-900 text-neutral-600 cursor-not-allowed opacity-50"
              >
                .MP3 (Coming Soon)
              </button>
            </div>
            <p className="text-[7px] text-zinc-650 leading-normal mt-1.5 font-mono uppercase">
              • 44.1 kHz, 16-bit PCM Dual Waveform
            </p>
          </div>

          {/* Timeline Range Selector */}
          <div className="bg-[#0f1013] border border-neutral-850 p-2 text-left">
            <span className="font-mono text-[8px] text-zinc-500 font-extrabold uppercase tracking-widest block mb-1.5">
              Timeline Export Range
            </span>
            <div id="export-range-group" className="flex gap-1.5">
              <button
                id="range-button-full"
                type="button"
                onClick={() => setRange("full")}
                disabled={renderStatus === "rendering"}
                className={`flex-1 py-1.5 font-mono text-[9px] font-black uppercase border cursor-pointer transition-all ${
                  range === "full"
                    ? "bg-cyan-500/10 border-cyan-500/70 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.2)]"
                    : "bg-[#111316] border-neutral-80/50 hover:border-zinc-700 text-zinc-500"
                }`}
              >
                Full Song
              </button>
              <button
                id="range-button-loop"
                type="button"
                onClick={() => setRange("loop")}
                disabled={renderStatus === "rendering"}
                className={`flex-1 py-1.5 font-mono text-[9px] font-black uppercase border cursor-pointer transition-all ${
                  range === "loop"
                    ? "bg-cyan-500/10 border-cyan-500/70 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.2)]"
                    : "bg-[#111316] border-neutral-80/50 hover:border-zinc-700 text-zinc-500"
                }`}
              >
                Loop Region
              </button>
            </div>
            <p className="text-[7px] text-zinc-650 leading-normal mt-1.5 font-mono uppercase">
              {range === "full" ? "• Renders all active timeline clips" : "• Renders loop boundary marker selections"}
            </p>
          </div>
        </div>

        {/* Row 2: Digital Signal Audio Processing Toggles */}
        <div className="bg-[#0f1013] border border-neutral-850 p-2.5 space-y-2 text-left">
          <span className="font-mono text-[8px] text-zinc-500 font-extrabold uppercase tracking-widest block mb-2 border-b border-zinc-900 pb-1">
            Digital Signal Audio Processing Options
          </span>
          
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="normalize-toggle-btn" className="text-[9px] font-bold text-zinc-300 font-mono block">
                NORMALIZE AUDIO MASTER TO 0dBFS
              </label>
              <span className="text-[7.5px] text-zinc-550 font-mono block">
                Amplifies peak sample value to fill headroom perfectly without clipping
              </span>
            </div>
            <button
              id="normalize-toggle-btn"
              type="button"
              onClick={() => setNormalize(!normalize)}
              disabled={renderStatus === "rendering"}
              className={`px-3 py-1 text-[8.5px] font-bold font-mono tracking-wider border rounded-xs transition-all cursor-pointer ${
                normalize
                  ? "bg-emerald-500/15 border-emerald-500/60 text-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.15)]"
                  : "bg-[#111316] border-neutral-850 text-zinc-600 hover:border-zinc-700"
              }`}
            >
              {normalize ? "ENABLED" : "DISABLED"}
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-zinc-900/60">
            <div>
              <label htmlFor="tail-toggle-btn" className="text-[9px] font-bold text-zinc-300 font-mono block">
                RENDER TAIL (DECAYS REMAINDER)
              </label>
              <span className="text-[7.5px] text-zinc-550 font-mono block">
                Extends sample limit duration to avoid cutting off echo/release tails
              </span>
            </div>
            <button
              id="tail-toggle-btn"
              type="button"
              onClick={() => setRenderTail(!renderTail)}
              disabled={renderStatus === "rendering"}
              className={`px-3 py-1 text-[8.5px] font-bold font-mono tracking-wider border rounded-xs transition-all cursor-pointer ${
                renderTail
                  ? "bg-emerald-500/15 border-emerald-500/60 text-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.15)]"
                  : "bg-[#111316] border-neutral-850 text-zinc-600 hover:border-zinc-700"
              }`}
            >
              {renderTail ? "ENABLED" : "DISABLED"}
            </button>
          </div>
        </div>

        {/* Dynamic Multi-State Rendering Diagnostic LCD Board */}
        <div id="render-diagnostic-lcd" className="bg-[#0b0c0e] border border-neutral-900 p-2.5 rounded-none font-mono text-[8px] space-y-1 text-left min-h-[64px] flex flex-col justify-center">
          
          {renderStatus === "idle" && (
            <div className="flex items-start gap-2">
              <span className="text-amber-500 shrink-0">❖</span>
              <div>
                <p className="text-zinc-400 uppercase font-black tracking-wider leading-none">Export Pipeline Ready for Bounce</p>
                <p className="text-zinc-600 mt-1 uppercase text-[7px] leading-relaxed">
                  Verify master output levels before triggering audio render to prevent gain issues.
                </p>
              </div>
            </div>
          )}

          {renderStatus === "rendering" && (
            <div className="space-y-1.5 w-full">
              <div className="flex justify-between text-amber-400 font-bold uppercase tracking-wider">
                <span className="animate-pulse">Bounce Processing Active...</span>
                <span>{progress}%</span>
              </div>
              <div id="progress-bar-boundary" className="w-full bg-[#14161b] border border-neutral-850 h-2 p-0.5 overflow-hidden">
                <div 
                  id="progress-bar-fill" 
                  className="bg-amber-500 h-full transition-all duration-100 ease-out" 
                  style={{ width: `${progress}%` }} 
                />
              </div>
              <p className="text-[7px] text-zinc-600 uppercase">OFFLINE MULTIPROCESSOR THREAD: COMPRESSING BUFFER SAMPLES</p>
            </div>
          )}

          {renderStatus === "success" && stats && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase tracking-wider">
                <Check className="h-3 w-3" />
                <span>BOUNCE BOUNCED SUCCESSFULLY!</span>
              </div>
              <p className="text-zinc-400 uppercase text-[7px]">
                • Render Duration: {stats.duration} Seconds • Render Elapsed: {stats.timeSecs}s
              </p>
              <p className="text-zinc-600 text-[6.5px] leading-tight uppercase">
                Mock File generated inside temporary application workspace tree. Target layout ready for preview.
              </p>
            </div>
          )}

          {renderStatus === "error" && (
            <div className="space-y-1 text-rose-500">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                <AlertTriangle className="h-3 w-3" />
                <span>Pipeline Rendering Error encountered!</span>
              </div>
              <p className="text-[7.5px] uppercase">Review developer logs or check offline audio context limits.</p>
            </div>
          )}

        </div>

      </div>

      {/* Bounce Call to Action Trigger Section */}
      <div className="mt-3.5 pt-3.5 border-t border-neutral-900 flex gap-2">
        {renderStatus === "success" && (
          <button
            id="dismiss-render-btn"
            type="button"
            onClick={() => setRenderStatus("idle")}
            className="px-3 bg-neutral-900 border border-neutral-850 text-zinc-400 hover:text-zinc-200 uppercase font-black tracking-widest text-[9px] rounded-xs transition-colors cursor-pointer"
          >
            Reset
          </button>
        )}
        <button
          id="render-bounce-action"
          type="button"
          onClick={startRender}
          disabled={renderStatus === "rendering"}
          className={`flex-1 py-2.5 px-4 font-black uppercase text-[10px] tracking-widest rounded-sm transition-all duration-150 cursor-pointer text-center leading-none select-none flex items-center justify-center gap-2 ${
            renderStatus === "rendering"
              ? "bg-[#14161b] border border-neutral-850 text-zinc-650 cursor-not-allowed"
              : "bg-amber-500 text-black shadow-[0_2px_10px_rgba(245,158,11,0.2)] hover:bg-amber-400 hover:shadow-[0_4px_16px_rgba(245,158,11,0.35)] active:scale-[0.982]"
          }`}
        >
          {renderStatus === "rendering" ? (
            <>
              <Disc className="h-3 w-3 animate-spin text-zinc-600" />
              <span>BOUNCE BOUNCING...</span>
            </>
          ) : (
            <>
              <Play className="h-3 w-3 fill-current text-black" />
              <span>Bounce Master Out</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
}
