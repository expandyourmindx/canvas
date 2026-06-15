import React, { useRef, useState, useEffect } from "react";
import { useAudioEngine } from "../../audio/useAudioEngine";
import { EQBandSettings } from "../../types";
import { useTheme, DARK, raised, sunken, flat, flush, SPACE, SIZE } from "../../theme/ThemeContext";

interface ParametricEQPanelProps {
  insertIndex: number;
  slotIndex: number;
  onClose: () => void;
}

const BAND_COLORS = [
  DARK.accentOrange, // Band 1: Orange
  DARK.accentMaster, // Band 2: Amber (Master Accent)
  DARK.accentMaster, // Band 3: Amber (Master Accent)
  DARK.accentGreen,  // Band 4: Green
  DARK.accentBlue,   // Band 5: Blue
  DARK.accentBlue,   // Band 6: Blue
  DARK.accentPurple, // Band 7: Purple
];

const BAND_LABELS = ["1", "2", "3", "4", "5", "6", "7"];

const FREQ_GRID = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const GAIN_GRID = [12, 6, 0, -6, -12];

const DEFAULT_BAND_PARAMS = [
  { frequency: 80, q: 0.707, gain: 0 },
  { frequency: 200, q: 0.707, gain: 0 },
  { frequency: 500, q: 1.0, gain: 0 },
  { frequency: 1000, q: 1.0, gain: 0 },
  { frequency: 4000, q: 1.0, gain: 0 },
  { frequency: 8000, q: 0.707, gain: 0 },
  { frequency: 16000, q: 0.707, gain: 0 },
];

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface EQKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  disabled?: boolean;
  dotColor: string;
  formatValue: (v: number) => string;
  onChange: (val: number) => void;
}

