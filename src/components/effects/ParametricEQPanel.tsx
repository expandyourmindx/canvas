import React, { useRef, useState, useEffect } from "react";
import { useAudioEngine } from "../../audio/useAudioEngine";
import { EQBandSettings } from "../../types";
import { Power, Activity, RefreshCw } from "lucide-react";

interface ParametricEQPanelProps {
  insertIndex: number;
  slotIndex: number;
  onClose: () => void;
}

const BAND_COLORS = [
  "#ef4444", // Band 1: Red (Low Cut)
  "#f97316", // Band 2: Orange (Low Shelf)
  "#eab308", // Band 3: Yellow (Peak 1)
  "#22c55e", // Band 4: Green (Peak 2)
  "#06b6d4", // Band 5: Cyan (Peak 3)
  "#3b82f6", // Band 6: Blue (High Shelf)
  "#a855f7", // Band 7: Purple (High Cut)
];

const BAND_LABELS = ["1", "2", "3", "4", "5", "6", "7"];

const FREQ_GRID = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const GAIN_GRID = [12, 6, 0, -6, -12];

export function ParametricEQPanel({ insertIndex, slotIndex, onClose }: ParametricEQPanelProps) {
  const { engine, updateInsertEQBand } = useAudioEngine();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [selectedBandIdx, setSelectedBandIdx] = useState<number>(2); // Default to Band 3 (500Hz)
  const [draggedBandIdx, setDraggedBandIdx] = useState<number | null>(null);

  // Local state to force trigger re-renders when bands change
  const [bandsState, setBandsState] = useState<EQBandSettings[]>([]);

  // Get active insert and EQ instances
  const insert = engine.getOrCreateMixerInsert(insertIndex);
  const eqInstance = (insert as any).fxInstances?.[slotIndex];

  // Refresh bands local state on mount and updates
  useEffect(() => {
    if (eqInstance) {
      setBandsState([...eqInstance.bands]);
    }
  }, [eqInstance]);

  // Logarithmic X coordinate converter: maps Hz to canvas pixel X
  const hzToX = (hz: number, width: number) => {
    const minL = Math.log10(20);
    const maxL = Math.log10(20000);
    const hzL = Math.log10(Math.max(20, Math.min(20000, hz)));
    return width * ((hzL - minL) / (maxL - minL));
  };

  // Reverse mapping: maps canvas pixel X to Hz
  const xToHz = (x: number, width: number) => {
    const minL = Math.log10(20);
    const maxL = Math.log10(20000);
    const fraction = x / width;
    const hzL = minL + fraction * (maxL - minL);
    return Math.round(Math.pow(10, hzL));
  };

  // Linear Y coordinate converter: maps Gain dB to canvas pixel Y
  const gainToY = (gain: number, height: number) => {
    // Range is [-18, +18]
    const fraction = 0.5 - (gain / 36);
    return height * Math.max(0, Math.min(1, fraction));
  };

  // Reverse mapping: maps canvas pixel Y to Gain dB
  const yToGain = (y: number, height: number) => {
    const fraction = y / height;
    const gain = (0.5 - fraction) * 36;
    return Math.max(-18, Math.min(18, Math.round(gain * 10) / 10));
  };

  // Draw loop for Spectrum Analyzer + EQ Grid/Curve/Points
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !engine || !eqInstance) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyser = insert.analyserNode;
    const bufferLength = analyser ? analyser.frequencyBinCount : 512;
    const dataArray = new Uint8Array(bufferLength);

    const sampleRate = analyser?.context.sampleRate || 44100;
    const numBars = 64; // High density bars for background
    const barWidth = canvas.width / numBars;

    // Logarithmic FFT mapping
    const minHz = 25;
    const maxHz = 19000;
    const binIndices = new Int32Array(numBars);
    for (let i = 0; i < numBars; i++) {
      const targetHz = minHz * Math.pow(maxHz / minHz, i / (numBars - 1));
      const binIndex = Math.min(
        bufferLength - 1,
        Math.max(0, Math.round((targetHz * (analyser?.fftSize || 1024)) / sampleRate))
      );
      binIndices[i] = binIndex;
    }

    // Set up frequencies for combined curve response mapping
    const numCurvePoints = 240;
    const curveFrequencies = new Float32Array(numCurvePoints);
    for (let i = 0; i < numCurvePoints; i++) {
      curveFrequencies[i] = 20 * Math.pow(20000 / 20, i / (numCurvePoints - 1));
    }
    const magResponse = new Float32Array(numCurvePoints);

    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      const W = canvas.width;
      const H = canvas.height;

      // 1. Draw solid dark background (trailing motion blur)
      ctx.fillStyle = "rgba(10, 11, 14, 0.35)";
      ctx.fillRect(0, 0, W, H);

      // 2. Draw Real-time Spectrum Analyzer behind
      if (analyser && !insert.isMuted) {
        analyser.getByteFrequencyData(dataArray);
        for (let i = 0; i < numBars; i++) {
          const binIndex = binIndices[i];
          const val = dataArray[binIndex] || 0;
          const amplitude = val / 255;
          const boost = 1 + (i / numBars) * 0.5; // High-end visual compensation
          const barHeight = Math.min(H, amplitude * H * 0.9 * boost);

          const grad = ctx.createLinearGradient(0, H, 0, H - barHeight);
          grad.addColorStop(0, "rgba(6, 182, 212, 0.03)"); // Cyan soft base
          grad.addColorStop(1, "rgba(52, 211, 153, 0.18)"); // Emerald glowing top

          ctx.fillStyle = grad;
          ctx.fillRect(i * barWidth, H - barHeight, barWidth - 1, barHeight);
        }
      }

      // 3. Draw Grid Lines & Labels
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      ctx.font = "8px monospace";
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";

      // Frequency Grid Lines (Logarithmic)
      FREQ_GRID.forEach(hz => {
        const x = hzToX(hz, W);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();

        // Label
        const lbl = hz >= 1000 ? `${hz / 1000}kHz` : `${hz}Hz`;
        ctx.fillText(lbl, x + 3, H - 6);
      });

      // Gain Grid Lines (Linear)
      GAIN_GRID.forEach(g => {
        const y = gainToY(g, H);
        
        ctx.strokeStyle = g === 0 ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.04)";
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();

        // Label
        const lbl = g > 0 ? `+${g}dB` : `${g}dB`;
        ctx.fillText(lbl, 6, y - 4);
      });

      // 4. Calculate and Draw Cumulative EQ Curve Response
      eqInstance.getFrequencyResponseData(curveFrequencies, magResponse);

      ctx.beginPath();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#34d399"; // High-fidelity emerald curve
      ctx.shadowColor = "#34d399";
      ctx.shadowBlur = 6;

      for (let i = 0; i < numCurvePoints; i++) {
        const mag = magResponse[i];
        const db = 20 * Math.log10(Math.max(0.0001, mag));
        const y = gainToY(db, H);
        const x = (i / (numCurvePoints - 1)) * W;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset shadow glow

      // 5. Draw Draggable Control Points
      eqInstance.bands.forEach((band: EQBandSettings, idx: number) => {
        const x = hzToX(band.frequency, W);
        const y = gainToY(band.bypass ? 0 : band.gain, H);
        const isSelected = selectedBandIdx === idx;
        const color = BAND_COLORS[idx];

        // Draw outer selector ring if focused/selected
        if (isSelected) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, 9, 0, 2 * Math.PI);
          ctx.stroke();
        }

        // Draw solid band circle
        ctx.fillStyle = band.bypass ? "rgba(71, 85, 105, 0.8)" : color;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fill();

        // Draw band identifier label text
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(BAND_LABELS[idx], x, y + 0.5);
      });
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [engine, eqInstance, selectedBandIdx, insert]);

  // Pointer move dragging calculations
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !eqInstance) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const W = canvas.width;
    const H = canvas.height;

    // Check click hit distance against all 7 band points
    let hitIndex: number | null = null;
    let minDistance = 250; // Maximum hit radius squared (15px)

    eqInstance.bands.forEach((band: EQBandSettings, idx: number) => {
      const bx = hzToX(band.frequency, W);
      const by = gainToY(band.bypass ? 0 : band.gain, H);
      const dist = Math.pow(x - bx, 2) + Math.pow(y - by, 2);
      if (dist < minDistance) {
        minDistance = dist;
        hitIndex = idx;
      }
    });

    if (hitIndex !== null) {
      setSelectedBandIdx(hitIndex);
      setDraggedBandIdx(hitIndex);
      canvas.setPointerCapture(e.pointerId);
      e.stopPropagation();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggedBandIdx === null || !eqInstance) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(canvas.height, e.clientY - rect.top));

    const targetHz = xToHz(x, canvas.width);
    const targetBand = eqInstance.bands[draggedBandIdx];
    
    // Check if type permits gain adjustment (cuts/notch/bandpass generally don't adjust gain)
    const hasGain = !["lowcut", "highcut", "notch", "bandpass"].includes(targetBand.type);
    const targetGain = hasGain ? yToGain(y, canvas.height) : 0;

    updateInsertEQBand(insertIndex, slotIndex, draggedBandIdx, {
      frequency: targetHz,
      gain: targetGain,
    });

    // Refresh state
    setBandsState([...eqInstance.bands]);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggedBandIdx !== null) {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.releasePointerCapture(e.pointerId);
      }
      setDraggedBandIdx(null);
    }
  };

  // Wheel adjusts bandwidth Q factor
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!eqInstance) return;

    // Detect if hovering over a band, or fallback to active selected band
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const W = canvas.width;
    const H = canvas.height;

    let hoverIdx = selectedBandIdx;
    let minDistance = 400; // Hover hit squared radius (20px)

    eqInstance.bands.forEach((band: EQBandSettings, idx: number) => {
      const bx = hzToX(band.frequency, W);
      const by = gainToY(band.bypass ? 0 : band.gain, H);
      const dist = Math.pow(x - bx, 2) + Math.pow(y - by, 2);
      if (dist < minDistance) {
        minDistance = dist;
        hoverIdx = idx;
      }
    });

    // Adjust Q factor: scrolling UP decreases Q (widens band), scrolling DOWN increases Q (sharpens band)
    const delta = e.deltaY > 0 ? 0.15 : -0.15;
    const activeQ = eqInstance.bands[hoverIdx].q;
    const nextQ = Math.max(0.1, Math.min(24.0, Math.round((activeQ + delta) * 100) / 100));

    updateInsertEQBand(insertIndex, slotIndex, hoverIdx, { q: nextQ });
    setBandsState([...eqInstance.bands]);
    
    // Prevent document scrolling
    e.preventDefault();
  };

  const activeBand = bandsState[selectedBandIdx] || (eqInstance ? eqInstance.bands[selectedBandIdx] : null);

  if (!eqInstance || !activeBand) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 font-mono py-20 gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
        <span>Instantiating parametric EQ hardware...</span>
      </div>
    );
  }

  const isGainDisabled = ["lowcut", "highcut", "notch", "bandpass"].includes(activeBand.type);

  return (
    <div className="flex flex-col h-full bg-[#0d0e12] select-none p-1 font-mono text-[10px] text-zinc-300">
      
      {/* 1. Curve Grid Display Area */}
      <div className="relative border border-neutral-850 h-56 bg-zinc-950/80 rounded-none overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          width="600"
          height="224"
          className="w-full h-full cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
        />
        
        {/* Helper instructions overlay */}
        <div className="absolute top-2 right-2 text-[7.5px] text-zinc-600 bg-black/60 px-2 py-0.5 rounded-none border border-neutral-900 pointer-events-none select-none uppercase tracking-wider">
          Drag Point = Freq / Gain • Wheel = Q Factor
        </div>
      </div>

      {/* 2. Hardware Controls Block */}
      <div className="flex gap-2.5 mt-2 flex-1 items-stretch min-h-0 select-none">
        
        {/* A. 7-Band Matrix selector deck */}
        <div className="w-40 border border-neutral-850 bg-black/35 p-2 flex flex-col gap-1 rounded-none justify-between">
          <div className="text-[8px] text-zinc-550 border-b border-neutral-850/50 pb-1 mb-1 font-extrabold uppercase tracking-widest text-center">
            Band Selectors
          </div>
          <div className="grid grid-cols-7 gap-1">
            {bandsState.map((band, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedBandIdx(idx)}
                className={`h-7 flex flex-col items-center justify-center rounded-none border text-[10px] font-black cursor-pointer transition-all ${
                  selectedBandIdx === idx
                    ? "bg-zinc-800 border-zinc-300 text-white shadow-inner"
                    : band.bypass
                      ? "bg-neutral-950 border-neutral-900 text-zinc-700"
                      : "bg-[#16171d]/60 border-neutral-800 hover:border-zinc-700 hover:bg-[#1f202a]"
                }`}
                style={{ borderTopColor: selectedBandIdx === idx ? BAND_COLORS[idx] : undefined, borderTopWidth: selectedBandIdx === idx ? 2 : undefined }}
                title={`Select Band ${idx + 1}`}
              >
                <div style={{ color: band.bypass ? "#475569" : BAND_COLORS[idx] }}>{idx + 1}</div>
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 mt-2">
            <button
              onClick={() => {
                updateInsertEQBand(insertIndex, slotIndex, selectedBandIdx, { bypass: !activeBand.bypass });
                setBandsState([...eqInstance.bands]);
              }}
              className={`flex-1 h-6.5 flex items-center justify-center gap-1 cursor-pointer font-extrabold tracking-wider border rounded-none text-[8.5px] uppercase ${
                activeBand.bypass
                  ? "bg-red-500/10 border-red-500/30 text-red-500"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15"
              }`}
            >
              <Power className="h-3 w-3" />
              <span>{activeBand.bypass ? "BYPASS" : "ACTIVE"}</span>
            </button>
          </div>
        </div>

        {/* B. Parameter Adjustment Dashboard */}
        <div className="flex-1 border border-neutral-850 bg-black/35 p-2.5 rounded-none flex flex-col gap-2 relative">
          <div className="text-[8px] text-zinc-550 border-b border-neutral-850/50 pb-1 font-extrabold uppercase tracking-widest flex justify-between">
            <span>Band {selectedBandIdx + 1} Parameters</span>
            <span style={{ color: BAND_COLORS[selectedBandIdx] }} className="font-black">
              {activeBand.type.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 flex-1 items-center">
            {/* 1. Band Type Selector */}
            <div className="flex flex-col gap-1 select-none">
              <label className="text-[7.5px] text-zinc-550 font-bold uppercase tracking-wider">Filter Type</label>
              <select
                value={activeBand.type}
                onChange={(e) => {
                  const type = e.target.value as any;
                  const hasGain = !["lowcut", "highcut", "notch", "bandpass"].includes(type);
                  updateInsertEQBand(insertIndex, slotIndex, selectedBandIdx, {
                    type,
                    gain: hasGain ? activeBand.gain : 0
                  });
                  setBandsState([...eqInstance.bands]);
                }}
                className="h-6.5 bg-[#121316] border border-neutral-800 rounded-none text-zinc-300 text-[9px] uppercase px-1 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="lowcut">Low Cut (Highpass)</option>
                <option value="lowshelf">Low Shelf</option>
                <option value="peaking">Peak (Bell)</option>
                <option value="highshelf">High Shelf</option>
                <option value="highcut">High Cut (Lowpass)</option>
                <option value="notch">Notch</option>
                <option value="bandpass">Band Pass</option>
              </select>
            </div>

            {/* 2. Frequency Control */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-baseline text-[7.5px] text-zinc-550 font-bold uppercase tracking-wider">
                <span>Frequency</span>
                <span className="text-zinc-400 font-mono">
                  {activeBand.frequency >= 1000
                    ? `${(activeBand.frequency / 1000).toFixed(2)} kHz`
                    : `${activeBand.frequency} Hz`}
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="20000"
                value={activeBand.frequency}
                onChange={(e) => {
                  updateInsertEQBand(insertIndex, slotIndex, selectedBandIdx, { frequency: Number(e.target.value) });
                  setBandsState([...eqInstance.bands]);
                }}
                className="w-full accent-emerald-400 bg-neutral-900 border border-neutral-850 h-1.5 rounded-none cursor-ew-resize"
              />
            </div>

            {/* 3. Gain and Q factors */}
            <div className="flex gap-2">
              {/* Gain */}
              <div className="flex-1 flex flex-col gap-1">
                <div className="flex justify-between items-baseline text-[7.5px] text-zinc-550 font-bold uppercase tracking-wider">
                  <span>Gain</span>
                  <span className={`font-mono ${isGainDisabled ? "text-zinc-650" : "text-zinc-400"}`}>
                    {isGainDisabled ? "0.0dB" : `${activeBand.gain > 0 ? "+" : ""}${activeBand.gain.toFixed(1)}dB`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-18"
                  max="18"
                  step="0.1"
                  disabled={isGainDisabled}
                  value={activeBand.gain}
                  onChange={(e) => {
                    updateInsertEQBand(insertIndex, slotIndex, selectedBandIdx, { gain: Number(e.target.value) });
                    setBandsState([...eqInstance.bands]);
                  }}
                  className={`w-full h-1.5 rounded-none cursor-ew-resize ${
                    isGainDisabled
                      ? "accent-zinc-700 bg-neutral-950/20 opacity-30 cursor-not-allowed"
                      : "accent-indigo-400 bg-neutral-900 border border-neutral-850"
                  }`}
                />
              </div>

              {/* Q Factor */}
              <div className="flex-1 flex flex-col gap-1">
                <div className="flex justify-between items-baseline text-[7.5px] text-zinc-550 font-bold uppercase tracking-wider">
                  <span>Band Q</span>
                  <span className="text-zinc-400 font-mono">{activeBand.q.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="15.0"
                  step="0.05"
                  value={activeBand.q}
                  onChange={(e) => {
                    updateInsertEQBand(insertIndex, slotIndex, selectedBandIdx, { q: Number(e.target.value) });
                    setBandsState([...eqInstance.bands]);
                  }}
                  className="w-full accent-cyan-400 bg-neutral-900 border border-[#1d1f25] h-1.5 rounded-none cursor-ew-resize"
                />
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