function EQKnob({
  label,
  value,
  min,
  max,
  defaultValue,
  disabled = false,
  dotColor,
  formatValue,
  onChange,
}: EQKnobProps) {
  const { theme: DARK, raised, sunken, flat, flush, SPACE, SIZE } = useTheme();
  const knobRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    if (e.altKey && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      onChange(defaultValue);
      return;
    }
    e.preventDefault();
    isDragging.current = true;
    startY.current = e.clientY;
    startValue.current = value;
    knobRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const deltaY = startY.current - e.clientY; // drag up increases
    const range = max - min;
    const dragDistance = 150; // pixels for full sweep
    const valueDelta = (deltaY / dragDistance) * range;
    let newValue = startValue.current + valueDelta;
    newValue = Math.max(min, Math.min(max, newValue));

    if (label === "FREQUENCY") {
      newValue = Math.round(newValue);
    } else if (label === "GAIN") {
      newValue = Math.round(newValue * 10) / 10;
    } else if (label === "BAND Q") {
      newValue = Math.round(newValue * 100) / 100;
    }

    onChange(newValue);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging.current) {
      isDragging.current = false;
      knobRef.current?.releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (disabled) return;
    e.preventDefault();
    const dir = e.deltaY > 0 ? -1 : 1;
    let step = 1;
    if (label === "FREQUENCY") {
      step = value >= 1000 ? 100 : 10;
    } else if (label === "GAIN") {
      step = 0.5;
    } else if (label === "BAND Q") {
      step = 0.05;
    }
    const newValue = Math.max(min, Math.min(max, value + dir * step));
    onChange(newValue);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    onChange(defaultValue);
  };

  // Convert value to degrees for rotation (sweep from -135deg to +135deg)
  const percent = (value - min) / (max - min);
  const angleDeg = -135 + percent * 270;
  const angleRad = (angleDeg * Math.PI) / 180;
  
  // Size-specific dimensions for knobMd (26px)
  const knobSize = SIZE.knobMd; // 26px
  const cx = knobSize / 2; // 13
  const cy = knobSize / 2; // 13
  const R = 8;
  const dotX = cx + R * Math.sin(angleRad);
  const dotY = cy - R * Math.cos(angleRad);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", userSelect: "none" }}>
      {/* Label above */}
      <span
        style={{
          fontFamily: DARK.font,
          fontSize: "7px",
          color: disabled ? DARK.textDim : DARK.textLo,
          fontWeight: "bold",
          textTransform: "uppercase",
          marginBottom: `${SPACE.xs}px`,
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>

      {/* Knob Body */}
      <div
        ref={knobRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        style={{
          width: `${knobSize}px`,
          height: `${knobSize}px`,
          borderRadius: "50%",
          backgroundColor: disabled ? DARK.bg4 : DARK.knobBody,
          position: "relative",
          cursor: disabled ? "not-allowed" : "ns-resize",
          boxSizing: "border-box",
          ...raised(DARK),
        }}
        title={`${label}: ${formatValue(value)}${disabled ? " (Disabled)" : " (Double-click to reset)"}`}
      >
        {/* Highlight Ellipse */}
        {!disabled && (
          <div
            style={{
              position: "absolute",
              top: "2px",
              left: "2px",
              width: "10px",
              height: "5px",
              borderRadius: "50%",
              backgroundColor: DARK.knobHighlight,
              transform: "rotate(-30deg)",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Indicator Dot */}
        {!disabled && (
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            <circle cx={dotX} cy={dotY} r={1.5} fill={dotColor} />
          </svg>
        )}
      </div>

      {/* LCD Readout below */}
      <div
        style={{
          marginTop: `${SPACE.sm}px`,
          width: "64px",
          height: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: DARK.bg0,
          boxSizing: "border-box",
          padding: `0 ${SPACE.xs}px`,
          ...sunken(DARK),
        }}
      >
        <span
          style={{
            fontFamily: DARK.font,
            fontSize: "8px",
            color: disabled ? DARK.textDim : DARK.lcdText,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {formatValue(value)}
        </span>
      </div>
    </div>
  );
}

export function ParametricEQPanel({ insertIndex, slotIndex, onClose }: ParametricEQPanelProps) {
  const { theme: DARK, raised, sunken, flat, flush, SPACE, SIZE } = useTheme();
  const { engine, updateInsertEQBand } = useAudioEngine();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  
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

  useEffect(() => {
    const container = canvasContainerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const syncSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);
      if (w === 0 || h === 0) return;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.scale(dpr, dpr);
      }
    };

    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

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

      const W = canvas.width / (window.devicePixelRatio || 1);
      const H = canvas.height / (window.devicePixelRatio || 1);
      const barWidth = W / numBars;

      // 1. Draw solid dark background (trailing motion blur)
      ctx.fillStyle = hexToRgba(DARK.bg0, 0.35);
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
          grad.addColorStop(0, hexToRgba(DARK.accentBlue, 0.02)); // accentBlue soft base
          grad.addColorStop(1, hexToRgba(DARK.accentBlue, 0.15)); // accentBlue top

          ctx.fillStyle = grad;
          ctx.fillRect(i * barWidth, H - barHeight, barWidth - 1, barHeight);
        }
      }

      // 3. Draw Grid Lines & Labels
      ctx.strokeStyle = DARK.bevelDark;
      ctx.lineWidth = 1;
      ctx.font = `7px ${DARK.font}`;
      ctx.fillStyle = DARK.textDim;
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";

      // Frequency Grid Lines (Logarithmic)
      FREQ_GRID.forEach(hz => {
        const x = hzToX(hz, W);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();

        // Label
        const lbl = hz >= 1000 ? `${hz / 1000}KHZ` : `${hz}HZ`;
        ctx.fillText(lbl, x + 3, H - 6);
      });

      // Gain Grid Lines (Linear)
      GAIN_GRID.forEach(g => {
        const y = gainToY(g, H);
        
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();

        // Label
        const lbl = g > 0 ? `+${g}DB` : `${g}DB`;
        ctx.fillText(lbl, 6, y - 4);
      });

      // 4. Calculate and Draw Cumulative EQ Curve Response
      eqInstance.getFrequencyResponseData(curveFrequencies, magResponse);

      // Path for fill
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let i = 0; i < numCurvePoints; i++) {
        const mag = magResponse[i];
        const db = 20 * Math.log10(Math.max(0.0001, mag));
        const y = gainToY(db, H);
        const x = (i / (numCurvePoints - 1)) * W;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(DARK.accentBlue, 0.1);
      ctx.fill();

      // Path for stroke
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = DARK.accentBlue;

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

      // 5. Draw Draggable Control Points
      eqInstance.bands.forEach((band: EQBandSettings, idx: number) => {
        const x = hzToX(band.frequency, W);
        const y = gainToY(band.bypass ? 0 : band.gain, H);
        const isSelected = selectedBandIdx === idx;
        const color = BAND_COLORS[idx];

        // Draw outer selector ring if focused/selected
        if (isSelected) {
          ctx.strokeStyle = DARK.bevelLight;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, 9, 0, 2 * Math.PI);
          ctx.stroke();
        }

        // Draw solid band circle
        ctx.fillStyle = band.bypass ? hexToRgba(DARK.textDim, 0.8) : color;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fill();

        // Draw band identifier label text
        ctx.fillStyle = DARK.bg0;
        ctx.font = `bold 7px ${DARK.font}`;
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
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check click hit distance against all 7 band points
    let hitIndex: number | null = null;
    let minDistance = 250; // Maximum hit radius squared (15px)

    eqInstance.bands.forEach((band: EQBandSettings, idx: number) => {
      const bx = hzToX(band.frequency, cssW);
      const by = gainToY(band.bypass ? 0 : band.gain, cssH);
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
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    const x = Math.max(0, Math.min(cssW, e.clientX - rect.left));
    const y = Math.max(0, Math.min(cssH, e.clientY - rect.top));

    const targetHz = xToHz(x, cssW);
    const targetBand = eqInstance.bands[draggedBandIdx];
    
    // Check if type permits gain adjustment (cuts/notch/bandpass generally don't adjust gain)
    const hasGain = !["lowcut", "highcut", "notch", "bandpass"].includes(targetBand.type);
    const targetGain = hasGain ? yToGain(y, cssH) : 0;

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
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let hoverIdx = selectedBandIdx;
    let minDistance = 400; // Hover hit squared radius (20px)

    eqInstance.bands.forEach((band: EQBandSettings, idx: number) => {
      const bx = hzToX(band.frequency, cssW);
      const by = gainToY(band.bypass ? 0 : band.gain, cssH);
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
      <div 
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          backgroundColor: DARK.bg2,
          fontFamily: DARK.font,
          color: DARK.textDim,
          textTransform: "uppercase"
        }}
      >
        <span>Instantiating parametric EQ...</span>
      </div>
    );
  }

  const isGainDisabled = ["lowcut", "highcut", "notch", "bandpass"].includes(activeBand.type);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: DARK.bg2,
        color: DARK.textMid,
        fontFamily: DARK.font,
        fontSize: "10px",
        userSelect: "none",
        padding: `${SPACE.sm}px`,
        boxSizing: "border-box",
      }}
    >
      
      {/* 1. Curve Grid Display Area */}
      <div
        ref={canvasContainerRef}
        style={{
          position: "relative",
          height: "60%",
          backgroundColor: DARK.bg0,
          boxSizing: "border-box",
          overflow: "hidden",
          ...sunken(DARK),
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", cursor: "crosshair", display: "block" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
        />
        
        {/* Helper instructions overlay */}
        <div
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            fontFamily: DARK.font,
            fontSize: "7px",
            color: DARK.textDim,
            backgroundColor: hexToRgba(DARK.bg0, 0.75),
            padding: `${SPACE.xs}px ${SPACE.sm}px`,
            pointerEvents: "none",
            userSelect: "none",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            ...flush(DARK)
          }}
        >
          Drag Point = Freq / Gain • Wheel = Q Factor
        </div>
      </div>

      {/* 2. Bottom section — restructured into two columns */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: `${SPACE.sm}px`,
          marginTop: `${SPACE.sm}px`,
          height: "calc(40% - 4px)",
          minHeight: "0",
        }}
      >
        
        {/* Left column — BAND SELECTORS + ACTIVE */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "180px",
            backgroundColor: DARK.bg1,
            padding: `${SPACE.md}px`,
            boxSizing: "border-box",
            ...flat(DARK),
          }}
        >
          {/* Band selectors block */}
          <div style={{ display: "flex", flexDirection: "column", gap: `${SPACE.sm}px` }}>
            <span
              style={{
                fontFamily: DARK.font,
                fontSize: "7px",
                color: DARK.textMid,
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Band Selectors
            </span>
            <div style={{ display: "flex", gap: "2px", flexWrap: "wrap" }}>
              {bandsState.map((band, idx) => {
                const isSelected = selectedBandIdx === idx;
                const accentColor = BAND_COLORS[idx];
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedBandIdx(idx)}
                    style={{
                      width: "22px",
                      height: "22px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: DARK.font,
                      fontSize: "9px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      borderRadius: 0,
                      boxSizing: "border-box",
                      border: "none",
                      ...(isSelected
                        ? {
                            ...sunken(DARK),
                            backgroundColor: DARK.bg0,
                            color: accentColor,
                          }
                        : {
                            ...raised(DARK),
                            backgroundColor: DARK.bg3,
                            color: DARK.textMid,
                          }),
                    }}
                    title={`Select Band ${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ACTIVE button */}
          <button
            onClick={() => {
              updateInsertEQBand(insertIndex, slotIndex, selectedBandIdx, { bypass: !activeBand.bypass });
              setBandsState([...eqInstance.bands]);
            }}
            style={{
              height: "22px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: DARK.font,
              fontSize: "8px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              cursor: "pointer",
              borderRadius: 0,
              boxSizing: "border-box",
              border: "none",
              ...raised(DARK),
              backgroundColor: DARK.bg3,
              color: activeBand.bypass ? DARK.textDim : DARK.stateGreen,
            }}
          >
            ACTIVE
          </button>
        </div>

        {/* Right column — BAND PARAMETERS */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            gap: `${SPACE.sm}px`,
            padding: `${SPACE.md}px`,
            backgroundColor: DARK.bg1,
            boxSizing: "border-box",
            ...flat(DARK),
          }}
        >
          {/* Header Row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: `1px solid ${DARK.bevelDark}`,
              paddingBottom: `${SPACE.sm}px`,
              marginBottom: `${SPACE.sm}px`,
            }}
          >
            {/* Section label */}
            <span
              style={{
                fontFamily: DARK.font,
                fontSize: "7px",
                color: DARK.textMid,
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Band {selectedBandIdx + 1} Parameters
            </span>

            {/* Filter type selector container */}
            <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.sm}px` }}>
              <span
                style={{
                  fontFamily: DARK.font,
                  fontSize: "7px",
                  color: DARK.accentMaster,
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Filter Type
              </span>
              <select
                value={activeBand.type}
                onChange={(e) => {
                  const type = e.target.value as any;
                  const hasGain = !["lowcut", "highcut", "notch", "bandpass"].includes(type);
                  updateInsertEQBand(insertIndex, slotIndex, selectedBandIdx, {
                    type,
                    gain: hasGain ? activeBand.gain : 0,
                  });
                  setBandsState([...eqInstance.bands]);
                }}
                style={{
                  height: "18px",
                  backgroundColor: DARK.bg0,
                  color: DARK.lcdText,
                  fontFamily: DARK.font,
                  fontSize: "8px",
                  textTransform: "uppercase",
                  padding: `0 ${SPACE.sm}px`,
                  outline: "none",
                  border: "none",
                  borderRadius: 0,
                  cursor: "pointer",
                  boxSizing: "border-box",
                  ...sunken(DARK),
                }}
              >
                <option value="lowcut">LOW CUT (HIGHPASS)</option>
                <option value="lowshelf">LOW SHELF</option>
                <option value="peaking">PEAK (BELL)</option>
                <option value="highshelf">HIGH SHELF</option>
                <option value="highcut">HIGH CUT (LOWPASS)</option>
                <option value="notch">NOTCH</option>
                <option value="bandpass">BAND PASS</option>
              </select>
            </div>
          </div>

          {/* Knobs side-by-side */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-around",
              alignItems: "center",
              flex: 1,
            }}
          >
            <EQKnob
              label="FREQUENCY"
              value={activeBand.frequency}
              min={20}
              max={20000}
              defaultValue={DEFAULT_BAND_PARAMS[selectedBandIdx].frequency}
              dotColor={DARK.accentBlue}
              formatValue={(val) => `${Math.round(val)} HZ`}
              onChange={(val) => {
                updateInsertEQBand(insertIndex, slotIndex, selectedBandIdx, { frequency: val });
                setBandsState([...eqInstance.bands]);
              }}
            />

            <EQKnob
              label="GAIN"
              value={activeBand.gain}
              min={-18}
              max={18}
              defaultValue={DEFAULT_BAND_PARAMS[selectedBandIdx].gain}
              disabled={isGainDisabled}
              dotColor={DARK.accentMaster}
              formatValue={(val) => {
                if (isGainDisabled) return "0.0 DB";
                return `${val > 0 ? "+" : ""}${val.toFixed(1)} DB`;
              }}
              onChange={(val) => {
                updateInsertEQBand(insertIndex, slotIndex, selectedBandIdx, { gain: val });
                setBandsState([...eqInstance.bands]);
              }}
            />

            <EQKnob
              label="BAND Q"
              value={activeBand.q}
              min={0.1}
              max={15.0}
              defaultValue={DEFAULT_BAND_PARAMS[selectedBandIdx].q}
              dotColor={DARK.accentGreen}
              formatValue={(val) => val.toFixed(2)}
              onChange={(val) => {
                updateInsertEQBand(insertIndex, slotIndex, selectedBandIdx, { q: val });
                setBandsState([...eqInstance.bands]);
              }}
            />
          </div>
        </div>

      </div>

    </div>
  );
}
